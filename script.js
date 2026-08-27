/*
============================================================
STAR CINEMA PERSONAL LINEUP
VERSION 13.12
============================================================

Keeps:
✓ Working grid detection
✓ Per-cell OCR
✓ Tolerant time parsing
✓ Chronological schedule
✓ 1 server = ALL ROWS
✓ 2 servers = split rows
✓ 3rd row = conditional over 50
✓ OCR name cleanup and duplicate merging
✓ Bold movie timeframe
✓ Compact schedule support

Improves:
✓ Detected Text fully hides after personal schedule opens
✓ Detected Text resets properly for a new uploaded lineup
✓ More tolerant grid-line brightness detection
✓ Detects the theater-table body dynamically
✓ Handles differently cropped / scaled lineup screenshots
============================================================
*/


// =========================================================
// DOM
// =========================================================

const imageInput =
    document.getElementById("lineupImage");

const imagePreview =
    document.getElementById("imagePreview");

const previewContainer =
    document.getElementById("previewContainer");

const readButton =
    document.getElementById("readButton");

const serverSection =
    document.getElementById("serverSection");

const serverSelect =
    document.getElementById("serverSelect");

const scheduleSection =
    document.getElementById("scheduleSection");

const scheduleList =
    document.getElementById("scheduleList");

const scheduleName =
    document.getElementById("scheduleName");

const scheduleDate =
    document.getElementById("scheduleDate");

const loading =
    document.getElementById("loading");

const progressBar =
    document.getElementById("progressBar");

const debugSection =
    document.getElementById("debugSection");

const detectedText =
    document.getElementById("detectedText");


let uploadedFile = null;
let lineupData = [];


// =========================================================
// THEATER ROW RULES
// =========================================================

const theaterRows = {

    1: [
        { normal: "ACE",  over50: "AD" },
        { normal: "BD",   over50: "BE" },
        { normal: "C",    over50: "C" }
    ],

    2: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDF",  over50: "BE" },
        { normal: "CF",   over50: "CF" }
    ],

    3: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDFH", over50: "BEH" },
        { normal: "CF",   over50: "CF" }
    ],

    4: [
        { normal: "ACE",  over50: "ADG" },
        { normal: "BDF",  over50: "BE" },
        { normal: "CF",   over50: "CF" }
    ],

    5: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDF",  over50: "BE" },
        { normal: "CF",   over50: "CF" }
    ],

    6: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDFH", over50: "BEH" },
        { normal: "CF",   over50: "CF" }
    ],

    7: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDF",  over50: "BE" },
        { normal: "CF",   over50: "CF" }
    ],

    8: [
        { normal: "ACE",  over50: "AD" },
        { normal: "BD",   over50: "BE" },
        { normal: "C",    over50: "C" }
    ]

};


// =========================================================
// IMAGE UPLOAD
// =========================================================

imageInput.addEventListener(
    "change",
    () => {

        uploadedFile =
            imageInput.files[0];

        if (!uploadedFile) {
            return;
        }


        const url =
            URL.createObjectURL(
                uploadedFile
            );


        imagePreview.src =
            url;


        imagePreview.onload =
            () => {

                URL.revokeObjectURL(
                    url
                );

            };


        previewContainer
            .classList
            .remove("hidden");


        readButton
            .classList
            .remove("hidden");


        serverSection
            .classList
            .add("hidden");


        scheduleSection
            .classList
            .add("hidden");


        // Reset debug display so it can be shown again
        // when a new lineup is processed.
        debugSection.style.display =
            "";

        debugSection
            .classList
            .add("hidden");


        lineupData = [];

    }
);


// =========================================================
// READ LINEUP
// =========================================================

readButton.addEventListener(
    "click",
    async () => {

        if (!uploadedFile) {

            alert(
                "Upload a lineup screenshot first."
            );

            return;

        }


        readButton.disabled =
            true;


        readButton.textContent =
            "Detecting Spreadsheet...";


        loading
            .classList
            .remove("hidden");


        progressBar.style.width =
            "0%";


        serverSection
            .classList
            .add("hidden");


        scheduleSection
            .classList
            .add("hidden");


        // Make sure Detected Text can appear during OCR,
        // even if it was force-hidden previously.
        debugSection.style.display =
            "";

        debugSection
            .classList
            .remove("hidden");


        detectedText.textContent =
            "Loading image...\n";


        try {

            const image =
                await loadImage(
                    uploadedFile
                );


            detectedText.textContent +=
                `Image: ${image.width} x ${image.height}\n`;


            const analysis =
                createAnalysisCanvas(
                    image
                );


            // ---------------------------------------------
            // DETECT COMPLETE SCHEDULE GRID
            // ---------------------------------------------

            /*
            Version 13.11 no longer starts by asking for six long
            vertical lines. Some Star Cinema exports interrupt those
            lines enough that a vertical-first detector can find zero.

            Horizontal theater-row lines are much more consistent across
            schedule exports, so detect the 41 theater grid lines first,
            infer the table width, then refine the seven vertical table
            boundaries from their expected positions.
            */
            const geometry =
                detectScheduleGrid(
                    analysis
                );


            let columns =
                geometry.columns;


            let rows =
                geometry.rows;


            detectedText.textContent +=
                `Grid strategy: ${geometry.strategy}\n`;


            detectedText.textContent +=
                `Showing column edges: ${columns.length}\n`;


            detectedText.textContent +=
                `Horizontal grid lines: ${rows.length}\n`;


            if (
                columns.length === 6
            ) {

                detectedText.textContent +=
                    `Column X: ${columns.map(
                        value =>
                            Math.round(
                                value
                            )
                    ).join(", ")}\n`;

            }


            if (
                rows.length === 41
            ) {

                detectedText.textContent +=
                    `Grid Y: ${Math.round(rows[0])} → ${Math.round(
                        rows[
                            rows.length - 1
                        ]
                    )}\n`;

            }


            /*
            Keep the older detector as a fallback. This gives us two
            independent ways to understand the same schedule instead of
            making one screenshot style a single point of failure.
            */
            if (
                columns.length !== 6 ||
                rows.length !== 41
            ) {

                const fallbackColumns =
                    detectShowingColumns(
                        analysis
                    );


                if (
                    fallbackColumns.length === 6
                ) {

                    const fallbackRows =
                        detectTheaterGrid(
                            analysis,
                            fallbackColumns[0],
                            fallbackColumns[5]
                        );


                    if (
                        fallbackRows.length === 41
                    ) {

                        columns =
                            fallbackColumns;


                        rows =
                            fallbackRows;


                        detectedText.textContent +=
                            "Fallback grid detector succeeded.\n";

                    }

                }

            }


            if (
                columns.length !== 6
            ) {

                throw new Error(
                    `Expected 6 column edges, found ${columns.length}.`
                );

            }


            if (
                rows.length !== 41
            ) {

                throw new Error(
                    `Expected 41 horizontal lines, found ${rows.length}.`
                );

            }


            detectedText.textContent +=
                "\nGrid detection successful.\n";


            // ---------------------------------------------
            // OCR WORKER
            // ---------------------------------------------

            readButton.textContent =
                "Starting OCR...";


            const worker =
                await Tesseract.createWorker(
                    "eng",
                    1
                );


            // ---------------------------------------------
            // TIME OCR
            // ---------------------------------------------

            await worker.setParameters({

                tessedit_pageseg_mode:
                    Tesseract.PSM?.SINGLE_LINE || 7,

                tessedit_char_whitelist:
                    "0123456789:.-apmAPM"

            });


            detectedText.textContent +=
                "\nTIME CELL OCR\n";


            detectedText.textContent +=
                "====================================\n";


            const detectedShowings =
                [];


            let counter =
                0;


            for (
                let theater = 1;
                theater <= 8;
                theater++
            ) {

                const base =
                    (
                        theater - 1
                    ) * 5;


                const timeTop =
                    rows[
                        base + 1
                    ];


                const timeBottom =
                    rows[
                        base + 2
                    ];


                for (
                    let column = 0;
                    column < 5;
                    column++
                ) {

                    counter++;


                    readButton.textContent =
                        `Reading times ${counter}/40...`;


                    progressBar.style.width =
                        `${(counter / 40) * 50}%`;


                    const left =
                        columns[
                            column
                        ];


                    const right =
                        columns[
                            column + 1
                        ];


                    const adaptiveTime =
                        await ocrTimeCellAdaptive(
                            worker,
                            image,
                            left,
                            right,
                            rows[base],
                            rows[base + 1],
                            rows[base + 2]
                        );


                    const raw =
                        adaptiveTime.raw;


                    const normalized =
                        normalizeTimeOCR(
                            raw
                        );


                    const parsed =
                        adaptiveTime.parsed;


                    detectedText.textContent +=
                        `T${theater} C${column + 1}: "${raw || "(blank)"}"`;


                    if (
                        normalized !== raw
                    ) {

                        detectedText.textContent +=
                            ` -> "${normalized}"`;

                    }


                    detectedText.textContent +=
                        parsed
                            ? "  ✓\n"
                            : "  ✗\n";


                    if (!parsed) {
                        continue;
                    }


                    detectedShowings.push({

                        theater,

                        column,

                        left,

                        right,

                        base,

                        ...parsed,

                        servers: [],

                        rules:
                            theaterRows[
                                theater
                            ],

                        rawTime:
                            raw

                    });

                }

            }


            detectedText.textContent +=
                `\nValid showings found: ${detectedShowings.length}\n`;


            // ---------------------------------------------
            // SERVER OCR
            // ---------------------------------------------

            await worker.setParameters({

                tessedit_pageseg_mode:
                    Tesseract.PSM?.SINGLE_LINE || 7,

                tessedit_char_whitelist:
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'()-"

            });


            detectedText.textContent +=
                "\nSERVER OCR\n";


            detectedText.textContent +=
                "====================================\n";


            let serverCounter =
                0;


            const totalServerCells =
                detectedShowings.length *
                3;


            for (
                const showing of
                detectedShowings
            ) {

                const base =
                    showing.base;


                const serverBounds = [

                    [
                        rows[base + 2],
                        rows[base + 3]
                    ],

                    [
                        rows[base + 3],
                        rows[base + 4]
                    ],

                    [
                        rows[base + 4],
                        rows[base + 5]
                    ]

                ];


                for (
                    let position = 0;
                    position < 3;
                    position++
                ) {

                    serverCounter++;


                    readButton.textContent =
                        `Reading names ${serverCounter}/${totalServerCells}...`;


                    const secondHalfProgress =
                        totalServerCells
                            ? (
                                serverCounter /
                                totalServerCells
                            ) * 50
                            : 50;


                    progressBar.style.width =
                        `${50 + secondHalfProgress}%`;


                    const [
                        top,
                        bottom
                    ] =
                        serverBounds[
                            position
                        ];


                    const nameOCR =
                        await ocrCell(
                            worker,
                            image,
                            showing.left,
                            top,
                            showing.right,
                            bottom,
                            "name"
                        );


                    const raw =
                        nameOCR.text ||
                        "";


                    const confidence =
                        Number(
                            nameOCR.confidence ||
                            0
                        );


                    let name =
                        cleanServerName(
                            raw
                        );


                    /*
                    Blank spreadsheet cells can occasionally produce
                    plausible-looking fake names. Their OCR confidence
                    is usually much lower than real printed names.
                    */
                    if (
                        name &&
                        confidence <
                        52
                    ) {

                        name =
                            "";

                    }


                    if (raw) {

                        detectedText.textContent +=

                            `T${showing.theater} ` +
                            `${showing.start} ` +
                            `row ${position + 1}: ` +
                            `"${raw}"`;


                        detectedText.textContent +=
                            ` [${Math.round(confidence)}%]`;


                        if (name) {

                            detectedText.textContent +=
                                ` -> ${name}`;

                        }


                        else if (
                            raw &&
                            confidence <
                            52
                        ) {

                            detectedText.textContent +=
                                " -> rejected low confidence";

                        }


                        detectedText.textContent +=
                            "\n";

                    }


                    if (!name) {
                        continue;
                    }


                    showing.servers.push({

                        name,

                        confidence,

                        position:
                            position + 1,

                        conditional:
                            position === 2,

                        rows:
                            "",

                        over50:
                            ""

                    });

                }

            }


            await worker.terminate();


            lineupData =
                detectedShowings;


            // ---------------------------------------------
            // NAME CLEANUP
            // ---------------------------------------------

            canonicalizeServerNames();


            // ---------------------------------------------
            // ASSIGN ROWS
            // ---------------------------------------------

            lineupData.forEach(
                applyAssignmentRules
            );


            populateServers();


            appendDetectedLineup();


            if (!lineupData.length) {

                alert(
                    "The grid was detected, but no showtimes could be read."
                );

            }

            else {

                serverSection
                    .classList
                    .remove("hidden");


                serverSection
                    .scrollIntoView({
                        behavior: "smooth"
                    });

            }

        }

        catch (error) {

            console.error(
                error
            );


            detectedText.textContent +=
                "\n\nERROR\n";


            detectedText.textContent +=
                "====================================\n";


            detectedText.textContent +=
                error?.stack ||
                error?.message ||
                String(error);


            alert(
                "There was a problem reading the lineup. Scroll down to Detected Text."
            );

        }


        loading
            .classList
            .add("hidden");


        readButton.disabled =
            false;


        readButton.textContent =
            "Read Lineup";

    }
);


