export type LibraryState = {
    libraryUser?: string;
    libraryInfo?: LibraryInfo;

    isClustering: boolean;
    wasAlreadyPresent: boolean;
    error: boolean;
};

// returned from API
export type LibraryInfo = {
    article: LibraryArticle;
    topic: LibraryTopic | null;
    sibling_count: number;
};

// imported from Unclutter Library src/store/_schema.ts
export type LibraryArticle = {
    is_favorite?: boolean | undefined;
    url: string;
    title: string | null;
    word_count: number;
    time_added: number;
    reading_progress: number;
    topic_id: string | null;
    topic_sort_position: number;
    id: string;
};

export type LibraryTopic = {
    group_id?: string | null | undefined;
    id: string;
    name: string;
    emoji: string | null;
};
