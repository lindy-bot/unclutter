import { SubscribeOptions } from "replicache";
import type { Runtime } from "webextension-polyfill";
import { A, M, accessors, mutators, RuntimeReplicache } from "../store";
import { getBrowser } from "./extension";

export async function reportEventContentScript(
    name: string,
    data = {},
    targetExtension: string | null = null
) {
    getBrowser().runtime.sendMessage(targetExtension, {
        event: "reportEvent",
        name,
        data,
    });
}

export async function getRemoteFeatureFlag(
    key: string,
    targetExtension: string | null = null
) {
    const featureFlags = await getBrowser().runtime.sendMessage(
        targetExtension,
        {
            event: "getRemoteFeatureFlags",
        }
    );
    return featureFlags?.[key];
}

export function openArticle(
    url: string,
    targetExtension: string | null = null
) {
    getBrowser().runtime.sendMessage(targetExtension, {
        event: "openLinkWithUnclutter",
        url: url,
        newTab: true,
    });
}

export async function getUnclutterVersion(
    targetExtension: string | null = null
): Promise<string> {
    return await getBrowser().runtime.sendMessage(targetExtension, {
        event: "getUnclutterVersion",
    });
}

export function captureActiveTabScreenshot(
    articleId: string,
    bodyRect: DOMRect,
    devicePixelRatio: number,
    targetExtension: string | null = null
) {
    getBrowser().runtime.sendMessage(targetExtension, {
        event: "captureActiveTabScreenshot",
        articleId,
        bodyRect,
        devicePixelRatio,
    });
}

export async function getLocalScreenshot(
    articleId: string,
    targetExtension: string | null = null
) {
    return await getBrowser().runtime.sendMessage(targetExtension, {
        event: "getLocalScreenshot",
        articleId,
    });
}

export type ReplicacheProxyEventTypes =
    | "query"
    | "mutate"
    | "subscribe"
    | "pull";
export async function processReplicacheContentScript(
    type: ReplicacheProxyEventTypes,
    methodName?: string,
    args?: any,
    targetExtension: string | null = null
) {
    return await getBrowser().runtime.sendMessage(targetExtension, {
        event: "processReplicacheMessage",
        type,
        methodName,
        args,
    });
}

// @ts-ignore
export class ReplicacheProxy implements RuntimeReplicache {
    private targetExtension: string | null;
    constructor(targetExtension: string | null = null) {
        this.targetExtension = targetExtension;
    }

    // @ts-ignore
    query: RuntimeReplicache["query"] = Object.keys(accessors).reduce(
        (obj, fnName: keyof A) => {
            obj[fnName] = (...args: any[]) =>
                processReplicacheContentScript(
                    "query",
                    fnName,
                    args,
                    this.targetExtension
                );

            return obj;
        },
        {}
    );

    // @ts-ignore
    mutate: RuntimeReplicache["mutate"] = Object.keys(mutators).reduce(
        (obj, fnName: keyof M) => {
            obj[fnName] = (args: any) =>
                processReplicacheContentScript(
                    "mutate",
                    fnName,
                    args,
                    this.targetExtension
                );

            return obj;
        },
        {}
    );

    // @ts-ignore
    subscribe: RuntimeReplicache["subscribe"] = Object.keys(accessors).reduce(
        (obj, fnName: keyof A) => {
            obj[fnName] =
                (...args: any[]) =>
                (subscribeOptions: SubscribeOptions<any, Error>) => {
                    const port: Runtime.Port = getBrowser().runtime.connect(
                        this.targetExtension,
                        { name: `replicache-subscribe` }
                    );
                    port.onMessage.addListener((message) => {
                        subscribeOptions.onData(message);
                    });
                    port.onDisconnect.addListener(() =>
                        subscribeOptions.onDone?.()
                    );

                    port.postMessage({ methodName: fnName, args });

                    return () => port.disconnect();
                };

            return obj;
        },
        {}
    );

    pull: RuntimeReplicache["pull"] = () => {
        processReplicacheContentScript(
            "pull",
            undefined,
            undefined,
            this.targetExtension
        );
    };
}
