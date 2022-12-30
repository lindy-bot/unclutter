import React, { useMemo, useReducer, useState } from "react";
import { LindyAnnotation } from "../common/annotations/create";
import { SummaryState } from "../content-script/modifications/DOM/smartHighlights";
import { groupAnnotations } from "./common/grouping";
import { useAnnotationSettings, useFeatureFlag } from "./common/hooks";
import AnnotationsList from "./components/AnnotationsList";
import { useAnnotationModifiers, useFetchAnnotations } from "./state/actions";
import { annotationReducer, handleWindowEventFactory } from "./state/local";

export default function App({ articleUrl }: { articleUrl: string }) {
    // annotation settings (updated through events below)
    const {
        personalAnnotationsEnabled,
        setPersonalAnnotationsEnabled,
        enableSocialAnnotations,
        showAllSocialAnnotations,
        setEnableSocialAnnotations,
        experimentsEnabled,
    } = useAnnotationSettings();

    // keep local annotations state
    const [summaryAnnotation, setSummaryAnnotation] = useState<LindyAnnotation>();
    const [annotations, mutateAnnotations] = useReducer(annotationReducer, []);
    useFetchAnnotations(
        articleUrl,
        personalAnnotationsEnabled,
        enableSocialAnnotations,
        mutateAnnotations
    );

    // handlers to modify remote & local state
    const { createReply, deleteHideAnnotation, onAnnotationHoverUpdate, updateAnnotation } =
        useAnnotationModifiers(mutateAnnotations);

    // receive events from the text highlighting content script code
    useMemo(() => {
        window.onmessage = handleWindowEventFactory(
            mutateAnnotations,
            setEnableSocialAnnotations,
            setPersonalAnnotationsEnabled,
            setSummaryAnnotation
        );
        window.top.postMessage({ event: "sidebarAppReady" }, "*");
    }, []);

    // group and filter annotations on every local state change (e.g. added, focused)
    const [groupedAnnotations, setGroupedAnnotations] = useState<LindyAnnotation[][]>([]);
    React.useEffect(() => {
        annotations
            .filter((a) => a.isMyAnnotation)
            .sort((a, b) => a.displayOffset - b.displayOffset)
            .forEach((a, index) => {
                a.listIndex = index;
            });

        const visibleAnnotations = annotations.filter(
            (a) => a.focused || (a.isMyAnnotation && (a.text || experimentsEnabled))
        );

        if (summaryAnnotation) {
            // prepend summary annotation to the list
            visibleAnnotations.unshift(summaryAnnotation);
        }

        // use large grouping margin to display every annotation properly
        const groupedAnnotations = groupAnnotations(visibleAnnotations, 75);
        setGroupedAnnotations(groupedAnnotations);
    }, [annotations, summaryAnnotation]);

    return (
        // x margin to show slight shadow (iframe allows no overflow)
        <div className="font-text mx-2 text-gray-700">
            <AnnotationsList
                groupedAnnotations={groupedAnnotations}
                hypothesisSyncEnabled={false}
                showAllSocialAnnotations={showAllSocialAnnotations}
                deleteHideAnnotation={deleteHideAnnotation}
                onAnnotationHoverUpdate={onAnnotationHoverUpdate}
                unfocusAnnotation={onAnnotationHoverUpdate}
                createReply={createReply}
                updateAnnotation={updateAnnotation}
            />
        </div>
    );
}
