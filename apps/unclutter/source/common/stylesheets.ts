export const overrideClassname = "lindylearn-document-override";

export function createStylesheetLink(url, styleId, insertAfter: HTMLElement = null, usedDocument: Document = document) {
    const link = usedDocument.createElement("link");
    link.classList.add(overrideClassname);
    link.classList.add(styleId);
    link.id = styleId;
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = url;

    if (insertAfter) {
        insertAfter.parentElement.insertBefore(link, insertAfter?.nextSibling || insertAfter);
    } else {
        usedDocument.head.appendChild(link);
    }

    return link;
}

export function createStylesheetText(text, styleId, insertAfter: HTMLElement = null) {
    const style = document.createElement("style");
    style.classList.add(overrideClassname);
    style.classList.add(styleId);
    style.id = styleId;
    style.innerHTML = text;

    if (insertAfter) {
        insertAfter.parentElement.insertBefore(style, insertAfter?.nextSibling || insertAfter);
    } else {
        document.head.appendChild(style);
    }

    return style;
}
