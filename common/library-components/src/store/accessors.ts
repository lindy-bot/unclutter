import { generate } from "@rocicorp/rails";
import { ReadTransaction } from "replicache";
import { getWeekNumber, getWeekStart, subtractWeeks } from "../common/time";
import {
    Article,
    articleLinkSchema,
    articleSchema,
    articleTextSchema,
    PartialSyncState,
    partialSyncStateSchema,
    PARTIAL_SYNC_STATE_KEY,
    readingProgressFullClamp,
    Settings,
    settingsSchema,
    Topic,
    topicSchema,
    UserInfo,
} from "./_schema";

/* ***** articles ***** */

export const { get: getArticle, list: listArticles } = generate(
    "articles",
    articleSchema
);
export const { get: getArticleText, list: listArticleTexts } = generate(
    "text",
    articleTextSchema
);
export const { list: listArticleLinks } = generate("link", articleLinkSchema);

export async function getArticlesCount(tx: ReadTransaction): Promise<number> {
    const articles = await listArticles(tx);
    return articles.length;
}

export type StateFilter = "all" | "unread" | "read" | "favorite";
export async function listRecentArticles(
    tx: ReadTransaction,
    sinceMs?: number,
    stateFilter?: StateFilter,
    selectedTopicId?: string | null
): Promise<Article[]> {
    const allArticles = await listArticles(tx);

    let allowedTopicIds: Set<string> | null = null;
    if (selectedTopicId) {
        const topic = await getTopic(tx, selectedTopicId);
        if (topic.group_id) {
            // individual topic
            allowedTopicIds = new Set([selectedTopicId]);
        } else {
            // selected group
            const topicChildren = await getGroupTopicChildren(
                tx,
                selectedTopicId
            );
            allowedTopicIds = new Set(topicChildren.map((t) => t.id));
        }
    }

    const sinceSeconds = sinceMs ? sinceMs / 1000 : 0;
    const filteredArticles = allArticles
        .filter((a) => a.time_added >= sinceSeconds)
        .filter(
            (a) => allowedTopicIds === null || allowedTopicIds.has(a.topic_id!)
        )
        .filter(
            (a) =>
                (stateFilter !== "unread" ||
                    a.reading_progress < readingProgressFullClamp) &&
                (stateFilter !== "read" ||
                    a.reading_progress >= readingProgressFullClamp)
        )
        .filter((a) => stateFilter !== "favorite" || a.is_favorite);

    return sortArticlesPosition(filteredArticles, "recency_sort_position");
}

export interface ArticleBucket {
    key: string;
    title: string;
    articles?: Article[];
    children?: ArticleBucket[];
}
export interface ArticleBucketMap {
    [key: string]: ArticleBucket;
}