// =========================================================
// LOAD IMAGE
// =========================================================

function loadImage(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const image =
                new Image();


            const url =
                URL.createObjectURL(
                    file
                );


            image.onload =
                () => {

                    URL.revokeObjectURL(
                        url
                    );


                    resolve(
                        image
                    );

                };


            image.onerror =
                () => {

                    URL.revokeObjectURL(
                        url
                    );


                    reject(
                        new Error(
                            "Could not load image."
                        )
                    );

                };


            image.src =
                url;

        }
    );

}


// =========================================================
// ANALYSIS CANVAS
// =========================================================

function createAnalysisCanvas(
    image
) {

    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        image.width;


    canvas.height =
        image.height;


    const ctx =
        canvas.getContext(
            "2d",
            {
                willReadFrequently:
                    true
            }
        );


    ctx.drawImage(
        image,
        0,
        0
    );


    const imageData =
        ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );


    return {

        data:
            imageData.data,

        width:
            canvas.width,

        height:
            canvas.height

    };

}


// =========================================================
// PIXEL BRIGHTNESS
// =========================================================

function brightnessAt(
    analysis,
    x,
    y
) {

    x =
        Math.max(
            0,
            Math.min(
                analysis.width - 1,
                Math.round(x)
            )
        );


    y =
        Math.max(
            0,
            Math.min(
                analysis.height - 1,
                Math.round(y)
            )
        );


    const i =
        (
            y *
            analysis.width +
            x
        ) * 4;


    return (

        analysis.data[i] +
        analysis.data[i + 1] +
        analysis.data[i + 2]

    ) / 3;

}


// =========================================================
// VERSION 13.11: COMPLETE GRID DETECTION
// =========================================================

