import { Runtime, Tabs } from "webextension-polyfill";
import { clusterLibraryArticles } from "../common/api";
import { extensionSupportsUrl } from "../common/articleDetection";
import { handleReportBrokenPage } from "../common/bugReport";
import {
    collectAnonymousMetricsFeatureFlag,
    getFeatureFlag,
    isDevelopmentFeatureFlag,
    setFeatureFlag,
} from "../common/featureFlags";
import browser from "../common/polyfill";
import { getLibraryUser, setLibraryUser } from "../common/storage";
import { saveInitialInstallVersionIfMissing } from "../overlay/outline/updateMessages";
import { migrateAnnotationStorage } from "../sidebar/common/local";
import { fetchCss } from "./actions";
import { loadAnnotationCountsToMemory } from "./annotationCounts";
import { getAllBookmarks, requestBookmarksPermission } from "./bookmarks";
import { enableInTab, injectScript, togglePageViewMessage } from "./inject";
import { onNewInstall, requestOptionalPermissions } from "./install";
import {
    getRemoteFeatureFlags,
    reportDisablePageView,
    reportEnablePageView,
    reportEvent,
    reportSettings,
    startMetrics,
} from "./metrics";
import { TabStateManager } from "./tabs";

const tabsManager = new TabStateManager();

// toggle page view on extension icon click
browser.action.onClicked.addListener((tab: Tabs.Tab) => {
    const url = new URL(tab.url);

    if (!extensionSupportsUrl(url)) {
        // ideally show some error message here
        return;
    }

    // Support importing browser bookmarks into the extension companion website (which allows the user to organize & easily open articles with the extension).
    // This code only runs if the user explicitly triggered it: they selected the browser import on the companion website, clicked the extension icon as stated in the instructions, then granted the optional bookmarks permission.
    // lindylearn.io is the official publisher domain for this browser extension.
    if (url.href === "http://localhost:3000/import?provider=bookmarks") {
        requestBookmarksPermission().then(async (granted: boolean) => {
            const libraryUser = await getLibraryUser();

            if (granted && libraryUser) {
                console.log("Starting bookmarks library import");
                const bookmarks = await getAllBookmarks();
                clusterLibraryArticles(bookmarks, libraryUser);
            }
        });

        return;
    }

    enableInTab(tab.id).then((didEnable) => {
        if (!didEnable) {
            // already active, so disable
            togglePageViewMessage(tab.id);
            return;
        }

        tabsManager.checkIsArticle(tab.id, tab.url);
        if (didEnable) {
            tabsManager
                .getSocialAnnotationsCount(tab.id, tab.url)
                .then((socialCommentsCount) =>
                    reportEnablePageView("manual", socialCommentsCount)
                );
        }
    });

    // can only request permissions from user action, use this opportunity
    // can't make callback a promise for this to work
    requestOptionalPermissions();
});

// handle events from content scripts
browser.runtime.onMessage.addListener(
    (message: any, sender: Runtime.MessageSender, sendResponse: () => void) => {
        // console.log(`Received '${message.event}' message:`, message);

        if (message.event === "disabledPageView") {
            reportDisablePageView(message.trigger, message.pageHeightPx);
        } else if (message.event === "requestEnhance") {
            // event sent from boot.js to inject additional functionality
            // browser apis are only available in scripts injected from background scripts or manifest.json
            console.log("boot.js requested injection into tab");
            injectScript(sender.tab.id, "content-script/enhance.js");

            tabsManager
                .getSocialAnnotationsCount(sender.tab.id, sender.url)
                .then((socialCommentsCount) =>
                    reportEnablePageView(message.trigger, socialCommentsCount)
                );
        } else if (message.event === "openOptionsPage") {
            browser.runtime.openOptionsPage();
        } else if (message.event === "fetchCss") {
            fetchCss(message.url).then(sendResponse);
            return true;
        } else if (message.event === "reportEvent") {
            reportEvent(message.name, message.data);
        } else if (message.event === "getRemoteFeatureFlags") {
            getRemoteFeatureFlags().then(sendResponse);
            return true;
        } else if (message.event === "checkLocalAnnotationCount") {
            // trigger from boot.js because we don't have tabs permissions
            tabsManager
                .checkIsArticle(sender.tab.id, sender.url)
                .then(sendResponse);
            return true;
        } else if (message.event === "getSocialAnnotationsCount") {
            tabsManager
                .getSocialAnnotationsCount(sender.tab.id, sender.url)
                .then(sendResponse);
            return true;
        } else if (message.event === "setSocialAnnotationsCount") {
            tabsManager.setSocialAnnotationsCount(sender.tab.id, message.count);
        } else if (message.event === "reportBrokenPage") {
            handleReportBrokenPage(message.data);
        } else if (message.event === "openLinkWithUnclutter") {
            browser.tabs.create({ url: message.url, active: true }, (tab) => {
                // need to wait until loaded, as have no permissions on new tab page
                setTimeout(() => {
                    injectScript(tab.id, "content-script/enhance.js");
                }, 1000);
            });
        } else if (message.event === "setLibraryLogin") {
            setLibraryUser(message.userId);
        } else if (message.event === "openLibrary") {
            let urlToOpen = `https://library.lindylearn.io/`;
            if (message.topicId !== undefined) {
                urlToOpen = `https://library.lindylearn.io/topics/${message.topicId}`;
            }

            browser.tabs.create({
                url: urlToOpen,
                active: true,
            });
        }

        return false;
    }
);

// run on install, extension update, or browser update
browser.runtime.onInstalled.addListener(async ({ reason }) => {
    const extensionInfo = await browser.management.getSelf();
    const isNewInstall = reason === "install";
    const isDev = extensionInfo.installType === "development";

    if (isDev) {
        // disable metrics in dev mode
        await setFeatureFlag(collectAnonymousMetricsFeatureFlag, false);
        await setFeatureFlag(isDevelopmentFeatureFlag, true);
    }

    // report aggregates on enabled extension features
    // this function should be executed every few days
    reportSettings(extensionInfo.version, isNewInstall);

    if (isNewInstall && !isDev) {
        onNewInstall(extensionInfo.version);
    }

    saveInitialInstallVersionIfMissing(extensionInfo.version);
    await migrateAnnotationStorage();

    // show opt shortcut icon on mac
    browser.runtime.getPlatformInfo().then(({ os }) =>
        browser.action.setTitle({
            title: "Unclutter Current Article (⌥+C)",
        })
    );
});

// track tab changes to update extension icon badge
browser.tabs.onActivated.addListener((info: Tabs.OnActivatedActiveInfoType) =>
    tabsManager.onChangeActiveTab(info.tabId)
);
browser.tabs.onUpdated.addListener(
    (tabId: number, change: Tabs.OnUpdatedChangeInfoType) => {
        if (change.url) {
            // clear state for old url, checkLocalAnnotationCount will be sent for likely articles again
            tabsManager.onCloseTab(tabId);
        }
    }
);
browser.tabs.onRemoved.addListener((tabId: number) =>
    tabsManager.onCloseTab(tabId)
);

// initialize on every service worker start
async function initializeServiceWorker() {
    const isDev = await getFeatureFlag(isDevelopmentFeatureFlag);
    startMetrics(isDev);

    if (!isDev) {
        // avoid during frequent reloads
        loadAnnotationCountsToMemory();
    }
}
initializeServiceWorker();
