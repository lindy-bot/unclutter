import { LindyAnnotation } from "../../common/annotations/create";
import {
    allowlistDomainOnManualActivationFeatureFlag,
    enableAnnotationsFeatureFlag,
    enableSocialCommentsFeatureFlag,
    getFeatureFlag,
} from "../../common/featureFlags";
import browser, { BrowserType, getBrowserType } from "../../common/polyfill";
import { LibraryState } from "../../common/schema";
import { createStylesheetLink, overrideClassname } from "../../common/stylesheets";
import { backgroundColorThemeVariable } from "../../common/theme";
import { getElementYOffset } from "../../overlay/outline/components/common";
import {
    createRootItem,
    getHeadingItems,
    getOutline,
    OutlineItem,
} from "../../overlay/outline/components/parse";
import TopLeftContainer from "../../overlay/outline/TopLeftContainer.svelte";
import PageAdjacentContainerSvelte from "../../overlay/ui/PageAdjacentContainer.svelte";
import TopRightContainerSvelte from "../../overlay/ui/TopRightContainer.svelte";
import AnnotationsModifier from "./annotations/annotationsModifier";
import ThemeModifier from "./CSSOM/theme";
import TextContainerModifier from "./DOM/textContainer";
import ElementPickerModifier from "./elementPicker";
import LibraryModalModifier from "./libraryModal";
import { PageModifier, trackModifierExecution } from "./_interface";
import ReadingTimeModifier from "./DOM/readingTime";
import { setUserSettingsForDomain } from "../../common/storage";
import LibraryModifier from "./library";
import BodyStyleModifier from "./bodyStyle";
import SmartHighlightsProxy from "./DOM/smartHighlightsProxy";
import type { Annotation } from "@unclutter/library-components/dist/store";

@trackModifierExecution
export default class OverlayManager implements PageModifier {
    private domain: string;
    private browserType: BrowserType;
    private themeModifier: ThemeModifier;
    private annotationsModifer: AnnotationsModifier;
    private textContainerModifier: TextContainerModifier;
    private elementPickerModifier: ElementPickerModifier;
    private libraryModifier: LibraryModifier;
    private libraryModalModifier: LibraryModalModifier;
    private bodyStyleModifier: BodyStyleModifier;
    private smartHighlightsProxy: SmartHighlightsProxy;

    outline: OutlineItem[];
    private flatOutline: OutlineItem[];
    private topleftSvelteComponent: TopLeftContainer;
    private toprightSvelteComponent: TopRightContainerSvelte;
    private pageAdjacentSvelteComponent: PageAdjacentContainerSvelte;

    private annotationsEnabled: boolean;

    constructor(
        domain: string,
        themeModifier: ThemeModifier,
        annotationsModifer: AnnotationsModifier,
        textContainerModifier: TextContainerModifier,
        elementPickerModifier: ElementPickerModifier,
        libraryModifier: LibraryModifier,
        libraryModalModifier: LibraryModalModifier,
        readingTimeModifier: ReadingTimeModifier,
        bodyStyleModifier: BodyStyleModifier,
        smartHighlightsProxy: SmartHighlightsProxy
    ) {
        this.domain = domain;
        this.browserType = getBrowserType();
        this.themeModifier = themeModifier;
        this.annotationsModifer = annotationsModifer;
        this.textContainerModifier = textContainerModifier;
        this.elementPickerModifier = elementPickerModifier;
        this.libraryModifier = libraryModifier;
        this.libraryModalModifier = libraryModalModifier;
        this.bodyStyleModifier = bodyStyleModifier;
        this.smartHighlightsProxy = smartHighlightsProxy;

        annotationsModifer.annotationListeners.push(this.onAnnotationUpdate.bind(this));
        readingTimeModifier.readingTimeLeftListeners.push(this.onReadingTimeUpdate.bind(this));
        libraryModifier.libraryStateListeners.push(this.updateLibraryState.bind(this));

        // fetch users settings to run code synchronously later
        (async () => {
            this.annotationsEnabled = await getFeatureFlag(enableAnnotationsFeatureFlag);
        })();

        window.addEventListener("message", (event) => this.onMessage(event.data || {}));
    }

    private onMessage(message: any) {
        if (message.event === "updateRelatedCount") {
            this.onRelatedCountUpdate(message.relatedCount);
        }
    }