function detectScheduleGrid(
    analysis
) {

    /*
    VERSION 13.12

    Step 1:
    Detect the 41 horizontal lines that define the eight theater
    blocks.

    Step 2:
    Once those rows are known, inspect ONLY the theater-table body
    for vertical lines. This avoids assuming that the Theater label
    column is the same width as the five showing columns.

    Step 3:
    Choose seven vertical boundaries:
        left theater edge
        theater/showing divider
        five remaining showing boundaries

    OCR then uses boundaries 1..6 as the five showing columns.
    */

    const horizontalPasses = [
        { brightness: 110, support: 0.36 },
        { brightness: 135, support: 0.36 },
        { brightness: 160, support: 0.36 },
        { brightness: 185, support: 0.34 },
        { brightness: 210, support: 0.32 },
        { brightness: 230, support: 0.30 }
    ];


    let bestRows =
        [];


    let bestCandidateCount =
        Infinity;


    for (
        const pass of
        horizontalPasses
    ) {

        const candidates =
            [];


        const stepX =
            Math.max(
                1,
                Math.round(
                    analysis.width /
                    1200
                )
            );


        for (
            let y = 0;
            y < analysis.height;
            y++
        ) {

            let dark =
                0;


            let samples =
                0;


            for (
                let x = 0;
                x < analysis.width;
                x += stepX
            ) {

                samples++;


                if (
                    brightnessAt(
                        analysis,
                        x,
                        y
                    ) <
                    pass.brightness
                ) {

                    dark++;

                }

            }


            if (
                samples &&
                dark /
                samples >=
                pass.support
            ) {

                candidates.push(
                    y
                );

            }

        }


        const clustered =
            clusterPositions(
                candidates,
                Math.max(
                    3,
                    Math.round(
                        analysis.height *
                        0.003
                    )
                )
            );


        const rows =
            findBestTheaterGrid(
                clustered
            );


        if (
            rows.length === 41 &&
            clustered.length <
            bestCandidateCount
        ) {

            bestRows =
                rows;


            bestCandidateCount =
                clustered.length;

        }

    }


    if (
        bestRows.length !== 41
    ) {

        return {
            rows:
                [],
            columns:
                [],
            strategy:
                "horizontal-first failed"
        };

    }


    const top =
        Math.max(
            0,
            Math.round(
                bestRows[0]
            )
        );


    const bottom =
        Math.min(
            analysis.height - 1,
            Math.round(
                bestRows[
                    bestRows.length - 1
                ]
            )
        );


    /*
    Score every x position by how often it behaves like a vertical
    rule INSIDE row interiors. Sampling row interiors instead of
    horizontal boundaries prevents every horizontal line from
    looking like a vertical line.
    */

    const sampleYs =
        [];


    for (
        let i = 0;
        i < bestRows.length - 1;
        i++
    ) {

        const a =
            bestRows[i];


        const b =
            bestRows[i + 1];


        const gap =
            b - a;


        if (
            gap <= 2
        ) {

            continue;

        }


        /*
        Three samples per row interior make the score tolerant of
        text crossing a boundary at any one y position.
        */
        sampleYs.push(
            a + gap * 0.25,
            a + gap * 0.50,
            a + gap * 0.75
        );

    }


    const scores =
        new Array(
            analysis.width
        ).fill(0);


    let maximumScore =
        0;


    for (
        let x = 0;
        x < analysis.width;
        x++
    ) {

        let dark =
            0;


        let veryDark =
            0;


        for (
            const sampleY of
            sampleYs
        ) {

            const y =
                Math.max(
                    top,
                    Math.min(
                        bottom,
                        Math.round(
                            sampleY
                        )
                    )
                );


            const value =
                Math.min(
                    brightnessAt(
                        analysis,
                        x,
                        y
                    ),
                    brightnessAt(
                        analysis,
                        x,
                        y - 1
                    ),
                    brightnessAt(
                        analysis,
                        x,
                        y + 1
                    )
                );


            if (
                value <
                190
            ) {

                dark++;

            }


            if (
                value <
                105
            ) {

                veryDark++;

            }

        }


        const score =
            (
                dark +
                veryDark *
                0.35
            ) /
            Math.max(
                1,
                sampleYs.length
            );


        scores[x] =
            score;


        if (
            score >
            maximumScore
        ) {

            maximumScore =
                score;

        }

    }


    /*
    Build candidate vertical rules at several relative thresholds.
    We keep the best seven-line geometry found across all passes.
    */

    const thresholdFractions = [
        0.72,
        0.64,
        0.56,
        0.48,
        0.40,
        0.34
    ];


    let bestVerticalSet =
        null;


    let bestVerticalScore =
        Infinity;


    for (
        const fraction of
        thresholdFractions
    ) {

        const threshold =
            Math.max(
                0.10,
                maximumScore *
                fraction
            );


        const rawCandidates =
            [];


        for (
            let x = 0;
            x < analysis.width;
            x++
        ) {

            if (
                scores[x] >=
                threshold
            ) {

                rawCandidates.push(
                    x
                );

            }

        }


        const clustered =
            clusterPositions(
                rawCandidates,
                Math.max(
                    2,
                    Math.round(
                        analysis.width *
                        0.0035
                    )
                )
            );


        /*
        Refine each cluster to the actual peak-score x rather than
        merely using the cluster average.
        */
        const candidates =
            clustered.map(
                center => {

                    const radius =
                        Math.max(
                            2,
                            Math.round(
                                analysis.width *
                                0.006
                            )
                        );


                    const left =
                        Math.max(
                            0,
                            Math.floor(
                                center -
                                radius
                            )
                        );


                    const right =
                        Math.min(
                            analysis.width - 1,
                            Math.ceil(
                                center +
                                radius
                            )
                        );


                    let bestX =
                        Math.round(
                            center
                        );


                    let bestScore =
                        -1;


                    for (
                        let x = left;
                        x <= right;
                        x++
                    ) {

                        if (
                            scores[x] >
                            bestScore
                        ) {

                            bestScore =
                                scores[x];


                            bestX =
                                x;

                        }

                    }


                    return bestX;

                }
            )
            .filter(
                (
                    value,
                    index,
                    array
                ) =>
                    index === 0 ||
                    Math.abs(
                        value -
                        array[index - 1]
                    ) >
                    2
            );


        if (
            candidates.length <
            7
        ) {

            continue;

        }


        /*
        Evaluate every consecutive set of seven candidate rules.

        We do NOT require the first gap (Theater label column) to
        equal the five showing widths. Only the final five gaps need
        to be close to uniform.
        */

        for (
            let startIndex = 0;
            startIndex <=
            candidates.length - 7;
            startIndex++
        ) {

            const set =
                candidates.slice(
                    startIndex,
                    startIndex + 7
                );


            const gaps =
                [];


            for (
                let i = 0;
                i < 6;
                i++
            ) {

                gaps.push(
                    set[i + 1] -
                    set[i]
                );

            }


            if (
                gaps.some(
                    gap =>
                        gap <=
                        analysis.width *
                        0.035
                )
            ) {

                continue;

            }


            const showingGaps =
                gaps.slice(
                    1
                );


            const showingMedian =
                median(
                    showingGaps
                );


            if (
                !showingMedian
            ) {

                continue;

            }


            const showingError =
                showingGaps.reduce(
                    (
                        sum,
                        gap
                    ) =>
                        sum +
                        Math.abs(
                            gap -
                            showingMedian
                        ) /
                        showingMedian,
                    0
                ) /
                showingGaps.length;


            const labelRatio =
                gaps[0] /
                showingMedian;


            /*
            Star Cinema exports vary, but the theater-label column is
            still in roughly the same scale as a showing column.
            Keep this intentionally broad.
            */
            if (
                labelRatio <
                0.45 ||
                labelRatio >
                1.65
            ) {

                continue;

            }


            const totalWidth =
                set[6] -
                set[0];


            if (
                totalWidth <
                analysis.width *
                0.45 ||
                totalWidth >
                analysis.width *
                0.95
            ) {

                continue;

            }


            const lineStrength =
                set.reduce(
                    (
                        sum,
                        x
                    ) =>
                        sum +
                        scores[x],
                    0
                ) /
                set.length;


            const centeredness =
                Math.abs(
                    (
                        set[0] +
                        set[6]
                    ) /
                    2 -
                    analysis.width /
                    2
                ) /
                analysis.width;


            const geometryScore =
                showingError *
                4 +
                Math.abs(
                    labelRatio -
                    0.85
                ) *
                0.30 +
                centeredness *
                0.30 -
                lineStrength *
                0.65;


            if (
                geometryScore <
                bestVerticalScore
            ) {

                bestVerticalScore =
                    geometryScore;


                bestVerticalSet =
                    set;

            }

        }

    }


    if (
        !bestVerticalSet
    ) {

        return {
            rows:
                bestRows,
            columns:
                [],
            strategy:
                "horizontal rows found; direct vertical rules failed"
        };

    }


    return {
        rows:
            bestRows,

        /*
        Skip the Theater-label column's left edge. The remaining six
        rules bound the five showing columns.
        */
        columns:
            bestVerticalSet.slice(
                1
            ),

        strategy:
            "horizontal-first + direct vertical rules"
    };

}


// =========================================================
// COLUMN DETECTION
// =========================================================