export async function groupRecentArticles(
    tx: ReadTransaction,
    sinceMs?: number,
    stateFilter?: StateFilter,
    selectedTopicId?: string | null,
    aggregateYears: boolean = true
    // returning 'object' due to replicache type issues
): Promise<object> {
    const recentArticles = await listRecentArticles(
        tx,
        sinceMs,
        stateFilter,
        selectedTopicId
    );

    const currentYear = new Date().getFullYear();
    const currentWeek = `${currentYear}-99${getWeekNumber(new Date())}`;
    const lastWeek = `${currentYear}-99${getWeekNumber(new Date()) - 1}`;
    const currentMonth = `${currentYear}-${new Date().getMonth()}`;

    // group into time buckets
    // const weekBuckets: { [week: number]: Article[] } = {};
    const monthBuckets: ArticleBucketMap = {};
    recentArticles.forEach((article) => {
        const date = new Date(article.time_added * 1000);
        const year = date.getFullYear();
        const week = `${year}-99${getWeekNumber(date)}`;
        const month = `${year}-${date.getMonth()}`;

        if (week === currentWeek || week === lastWeek) {
            if (!monthBuckets[week]) {
                monthBuckets[week] = {
                    key: week,
                    title: week === currentWeek ? "This week" : "Last week",
                    articles: [],
                };
            }

            monthBuckets[week].articles!.push(article);
        } else {
            if (!monthBuckets[month]) {
                const monthName = date.toLocaleString("en-us", {
                    month: "long",
                });
                monthBuckets[month] = {
                    key: month,
                    title: `${monthName}`,
                    articles: [],
                };
            }

            monthBuckets[month].articles!.push(article);
        }
    });

    if (aggregateYears) {
        const yearBuckets: ArticleBucketMap = {};
        Object.values(monthBuckets)
            .sort((a, b) =>
                parseInt(b.key.slice(5)) > parseInt(a.key.slice(5)) ? 1 : -1
            ) // newest month first
            .forEach((monthBucket) => {
                const [year, month] = monthBucket.key.split("-");

                if (!yearBuckets[year]) {
                    yearBuckets[year] = {
                        key: year,
                        title: year,
                        children: [],
                    };
                }
                yearBuckets[year].children!.push(monthBucket);
            });

        if (yearBuckets["1970"]) {
            yearBuckets["1970"] = {
                key: "1970",
                title: "Imported",
                articles: yearBuckets["1970"].children![0].articles,
            };
        }
        return yearBuckets;
    } else {
        return monthBuckets;
    }
}

export async function listFavoriteArticles(
    tx: ReadTransaction
): Promise<Article[]> {
    const allArticles = await listArticles(tx);
    const articles = allArticles.filter((a) => a.is_favorite);
    sortArticlesPosition(articles, "favorites_sort_position");
    return articles;
}

export async function listQueueArticles(
    tx: ReadTransaction
): Promise<Article[]> {
    const allArticles = await listArticles(tx);
    const articles = allArticles.filter((a) => a.is_queued);
    sortArticlesPosition(articles, "queue_sort_position");
    return articles;
}

export async function listTopicArticles(
    tx: ReadTransaction,
    topic_id: string
): Promise<Article[]> {
    if (!topic_id) {
        return [];
    }

    const result = tx.scan({
        indexName: "articlesByTopic",
        prefix: topic_id,
    });
    const articles = (await result.values().toArray()) as Article[];
    sortArticlesPosition(articles, "topic_sort_position");

    return articles;
}

// can't use scan() on server
export async function listTopicArticlesServer(
    tx: ReadTransaction,
    topic_id: string
): Promise<Article[]> {
    const allArticles = await listArticles(tx);
    const topicArticles = allArticles.filter((a) => a.topic_id === topic_id);
    sortArticlesPosition(topicArticles, "topic_sort_position");
    return topicArticles;
}

export type ArticleSortPosition =
    | "queue_sort_position"
    | "recency_sort_position"
    | "favorites_sort_position"
    | "topic_sort_position"
    | "domain_sort_position";
export function getSafeArticleSortPosition(
    article: Article,
    sortPosition: ArticleSortPosition
): number {
    // no manual position
    if (article[sortPosition] === undefined || article[sortPosition] === null) {
        return article.time_added * 1000;
    }
    // uses old index positioning
    // @ts-ignore
    if (article[sortPosition] < 1000) {
        return article.time_added * 1000;
    }
    // valid time-based position
    // @ts-ignore
    return article[sortPosition];
}
export function sortArticlesPosition(
    articles: Article[],
    key: ArticleSortPosition
) {
    // sort reverse to easily append items in front
    articles.sort((a, b) => {
        // highest indexes first
        return (
            getSafeArticleSortPosition(b, key) -
            getSafeArticleSortPosition(a, key)
        );
    });
    return articles;
}

export async function getTopicArticlesCount(
    tx: ReadTransaction,
    topic_id: string
): Promise<number> {
    const articles = await listTopicArticles(tx, topic_id);
    return articles.length;
}