    private topleftIframe: HTMLIFrameElement;
    createIframes() {
        this.topleftIframe = createIframeNode("lindy-info-topleft");
        this.topleftIframe.style.setProperty("position", "fixed", "important"); // put on new layer
        this.topleftIframe.style.setProperty(
            "max-width",
            "calc((100vw - var(--lindy-pagewidth)) / 2 - 7px)",
            "important"
        ); // prevent initial transition
        document.documentElement.appendChild(this.topleftIframe);
        insertIframeFont(this.topleftIframe);
    }

    renderUi() {
        // insert styles and font definition
        createStylesheetLink(browser.runtime.getURL("overlay/index.css"), "lindy-switch-style");

        this.renderTopLeftContainer();
        this.renderUiContainers();
    }

    setEnableAnnotations(enableAnnotations: boolean) {
        this.topleftSvelteComponent?.$set({
            annotationsEnabled: enableAnnotations,
        });
    }

    parseOutline() {
        const headingItems = getHeadingItems(); // List raw DOM nodes and filter to likely headings
        this.outline = getOutline(headingItems);
        if (this.outline.length <= 3) {
            // Use just article title, as outline likely not useful or invalid
            // taking the first outline entry sometimes doesn't work, e.g. on https://newrepublic.com/maz/article/167263/amazons-global-quest-crush-unions
            this.outline = [createRootItem(headingItems)];
        }

        function flatten(item: OutlineItem): OutlineItem[] {
            return [item].concat(item.children.flatMap(flatten));
        }
        this.flatOutline = this.outline.flatMap(flatten);

        // Remove outline nesting if too large
        if (this.flatOutline.length > 15) {
            this.outline.forEach((_, i) => {
                this.outline[i].children = [];
            });
            this.flatOutline = this.outline;
        }
        if (this.flatOutline.length > 15) {
            this.outline = [this.outline[0]];
            this.flatOutline = [this.outline[0]];
        }

        this.listenToOutlineScroll();
    }

    async renderTopLeftContainer() {
        if (this.browserType === "firefox") {
            // wait until iframe rendered
            // TODO attach listener instead of static wait?
            await new Promise((r) => setTimeout(r, 10));
        }

        // set background color immediately
        this.topleftIframe.contentDocument.body.style.setProperty(
            backgroundColorThemeVariable,
            this.themeModifier.backgroundColor
        );

        // render DOM elements into iframe to simplify message passing
        this.topleftSvelteComponent = new TopLeftContainer({
            target: this.topleftIframe.contentDocument.body,
            props: {
                outline: this.outline, // null at first
                activeOutlineIndex: this.outline?.[0].index,
                annotationsEnabled: this.annotationsEnabled,
                readingTimeLeft: this.readingTimeLeft,
                libraryState: this.libraryModifier.libraryState,
                darkModeEnabled: this.darkModeEnabled,
                libraryModifier: this.libraryModifier,
                libraryModalModifier: this.libraryModalModifier,
            },
        });
    }

    renderUiContainers() {
        // render UI into main page to prevent overlaps with sidebar iframe

        // create DOM container nodes
        const topRightContainer = this.createUiContainer("lindy-page-settings-toprght");
        // const pageAdjacentContainer = this.createUiContainer("lindy-page-settings-pageadjacent");

        // render svelte component
        this.toprightSvelteComponent = new TopRightContainerSvelte({
            target: topRightContainer.attachShadow({ mode: "open" }),
            props: {
                domain: this.domain,
                themeModifier: this.themeModifier,
                annotationsModifer: this.annotationsModifer,
                smartHighlightsProxy: this.smartHighlightsProxy,
                overlayModifier: this,
                elementPickerModifier: this.elementPickerModifier,
            },
        });
        // this.pageAdjacentSvelteComponent = new PageAdjacentContainerSvelte({
        //     target: pageAdjacentContainer,
        //     props: {
        //         domain: this.domain,
        //     },
        // });

        // insert rendered nodes into document
        document.documentElement.appendChild(topRightContainer);
        // document.documentElement.appendChild(pageAdjacentContainer);

        // handle automatic activation here since pageAdjacentContainer disabled
        getFeatureFlag(allowlistDomainOnManualActivationFeatureFlag).then(
            (allowlistOnActivation) => {
                if (allowlistOnActivation) {
                    setUserSettingsForDomain(this.domain, "allow");
                }
            }
        );
    }