function detectShowingColumns(
    analysis
) {

    /*
    VERSION 13.10 ADAPTIVE COLUMN DETECTION

    Previous versions used one fixed darkness/support threshold.
    That works for some screenshots but fails when the same lineup
    is exported at a different scale, contrast, or crop.

    This detector tries several vertical ranges and brightness
    thresholds, then derives its support threshold from the image
    itself. It therefore looks for the strongest long vertical grid
    lines rather than assuming a particular screenshot style.
    */

    const passes = [
        { top: 0.08, bottom: 0.96, brightness: 215 },
        { top: 0.14, bottom: 0.94, brightness: 205 },
        { top: 0.20, bottom: 0.92, brightness: 195 },
        { top: 0.28, bottom: 0.90, brightness: 185 },
        { top: 0.10, bottom: 0.98, brightness: 230 }
    ];


    let best =
        null;


    for (
        const pass of
        passes
    ) {

        const yStart =
            Math.max(
                0,
                Math.floor(
                    analysis.height *
                    pass.top
                )
            );


        const yEnd =
            Math.min(
                analysis.height,
                Math.ceil(
                    analysis.height *
                    pass.bottom
                )
            );


        const stepY =
            Math.max(
                1,
                Math.round(
                    analysis.height /
                    900
                )
            );


        const sampledRows =
            Math.max(
                1,
                Math.ceil(
                    (
                        yEnd -
                        yStart
                    ) /
                    stepY
                )
            );


        const ratios =
            new Array(
                analysis.width
            ).fill(0);


        let maximumRatio =
            0;


        for (
            let x = 0;
            x < analysis.width;
            x++
        ) {

            let dark =
                0;


            for (
                let y = yStart;
                y < yEnd;
                y += stepY
            ) {

                if (
                    brightnessAt(
                        analysis,
                        x,
                        y
                    ) <
                    pass.brightness
                ) {

                    dark++;

                }

            }


            const ratio =
                dark /
                sampledRows;


            ratios[x] =
                ratio;


            if (
                ratio >
                maximumRatio
            ) {

                maximumRatio =
                    ratio;

            }

        }


        if (
            maximumRatio <
            0.08
        ) {

            continue;

        }


        /*
        Use a threshold relative to the strongest vertical line in
        this particular image. Clamp it so faint-but-real grid lines
        can still be found without admitting ordinary text columns.
        */
        const supportThreshold =
            Math.max(
                0.10,
                Math.min(
                    0.46,
                    maximumRatio *
                    0.50
                )
            );


        const candidates =
            [];


        for (
            let x = 0;
            x < analysis.width;
            x++
        ) {

            if (
                ratios[x] >=
                supportThreshold
            ) {

                candidates.push(
                    x
                );

            }

        }


        let lines =
            clusterPositions(
                candidates,
                Math.max(
                    3,
                    Math.round(
                        analysis.width *
                        0.004
                    )
                )
            );


        lines =
            lines.filter(
                x =>
                    x >
                    analysis.width *
                    0.025 &&
                    x <
                    analysis.width *
                    0.995
            );


        const set =
            findBestColumnSet(
                lines,
                analysis.width
            );


        if (
            set.length !==
            6
        ) {

            continue;

        }


        const gaps =
            [];


        for (
            let i = 0;
            i < 5;
            i++
        ) {

            gaps.push(
                set[i + 1] -
                set[i]
            );

        }


        const averageGap =
            gaps.reduce(
                (
                    a,
                    b
                ) =>
                    a + b,
                0
            ) /
            gaps.length;


        const variance =
            gaps.reduce(
                (
                    sum,
                    gap
                ) => {

                    const d =
                        gap -
                        averageGap;


                    return (
                        sum +
                        d * d
                    );

                },
                0
            ) /
            gaps.length;


        const geometryScore =
            averageGap
                ? Math.sqrt(
                    variance
                ) /
                    averageGap
                : 999;


        const supportScore =
            set.reduce(
                (
                    sum,
                    x
                ) =>
                    sum +
                    ratios[
                        Math.max(
                            0,
                            Math.min(
                                analysis.width - 1,
                                Math.round(x)
                            )
                        )
                    ],
                0
            ) /
            set.length;


        const totalScore =
            geometryScore -
            supportScore *
            0.20;


        if (
            !best ||
            totalScore <
            best.score
        ) {

            best = {
                set,
                score:
                    totalScore
            };

        }

    }


    return best
        ? best.set
        : [];

}


function findBestColumnSet(
    lines,
    imageWidth = null
) {

    if (
        lines.length <
        6
    ) {

        return [];

    }


    const possible =
        [];


    /*
    Usually there are only a handful of strong lines. Search every
    ordered 6-line combination when practical so extra page borders
    or the Theater-label boundary cannot throw the detector off.
    */
    function considerSet(
        set
    ) {

        const gaps =
            [];


        for (
            let i = 0;
            i < 5;
            i++
        ) {

            const gap =
                set[i + 1] -
                set[i];


            if (
                gap <= 0
            ) {

                return;

            }


            gaps.push(
                gap
            );

        }


        const average =
            gaps.reduce(
                (
                    a,
                    b
                ) =>
                    a + b,
                0
            ) /
            gaps.length;


        if (
            average <= 0
        ) {

            return;

        }


        const variance =
            gaps.reduce(
                (
                    sum,
                    gap
                ) => {

                    const d =
                        gap -
                        average;


                    return (
                        sum +
                        d * d
                    );

                },
                0
            ) /
            gaps.length;


        const cv =
            Math.sqrt(
                variance
            ) /
            average;


        const span =
            set[5] -
            set[0];


        if (
            cv >
            0.24
        ) {

            return;

        }


        if (
            imageWidth &&
            (
                span <
                imageWidth *
                0.38 ||
                span >
                imageWidth *
                0.90
            )
        ) {

            return;

        }


        possible.push({
            set,
            score:
                cv,
            right:
                set[5],
            span
        });

    }


    if (
        lines.length <=
        12
    ) {

        for (
            let a = 0;
            a < lines.length - 5;
            a++
        ) {

            for (
                let b = a + 1;
                b < lines.length - 4;
                b++
            ) {

                for (
                    let c = b + 1;
                    c < lines.length - 3;
                    c++
                ) {

                    for (
                        let d = c + 1;
                        d < lines.length - 2;
                        d++
                    ) {

                        for (
                            let e = d + 1;
                            e < lines.length - 1;
                            e++
                        ) {

                            for (
                                let f = e + 1;
                                f < lines.length;
                                f++
                            ) {

                                considerSet([
                                    lines[a],
                                    lines[b],
                                    lines[c],
                                    lines[d],
                                    lines[e],
                                    lines[f]
                                ]);

                            }

                        }

                    }

                }

            }

        }

    }


    else {

        /*
        Defensive fallback for unusually noisy images: test nearby
        sequences instead of exploding combinatorially.
        */
        for (
            let start = 0;
            start <=
            lines.length - 6;
            start++
        ) {

            considerSet(
                lines.slice(
                    start,
                    start + 6
                )
            );

        }

    }


    if (
        !possible.length
    ) {

        return [];

    }


    possible.sort(
        (
            a,
            b
        ) => {

            const scoreDifference =
                a.score -
                b.score;


            if (
                Math.abs(
                    scoreDifference
                ) >
                0.035
            ) {

                return scoreDifference;

            }


            /*
            When two sets are similarly regular, prefer the set
            farther right. This excludes the left Theater-label
            column and retains the five showing columns.
            */
            return (
                b.right -
                a.right
            );

        }
    );


    return possible[0].set;

}


// =========================================================
// DETECT THE VERTICAL RANGE OF THE THEATER TABLE
// =========================================================

function detectTheaterBodyRange(
    analysis,
    columns
) {

    if (
        !columns ||
        columns.length !== 6
    ) {

        return null;

    }


    const requiredEdges =
        Math.max(
            3,
            Math.ceil(
                columns.length *
                0.65
            )
        );


    const qualifying =
        [];


    for (
        let y = 0;
        y < analysis.height;
        y++
    ) {

        let matches =
            0;


        for (
            const x of
            columns
        ) {

            if (
                brightnessAt(
                    analysis,
                    x,
                    y
                ) <
                190
            ) {

                matches++;

            }

        }


        if (
            matches >=
            requiredEdges
        ) {

            qualifying.push(
                y
            );

        }

    }


    if (
        !qualifying.length
    ) {

        return null;

    }


    /*
    Convert qualifying rows into runs. Tiny interruptions are
    ignored because text can temporarily cover a grid line.
    */

    const runs =
        [];


    let start =
        qualifying[0];


    let previous =
        qualifying[0];


    for (
        let i = 1;
        i < qualifying.length;
        i++
    ) {

        const current =
            qualifying[i];


        if (
            current -
            previous <=
            5
        ) {

            previous =
                current;

            continue;

        }


        runs.push({
            top:
                start,
            bottom:
                previous,
            height:
                previous -
                start +
                1
        });


        start =
            current;


        previous =
            current;

    }


    runs.push({
        top:
            start,
        bottom:
            previous,
        height:
            previous -
                start +
                1
    });


    runs.sort(
        (
            a,
            b
        ) =>
            b.height -
            a.height
    );


    if (
        !runs.length
    ) {

        return null;

    }


    return runs[0];

}


// =========================================================
// HORIZONTAL GRID
// =========================================================

