import React, { useContext, useEffect, useState } from "react";
import { ModalStateContext } from "./context";
import { SettingsButton, SettingsGroup } from "../Settings/SettingsGroup";
import { ReplicacheContext } from "../../store";
import { useUser } from "@supabase/auth-helpers-react";
import { setUnclutterLibraryAuth } from "../../common";
import { usePaymentsLink } from "../Settings/SmartReading";
import clsx from "clsx";

export default function AboutModalTab({}: {}) {
    const { darkModeEnabled, userInfo, showSignup, reportEvent } = useContext(ModalStateContext);
    const rep = useContext(ReplicacheContext);

    const [justEnabled, setJustEnabled] = useState(false);
    useEffect(() => {
        (async () => {
            if (!rep) {
                return;
            }

            // immediately enable on stripe payments redirect
            const paymentSuccess = new URLSearchParams(window.location.search).get(
                "stripe_success"
            );
            if (paymentSuccess && !userInfo?.stripeId) {
                history.replaceState({}, "", `/about`);
                await rep.mutate.updateUserInfo({
                    aiEnabled: true,
                });
                setJustEnabled(true);

                reportEvent("enableSmartReading", {
                    $set: {
                        aiEnabled: true,
                        stripeId: userInfo?.stripeId,
                    },
                });
            }
        })();
    }, [rep, userInfo]);

    const paymentsLink = usePaymentsLink(userInfo);

    return (
        <div className="animate-fadein flex flex-col gap-4">
            <SettingsGroup
                title="About"
                icon={
                    <svg className="h-4 w-4" viewBox="0 0 512 512">
                        <path
                            fill="currentColor"
                            d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM256 464c-114.7 0-208-93.31-208-208S141.3 48 256 48s208 93.31 208 208S370.7 464 256 464zM296 336h-16V248C280 234.8 269.3 224 256 224H224C210.8 224 200 234.8 200 248S210.8 272 224 272h8v64h-16C202.8 336 192 346.8 192 360S202.8 384 216 384h80c13.25 0 24-10.75 24-24S309.3 336 296 336zM256 192c17.67 0 32-14.33 32-32c0-17.67-14.33-32-32-32S224 142.3 224 160C224 177.7 238.3 192 256 192z"
                        />
                    </svg>
                }
            >
                {!userInfo?.aiEnabled && (
                    <p>
                        Hey{userInfo?.name && ` ${userInfo?.name}`}, welcome to your Unclutter
                        library account!
                    </p>
                )}

                <p>
                    Your library helps you to read smarter by automatically saving, organizing, and
                    connecting information from the articles you read.
                </p>
            </SettingsGroup>

            <SettingsGroup
                title="Support"
                icon={
                    <svg className="h-4 w-4" viewBox="0 0 512 512">
                        <path
                            fill="currentColor"
                            d="M244 84L255.1 96L267.1 84.02C300.6 51.37 347 36.51 392.6 44.1C461.5 55.58 512 115.2 512 185.1V190.9C512 232.4 494.8 272.1 464.4 300.4L283.7 469.1C276.2 476.1 266.3 480 256 480C245.7 480 235.8 476.1 228.3 469.1L47.59 300.4C17.23 272.1 0 232.4 0 190.9V185.1C0 115.2 50.52 55.58 119.4 44.1C164.1 36.51 211.4 51.37 244 84C243.1 84 244 84.01 244 84L244 84zM255.1 163.9L210.1 117.1C188.4 96.28 157.6 86.4 127.3 91.44C81.55 99.07 48 138.7 48 185.1V190.9C48 219.1 59.71 246.1 80.34 265.3L256 429.3L431.7 265.3C452.3 246.1 464 219.1 464 190.9V185.1C464 138.7 430.4 99.07 384.7 91.44C354.4 86.4 323.6 96.28 301.9 117.1L255.1 163.9z"
                        />
                    </svg>
                }
                buttons={
                    !userInfo?.aiEnabled && (
                        <SettingsButton
                            title="Start free trial"
                            href={paymentsLink}
                            // inNewTab={false}
                            darkModeEnabled={darkModeEnabled}
                            reportEvent={reportEvent}
                        />
                    )
                }
                className={clsx(justEnabled && "bg-amber-100")}
            >
                {userInfo?.aiEnabled ? (
                    <>
                        <p>Thank you for supporting the Unclutter open-source project!</p>
                        <p>
                            Try out the new features on any article in your library, and make sure
                            to visit the Import page too.
                        </p>
                    </>
                ) : (
                    <>
                        <p>
                            Using the Unclutter library requires a financial support of $4.99 per
                            month. This money is used to pay contributors to the Unclutter
                            open-source project.
                        </p>
                        <p>See below for an overview of the features you'll unlock!</p>
                    </>
                )}
            </SettingsGroup>

            <SettingsGroup
                title="Save articles"
                icon={
                    <svg className="h-4" viewBox="0 0 576 512">
                        <path
                            fill="currentColor"
                            d="M540.9 56.77C493.8 39.74 449.6 31.58 410.9 32.02C352.2 32.96 308.3 50 288 59.74C267.7 50 223.9 32.98 165.2 32.04C125.8 31.35 82.18 39.72 35.1 56.77C14.02 64.41 0 84.67 0 107.2v292.1c0 16.61 7.594 31.95 20.84 42.08c13.73 10.53 31.34 13.91 48.2 9.344c118.1-32 202 22.92 205.5 25.2C278.6 478.6 283.3 480 287.1 480s9.37-1.359 13.43-4.078c3.516-2.328 87.59-57.21 205.5-25.25c16.92 4.563 34.5 1.188 48.22-9.344C568.4 431.2 576 415.9 576 399.2V107.2C576 84.67 561.1 64.41 540.9 56.77zM264 416.8c-27.86-11.61-69.84-24.13-121.4-24.13c-26.39 0-55.28 3.281-86.08 11.61C53.19 405.3 50.84 403.9 50 403.2C48 401.7 48 399.8 48 399.2V107.2c0-2.297 1.516-4.531 3.594-5.282c40.95-14.8 79.61-22.36 112.8-21.84C211.3 80.78 246.8 93.75 264 101.5V416.8zM528 399.2c0 .5938 0 2.422-2 3.969c-.8438 .6407-3.141 2.063-6.516 1.109c-90.98-24.6-165.4-5.032-207.5 12.53v-315.3c17.2-7.782 52.69-20.74 99.59-21.47c32.69-.5157 71.88 7.047 112.8 21.84C526.5 102.6 528 104.9 528 107.2V399.2z"
                        />
                    </svg>
                }
                imageSrc="/media/articles.png"
            >
                <p>
                    Every article you open with Unclutter automatically gets saved in your library.
                </p>
                <p>
                    Save articles for later, access your reading queue on your mobile phone, or find
                    any article you've read in the past.
                </p>
            </SettingsGroup>

            <SettingsGroup
                title="Read faster"
                icon={
                    <svg className="h-4 w-4" viewBox="0 0 576 512">
                        <path
                            fill="currentColor"
                            d="M248.8 4.994C249.9 1.99 252.8 .0001 256 .0001C259.2 .0001 262.1 1.99 263.2 4.994L277.3 42.67L315 56.79C318 57.92 320 60.79 320 64C320 67.21 318 70.08 315 71.21L277.3 85.33L263.2 123C262.1 126 259.2 128 256 128C252.8 128 249.9 126 248.8 123L234.7 85.33L196.1 71.21C193.1 70.08 192 67.21 192 64C192 60.79 193.1 57.92 196.1 56.79L234.7 42.67L248.8 4.994zM495.3 14.06L529.9 48.64C548.6 67.38 548.6 97.78 529.9 116.5L148.5 497.9C129.8 516.6 99.38 516.6 80.64 497.9L46.06 463.3C27.31 444.6 27.31 414.2 46.06 395.4L427.4 14.06C446.2-4.686 476.6-4.686 495.3 14.06V14.06zM461.4 48L351.7 157.7L386.2 192.3L495.1 82.58L461.4 48zM114.6 463.1L352.3 226.2L317.7 191.7L80 429.4L114.6 463.1zM7.491 117.2L64 96L85.19 39.49C86.88 34.98 91.19 32 96 32C100.8 32 105.1 34.98 106.8 39.49L128 96L184.5 117.2C189 118.9 192 123.2 192 128C192 132.8 189 137.1 184.5 138.8L128 160L106.8 216.5C105.1 221 100.8 224 96 224C91.19 224 86.88 221 85.19 216.5L64 160L7.491 138.8C2.985 137.1 0 132.8 0 128C0 123.2 2.985 118.9 7.491 117.2zM359.5 373.2L416 352L437.2 295.5C438.9 290.1 443.2 288 448 288C452.8 288 457.1 290.1 458.8 295.5L480 352L536.5 373.2C541 374.9 544 379.2 544 384C544 388.8 541 393.1 536.5 394.8L480 416L458.8 472.5C457.1 477 452.8 480 448 480C443.2 480 438.9 477 437.2 472.5L416 416L359.5 394.8C354.1 393.1 352 388.8 352 384C352 379.2 354.1 374.9 359.5 373.2z"
                        />
                    </svg>
                }
                imageSrc="media/ai_highlights.png"
            >
                <p>
                    Unclutter automatically highlights the most important sentences on each article
                    you read in yellow, helping you focus on what matters.
                </p>
                <p>Just click on any such highlight to save in your library.</p>
            </SettingsGroup>

            <SettingsGroup
                title="Save quotes"
                icon={
                    <svg className="w-4" viewBox="0 0 448 512">
                        <path
                            fill="currentColor"
                            d="M296 160c-30.93 0-56 25.07-56 56s25.07 56 56 56c2.74 0 5.365-.4258 8-.8066V280c0 13.23-10.77 24-24 24C266.8 304 256 314.8 256 328S266.8 352 280 352C319.7 352 352 319.7 352 280v-64C352 185.1 326.9 160 296 160zM152 160C121.1 160 96 185.1 96 216S121.1 272 152 272C154.7 272 157.4 271.6 160 271.2V280C160 293.2 149.2 304 136 304c-13.25 0-24 10.75-24 24S122.8 352 136 352C175.7 352 208 319.7 208 280v-64C208 185.1 182.9 160 152 160zM384 32H64C28.65 32 0 60.65 0 96v320c0 35.35 28.65 64 64 64h320c35.35 0 64-28.65 64-64V96C448 60.65 419.3 32 384 32zM400 416c0 8.822-7.178 16-16 16H64c-8.822 0-16-7.178-16-16V96c0-8.822 7.178-16 16-16h320c8.822 0 16 7.178 16 16V416z"
                        />
                    </svg>
                }
                imageSrc="media/quotes.png"
            >
                <p>All your highlights are tagged and organized automatically.</p>
                <p>
                    Browse your collected quotes by topic or find all information you've seen about
                    a specific idea or fact. Your library remembers it for you.
                </p>
            </SettingsGroup>

            <SettingsGroup
                title="Connect ideas"
                icon={
                    <svg className="h-4 w-4" viewBox="0 0 512 512">
                        <path
                            fill="currentColor"
                            d="M425 182c-3.027 0-6.031 .1758-9 .5195V170C416 126.4 372.8 96 333.1 96h-4.519c.3457-2.969 .5193-5.973 .5193-9c0-48.79-43.92-87-100-87c-56.07 0-100 38.21-100 87c0 3.027 .1761 6.031 .5218 9h-56.52C33.2 96 0 129.2 0 170v66.21C0 253.8 6.77 269.9 17.85 282C6.77 294.1 0 310.2 0 327.8V438C0 478.8 33.2 512 73.1 512h110.2c17.63 0 33.72-6.77 45.79-17.85C242.1 505.2 258.2 512 275.8 512h58.21C372.8 512 416 481.6 416 438v-56.52c2.969 .3438 5.973 .5195 9 .5195C473.8 382 512 338.1 512 282S473.8 182 425 182zM425 334c-26.35 0-25.77-26-45.21-26C368.9 308 368 316.9 368 327.8V438c0 14.36-19.64 26-34 26h-58.21C264.9 464 256 455.1 256 444.2c0-19.25 25.1-18.88 25.1-45.21c0-21.54-23.28-39-52-39c-28.72 0-52 17.46-52 39c0 26.35 26 25.77 26 45.21C204 455.1 195.1 464 184.2 464H73.1C59.64 464 48 452.4 48 438v-110.2C48 316.9 56.86 308 67.79 308c19.25 0 18.88 26 45.21 26c21.54 0 39-23.28 39-52s-17.46-52-39-52C86.65 230 87.23 256 67.79 256C56.86 256 48 247.1 48 236.2V170C48 155.6 59.64 144 73.1 144h110.2C195.1 144 204 143.1 204 132.2c0-19.25-26-18.88-26-45.21c0-21.54 23.28-39 52-39c28.72 0 52 17.46 52 39C281.1 113.4 256 112.8 256 132.2C256 143.1 264.9 144 275.8 144h58.21C348.4 144 368 155.6 368 170v66.21C368 247.1 368.9 256 379.8 256c19.25 0 18.88-26 45.21-26c21.54 0 39 23.28 39 52S446.5 334 425 334z"
                        />
                    </svg>
                }
                imageSrc="media/connect_ideas.png"
            >
                <p>
                    Quotes from your library also automatically appear whenever you create a related
                    highlight on another article, helping you connect different ideas.
                </p>
                <p>
                    For example, if a text mentions Google and AI search, you'll see everything
                    you've read about Google's AI research and chatGPT right next to it.
                </p>
            </SettingsGroup>

            <SettingsGroup
                title="Import articles"
                icon={
                    <svg className="h-4 w-4" viewBox="0 0 512 512">
                        <path
                            fill="currentColor"
                            d="M263 383C258.3 387.7 256 393.8 256 400s2.344 12.28 7.031 16.97c9.375 9.375 24.56 9.375 33.94 0l80-80c9.375-9.375 9.375-24.56 0-33.94l-80-80c-9.375-9.375-24.56-9.375-33.94 0s-9.375 24.56 0 33.94L302.1 296H24C10.75 296 0 306.8 0 320s10.75 24 24 24h278.1L263 383zM493.3 93.38l-74.63-74.64C406.6 6.742 390.3 0 373.4 0H192C156.7 0 127.1 28.66 128 64l.0078 168c.002 13.26 10.75 24 24 24s24-10.75 23.1-24L176 64.13c0-8.836 7.162-16 16-16h160L352 128c0 17.67 14.33 32 32 32h79.1v288c0 8.836-7.164 16-16 16H192c-8.838 0-16-7.164-16-16l-.002-40C176 394.7 165.3 384 152 384s-24 10.75-23.1 24L128 448c.002 35.34 28.65 64 64 64H448c35.2 0 64-28.8 64-64V138.6C512 121.7 505.3 105.4 493.3 93.38z"
                        />
                    </svg>
                }
                imageSrc="/media/import.png"
            >
                <p>The more you read, the smarter your library becomes.</p>
                <p>
                    You can also import articles to make use of the knowledge you've already
                    accumulated with Pocket, Instapaper, Raindrop, or your browser bookmarks.
                </p>
            </SettingsGroup>
        </div>
    );
}
