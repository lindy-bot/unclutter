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
        const activeHtmlStyles = window.getComputedStyle(
            document.documentElement
        );
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
        this.styleObserver = new MutationObserver((mutations, observer) => {
            this.modifyHtmlStyle();
        });
        this.styleObserver.observe(document.documentElement, {
            attributeFilter: ["style"],
        });

        // watch for screen size changes
        const mediaQueryList = window.matchMedia("(max-width: 1200px)");
        const matchMediaListener = ({ matches }) => {
            this.applyResponsiveStyle(matches);
        };
        matchMediaListener(mediaQueryList);

        mediaQueryList.addEventListener("change", matchMediaListener);
        this.removeResponsiveStyleListener = () =>
            mediaQueryList.removeEventListener("change", matchMediaListener);
    }

    transitionOut() {
        this.styleObserver.disconnect();
        this.removeResponsiveStyleListener();

        // can't reference the variables here for some reason
        document.body.classList.remove("lindy-container");
    }

    afterTransitionOut() {
        document.body.style.removeProperty("width");
        document.body.style.removeProperty("max-width");
        document.body.style.removeProperty("margin");
        document.body.style.removeProperty("padding");
        document.body.style.removeProperty("display");
        document.body.style.removeProperty("min-width");
        document.body.style.removeProperty("height");
        document.body.style.removeProperty("background");
        document.body.style.removeProperty("transition");
    }

    private modifyHtmlStyle() {
        // html or body tags may have classes with fixed style applied (which we hide via css rewrite)
        document.documentElement.style.setProperty(
            "display",
            "block",
            "important"
        );

        // set inline styles to overwrite scroll-locks
        document.documentElement.style.setProperty(
            "position",
            "relative",
            "important"
        );
        document.documentElement.style.setProperty(
            "overflow-y",
            "scroll",
            "important"
        );
        document.documentElement.style.setProperty(
            "height",
            "auto",
            "important"
        );
        document.documentElement.style.setProperty(
            "max-width",
            "none",
            "important"
        );
        document.documentElement.style.setProperty("margin", "0", "important");
        document.documentElement.style.setProperty("padding", "0", "important");
    }

    private modifyBodyStyle() {
        // add miniscule top padding if not already present, to prevent top margin collapse
        // note that body margin is rewritten into padding in cssTweaks.ts
        // if (["", "0px"].includes(this.bodyStyleProperties.paddingTop)) {
        //     document.body.style.paddingTop = "0.05px";
        // }

        document.body.style.setProperty("padding", "30px 50px", "important");
        document.body.style.setProperty("min-width", "0", "important");
        document.body.style.setProperty(
            "max-width",
            "var(--lindy-pagewidth)",
            "important"
        );
        document.body.style.setProperty("display", "block", "important");
        document.body.style.setProperty("height", "auto", "important");
        document.body.style.setProperty("overflow", "hidden", "important");
        document.body.style.setProperty(
            "box-shadow",
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            "important"
        );
        document.body.style.setProperty(
            "transition",
            "all 0.4s cubic-bezier(0.33, 1, 0.68, 1)",
            "important"
        );
    }

    private applyResponsiveStyle(isMobile: boolean) {
        if (isMobile) {
            document.body.style.setProperty(
                "margin",
                "10px auto 40px 20px",
                "important"
            );
        } else {
            document.body.style.setProperty(
                "margin",
                "10px auto 40px auto",
                "important"
            );
        }
    }
}
