import { DraggableArticleList, StaticArticleList } from "../../components";
import React, { ReactNode } from "react";
import clsx from "clsx";
import { getRandomLightColor } from "../../common";
import { Article, readingProgressFullClamp } from "../../store";
import { ReadingProgress } from "../Modal/components/numbers";
import { getActivityColor } from "../Charts";

export function ArticleGroup({
    groupKey,
    title,
    icon,
    color,
    articles,
    articleLines = 1,
    isTopic,
    darkModeEnabled,
    showTopic,
    reportEvent = () => {},
    enableDragging = true,
    showProgress = true,
    className,
    style,
    emptyMessage,
}: {
    groupKey: string;
    title?: string;
    icon?: ReactNode;
    color?: string;
    articles: Article[];
    articleLines?: number;
    isTopic?: boolean;
    darkModeEnabled: boolean;
    showTopic?: (topicId: string) => void;
    reportEvent?: (event: string, data?: any) => void;
    enableDragging?: boolean;
    showProgress?: boolean;
    className?: string;
    style?: React.CSSProperties;
    emptyMessage?: string;
}) {
    color =
        color ||
        (groupKey === "queue"
            ? getActivityColor(3, darkModeEnabled)
            : getRandomLightColor(groupKey, darkModeEnabled));

    // const readCount = articles?.filter(
    //     (a) => a.reading_progress >= readingProgressFullClamp
    // )?.length;

    return (
        <div className={clsx("topic relative", className)} style={style}>
            <div className="topic-header mx-0.5 mb-2 flex justify-between">
                <h2
                    className={clsx(
                        "title flex select-none items-center gap-2 font-medium",
                        isTopic && "cursor-pointer transition-transform hover:scale-[96%]"
                    )}
                    onClick={() => {
                        if (isTopic && showTopic) {
                            showTopic(groupKey);
                        }
                    }}
                >
                    {icon}
                    {title}
                </h2>

                {showProgress && (
                    <ReadingProgress
                        className="relative px-1.5 py-0.5"
                        articleCount={articles?.length}
                        color={color}
                    />
                )}
            </div>

            {/* {!isTopic && groupKey !== "search" && (
                <ReadingProgress
                    className="absolute -top-[3rem] right-0 px-2 py-1"
                    articleCount={articles?.length}
                    readCount={readCount}
                    color={color}
                />
            )} */}

            <div
                className="topic-articles relative rounded-md p-3 transition-colors"
                style={{
                    height: `${11.5 * articleLines - 0.75 * (articleLines - 1)}rem`, // article height + padding to prevent size change
                    background: color,
                }}
            >
                {emptyMessage && articles?.length === 0 && (
                    <div className="animate-fadein absolute top-0 left-0 flex h-full w-full select-none items-center justify-center">
                        {emptyMessage}
                    </div>
                )}
                {!emptyMessage && articles?.length === 0 && emptyListMessage[groupKey] && (
                    <div className="animate-fadein absolute top-0 left-0 flex h-full w-full select-none items-center justify-center">
                        {emptyListMessage[groupKey]}
                    </div>
                )}

                {enableDragging ? (
                    <DraggableArticleList
                        listId={groupKey}
                        articlesToShow={articleLines * 5}
                        small
                        reportEvent={reportEvent}
                    />
                ) : (
                    <StaticArticleList articles={articles.slice(0, articleLines * 5)} small />
                )}
            </div>
        </div>
    );
}

const emptyListMessage = {
    queue: "Drag articles here to read them later.",
    new: "Follow website feeds to see new articles here.",
    past: "No past feed articles found.",
    list: "Open articles with Unclutter to automatically save them.",
    uncompleted: "Your unread articles will appear here.",
    completed: "Every article you read with Unclutter will appear here.",
};