function detectTheaterGrid(
    analysis,
    left,
    right
) {

    const candidates =
        [];


    const xStart =
        Math.floor(
            left + 2
        );


    const xEnd =
        Math.ceil(
            right - 2
        );


    const samples =
        Math.max(
            1,
            Math.floor(
                (
                    xEnd -
                    xStart
                ) / 2
            )
        );


    const columns =
        detectShowingColumns(
            analysis
        );


    const body =
        detectTheaterBodyRange(
            analysis,
            columns
        );


    const yStart =
        body
            ? Math.max(
                0,
                body.top - 3
            )
            : Math.floor(
                analysis.height *
                0.08
            );


    const yEnd =
        body
            ? Math.min(
                analysis.height - 1,
                body.bottom + 3
            )
            : Math.ceil(
                analysis.height *
                0.95
            );


    for (
        let y = yStart;
        y <= yEnd;
        y++
    ) {

        let dark =
            0;


        for (
            let x = xStart;
            x <= xEnd;
            x += 2
        ) {

            if (
                brightnessAt(
                    analysis,
                    x,
                    y
                ) < 185
            ) {

                dark++;

            }

        }


        /*
        A true horizontal grid line crosses almost the entire
        showing area. Requiring strong coverage filters out text.
        */

        if (
            dark /
            samples >
            0.88
        ) {

            candidates.push(
                y
            );

        }

    }


    let lines =
        clusterPositions(
            candidates,
            4
        );


    lines =
        lines.filter(
            y =>

                y >
                analysis.height *
                0.02 &&

                y <
                analysis.height *
                0.99
        );


    return findBestTheaterGrid(
        lines,
        body
    );

}


function findBestTheaterGrid(
    lines,
    body = null
) {

    if (
        lines.length <
        41
    ) {

        return [];

    }


    if (
        lines.length === 41
    ) {

        return lines;

    }


    let best =
        null;


    let bestScore =
        Infinity;


    for (
        let start = 0;
        start <=
        lines.length - 41;
        start++
    ) {

        const set =
            lines.slice(
                start,
                start + 41
            );


        const gaps =
            [];


        let valid =
            true;


        for (
            let i = 0;
            i < 40;
            i++
        ) {

            const gap =
                set[i + 1] -
                set[i];


            if (
                gap <= 0
            ) {

                valid =
                    false;

                break;

            }


            gaps.push(
                gap
            );

        }


        if (!valid) {
            continue;
        }


        const gapMedian =
            median(
                gaps
            );


        if (
            !gapMedian
        ) {

            continue;

        }


        /*
        Penalize only truly abnormal spacing. Theater-header
        heights vary from schedule to schedule, so we no longer
        assume every fifth gap must be 35% taller.
        */

        let score =
            0;


        gaps.forEach(
            gap => {

                const ratio =
                    gap /
                    gapMedian;


                if (
                    ratio < 0.45 ||
                    ratio > 2.60
                ) {

                    score +=
                        10;

                }


                score +=
                    Math.abs(
                        gap -
                        gapMedian
                    ) /
                    gapMedian *
                    0.05;

            }
        );


        /*
        If we dynamically detected the theater-table body,
        heavily favor the 41-line set whose first and last
        boundaries match that body.
        */

        if (body) {

            score +=
                Math.abs(
                    set[0] -
                    body.top
                ) /
                Math.max(
                    1,
                    gapMedian
                );


            score +=
                Math.abs(
                    set[
                        set.length - 1
                    ] -
                    body.bottom
                ) /
                Math.max(
                    1,
                    gapMedian
                );

        }


        if (
            score <
            bestScore
        ) {

            bestScore =
                score;


            best =
                set;

        }

    }


    return (
        best ||
        []
    );

}

// =========================================================
// CLUSTER GRID LINES
// =========================================================

function clusterPositions(
    values,
    maximumGap
) {

    if (
        !values.length
    ) {

        return [];

    }


    const sorted =
        [...values]
            .sort(
                (
                    a,
                    b
                ) =>
                    a - b
            );


    const clusters =
        [];


    let current =
        [
            sorted[0]
        ];


    for (
        let i = 1;
        i < sorted.length;
        i++
    ) {

        if (
            sorted[i] -
            sorted[i - 1] <=
            maximumGap
        ) {

            current.push(
                sorted[i]
            );

        }

        else {

            clusters.push(
                current
            );


            current =
                [
                    sorted[i]
                ];

        }

    }


    clusters.push(
        current
    );


    return clusters.map(
        cluster =>

            cluster.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            ) /
            cluster.length
    );

}


function median(
    values
) {

    if (
        !values.length
    ) {

        return 0;

    }


    const sorted =
        [...values]
            .sort(
                (
                    a,
                    b
                ) =>
                    a - b
            );


    const middle =
        Math.floor(
            sorted.length /
            2
        );


    if (
        sorted.length %
        2
    ) {

        return sorted[
            middle
        ];

    }


    return (

        sorted[
            middle - 1
        ] +

        sorted[
            middle
        ]

    ) / 2;

}


// =========================================================
// OCR CELL
// =========================================================

async function ocrCell(
    worker,
    image,
    left,
    top,
    right,
    bottom,
    type
) {

    const cellWidth =
        right -
        left;


    const cellHeight =
        bottom -
        top;


    const insetX =
        Math.max(
            1,
            cellWidth *
            0.015
        );


    const insetY =
        Math.max(
            1,
            cellHeight *
            0.04
        );


    const sourceX =
        left +
        insetX;


    const sourceY =
        top +
        insetY;


    const sourceWidth =
        cellWidth -
        insetX *
        2;


    const sourceHeight =
        cellHeight -
        insetY *
        2;


    const scale =
        type === "time"
            ? 8
            : 6;


    const padding =
        type === "time"
            ? 35
            : 25;


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        Math.round(
            sourceWidth *
            scale
        ) +
        padding *
        2;


    canvas.height =
        Math.round(
            sourceHeight *
            scale
        ) +
        padding *
        2;


    const ctx =
        canvas.getContext(
            "2d",
            {
                willReadFrequently:
                    true
            }
        );


    ctx.fillStyle =
        "white";


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.imageSmoothingEnabled =
        true;


    ctx.drawImage(

        image,

        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,

        padding,
        padding,

        sourceWidth *
        scale,

        sourceHeight *
        scale

    );


    const imageData =
        ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );


    const pixels =
        imageData.data;


    for (
        let i = 0;
        i < pixels.length;
        i += 4
    ) {

        const gray =

            (
                0.299 *
                pixels[i]
            ) +

            (
                0.587 *
                pixels[i + 1]
            ) +

            (
                0.114 *
                pixels[i + 2]
            );


        let adjusted =
            (
                gray -
                128
            ) *
            1.55 +
            128;


        adjusted =
            Math.max(
                0,
                Math.min(
                    255,
                    adjusted
                )
            );


        pixels[i] =
            adjusted;


        pixels[i + 1] =
            adjusted;


        pixels[i + 2] =
            adjusted;

    }


    ctx.putImageData(
        imageData,
        0,
        0
    );


    const result =
        await worker.recognize(
            canvas
        );


    const cleanedText =
        (
            result.data?.text ||
            ""
        )
            .replace(
                /\r/g,
                ""
            )
            .replace(
                /\n/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    if (
        type ===
        "name"
    ) {

        return {

            text:
                cleanedText,

            confidence:
                Number(
                    result.data?.confidence ||
                    0
                )

        };

    }


    return cleanedText;

}


// =========================================================
// VERSION 13.12: ADAPTIVE TIME-CELL OCR
// =========================================================

async function ocrTimeCellAdaptive(
    worker,
    image,
    left,
    right,
    row0,
    row1,
    row2
) {

    /*
    Different schedule exports give the movie-title and time bands
    slightly different heights. Try several plausible slices from the
    top two theater rows instead of assuming one exact band.
    */

    const fullTop =
        row0;


    const fullBottom =
        row2;


    const fullHeight =
        fullBottom -
        fullTop;


    const candidates = [

        /*
        Traditional time-only band.
        */
        [
            row1,
            row2
        ],

        /*
        Lower half / lower 60% of the combined movie+time area.
        */
        [
            fullTop +
                fullHeight *
                0.42,
            fullBottom
        ],

        [
            fullTop +
                fullHeight *
                0.32,
            fullBottom
        ],

        /*
        Entire movie+time cell. The time OCR whitelist suppresses
        most title letters, and this rescues unusual row geometry.
        */
        [
            fullTop,
            fullBottom
        ],

        /*
        Upper row as a final fallback in case the detector assigned
        the title/time divider one line too low.
        */
        [
            row0,
            row1
        ]

    ];


    const seen =
        new Set();


    let bestRaw =
        "";


    let bestParsed =
        null;


    let bestScore =
        -Infinity;


    for (
        const [
            candidateTop,
            candidateBottom
        ] of
        candidates
    ) {

        const top =
            Math.max(
                row0,
                candidateTop
            );


        const bottom =
            Math.min(
                row2,
                candidateBottom
            );


        if (
            bottom -
            top <
            3
        ) {

            continue;

        }


        const key =
            `${Math.round(top)}:${Math.round(bottom)}`;


        if (
            seen.has(
                key
            )
        ) {

            continue;

        }


        seen.add(
            key
        );


        const raw =
            await ocrCell(
                worker,
                image,
                left,
                top,
                right,
                bottom,
                "time"
            );


        const normalized =
            normalizeTimeOCR(
                raw
            );


        const parsed =
            parseShowtime(
                normalized
            );


        let score =
            0;


        if (parsed) {

            score +=
                100;


            /*
            Prefer reads that contain an explicit separator and two
            complete clock values.
            */
            if (
                /[-–—]/.test(
                    raw
                )
            ) {

                score +=
                    12;

            }


            if (
                /\d{1,2}:\d{2}/.test(
                    raw
                )
            ) {

                score +=
                    8;

            }


            score -=
                Math.abs(
                    raw.length -
                    11
                ) *
                0.15;

        }


        else {

            /*
            Keep the most time-like failed read for diagnostics.
            */
            score +=
                (
                    raw.match(
                        /\d/g
                    ) ||
                    []
                ).length;

        }


        if (
            score >
            bestScore
        ) {

            bestScore =
                score;


            bestRaw =
                raw;


            bestParsed =
                parsed;

        }


        if (
            parsed &&
            score >=
            115
        ) {

            break;

        }

    }


    return {

        raw:
            bestRaw,

        parsed:
            bestParsed

    };

}


