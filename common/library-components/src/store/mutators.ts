import { JSONValue } from "replicache";
import { generate, Update } from "@rocicorp/rails";
import { WriteTransaction } from "replicache";
import sha256 from "crypto-js/sha256";

import {
    ArticleSortPosition,
    getSafeArticleSortPosition,
    getSettings,
    getUserInfo,
} from "./accessors";
import {
    Article,
    ArticleLink,
    articleLinkSchema,
    articleSchema,
    ArticleText,
    articleTextSchema,
    Settings,
    Topic,
    topicSchema,
    UserInfo,
} from "./_schema";

const {
    get: getArticle,
    list: listArticles,
    put: putArticle,
    update: updateArticle,
    delete: deleteArticleRaw,
} = generate("articles", articleSchema);
const {
    put: putArticleText,
    update: updateArticleText,
    delete: deleteArticleText,
} = generate("text", articleTextSchema);
const { put: putArticleLink } = generate("link", articleLinkSchema);
const {
    put: putTopic,
    list: listTopics,
    delete: deleteTopic,
} = generate("topics", topicSchema);

async function putArticleIfNotExists(
    tx: WriteTransaction,
    article: Omit<Article, ArticleSortPosition>
) {
    const existing = await getArticle(tx, article.id);
    if (existing) {
        return;
    }

    // use time as sort position
    const fullArticle = article as Article;
    fullArticle.recency_sort_position = fullArticle.time_added * 1000;
    fullArticle.topic_sort_position = fullArticle.time_added * 1000;

    await putArticle(tx, fullArticle);
}

// batch large inserts to have fewer mutations to sync
async function importArticles(
    tx: WriteTransaction,
    {
        articles,
    }: {
        articles: Omit<Article, ArticleSortPosition>[];
    }
) {
    await Promise.all(
        articles.map(async (a) => {
            await putArticleIfNotExists(tx, a);
        })
    );
}
async function importArticleTexts(
    tx: WriteTransaction,
    {
        article_texts,
    }: {
        article_texts: ArticleText[];
    }
) {
    await Promise.all(
        article_texts.map(async (article_text) => {
            await putArticleText(tx, article_text);
        })
    );
}

async function importArticleLinks(
    tx: WriteTransaction,
    {
        links,
    }: {
        links: Omit<ArticleLink, "id">[];
    }
) {
    await Promise.all(
        links.map(async (link: ArticleLink) => {
            // use one entry for both directions
            const nodeIds = [link.source, link.target].sort();
            link.id = sha256(`${nodeIds.join("-")}-${link.type}`).toString();
            await putArticleLink(tx, link);
        })
    );
}

async function deleteArticle(tx: WriteTransaction, articleId: string) {
    await deleteArticleRaw(tx, articleId);
    await deleteArticleText(tx, articleId);
}

async function articleSetFavorite(
    tx: WriteTransaction,
    { id, is_favorite }: { id: string; is_favorite: boolean }
) {
    let favorites_sort_position: number | null = null;
    if (is_favorite) {
        favorites_sort_position = new Date().getTime();
    }

    await updateArticle(tx, {
        id,
        is_favorite,
        favorites_sort_position,
    });
}

async function articleTrackOpened(tx: WriteTransaction, articleId: string) {
    const timeNow = new Date().getTime();
    await updateArticle(tx, {
        id: articleId,
        recency_sort_position: timeNow,
        topic_sort_position: timeNow,
        domain_sort_position: timeNow,
    });
}

