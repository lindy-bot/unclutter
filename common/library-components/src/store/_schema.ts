import { entitySchema } from "@rocicorp/rails";
import { z } from "zod";

// *** Article ***
export const articleSchema = entitySchema.extend({
    url: z.string(),
    title: z.nullable(z.string()),
    word_count: z.number(), // 0 for unparsed text
    publication_date: z.nullable(z.string()),

    time_added: z.number(), // unix seconds, 0 for missing value
    reading_progress: z.number(),
    is_favorite: z.boolean(),
    is_queued: z.optional(z.boolean()),

    is_temporary: z.optional(z.boolean()), // not saved
    is_new: z.optional(z.boolean()), // added via feed subscription

    topic_id: z.nullable(z.string()),

    queue_sort_position: z.optional(z.number()),
    recency_sort_position: z.optional(z.number()),
    topic_sort_position: z.optional(z.number()),
    domain_sort_position: z.optional(z.number()),
    favorites_sort_position: z.optional(z.nullable(z.number())),

    annotation_count: z.optional(z.number()), // set when querying
    description: z.optional(z.string()), // set for non-library feed articles
});
export type Article = z.infer<typeof articleSchema>;

// *** Topic ***
export const topicSchema = entitySchema.extend({
    name: z.string(),
    emoji: z.nullable(z.string()),

    group_id: z.nullable(z.string()),
});
export type Topic = z.infer<typeof topicSchema>;

// *** ArticleText ***
export const articleTextSchema = entitySchema.extend({
    title: z.nullable(z.string()),
    paragraphs: z.array(z.string()),
});
export type ArticleText = z.infer<typeof articleTextSchema>;

// *** ArticleLink ***
export const articleLinkSchema = entitySchema.extend({
    source: z.string(),
    target: z.string(),
    type: z.enum(["sim"]),
    score: z.optional(z.number()),
});
export type ArticleLink = z.infer<typeof articleLinkSchema>;

// *** Annotation ***
export const annotationSchema = entitySchema.extend({
    article_id: z.string(),
    quote_text: z.optional(z.string()),
    quote_html_selector: z.optional(z.any()),
    created_at: z.number(), // unix seconds, 0 for missing value
    updated_at: z.optional(z.number()),

    text: z.optional(z.string()),
    tags: z.optional(z.array(z.string())),
    is_favorite: z.optional(z.boolean()),

    ai_created: z.optional(z.boolean()),
    ai_score: z.optional(z.number()),
    h_id: z.optional(z.string()), // remote id if synced with hypothesis
});
export type Annotation = z.infer<typeof annotationSchema>;

// *** PartialSyncState ***
export const PARTIAL_SYNC_STATE_KEY = "control/partialSync";
export const partialSyncStateSchema = z.union([
    z.object({
        // full-text entries may lag behind article version
        minVersion: z.number(),
        maxVersion: z.number(),
        endKey: z.string(),
    }),
    z.literal("PARTIAL_SYNC_COMPLETE"),
]);
export type PartialSyncState = z.TypeOf<typeof partialSyncStateSchema>;

// *** Setting ***
export const settingsSchema = z.object({
    tutorial_stage: z.optional(z.number()),
    seen_settings_version: z.optional(z.number()),
    seen_highlights_version: z.optional(z.number()),
});
export const latestSettingsVersion = 1;
export const latestHighlightsVersion = 1;
export type Settings = z.infer<typeof settingsSchema>;

// *** UserInfo ***
export const userInfoSchema = z.object({
    id: z.string(),
    name: z.optional(z.string()),

    accountEnabled: z.optional(z.boolean()),
    signinProvider: z.optional(z.enum(["email", "google", "github"])),
    email: z.optional(z.string()),

    aiEnabled: z.optional(z.boolean()),
});
export type UserInfo = z.infer<typeof userInfoSchema>;

// *** FeedSubscription ***
export const feedSubscriptionSchema = entitySchema.extend({
    // id equal to rss_url
    rss_url: z.string(),
    link: z.string(),
    domain: z.string(),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    author: z.optional(z.string()),
    post_frequency: z.optional(
        z.object({
            count: z.number(),
            per_week: z.optional(z.number()),
            period: z.enum(["day", "week", "month", "year"]),
        })
    ),

    time_added: z.number(),
    is_subscribed: z.optional(z.boolean()),
    last_fetched: z.optional(z.number()),
});
export type FeedSubscription = z.infer<typeof feedSubscriptionSchema>;
