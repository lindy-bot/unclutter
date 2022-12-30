import ky from "ky";
import { PageModifier, trackModifierExecution } from "../_interface";

export interface RankedSentence {
    score: number;
    sentence: string;
    related?: RelatedHighlight[];
}
export interface RelatedHighlight {
    score: number;
    score2: number;
    text: string;
    excerpt: string;
    title: string;
}

const excludedParagraphClassNames = [
    "comment", // https://civilservice.blog.gov.uk/2022/08/16/a-simple-guide-on-words-to-avoid-in-government/
    "reference", // https://en.wikipedia.org/wiki/Sunstone_(medieval)
];

@trackModifierExecution
export default class SmartHighlightsModifier implements PageModifier {
    private onHighlightClick: null | ((range: Range, related: RelatedHighlight[]) => void);

    articleSummary: string | null;
    keyPointsCount: number | null;
    relatedCount: number | null;
    topHighlights: RankedSentence[] | null;

    constructor(onHighlightClick: (range: Range, related: RelatedHighlight[]) => void = null) {
        this.onHighlightClick = onHighlightClick;
    }

    private paragraphs: HTMLElement[] = [];
    private rankedSentencesByParagraph: RankedSentence[][];
    async parseUnclutteredArticle() {
        const paragraphTexts: string[] = [];
        document.querySelectorAll("p, font, li").forEach((paragraph: HTMLElement) => {
            const textContent = paragraph.textContent;
            if (!textContent || textContent.length < 200) {
                return;
            }

            if (
                excludedParagraphClassNames.some((word) =>
                    paragraph.className.toLowerCase().includes(word)
                ) ||
                excludedParagraphClassNames.some((word) =>
                    paragraph.parentElement.className.toLowerCase().includes(word)
                )
            ) {
                return;
            }

            this.paragraphs.push(paragraph);
            paragraphTexts.push(textContent);
        });

        const response: any = await ky
            .post("https://q5ie5hjr3g.execute-api.us-east-2.amazonaws.com/default/heatmap", {
                json: {
                    title: document.title,
                    url: window.location.href,
                    paragraphs: paragraphTexts,
                },
                timeout: false,
            })
            .json();
        this.rankedSentencesByParagraph = response;
        // this.rankedSentencesByParagraph = response.rankings || null;
        // this.articleSummary = response.summary || null;
        // console.log(this.rankedSentencesByParagraph);

        this.keyPointsCount = 0;
        this.relatedCount = 0;
        this.topHighlights = [];
        this.rankedSentencesByParagraph?.forEach((paragraph) => {
            paragraph.forEach((sentence: RankedSentence) => {
                if (sentence.related && sentence.related?.[0]?.score2 > 0.5) {
                    this.relatedCount += 1;
                } else if (sentence.score >= 0.6) {
                    this.keyPointsCount += 1;

                    // this.topHighlights.push(sentence);
                }
            });
        });
        // this.topHighlights = this.topHighlights.sort((a, b) => b.score - a.score).slice(0, 3);

        this.enableAnnotations();
        // if (this.annotationsModifier?.sidebarIframe) {
        //     sendIframeEvent(this.annotationsModifier.sidebarIframe, {
        //         event: "setSummaryAnnotation",
        //         summaryAnnotation: createAnnotation(window.location.href, null, {
        //             id: generateId(),
        //             platform: "summary",
        //             text: this.articleSummary,
        //             displayOffset: 0,
        //             displayOffsetEnd: 0,
        //         }),
        //     });
        // }
    }

    private annotationState: {
        sentence: RankedSentence;
        container: HTMLElement;
        range: Range;
        paintedElements?: HTMLElement[];
        invalid?: boolean;
    }[] = [];
    enableAnnotations() {
        this.createContainers();

        this.paragraphs.forEach((paragraph, index) => {
            const rankedSentences = this.rankedSentencesByParagraph?.[index];
            if (!rankedSentences) {
                return;
            }

            const container = this.getParagraphAnchor(paragraph);

            // anchor all sentences returned from backend
            let ranges = this.anchorParagraphSentences(
                paragraph,
                rankedSentences.map((s) => s.sentence)
            );

            // construct global annotationState
            ranges.forEach((range, i) => {
                const sentence = rankedSentences[i];
                if (sentence.related) {
                    sentence.score = sentence.related[0].score2 + 0.1;
                }

                // filter considered sentences
                if (sentence.score < 0.6) {
                    return;
                }

                this.annotationState.push({
                    sentence,
                    container,
                    range,
                });
            });
        });

        // immediate first paint
        this.paintAllAnnotations();

        // paint again on position change
        let isInitialPaint = true;
        const resizeObserver = new ResizeObserver(() => {
            if (isInitialPaint) {
                isInitialPaint = false;
                return;
            }

            this.paintAllAnnotations();
        });
        this.annotationState.forEach(({ container }) => {
            resizeObserver.observe(container);
        });
    }

