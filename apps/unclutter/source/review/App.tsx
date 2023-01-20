import { ReplicacheProxy } from "@unclutter/library-components/dist/common/replicache";
import ArticleBottomReview from "@unclutter/library-components/dist/components/Review/ArticleBottomReview";
import { ReplicacheContext } from "@unclutter/library-components/dist/store/replicache";
import React, { useMemo } from "react";

export default function App({
    articleId,
    darkModeEnabled,
}: {
    articleId: string;
    darkModeEnabled: boolean;
}) {
    const rep = useMemo<ReplicacheProxy>(() => new ReplicacheProxy(), []);

    return (
        <div className="bottom-container font-text relative mt-[8px]">
            {/* @ts-ignore */}
            <ReplicacheContext.Provider value={rep}>
                <ArticleBottomReview articleId={articleId} darkModeEnabled={darkModeEnabled} />
            </ReplicacheContext.Provider>
        </div>
    );
}
