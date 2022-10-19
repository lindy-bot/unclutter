import ky from "ky";

import { Article } from "../store/_schema";
import { getBrowserType, sendMessage } from "./extension";
import { SearchResult } from "./search";

const lindyApiUrl = "https://api2.lindylearn.io";
// const lindyApiUrl = "http://localhost:8000";

export async function getPageHistory(url: string) {
    const response = await fetch(
        `${lindyApiUrl}/annotations/get_page_history?${new URLSearchParams({
            page_url: url,
        })}`
    );
    const json = await response.json();
    return json;
}

export async function reportBrokenPage(url: string) {
    const domain = getDomainFrom(new URL(url));
    const browserType = "serverless-screenshots";

    try {
        await fetch(`https://api2.lindylearn.io/report_broken_page`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                url,
                domain,
                userAgent: navigator.userAgent,
                browserType,
                unclutterVersion: null,
            }),
        });
    } catch {}
}

export async function quickReport(
    message: string,
    url?: string,
    userId?: string
): Promise<string | null> {
    const browserType = getBrowserType();
    const unclutterVersion = await sendMessage({
        event: "getUnclutterVersion",
    });

    try {
        const response = await fetch(
            `https://unclutter.lindylearn.io/api/quickReport`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url,
                    userId,
                    message,
                    userAgent: navigator.userAgent,
                    browserType,
                    unclutterVersion,
                }),
            }
        );
        return await response.text();
    } catch {
        return null;
    }
}

function getDomainFrom(url: URL) {
    return url.hostname.replace("www.", "");
}

export async function searchArticles(
    user_id: string,
    query: string
): Promise<SearchResult[]> {
    let data = (await ky
        .get(`${lindyApiUrl}/library/search_articles`, {
            searchParams: {
                user_id,
                query,
            },
        })
        .json()) as SearchResult[];

    return data.filter((d) => d.sentences?.[0]?.length);
}

export async function checkHasSubscription(
    user_id: string,
    email: string
): Promise<boolean> {
    let data: any = await ky
        .get(`${lindyApiUrl}/subscriptions/check_subscription`, {
            searchParams: {
                user_id,
                email,
            },
        })
        .json();

    return data?.is_subscribed || false;
}