    private getParagraphAnchor(container: HTMLElement) {
        // get container to anchor highlight elements

        // need to be able to anchor absolute elements
        while (container.nodeType !== Node.ELEMENT_NODE) {
            container = container.parentElement;
        }

        // box is not correct for inline elements
        let containerStyle = window.getComputedStyle(container);
        while (containerStyle.display === "inline") {
            container = container.parentElement;
            containerStyle = window.getComputedStyle(container);
        }

        // be careful with style changes
        if (containerStyle.position === "static") {
            container.style.setProperty("position", "relative", "important");
        }
        container.style.setProperty("z-index", "0", "important");

        return container;
    }

    private paintAllAnnotations() {
        console.log(`Painting ${this.annotationState.length} smart annotations`);

        this.annotationState.forEach(({ invalid, sentence, container, range }, i) => {
            if (invalid) {
                return;
            }
            if (sentence.score < 0.6 && !this.enableAllSentences) {
                return;
            }

            const containerRect = container.getBoundingClientRect();
            this.annotationState[i].paintedElements?.forEach((e) => e.remove());

            let paintedElements = this.paintRange(container, containerRect, range, sentence);
            if (paintedElements.length === 0) {
                this.annotationState[i].invalid = true;
            } else {
                this.annotationState[i].paintedElements = paintedElements;
            }
        });
    }

    disableScrollbar() {
        this.scrollbarContainer?.remove();
        this.scrollbarContainer = null;
    }

    disableAnnotations() {
        this.disableScrollbar();
        this.annotationState.forEach(({ paintedElements }) => {
            paintedElements?.forEach((e) => e.remove());
        });
        this.annotationState = [];
    }

    setEnableAnnotations(enableAnnotations: boolean) {
        if (enableAnnotations) {
            this.enableAnnotations();
        } else {
            this.disableAnnotations();
        }
    }

    // create ranges for each sentence by iterating leaf children
    private anchorParagraphSentences(paragraph: HTMLElement, sentences: string[]): Range[] {
        const ranges: Range[] = [];

        let currentElem: HTMLElement = paragraph;
        let runningTextLength = 0;
        let currentRange = document.createRange();
        currentRange.setStart(currentElem, 0);

        // debug
        // if (!paragraph.textContent.includes("discounts")) {
        //     return [];
        // }
        // console.log(paragraph, sentences);

        while (ranges.length < sentences.length) {
            if (!currentElem) {
                break;
            }

            const currentSentence = sentences[ranges.length];
            let currentSentenceLength = currentSentence.length;
            const currentLength = currentElem.textContent.length;

            // assume trailing space removed in backend
            // TODO handle this better
            let hasTrailingSpace = false;
            if (ranges.length < sentences.length - 1) {
                hasTrailingSpace = true;
                currentSentenceLength += 1;
            }

            // console.log({ currentElem });

            if (runningTextLength + currentLength < currentSentenceLength) {
                // console.log("skip", runningTextLength, currentLength, currentSentenceLength);

                // not enough text, skip entire node subtree
                runningTextLength += currentLength;
                if (currentElem.nextSibling) {
                    // next sibling
                    currentElem = currentElem.nextSibling as HTMLElement;
                } else if (!paragraph.contains(currentElem.parentElement?.nextSibling)) {
                    // end of paragraph (likely count error)
                    // console.log("break");

                    if (currentElem.parentElement?.nextSibling) {
                        currentRange.setEndAfter(paragraph);
                    } else {
                        // parent may not be defined, e.g. on https://www.theatlantic.com/ideas/archive/2022/12/volodymyr-zelensky-visit-ukraine-united-states/672528/
                        // how to handle?
                    }

                    ranges.push(currentRange);
                    // console.log(currentRange.toString());
                    break;
                } else {
                    // next parent sibling
                    currentElem = currentElem.parentElement?.nextSibling as HTMLElement;
                }
            } else {
                if (currentElem.childNodes.length > 0) {
                    // iterate children
                    // console.log("iterate children");
                    currentElem = currentElem.childNodes[0] as HTMLElement;
                    continue;
                } else {
                    // slice text content
                    // console.log("slice", runningTextLength, currentLength, currentSentenceLength);

                    // sentence ends inside this node
                    const offset = currentSentenceLength - runningTextLength;
                    currentRange.setEnd(currentElem, offset - (hasTrailingSpace ? 1 : 0));
                    ranges.push(currentRange);
                    // console.log(currentRange.toString());

                    // start new range
                    currentRange = document.createRange();
                    currentRange.setStart(currentElem, offset);
                    runningTextLength = -offset; // handle in next iteration

                    // console.log("---");
                }
            }
        }

        return ranges;
    }

    private scrollbarContainer: HTMLElement;
    createContainers() {
        this.scrollbarContainer = document.createElement("div");
        this.scrollbarContainer.className = "smart-highlight-scrollbar";
        this.scrollbarContainer.style.setProperty("position", "relative", "important");
        this.scrollbarContainer.style.setProperty("z-index", "1001", "important");
        document.body.append(this.scrollbarContainer);
    }