// =========================================================
// TIME NORMALIZATION
// =========================================================

function normalizeTimeOCR(
    value
) {

    if (!value) {
        return "";
    }


    let text =
        value
            .trim()
            .toLowerCase();


    text =
        text.replace(
            /[–—−_]/g,
            "-"
        );


    text =
        text
            .replace(
                /;/g,
                ":"
            )
            .replace(
                /,/g,
                ":"
            );


    text =
        text.replace(
            /[oO]/g,
            "0"
        );


    text =
        text.replace(
            /[lI|]/g,
            "1"
        );


    text =
        text.replace(
            /\s+/g,
            ""
        );


    text =
        text.replace(
            /[^0-9:.\-apm]/g,
            ""
        );


    text =
        text.replace(
            /\.(?=\d{2})/g,
            ":"
        );


    text =
        text.replace(
            /(^|-)(\d{2})(\d{2})(?=[apm-]|$)/g,
            "$1$2:$3"
        );


    text =
        text.replace(
            /(^|-)(\d)(\d{2})(?=[apm-]|$)/g,
            "$1$2:$3"
        );


    text =
        text.replace(
            /(\d{1,2}:\d{2}[ap]m?)(\d{1,2}:\d{2})/,
            "$1-$2"
        );


    return text;

}


// =========================================================
// SHOWTIME PARSER
// =========================================================

function parseShowtime(
    value
) {

    if (!value) {
        return null;
    }


    const match =
        value.match(
            /(\d{1,2}):(\d{2})([ap](?:m)?)?-?(\d{1,2}):(\d{2})([ap](?:m)?)?/
        );


    if (!match) {
        return null;
    }


    const startHour =
        Number(
            match[1]
        );


    const startMinute =
        Number(
            match[2]
        );


    const endHour =
        Number(
            match[4]
        );


    const endMinute =
        Number(
            match[5]
        );


    if (
        startHour < 1 ||
        startHour > 12 ||

        endHour < 1 ||
        endHour > 12 ||

        startMinute > 59 ||
        endMinute > 59
    ) {

        return null;

    }


    let startPeriod =
        periodFromMarker(
            match[3]
        );


    let endPeriod =
        periodFromMarker(
            match[6]
        );


    if (!startPeriod) {

        if (
            startHour === 10 ||
            startHour === 11
        ) {

            startPeriod =
                "AM";

        }

        else {

            startPeriod =
                "PM";

        }

    }


    if (!endPeriod) {

        if (
            startPeriod === "AM" &&
            (
                endHour === 12 ||
                endHour <
                startHour
            )
        ) {

            endPeriod =
                "PM";

        }

        else if (
            startPeriod === "PM" &&
            startHour >= 7 &&
            (
                endHour === 12 ||
                endHour <= 2
            )
        ) {

            endPeriod =
                "AM";

        }

        else {

            endPeriod =
                startPeriod;

        }

    }


    const startMinutes =
        clockMinutes(
            startHour,
            startMinute,
            startPeriod
        );


    let endMinutes =
        clockMinutes(
            endHour,
            endMinute,
            endPeriod
        );


    if (
        endMinutes <
        startMinutes
    ) {

        endMinutes +=
            24 *
            60;

    }


    return {

        start:
            formatTime(
                startHour,
                startMinute,
                startPeriod
            ),

        end:
            formatTime(
                endHour,
                endMinute,
                endPeriod
            ),

        startMinutes,

        endMinutes

    };

}


// =========================================================
// NAME CLEANUP
// =========================================================

function cleanServerName(
    value
) {

    if (!value) {
        return "";
    }


    let cleaned =
        value
            .replace(
                /[()[\]{}|]/g,
                " "
            )
            .replace(
                /[^A-Za-zÀ-ÿ' -]/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    if (!cleaned) {
        return "";
    }


    cleaned =
        cleaned
            .replace(
                /^[-' ]+|[-' ]+$/g,
                ""
            )
            .trim();


    if (!cleaned) {
        return "";
    }


    let tokens =
        cleaned
            .split(" ")
            .filter(Boolean);


    if (
        tokens.length >
        1
    ) {

        tokens =
            tokens.filter(
                token =>
                    token.length >
                    1
            );

    }


    if (
        !tokens.length
    ) {

        return "";

    }


    cleaned =
        tokens.join(
            " "
        );


    cleaned =
        cleaned
            .split(" ")
            .map(
                word =>

                    word
                        .charAt(0)
                        .toUpperCase() +

                    word
                        .slice(1)
                        .toLowerCase()
            )
            .join(" ");


    const garbage =
        new Set(
            [
                "Rr",
                "Ll",
                "Ii",
                "Tt",
                "Seating",
                "Capacity",
                "Theater",
                "Movie"
            ]
        );


    if (
        garbage.has(
            cleaned
        )
    ) {

        return "";

    }


    if (
        /^[A-H]{1,8}$/i.test(
            cleaned
        )
    ) {

        return "";

    }


    const lettersOnly =
        cleaned.replace(
            /[^A-Za-zÀ-ÿ]/g,
            ""
        );


    if (
        lettersOnly.length <
        3 ||
        lettersOnly.length >
        14
    ) {

        return "";

    }


    if (
        /(.)\1{3,}/i.test(
            lettersOnly
        )
    ) {

        return "";

    }


    const uniqueLetters =
        new Set(
            lettersOnly
                .toLowerCase()
                .split("")
        ).size;


    if (
        lettersOnly.length >= 7 &&
        uniqueLetters <= 2
    ) {

        return "";

    }


    /*
    Another common blank-cell hallucination is a plausible-looking
    word dominated by one letter, such as "Freese". For strings of
    6+ letters, reject cases where half or more of the characters
    are the same letter.
    */
    if (
        lettersOnly.length >= 6
    ) {

        const counts =
            new Map();


        for (
            const character of
            lettersOnly.toLowerCase()
        ) {

            counts.set(
                character,
                (
                    counts.get(
                        character
                    ) || 0
                ) + 1
            );

        }


        const highestCount =
            Math.max(
                ...counts.values()
            );


        if (
            highestCount /
            lettersOnly.length >=
            0.50
        ) {

            return "";

        }

    }


    if (
        !/[aeiouy]/i.test(
            lettersOnly
        )
    ) {

        return "";

    }


    if (
        cleaned
            .split(" ")
            .length >
        2
    ) {

        return "";

    }


    return cleaned;

}


// =========================================================
// SMALL OCR NAME-DISTANCE HELPER
// =========================================================

function nameEditDistance(
    a,
    b
) {

    a =
        String(
            a || ""
        );


    b =
        String(
            b || ""
        );


    const rows =
        a.length + 1;


    const cols =
        b.length + 1;


    const dp =
        Array.from(
            {
                length:
                    rows
            },
            () =>
                new Array(
                    cols
                ).fill(0)
        );


    for (
        let i = 0;
        i < rows;
        i++
    ) {

        dp[i][0] =
            i;

    }


    for (
        let j = 0;
        j < cols;
        j++
    ) {

        dp[0][j] =
            j;

    }


    for (
        let i = 1;
        i < rows;
        i++
    ) {

        for (
            let j = 1;
            j < cols;
            j++
        ) {

            const cost =
                a[i - 1] ===
                b[j - 1]
                    ? 0
                    : 1;


            dp[i][j] =
                Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );

        }

    }


    return dp[
        rows - 1
    ][
        cols - 1
    ];

}