    // insert font into main HTML doc
    insertUiFont() {
        const fontLink = document.createElement("link");
        fontLink.rel = "stylesheet";
        fontLink.href = browser.runtime.getURL("assets/fonts/fontface.css");
        document.head.appendChild(fontLink);
    }

    private createUiContainer(id: string) {
        // create container DOM element
        const container = document.createElement("div");
        container.id = id;
        container.className = `${overrideClassname} lindy-overlay-elem ${id}`;
        container.style.contain = "layout style";
        container.style.visibility = "hidden"; // hide until overlay/index.css applied (so don't set importance)
        container.style.willChange = "opacity";

        return container;
    }

    private uninstallScrollListener: () => void;
    private listenToOutlineScroll() {
        // listen to scroll changes, compare to last header
        let currentOutlineIndex = 0;
        let lowTheshold: number;
        let highTheshold: number;

        const updateTresholds = () => {
            const margin = 20; // a bit more than the auto scroll margin
            lowTheshold = getElementYOffset(this.flatOutline[currentOutlineIndex].element, margin);
            if (currentOutlineIndex + 1 < this.flatOutline.length) {
                highTheshold = getElementYOffset(
                    this.flatOutline[currentOutlineIndex + 1].element,
                    margin
                );
            } else {
                highTheshold = Infinity;
            }
        };
        updateTresholds();

        const handleScroll = (skipRender = false) => {
            if (window.scrollY === 0) {
                // start of document
                currentOutlineIndex = 0;
                updateTresholds();
            } else if (
                window.scrollY + window.innerHeight >=
                document.documentElement.scrollHeight - 20
            ) {
                // end of document
                currentOutlineIndex = this.flatOutline.length - 1;
                updateTresholds();
            } else if (currentOutlineIndex > 0 && window.scrollY < lowTheshold) {
                // scrolled up
                currentOutlineIndex -= 1;
                updateTresholds();

                // check if jumped multiple sections
                handleScroll(true);
            } else if (window.scrollY >= highTheshold) {
                // scrolled down
                currentOutlineIndex += 1;
                updateTresholds();

                // check if jumped multiple sections
                handleScroll(true);
            }

            if (!skipRender) {
                const currentHeading = this.flatOutline[currentOutlineIndex];
                this.topleftSvelteComponent?.$set({
                    activeOutlineIndex: currentHeading.index,
                });
            }
        };

        const scrollListener = () => handleScroll();
        document.addEventListener("scroll", scrollListener);
        this.uninstallScrollListener = () => document.removeEventListener("scroll", scrollListener);
    }

    fadeOutUi() {
        document
            .querySelectorAll(
                "#lindy-page-settings-toprght, #lindy-page-settings-pageadjacent, #lindy-info-topleft"
            )
            .forEach((e) => e.classList.add("lindy-ui-fadeout"));

        if (this.uninstallScrollListener) {
            this.uninstallScrollListener();
        }
    }

    removeUi() {
        document
            .querySelectorAll(
                "#lindy-page-settings-toprght, #lindy-page-settings-pageadjacent, #lindy-info-topleft"
            )
            .forEach((e) => e.remove());
    }

    // listen to annotation updates and attribute to outline heading
    private async onAnnotationUpdate(
        action: "set" | "add" | "remove" | "update",
        annotations: Annotation[]
    ) {
        if (!this.flatOutline || this.flatOutline.length === 0) {
            return;
        }

        // reset state
        if (action === "set") {
            this.flatOutline.map((_, index) => {
                this.flatOutline[index].annotations = [];
                this.flatOutline[index].socialCommentsCount = 0;
            });
        }

        annotations.map((annotation) => {
            const outlineIndex = this.getOutlineIndexForAnnotation(annotation);
            const heading = this.flatOutline[outlineIndex];
            if (!heading) {
                return;
            }

            if (action === "set" || action === "add" || action === "update") {
                const existingIndex = heading.annotations.findIndex((a) => a.id === annotation.id);
                if (existingIndex !== -1) {
                    heading.annotations[existingIndex] = annotation;
                } else {
                    heading.annotations.push(annotation);
                }
            } else if (action === "remove") {
                heading.annotations = heading.annotations.filter((a) => a.id !== annotation.id);
            }
        });

        this.topleftSvelteComponent?.$set({
            outline: this.flatOutline,
        });
    }

