import { PageModifier, trackModifierExecution } from "./_interface";

// Perform various inline style fixes to overwrite site styles
@trackModifierExecution
export default class BodyStyleModifier implements PageModifier {
    private styleObserver: MutationObserver;
    private removeResponsiveStyleListener: () => void;

    originalBackgroundColor: string;
    private bodyStyleProperties: any;

    constructor() {}

    prepare() {
        // save before modifications state
        const activeHtmlStyles = window.getComputedStyle(document.documentElement);
        const activeBodyStyles = window.getComputedStyle(document.body);

        if (activeHtmlStyles.backgroundColor !== "rgba(0, 0, 0, 0)") {
            this.originalBackgroundColor = activeHtmlStyles.backgroundColor;
        } else if (activeBodyStyles.backgroundColor !== "rgba(0, 0, 0, 0)") {
            this.originalBackgroundColor = activeBodyStyles.backgroundColor;
        }

        this.bodyStyleProperties = {};
    }

    transitionIn() {
        this.modifyBodyStyle();
        this.modifyHtmlStyle();

        // re-run on <html> inline style changes (e.g. scroll-locks)
        this.observeStyleChanges();

        // watch for screen size changes
        const responsiveQuery = window.matchMedia("(max-width: 1200px)");
        const responsiveQueryListener = ({ matches }) => {
            this.applyResponsiveStyle(matches);
        };
        responsiveQueryListener(responsiveQuery);
        responsiveQuery.addEventListener("change", responsiveQueryListener);

        this.removeResponsiveStyleListener = () => {
            responsiveQuery.removeEventListener("change", responsiveQueryListener);
        };
    }

    // set styles after pageview animation done
    afterTransitionIn() {
        // need overflow during fade-in to animate page elements
        document.body.style.setProperty("overflow", "hidden", "important");
        document.body.style.setProperty(
            "box-shadow",
            "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
            "important"
        );

        // delay background transition slightly to render style tweaks first
        document.documentElement.style.setProperty(
            "transition",
            "background 0.3s ease-in-out 0.1s",
            "important"
        );
        document.body.style.setProperty(
            "transition",
            "max-width 0.2s cubic-bezier(0.33, 1, 0.68, 1), background 0.3s ease-in-out 0.1s",
            "important"
        );
    }

    // prepare reverse pageview animation (undo afterTransitionIn())
    beforeTransitionOut() {
        document.body.style.setProperty("overflow", "visible", "important");
        document.body.style.removeProperty("box-shadow");
    }

    transitionOut() {
        this.unObserveStyleChanges();
        this.removeResponsiveStyleListener();

        // can't reference the classname variables here for some reason
        document.body.classList.remove("lindy-container");

        document.body.style.removeProperty("width");
        document.body.style.removeProperty("max-width");
        document.body.style.removeProperty("margin");
        document.body.style.removeProperty("padding");
        document.body.style.removeProperty("display");
        document.body.style.removeProperty("min-width");
        document.body.style.removeProperty("height");
        document.body.style.removeProperty("background");
        document.body.style.removeProperty("transition");
        document.body.style.removeProperty("overflow");
    }

    private styleChangesCount = 0;
    private observeStyleChanges(skipScrollChanges: boolean = false) {
        this.styleObserver = new MutationObserver((mutations, observer) => {
            // avoid infinite loops if there's another observer
            if (this.styleChangesCount > 10) {
                this.styleObserver.disconnect();
                return;
            }
            this.styleChangesCount += 1;

            this.modifyHtmlStyle(skipScrollChanges);
        });
        this.styleObserver.observe(document.documentElement, {
            attributeFilter: ["style"],
        });
    }
    private unObserveStyleChanges() {
        this.styleObserver?.disconnect();
        this.styleObserver = null;
    }

    private bottomPadding = "20px";
    private modifyHtmlStyle(skipScrollChanges: boolean = false) {
        // html or body tags may have classes with fixed style applied (which we hide via css rewrite)
        document.documentElement.style.setProperty("display", "block", "important");

        // set inline styles to overwrite scroll-locks
        if (!skipScrollChanges) {
            document.documentElement.style.setProperty("position", "relative", "important");
        }
        document.documentElement.style.setProperty("overflow-y", "scroll", "important");
        document.documentElement.style.setProperty("width", "100%", "important");
        document.documentElement.style.setProperty("height", "auto", "important");
        document.documentElement.style.setProperty("left", "0", "important");
        document.documentElement.style.setProperty("right", "0", "important");
        document.documentElement.style.setProperty("max-width", "none", "important");
        document.documentElement.style.setProperty("margin", "0", "important");
        document.documentElement.style.setProperty(
            "padding",
            `0 0 ${this.bottomPadding} 0`,
            "important"
        );
    }

    private modifyBodyStyle() {
        // add miniscule top padding if not already present, to prevent top margin collapse
        // note that body margin is rewritten into padding in cssTweaks.ts
        // if (["", "0px"].includes(this.bodyStyleProperties.paddingTop)) {
        //     document.body.style.paddingTop = "0.05px";
        // }

        document.body.style.setProperty("padding", "30px 50px", "important");
        document.body.style.setProperty("min-width", "0", "important");
        document.body.style.setProperty("max-width", "var(--lindy-pagewidth)", "important");
        document.body.style.setProperty("max-height", "none", "important");
        document.body.style.setProperty("display", "block", "important");
        document.body.style.setProperty("height", "auto", "important");

        document.body.style.setProperty("overflow", "visible", "important");
    }

    private applyResponsiveStyle(isMobile: boolean) {
        let marginSide = "auto";
        if (isMobile) {
            marginSide = "10px";
        }

        document.body.style.setProperty("margin", `8px ${marginSide} 0 ${marginSide}`, "important");
    }

    scrollLockEnabled: boolean;
    private scrollLockPrevPos = 0;
    enableScrollLock() {
        this.scrollLockEnabled = true;
        this.unObserveStyleChanges();

        this.scrollLockPrevPos = window.scrollY;
        document.documentElement.style.setProperty(
            "top",
            `-${this.scrollLockPrevPos}px`,
            "important"
        );
        document.documentElement.style.setProperty("position", "fixed", "important");

        this.observeStyleChanges(true);
    }

    disableScrollLock() {
        this.unObserveStyleChanges();

        document.documentElement.style.setProperty("position", "relative", "important");
        document.documentElement.style.setProperty("top", "0", "important");
        window.scrollTo(0, this.scrollLockPrevPos);

        this.observeStyleChanges(true);
        this.scrollLockEnabled = false;
    }

    setBottomContainerPadding(bottomPadding: string) {
        // set padding for BottomContainer on documentElement for resilience against overflows
        this.unObserveStyleChanges();

        this.bottomPadding = bottomPadding;
        document.documentElement.style.setProperty(
            "padding",
            `0 0 ${this.bottomPadding} 0`,
            "important"
        );

        this.observeStyleChanges(true);
    }
}