export type ReadingProgress = {
    articleCount: number;
    completedCount: number;
};
export async function getReadingProgress(
    tx: ReadTransaction,
    forTopicId: string | null = null
): Promise<ReadingProgress> {
    let articles: Article[];
    if (forTopicId) {
        articles = await listTopicArticles(tx, forTopicId);
        if (!articles) {
            articles = [];
        }
    } else {
        const start = subtractWeeks(getWeekStart(), 3);
        articles = await listRecentArticles(tx, start.getTime());
    }

    return {
        articleCount: articles.length,
        completedCount: articles.filter(
            (a) => a.reading_progress >= readingProgressFullClamp
        ).length,
    };
}

/* ***** topics ***** */

const { get: getTopicRaw, list: listTopics } = generate("topics", topicSchema);

export async function getTopic(
    tx: ReadTransaction,
    topic_id: string
): Promise<Topic> {
    return (await getTopicRaw(tx, topic_id)) as Topic;
}

export async function getTopicIdMap(
    tx: ReadTransaction
): Promise<{ [topic_id: string]: Topic }> {
    const allTopics = await listTopics(tx);

    const idMap = {};
    allTopics.forEach((topic) => {
        idMap[topic.id] = topic;
    });
    return idMap;
}

export async function groupTopics(
    tx: ReadTransaction
): Promise<{ groupTopic: Topic; children: Topic[] }[]> {
    const allTopics = await listTopics(tx);

    const groupTopics: Topic[] = [];
    const topicChildren: { [topid_id: string]: Topic[] } = {};
    allTopics.forEach((topic) => {
        if (topic.group_id == null) {
            groupTopics.push(topic);
            return;
        }

        if (!topicChildren[topic.group_id]) {
            topicChildren[topic.group_id] = [];
        }
        topicChildren[topic.group_id].push(topic);
    });

    return groupTopics
        .map((groupTopic) => ({
            groupTopic,
            children: topicChildren[groupTopic.id].sort(
                (a, b) => parseInt(a.id) - parseInt(b.id)
            ),
        }))
        .filter((group) => group.children.length > 0)
        .sort((a, b) => b.children.length - a.children.length);
}

export async function getGroupTopicChildren(
    tx: ReadTransaction,
    topic_id: string
): Promise<Topic[]> {
    const allTopics = await listTopics(tx);
    return allTopics
        .filter((topic) => topic.group_id === topic_id)
        .sort((a, b) => parseInt(a.id) - parseInt(b.id));
}

/* ***** partialSyncState ***** */

export async function getPartialSyncState(
    tx: ReadTransaction
): Promise<PartialSyncState | undefined> {
    const val = await tx.get(PARTIAL_SYNC_STATE_KEY);
    if (val === undefined) {
        return undefined;
    }
    return partialSyncStateSchema.parse(JSON.parse(val?.toString() || "null"));
}

/* ***** settings ***** */

export async function getSettings(tx: ReadTransaction): Promise<Settings> {
    const savedValue = (await tx.get("settings")) as Settings | undefined;
    return savedValue || {};
}

/* ***** userInfo ***** */

export async function getUserInfo(
    tx: ReadTransaction
): Promise<UserInfo | null> {
    const savedValue = (await tx.get("userInfo")) as UserInfo | undefined;
    return savedValue || null;
}

export const accessors = {
    getArticle,
    listArticles,
    getArticleText,
    listArticleTexts,
    listArticleLinks,
    getArticlesCount,
    listRecentArticles,
    groupRecentArticles,
    listFavoriteArticles,
    listQueueArticles,
    listTopicArticles,
    listTopicArticlesServer,
    getTopicArticlesCount,
    getReadingProgress,
    getTopic,
    listTopics,
    getTopicIdMap,
    groupTopics,
    getGroupTopicChildren,
    getPartialSyncState,
    getSettings,
    getUserInfo,
};
export type A = typeof accessors;