    private cachedAnnotationOutlineIndex: { [annotationId: string]: number } = {};
    private getOutlineIndexForAnnotation(annotation: Annotation): number {
        if (!this.flatOutline) {
            return null;
        }
        if (this.cachedAnnotationOutlineIndex[annotation.id] !== undefined) {
            return this.cachedAnnotationOutlineIndex[annotation.id];
        }

        const annotationNode = document.getElementById(annotation.id);
        if (!annotationNode) {
            return;
        }
        const annotationOffset = getElementYOffset(annotationNode);

        let lastIndex: number = 0;
        while (lastIndex + 1 < this.flatOutline.length) {
            const item = this.flatOutline[lastIndex + 1];
            const startOffset = getElementYOffset(item.element);
            if (annotationOffset < startOffset) {
                break;
            }

            lastIndex += 1;
        }

        this.cachedAnnotationOutlineIndex[annotation.id] = lastIndex;
        return lastIndex;
    }

    disableSocialAnnotations() {
        this.flatOutline.map((_, index) => {
            this.flatOutline[index].socialCommentsCount = 0;
        });
        this.topleftSvelteComponent?.$set({
            // totalAnnotationCount: this.totalAnnotationCount,
            outline: this.outline,
        });
    }

    onRelatedCountUpdate(relatedCount: number) {
        this.topleftSvelteComponent?.$set({
            totalRelatedCount: relatedCount,
        });
    }

    private maxPageProgress = 0;
    private readingTimeLeft: number = null;
    onReadingTimeUpdate(pageProgress: number, readingTimeLeft: number) {
        this.readingTimeLeft = readingTimeLeft;
        this.topleftSvelteComponent?.$set({
            readingTimeLeft,
        });

        this.maxPageProgress = Math.max(this.maxPageProgress, pageProgress);
    }

    updateLibraryState(libraryState: LibraryState) {
        this.topleftSvelteComponent?.$set({
            libraryState,
        });

        this.libraryModalModifier.updateLibraryState(libraryState);
    }

    private darkModeEnabled: boolean = null;
    async setOverlayDarkMode(darkModeEnabled: boolean) {
        this.darkModeEnabled = darkModeEnabled;

        if (darkModeEnabled) {
            createStylesheetLink(
                browser.runtime.getURL("overlay/indexDark.css"),
                "dark-mode-ui-style"
            );
            createStylesheetLink(
                browser.runtime.getURL("overlay/outline/outlineDark.css"),
                "dark-mode-ui-style",
                this.topleftIframe.contentDocument?.head.lastChild as HTMLElement,
                this.topleftIframe.contentDocument
            );
        } else {
            document.querySelectorAll(".dark-mode-ui-style").forEach((e) => e.remove());
            this.topleftIframe.contentDocument?.head
                ?.querySelectorAll(".dark-mode-ui-style")
                .forEach((e) => e.remove());
        }

        this.topleftSvelteComponent?.$set({
            darkModeEnabled: this.darkModeEnabled,
        });
        this.toprightSvelteComponent?.$set({ darkModeEnabled });
        this.libraryModalModifier.setDarkMode(darkModeEnabled);
    }
}

export function createIframeNode(id: string) {
    const iframe = document.createElement("iframe");
    iframe.classList.add("lindy-overlay-elem");
    iframe.id = id;

    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("frameBorder", "0");
    iframe.style.setProperty("contain", "strict", "important");
    iframe.style.setProperty("z-index", "3000", "important");

    return iframe;
}

export function insertIframeFont(iframe: HTMLIFrameElement) {
    if (getBrowserType() === "firefox") {
        // Firefox bug: need to wait until iframe initial render to insert elements
        // See https://stackoverflow.com/questions/60814167/firefox-deleted-innerhtml-of-generated-iframe
        setTimeout(() => {
            insertIframeFontUnsafe(iframe);
        }, 10);
    } else {
        insertIframeFontUnsafe(iframe);
    }
}

function insertIframeFontUnsafe(iframe: HTMLIFrameElement) {
    if (!iframe.contentDocument) {
        return;
    }

    const fontLink = iframe.contentDocument.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = browser.runtime.getURL("assets/fonts/fontface.css");
    iframe.contentDocument.head.appendChild(fontLink);
}