// =========================================================
// NAME CANONICALIZATION
// =========================================================

function canonicalizeServerNames() {

    /*
    VERSION 13.9 NAME CLUSTERING

    OCR can produce several spellings for one person. Instead of
    deciding only by frequency, build small groups of similar names
    and choose the most plausible representative.

    Important examples:
      Enk  -> Erik
      Erk  -> Erik
      L Kishan / Kishan L -> Kishan

    This is roster-independent; no employee names are hard-coded.
    */

    lineupData.forEach(
        showing => {

            showing.servers =
                showing.servers
                    .map(
                        server => {

                            const cleaned =
                                cleanServerName(
                                    server.name
                                );


                            return {

                                ...server,

                                name:
                                    cleaned,

                                confidence:
                                    Number(
                                        server.confidence ||
                                        0
                                    )

                            };

                        }
                    )
                    .filter(
                        server =>
                            Boolean(
                                server.name
                            )
                    );

        }
    );


    const stats =
        new Map();


    lineupData.forEach(
        showing => {

            showing.servers.forEach(
                server => {

                    const key =
                        normalizeNameKey(
                            server.name
                        );


                    if (!key) {
                        return;
                    }


                    if (
                        !stats.has(
                            key
                        )
                    ) {

                        stats.set(
                            key,
                            {
                                key,
                                display:
                                    server.name,
                                count:
                                    0,
                                confidenceTotal:
                                    0
                            }
                        );

                    }


                    const item =
                        stats.get(
                            key
                        );


                    item.count++;


                    item.confidenceTotal +=
                        Number(
                            server.confidence ||
                            0
                        );

                }
            );

        }
    );


    const entries =
        [
            ...stats.values()
        ];


    entries.forEach(
        item => {

            item.averageConfidence =
                item.count
                    ? item.confidenceTotal /
                        item.count
                    : 0;

        }
    );


    const parent =
        new Map(
            entries.map(
                item =>
                    [
                        item.key,
                        item.key
                    ]
            )
        );


    function findRoot(
        key
    ) {

        let current =
            key;


        while (
            parent.get(
                current
            ) !==
            current
        ) {

            current =
                parent.get(
                    current
                );

        }


        return current;

    }


    function union(
        a,
        b
    ) {

        const rootA =
            findRoot(
                a
            );


        const rootB =
            findRoot(
                b
            );


        if (
            rootA !==
            rootB
        ) {

            parent.set(
                rootB,
                rootA
            );

        }

    }


    function shouldClusterNames(
        a,
        b
    ) {

        if (
            a ===
            b
        ) {

            return true;

        }


        /*
        Classic stray-character OCR:
        Kishan <-> Lkishan
        Kishan <-> Kishanl

        Prefer grouping these so the shorter clean spelling can win.
        */
        if (
            Math.abs(
                a.length -
                b.length
            ) ===
            1
        ) {

            const longer =
                a.length >
                b.length
                    ? a
                    : b;


            const shorter =
                a.length >
                b.length
                    ? b
                    : a;


            if (
                longer.slice(
                    1
                ) ===
                shorter ||

                longer.slice(
                    0,
                    -1
                ) ===
                shorter
            ) {

                return true;

            }

        }


        const distance =
            nameEditDistance(
                a,
                b
            );


        /*
        Short names are where OCR most often turns "ri" into "n"
        or drops a letter. Two edits is intentionally allowed here.
        */
        if (
            Math.min(
                a.length,
                b.length
            ) <=
            4
        ) {

            return (
                distance <=
                2
            );

        }


        /*
        Longer names only merge when they are very close.
        */
        return (
            distance <=
            1
        );

    }


    for (
        let i = 0;
        i < entries.length;
        i++
    ) {

        for (
            let j = i + 1;
            j < entries.length;
            j++
        ) {

            if (
                shouldClusterNames(
                    entries[i].key,
                    entries[j].key
                )
            ) {

                union(
                    entries[i].key,
                    entries[j].key
                );

            }

        }

    }


    const groups =
        new Map();


    entries.forEach(
        item => {

            const root =
                findRoot(
                    item.key
                );


            if (
                !groups.has(
                    root
                )
            ) {

                groups.set(
                    root,
                    []
                );

            }


            groups.get(
                root
            ).push(
                item
            );

        }
    );


    const canonicalFor =
        new Map();


    groups.forEach(
        group => {

            /*
            First handle the old "extra first/last character"
            situation. If a longer spelling is exactly the shorter
            spelling plus one edge character, favor the shorter one.
            */
            const edgeTrimTargets =
                new Set();


            group.forEach(
                longerItem => {

                    group.forEach(
                        shorterItem => {

                            if (
                                longerItem ===
                                shorterItem
                            ) {

                                return;

                            }


                            if (
                                longerItem.key.length !==
                                shorterItem.key.length + 1
                            ) {

                                return;

                            }


                            if (
                                longerItem.key.slice(
                                    1
                                ) ===
                                shorterItem.key ||

                                longerItem.key.slice(
                                    0,
                                    -1
                                ) ===
                                shorterItem.key
                            ) {

                                edgeTrimTargets.add(
                                    shorterItem.key
                                );

                            }

                        }
                    );

                }
            );


            let candidates =
                edgeTrimTargets.size
                    ? group.filter(
                        item =>
                            edgeTrimTargets.has(
                                item.key
                            )
                    )
                    : [
                        ...group
                    ];


            /*
            Otherwise prefer the more complete spelling for short
            damaged OCR. This is what makes Enk/Erk resolve to Erik.
            Confidence and frequency break ties.
            */
            candidates.sort(
                (
                    a,
                    b
                ) => {

                    if (
                        b.key.length !==
                        a.key.length
                    ) {

                        return (
                            b.key.length -
                            a.key.length
                        );

                    }


                    if (
                        Math.abs(
                            b.averageConfidence -
                            a.averageConfidence
                        ) >
                        3
                    ) {

                        return (
                            b.averageConfidence -
                            a.averageConfidence
                        );

                    }


                    return (
                        b.count -
                        a.count
                    );

                }
            );


            const winner =
                candidates[0];


            group.forEach(
                item => {

                    canonicalFor.set(
                        item.key,
                        winner.display
                    );

                }
            );

        }
    );


    /*
    Apply the chosen spelling back to every assignment.
    */
    lineupData.forEach(
        showing => {

            showing.servers.forEach(
                server => {

                    const key =
                        normalizeNameKey(
                            server.name
                        );


                    if (
                        canonicalFor.has(
                            key
                        )
                    ) {

                        server.name =
                            canonicalFor.get(
                                key
                            );

                    }

                }
            );


            /*
            Never keep the same person twice in one showing after
            aliases have been merged.
            */
            const seen =
                new Set();


            showing.servers =
                showing.servers.filter(
                    server => {

                        const key =
                            normalizeNameKey(
                                server.name
                            );


                        if (
                            !key ||
                            seen.has(
                                key
                            )
                        ) {

                            return false;

                        }


                        seen.add(
                            key
                        );


                        return true;

                    }
                );

        }
    );

}


// =========================================================
// NAME NORMALIZATION KEY
// =========================================================

function normalizeNameKey(
    name
) {

    return String(
        name ||
        ""
    )
        .toLowerCase()
        .replace(
            /[^a-z]/g,
            ""
        );

}


// =========================================================
// ASSIGNMENT RULES
// =========================================================

function applyAssignmentRules(
    showing
) {

    const normalServers =
        showing.servers.filter(
            server =>
                !server.conditional
        );


    const conditionalServers =
        showing.servers.filter(
            server =>
                server.conditional
        );


    if (
        normalServers.length ===
        1
    ) {

        const server =
            normalServers[0];


        server.rows =
            "ALL ROWS";


        if (
            conditionalServers.length ===
            0
        ) {

            server.over50 =
                "ALL ROWS";

        }

        else {

            server.over50 =
                combineRows(

                    showing.rules[0]
                        .over50,

                    showing.rules[1]
                        .over50

                );

        }

    }


    else if (
        normalServers.length >=
        2
    ) {

        normalServers.forEach(
            server => {

                const index =
                    Math.min(
                        server.position -
                        1,
                        1
                    );


                const rule =
                    showing.rules[
                        index
                    ];


                server.rows =
                    rule.normal;


                server.over50 =
                    rule.over50;

            }
        );

    }


    conditionalServers.forEach(
        server => {

            const rule =
                showing.rules[2];


            server.rows =
                rule.over50 ||
                rule.normal;


            server.over50 =
                server.rows;

        }
    );

}


// =========================================================
// COMBINE ROWS
// =========================================================