    private styleObserver: MutationObserver;
    private styleChangesCount = 0;
    enableStyleTweaks() {
        this.patchScrollbarStyle();

        // site may override inline styles, e.g. https://www.fortressofdoors.com/ai-markets-for-lemons-and-the-great-logging-off/
        this.styleObserver = new MutationObserver(() => {
            // avoid infinite loops if there's another observer (e.g. in BodyStyleModifier)
            if (this.styleChangesCount > 10) {
                this.styleObserver.disconnect();
                return;
            }
            this.styleChangesCount += 1;

            this.patchScrollbarStyle();
        });
        this.styleObserver.observe(document.documentElement, {
            attributeFilter: ["style"],
        });
        this.styleObserver.observe(document.body, {
            attributeFilter: ["style"],
        });
    }

    private patchScrollbarStyle() {
        // put scrollbar on <body> to allow overlapping divs
        // only needed when called outside the reader mode
        console.log("Patching scrollbar style");

        document.documentElement.style.setProperty("overflow", "hidden", "important");

        document.body.style.setProperty("height", "100vh", "important");
        document.body.style.setProperty("max-height", "100vh", "important");
        document.body.style.setProperty("overflow", "auto", "important");

        const bodyStyle = window.getComputedStyle(document.body);
        if (bodyStyle.marginRight !== "0px") {
            // avoid space between scrollbar and window
            document.body.style.setProperty(
                "padding-right",
                `calc(${bodyStyle.paddingRight} + ${bodyStyle.marginRight})`,
                "important"
            );
            document.body.style.setProperty("margin-right", "0px", "important");
        }
        if (bodyStyle.position === "static") {
            // position absolute body children correctly
            document.body.style.setProperty("position", "relative", "important");
        }
    }

    disableStyleTweaks() {
        this.styleObserver.disconnect();

        document.documentElement.style.removeProperty("overflow");

        document.body.style.removeProperty("height");
        document.body.style.removeProperty("max-height");
        document.body.style.removeProperty("overflow");
    }

    private paintRange(
        container: HTMLElement,
        containerRect: DOMRect,
        range: Range,
        sentence: RankedSentence
    ): HTMLElement[] {
        const color: string = sentence.related ? "168, 85, 247" : "250, 204, 21";
        const score = sentence.score > 0.6 ? sentence.score : 0;
        const colorIntensity = 0.8 * score ** 4;

        let addedElements: HTMLElement[] = [];

        const rect = range.getBoundingClientRect();
        if (rect.top === 0) {
            // position error
            return [];
        }

        let lastRect: ClientRect;
        const clientRects = [...range.getClientRects()]
            // sort to avoid double-paint of <b> elements
            .sort((a, b) => {
                return a.top - b.top || a.left - b.left;
            })
            .reverse();
        for (const rect of clientRects) {
            // check overlap
            if (
                lastRect &&
                !(
                    lastRect.top >= rect.bottom ||
                    lastRect.right <= rect.left ||
                    lastRect.bottom <= rect.top ||
                    lastRect.left >= rect.right
                )
            ) {
                continue;
            }
            lastRect = rect;

            const node = document.createElement("div");
            node.className = "lindy-smart-highlight";
            node.style.setProperty("--annotation-color", `rgba(${color}, ${colorIntensity})`);
            node.style.setProperty("position", "absolute", "important");
            node.style.setProperty("top", `${rect.top - containerRect.top}px`, "important");
            node.style.setProperty("left", `${rect.left - containerRect.left}px`, "important");
            node.style.setProperty("width", `${rect.width}px`, "important");
            node.style.setProperty("height", `${rect.height}px`, "important");
            node.style.setProperty("z-index", `-1`, "important");

            container.prepend(node);
            addedElements.push(node);

            if (this.enableHighlightsClick) {
                const clickNode = node.cloneNode() as HTMLElement;
                clickNode.style.setProperty("background", "transparent", "important");
                clickNode.style.setProperty("cursor", "pointer", "important");
                clickNode.style.setProperty("z-index", `1001`, "important");

                clickNode.onclick = (e) => this.onRangeClick(e, range, sentence.related);
                container.appendChild(clickNode);
                addedElements.push(clickNode);
            }
        }

        const scrollbarNode = document.createElement("div");
        scrollbarNode.className = "lindy-smart-highlight-scroll";
        scrollbarNode.style.setProperty("--annotation-color", `rgba(${color}, ${colorIntensity})`);
        scrollbarNode.style.setProperty(
            "top",
            `${(100 * (rect.top + document.body.scrollTop)) / document.body.scrollHeight}vh`,
            "important"
        );

        this.scrollbarContainer?.appendChild(scrollbarNode);
        addedElements.push(scrollbarNode);

        return addedElements;
    }

    enableHighlightsClick: boolean = false;
    enableAllSentences: boolean = false;
    isProxyActive: boolean = false;
    private onRangeClick(e: Event, range: Range, related: RelatedHighlight[]) {
        // TODO split handling for related annotations

        if (this.isProxyActive) {
            // pass to proxy running inside enhance.ts
            // TODO pass range instead of modifying the selection
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            window.postMessage({ type: "clickSmartHighlight" }, "*");
        } else {
            // handle in highlights.ts
            if (this.onHighlightClick) {
                this.onHighlightClick(range, related);
                return;
            }
        }
    }
}