// noted: this may be batched into multiple mutations in backend
async function updateAllTopics(
    tx: WriteTransaction,
    {
        newTopics,
        articleTopics,
        skip_topics_delete = false,
    }: {
        newTopics: Topic[];
        articleTopics: { [articleId: string]: string };
        skip_topics_delete?: boolean;
    }
) {
    // replace existing topic entries
    if (!skip_topics_delete) {
        const existingTopics = await listTopics(tx);
        await Promise.all(existingTopics.map((t) => deleteTopic(tx, t.id)));
    }
    await Promise.all(newTopics.map((t) => putTopic(tx, t)));

    // update article topic ids
    const articleTopicEntries = Object.entries(articleTopics);
    // read before write
    const existingArticles = await Promise.all(
        articleTopicEntries.map(([articleId, topicId]) =>
            getArticle(tx, articleId)
        )
    );
    await Promise.all(
        articleTopicEntries.map(async ([articleId, topicId], index) => {
            const existing = existingArticles[index];
            if (existing?.topic_id !== topicId) {
                console.log(`update ${existing?.topic_id} -> ${topicId}`);
                await updateArticle(tx, {
                    id: articleId,
                    topic_id: topicId,
                });
            }
        })
    );
}

async function moveArticlePosition(
    tx: WriteTransaction,
    {
        articleId,
        articleIdBeforeNewPosition,
        articleIdAfterNewPosition,
        sortPosition,
    }: {
        articleId: string;
        articleIdBeforeNewPosition: string | null;
        articleIdAfterNewPosition: string | null;
        sortPosition: ArticleSortPosition;
    }
) {
    const activeArticle = await getArticle(tx, articleId);
    const beforeArticle = articleIdBeforeNewPosition
        ? await getArticle(tx, articleIdBeforeNewPosition)
        : null;
    const afterArticle = articleIdAfterNewPosition
        ? await getArticle(tx, articleIdAfterNewPosition)
        : null;
    if (!activeArticle || (!beforeArticle && !afterArticle)) {
        return;
    }

    // higest indexes first
    let newUpperBound =
        beforeArticle &&
        getSafeArticleSortPosition(beforeArticle, sortPosition);
    let newLowerBound =
        afterArticle && getSafeArticleSortPosition(afterArticle, sortPosition);
    // don't floor to 0 or present in case of reordering on sliced / filtered list
    if (!newUpperBound) {
        newUpperBound = newLowerBound! + 1000;
    } else if (!newLowerBound) {
        newLowerBound = newUpperBound - 1000;
    }

    // creates floats
    const newPosition = (newLowerBound! + newUpperBound!) / 2;

    await updateArticle(tx, {
        id: articleId,
        [sortPosition]: newPosition,
    });
}

// combine queue status update & move within a single mutation (to prevent UI flicker)
async function articleAddMoveToQueue(
    tx: WriteTransaction,
    {
        articleId,
        isQueued,
        articleIdBeforeNewPosition,
        articleIdAfterNewPosition,
        sortPosition,
    }: {
        articleId: string;
        isQueued: boolean;
        articleIdBeforeNewPosition: string | null;
        articleIdAfterNewPosition: string | null;
        sortPosition: ArticleSortPosition;
    }
) {
    await updateArticle(tx, {
        id: articleId,
        is_queued: isQueued,
        queue_sort_position: new Date().getTime(),
    });
    await moveArticlePosition(tx, {
        articleId,
        articleIdBeforeNewPosition,
        articleIdAfterNewPosition,
        sortPosition,
    });
}

export async function updateSettings(
    tx: WriteTransaction,
    diff: Partial<Settings>
) {
    const savedValue = await getSettings(tx);
    await tx.put("settings", { ...savedValue, ...diff });
}

export async function updateUserInfo(
    tx: WriteTransaction,
    diff: Partial<UserInfo>
) {
    const savedValue = await getUserInfo(tx);
    await tx.put("userInfo", { ...(savedValue || {}), ...diff });
}

export async function importEntries(
    tx: WriteTransaction,
    entries: [string, JSONValue][]
) {
    await Promise.all(entries.map(([key, value]) => tx.put(key, value)));
}

export const mutators = {
    updateArticle,
    articleSetFavorite,
    articleTrackOpened,
    deleteArticle,
    putArticleIfNotExists,
    importArticles,
    importArticleTexts,
    importArticleLinks,
    putTopic,
    updateAllTopics,
    moveArticlePosition,
    articleAddMoveToQueue,
    updateSettings,
    importEntries,
    updateUserInfo,
};
export type M = typeof mutators;
export type ArticleUpdate = Update<Article>;