function combineRows(
    first,
    second
) {

    return [

        ...new Set(

            (
                first +
                second
            )
                .split("")
                .filter(
                    letter =>
                        /[A-H]/i.test(
                            letter
                        )
                )

        )

    ]
        .sort()
        .join("");

}


// =========================================================
// TIME HELPERS
// =========================================================

function periodFromMarker(
    marker
) {

    if (!marker) {
        return "";
    }


    marker =
        marker.toLowerCase();


    if (
        marker.startsWith(
            "a"
        )
    ) {

        return "AM";

    }


    if (
        marker.startsWith(
            "p"
        )
    ) {

        return "PM";

    }


    return "";

}


function clockMinutes(
    hour,
    minute,
    period
) {

    let h =
        hour;


    if (
        period ===
        "PM" &&
        h !==
        12
    ) {

        h +=
            12;

    }


    if (
        period ===
        "AM" &&
        h ===
        12
    ) {

        h =
            0;

    }


    return (
        h *
        60 +
        minute
    );

}


function formatTime(
    hour,
    minute,
    period
) {

    return (

        hour +
        ":" +

        String(
            minute
        ).padStart(
            2,
            "0"
        ) +

        " " +
        period

    );

}


// =========================================================
// SERVER DROPDOWN
// =========================================================

function populateServers() {

    /*
    Build statistics AFTER canonicalization. A real server normally
    appears in multiple assignments. A one-off name is still allowed,
    but only when OCR confidence is exceptionally strong.
    */

    const stats =
        new Map();


    lineupData.forEach(
        showing => {

            showing.servers.forEach(
                server => {

                    const name =
                        cleanServerName(
                            server.name
                        );


                    if (!name) {
                        return;
                    }


                    const key =
                        normalizeNameKey(
                            name
                        );


                    if (
                        !stats.has(
                            key
                        )
                    ) {

                        stats.set(
                            key,
                            {
                                name,
                                count:
                                    0,
                                confidenceTotal:
                                    0,
                                servers:
                                    []
                            }
                        );

                    }


                    const item =
                        stats.get(
                            key
                        );


                    item.count++;


                    item.confidenceTotal +=
                        Number(
                            server.confidence ||
                            0
                        );


                    item.servers.push(
                        server
                    );

                }
            );

        }
    );


    const allowedKeys =
        new Set();


    stats.forEach(
        (
            item,
            key
        ) => {

            const averageConfidence =
                item.count
                    ? item.confidenceTotal /
                        item.count
                    : 0;


            /*
            Repeated names are trusted. A one-off is kept only when
            Tesseract was very confident. This removes isolated blank
            cell hallucinations such as "Freese" while still allowing
            a legitimate server with only one assignment if the print
            was read clearly.
            */
            if (
                item.count >=
                2 ||

                averageConfidence >=
                88
            ) {

                allowedKeys.add(
                    key
                );

            }


            else {

                detectedText.textContent +=

                    `Rejected one-off name "${item.name}" ` +
                    `(${Math.round(averageConfidence)}% confidence)\n`;

            }

        }
    );


    /*
    Remove rejected OCR artifacts from lineupData itself, not only
    from the dropdown. That prevents a rogue name from retaining a
    phantom schedule assignment behind the scenes.
    */
    lineupData.forEach(
        showing => {

            showing.servers =
                showing.servers.filter(
                    server =>

                        allowedKeys.has(
                            normalizeNameKey(
                                server.name
                            )
                        )
                );

        }
    );


    const names =
        new Set();


    stats.forEach(
        (
            item,
            key
        ) => {

            if (
                allowedKeys.has(
                    key
                )
            ) {

                names.add(
                    item.name
                );

            }

        }
    );


    serverSelect.innerHTML =
        '<option value="">Select your name</option>';


    [
        ...names
    ]
        .sort(
            (
                a,
                b
            ) =>

                a.localeCompare(
                    b
                )
        )
        .forEach(
            name => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    name;


                option.textContent =
                    name;


                serverSelect.appendChild(
                    option
                );

            }
        );


    detectedText.textContent +=
        "\nSCRIPT VERSION: 13.12\n";

}


// =========================================================
// SHOW PERSONAL SCHEDULE// =========================================================
// SHOW PERSONAL SCHEDULE
// =========================================================

document
    .getElementById(
        "showSchedule"
    )
    .addEventListener(
        "click",
        () => {

            const name =
                serverSelect.value;


            if (!name) {

                alert(
                    "Select your name first."
                );


                return;

            }


            // Completely hide Detected Text before
            // displaying the personal schedule.
            debugSection
                .classList
                .add("hidden");

            debugSection.style.display =
                "none";


            buildSchedule(
                name
            );

        }
    );


// =========================================================
// BUILD PERSONAL SCHEDULE
// =========================================================

function buildSchedule(
    name
) {

    const assignments =
        [];


    lineupData.forEach(
        showing => {

            showing.servers.forEach(
                server => {

                    if (
                        server.name ===
                        name
                    ) {

                        assignments.push({

                            ...showing,

                            server

                        });

                    }

                }
            );

        }
    );


    assignments.sort(
        (
            a,
            b
        ) =>

            a.startMinutes -
            b.startMinutes
    );


    scheduleList.innerHTML =
        "";


    scheduleName.textContent =
        name +
        "'s Lineup";


    scheduleDate.textContent =
        "Today's schedule";


    if (
        !assignments.length
    ) {

        scheduleList.innerHTML =
            "<p>No assignments found.</p>";


        scheduleSection
            .classList
            .remove("hidden");


        return;

    }


    assignments.forEach(
        item => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "assignment" +
                (
                    item.server
                        .conditional
                        ? " conditional"
                        : ""
                );


            let rowsHTML =
                "";


            if (
                item.server
                    .conditional
            ) {

                rowsHTML = `

                    <div class="conditional-label">
                        ONLY IF OVER 50 GUESTS
                    </div>

                    <div class="rows">
                        ${escapeHTML(
                            item.server.rows
                        )}
                    </div>

                `;

            }

            else {

                rowsHTML = `

                    <div class="rows">
                        ${escapeHTML(
                            item.server.rows
                        )}
                    </div>

                `;


                if (
                    item.server.over50 &&
                    item.server.over50 !==
                    item.server.rows
                ) {

                    rowsHTML += `

                        <div class="over50">

                            Over 50 guests:

                            <strong>
                                ${escapeHTML(
                                    item.server.over50
                                )}
                            </strong>

                        </div>

                    `;

                }

            }


            card.innerHTML = `

                <div class="assignment-time">

                    <strong>
                        ${escapeHTML(
                            item.start
                        )}

                        –

                        ${escapeHTML(
                            item.end
                        )}
                    </strong>

                </div>


                <div class="assignment-title">

                    Theater ${item.theater}

                </div>


                ${rowsHTML}

            `;


            scheduleList.appendChild(
                card
            );

        }
    );


    scheduleSection
        .classList
        .remove("hidden");


    scheduleSection
        .scrollIntoView({
            behavior:
                "smooth"
        });

}


// =========================================================
// DEBUG SUMMARY
// =========================================================

function appendDetectedLineup() {

    detectedText.textContent +=
        "\n\nFINAL INTERPRETATION\n";


    detectedText.textContent +=
        "====================================\n";


    detectedText.textContent +=
        `Showings detected: ${lineupData.length}\n\n`;


    for (
        let theater = 1;
        theater <= 8;
        theater++
    ) {

        detectedText.textContent +=
            `THEATER ${theater}\n`;


        const shows =
            lineupData.filter(
                item =>
                    item.theater ===
                    theater
            );


        if (
            !shows.length
        ) {

            detectedText.textContent +=
                "  None\n";

        }


        shows.forEach(
            showing => {

                detectedText.textContent +=

                    `\n  ${showing.start} - ${showing.end}\n`;


                if (
                    !showing.servers.length
                ) {

                    detectedText.textContent +=
                        "  ! No server detected\n";

                }


                showing.servers.forEach(
                    server => {

                        if (
                            server.conditional
                        ) {

                            detectedText.textContent +=

                                `  -> (${server.name}) ` +
                                `${server.rows} ` +
                                `ONLY OVER 50\n`;

                        }

                        else {

                            detectedText.textContent +=

                                `  -> ${server.name} ` +
                                `${server.rows}`;


                            if (
                                server.over50 !==
                                server.rows
                            ) {

                                detectedText.textContent +=

                                    ` -> ${server.over50} over 50`;

                            }


                            detectedText.textContent +=
                                "\n";

                        }

                    }
                );

            }
        );


        detectedText.textContent +=
            "\n------------------------------------\n";

    }

}


// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHTML(
    value
) {

    return String(
        value
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}
