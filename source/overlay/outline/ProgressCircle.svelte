<script lang="ts">
    import { reportEventContentScript } from "source/content-script/messaging";
    import { createEventDispatcher } from "svelte";

    export let totalAnnotationCount: number;
    const goalAnnotationCount = 6;

    let strokeDashoffset: number;
    $: strokeDashoffset =
        288.5 -
        288.5 *
            Math.min(1.0, (totalAnnotationCount || 0) / goalAnnotationCount);
</script>

<div
    class="relative font-header hover:drop-shadow cursor-pointer lindy-tooltp lindy-fade"
    data-title={`Created ${totalAnnotationCount} private note${
        totalAnnotationCount !== 1 ? "s" : ""
    }`}
>
    <svg viewBox="0 0 100 100" class="progress-circle w-10">
        <defs>
            <mask id="mask">
                <path
                    class="logoPath"
                    id="logo-path"
                    style={`stroke-dashoffset: ${strokeDashoffset}`}
                    d="M 50 96 a 46 46 0 0 1 0 -92 46 46 0 0 1 0 92"
                />
            </mask>
        </defs>

        <path
            class="placeholder"
            d="M 50 96 a 46 46 0 0 1 0 -92 46 46 0 0 1 0 92"
        />

        <foreignObject
            class="logoWrap"
            mask="url(#mask)"
            x="0"
            y="0"
            width="100"
            height="100"
        >
            <div class="logoGradient" />
        </foreignObject>
    </svg>

    <div
        class={"caption absolute font-semibold select-none w-full text-center flex justify-center " +
            (totalAnnotationCount >= goalAnnotationCount ? "goal-reached" : "")}
        style="top: 20%; left: 0;"
    >
        <svg
            class="icon celebration-icon absolute invisible"
            style="width: 18px; top: 2px;"
            viewBox="0 0 512 512"
        >
            <path
                fill="currentColor"
                d="M184 160c5.438 0 10.87-1.812 15.37-5.562c35.97-30 56.62-74.06 56.62-120.9V24c0-13.25-10.75-24-23.1-24s-23.1 10.75-23.1 24v9.531c0 32.56-14.34 63.19-39.37 84.03C158.4 126.1 157.1 141.2 165.6 151.4C170.3 157.1 177.1 160 184 160zM64 63.1c17.67 0 31.1-14.33 31.1-31.1c0-17.67-14.33-31.1-31.1-31.1c-17.67 0-31.1 14.33-31.1 31.1C32 49.67 46.33 63.1 64 63.1zM487.1 256h-9.531C431.6 256 387.6 276.7 357.6 312.6c-8.5 10.19-7.125 25.31 3.062 33.81C365.1 350.2 370.6 352 375.1 352c6.875 0 13.69-2.938 18.44-8.625C415.3 318.3 445.9 304 478.5 304h9.531c13.25 0 23.1-10.75 23.1-24S501.2 256 487.1 256zM479.1 416c-17.67 0-31.1 14.33-31.1 31.1c0 17.67 14.33 31.1 31.1 31.1s31.1-14.33 31.1-31.1C511.1 430.3 497.7 416 479.1 416zM479.1 128c-17.67 0-31.1 14.33-31.1 31.1c0 17.67 14.33 31.1 31.1 31.1s31.1-14.33 31.1-31.1C511.1 142.3 497.7 128 479.1 128zM389.7 176c20.88-24.47 19.37-48.19 18.25-65.5c-.9687-14.97-1.062-21.97 6.844-31.22c7.875-9.219 14.78-10.19 29.66-11.53c17.25-1.562 40.91-3.688 61.84-28.16c8.594-10.06 7.438-25.22-2.656-33.84c-10.03-8.5-25.16-7.438-33.84 2.656c-7.875 9.219-14.78 10.19-29.66 11.53c-17.25 1.562-40.91 3.688-61.84 28.16c-20.88 24.47-19.37 48.19-18.25 65.5c.9687 14.97 1.062 21.97-6.844 31.22c-7.844 9.188-14.75 10.16-29.59 11.5c-17.25 1.531-40.91 3.625-61.81 28.09C253.2 194.5 254.3 209.7 264.4 218.3C268.9 222.1 274.5 224 279.1 224c6.781 0 13.5-2.844 18.25-8.406c7.844-9.188 14.75-10.16 29.56-11.5C345.1 202.6 368.7 200.5 389.7 176zM150.6 201.4C144.6 195.3 136.4 192 127.9 192c-2.234 0-4.482 .2269-6.711 .6996c-10.62 2.312-19.37 9.844-23.19 20.03l-95.1 256c-4.406 11.75-1.531 25 7.344 33.88C15.47 508.7 23.66 512 32 512c3.781 0 7.594-.6563 11.25-2.031l255.1-96c10.19-3.812 17.72-12.56 20.03-23.19c2.281-10.62-.9702-21.72-8.656-29.41L150.6 201.4zM59.33 452.7l32.57-86.85l54.28 54.28L59.33 452.7zM195.5 401.6L110.4 316.5l23.84-63.59l124.9 124.9L195.5 401.6z"
            />
        </svg>
        <span class="count absolute">{`${totalAnnotationCount || 0}`}</span>
    </div>
</div>

<style lang="postcss">
    svg {
        transform-origin: bottom;
    }

    .logoWrap {
        transform-origin: 50px 50px;
    }

    .logoGradient {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: conic-gradient(
            rgba(255, 23, 68, 0.5),
            rgba(213, 0, 249, 0.5),
            rgba(61, 90, 254, 0.5),
            rgba(0, 176, 255, 0.5),
            rgba(29, 233, 182, 0.5),
            rgba(118, 255, 3, 0.5),
            rgba(255, 234, 0, 0.5),
            rgba(255, 145, 0, 0.5),
            rgba(255, 23, 68, 0.5)
        );
    }

    .logoPath {
        stroke: white;
        stroke-width: 12;
        stroke-linecap: round;
        fill: none;
        transform-origin: 50px 50px;
        transform: rotate(-180deg);
        transition: stroke-dashoffset 0.35s;

        stroke-dasharray: 288.5;
    }

    .placeholder {
        stroke: #f3f4f6;
        fill: var(--lindy-background-color);
        stroke-width: 6;
        transform-origin: 50px 50px;
    }

    .caption.goal-reached > .count {
        animation-name: fadeOut, fadeIn;
        animation-delay: 0s, 1.65s;
        animation-duration: 0.5s, 0.5s;
        animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1),
            cubic-bezier(0.16, 1, 0.3, 1);
        animation-fill-mode: forwards, forwards;
    }
    .caption.goal-reached > .celebration-icon {
        animation-name: fadeIn, fadeOut;
        animation-delay: 0.15s, 1.5s;
        animation-duration: 0.5s, 0.5s;
        animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1),
            cubic-bezier(0.16, 1, 0.3, 1);
        animation-fill-mode: forwards, forwards;
    }

    @keyframes fadeOut {
        from {
            visibility: visible;
            opacity: 1;
            transform: translate3d(0, 0, 0);
        }
        to {
            visibility: hidden;
            opacity: 0;
            transform: translate3d(10px, 0, 0);
        }
    }
    @keyframes fadeIn {
        from {
            visibility: hidden;
            opacity: 0;
            transform: translate3d(-10px, 0, 0);
        }
        to {
            visibility: visible;
            opacity: 1;
            transform: translate3d(0, 0, 0);
        }
    }
</style>
