/*
============================================================
STAR CINEMA PERSONAL LINEUP
VERSION 10
============================================================

Changes from Version 9:
✓ Keeps working grid detection
✓ Keeps per-cell OCR
✓ Keeps tolerant time recognition
✓ Merges duplicate OCR names
✓ Removes stray one-letter OCR fragments
✓ Normalizes capitalization
✓ Groups server assignments under one real name
✓ 1 server = ALL ROWS
✓ 2 servers = split rows
✓ 3rd server = conditional over 50
✓ Chronological personal schedule
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
// STAR CINEMA ROW CONFIGURATIONS
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

imageInput.addEventListener("change", () => {

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


    debugSection
        .classList
        .add("hidden");


    lineupData = [];

});


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
            // DETECT SHOWING COLUMNS
            // ---------------------------------------------

            const columns =
                detectShowingColumns(
                    analysis
                );


            detectedText.textContent +=
                `Showing column edges: ${columns.length}\n`;


            if (
                columns.length !== 6
            ) {

                throw new Error(
                    `Expected 6 column edges, found ${columns.length}.`
                );

            }


            // ---------------------------------------------
            // DETECT HORIZONTAL GRID
            // ---------------------------------------------

            const rows =
                detectTheaterGrid(
                    analysis,
                    columns[0],
                    columns[5]
                );


            detectedText.textContent +=
                `Horizontal grid lines: ${rows.length}\n`;


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
            // CREATE OCR WORKER
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


                    const raw =
                        await ocrCell(
                            worker,
                            image,
                            left,
                            timeTop,
                            right,
                            timeBottom,
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
            // SERVER NAME OCR
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


                    const raw =
                        await ocrCell(
                            worker,
                            image,
                            showing.left,
                            top,
                            showing.right,
                            bottom,
                            "name"
                        );


                    const name =
                        cleanServerName(
                            raw
                        );


                    if (raw) {

                        detectedText.textContent +=

                            `T${showing.theater} ` +
                            `${showing.start} ` +
                            `row ${position + 1}: ` +
                            `"${raw}"`;


                        if (name) {

                            detectedText.textContent +=
                                ` -> ${name}`;

                        }


                        detectedText.textContent +=
                            "\n";

                    }


                    if (!name) {
                        continue;
                    }


                    showing.servers.push({

                        name,

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
            // IMPORTANT VERSION 10 STEP:
            // MERGE DUPLICATE NAMES
            // ---------------------------------------------

            canonicalizeServerNames();


            // ---------------------------------------------
            // APPLY ROW RULES
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
// IMAGE LOADING
// =========================================================

function loadImage(file) {

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
// COLUMN DETECTION
// =========================================================

function detectShowingColumns(
    analysis
) {

    const candidates =
        [];


    const yStart =
        Math.floor(
            analysis.height *
            0.05
        );


    const yEnd =
        Math.ceil(
            analysis.height *
            0.98
        );


    const samples =
        Math.max(
            1,
            Math.floor(
                (
                    yEnd -
                    yStart
                ) / 2
            )
        );


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
            y += 2
        ) {

            if (
                brightnessAt(
                    analysis,
                    x,
                    y
                ) < 65
            ) {

                dark++;

            }

        }


        if (
            dark /
            samples >
            0.68
        ) {

            candidates.push(
                x
            );

        }

    }


    let lines =
        clusterPositions(
            candidates,
            5
        );


    lines =
        lines.filter(
            x =>

                x >
                analysis.width *
                0.05 &&

                x <
                analysis.width *
                0.995
        );


    return findBestColumnSet(
        lines
    );

}


function findBestColumnSet(
    lines
) {

    if (
        lines.length <
        6
    ) {

        return [];

    }


    let best =
        null;


    let bestScore =
        Infinity;


    for (
        let start = 0;
        start <=
        lines.length - 6;
        start++
    ) {

        const set =
            lines.slice(
                start,
                start + 6
            );


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

            continue;

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


        const score =
            Math.sqrt(
                variance
            ) /
            average;


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


    if (
        !best ||
        bestScore >
        0.15
    ) {

        return [];

    }


    return best;

}


// =========================================================
// HORIZONTAL GRID DETECTION
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


    for (
        let y = 0;
        y < analysis.height;
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
                ) < 75
            ) {

                dark++;

            }

        }


        if (
            dark /
            samples >
            0.60
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
                0.025 &&

                y <
                analysis.height *
                0.985
        );


    return findBestTheaterGrid(
        lines
    );

}


function findBestTheaterGrid(
    lines
) {

    if (
        lines.length <
        41
    ) {

        return [];

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


        const movieGaps =
            [];


        const smallGaps =
            [];


        gaps.forEach(
            (
                gap,
                index
            ) => {

                if (
                    index % 5 === 0
                ) {

                    movieGaps.push(
                        gap
                    );

                }

                else {

                    smallGaps.push(
                        gap
                    );

                }

            }
        );


        const movieMedian =
            median(
                movieGaps
            );


        const smallMedian =
            median(
                smallGaps
            );


        if (
            !smallMedian ||
            movieMedian <
            smallMedian *
            1.35
        ) {

            continue;

        }


        let score =
            0;


        movieGaps.forEach(
            gap => {

                score +=
                    Math.abs(
                        gap -
                        movieMedian
                    ) /
                    movieMedian;

            }
        );


        smallGaps.forEach(
            gap => {

                score +=
                    Math.abs(
                        gap -
                        smallMedian
                    ) /
                    smallMedian;

            }
        );


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
// OCR ONE CELL
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


    return (
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

}


// =========================================================
// TIME OCR NORMALIZATION
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
// RAW SERVER NAME CLEANUP
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


    if (
        cleaned.length <
        2 ||
        cleaned.length >
        30
    ) {

        return "";

    }


    /*
    Normalize capitalization.
    */

    cleaned =
        cleaned
            .split(" ")
            .map(
                word => {

                    if (!word) {
                        return "";
                    }


                    return (
                        word
                            .charAt(0)
                            .toUpperCase() +

                        word
                            .slice(1)
                            .toLowerCase()
                    );

                }
            )
            .filter(Boolean)
            .join(" ");


    /*
    Don't treat row codes as names.
    */

    if (
        /^[A-H]{1,8}$/i.test(
            cleaned
        )
    ) {

        return "";

    }


    return cleaned;

}


// =========================================================
// VERSION 10 NAME NORMALIZATION
// =========================================================

function canonicalizeServerNames() {

    const rawNames =
        [];


    lineupData.forEach(
        showing => {

            showing.servers.forEach(
                server => {

                    if (
                        server.name
                    ) {

                        rawNames.push(
                            server.name
                        );

                    }

                }
            );

        }
    );


    /*
    Count how often every OCR spelling appears.

    Example:

    Kishan   = 5 times
    L Kishan = 2 times

    The more common spelling will usually be the
    correct canonical version.
    */

    const frequency =
        new Map();


    rawNames.forEach(
        name => {

            frequency.set(

                name,

                (
                    frequency.get(
                        name
                    ) ||
                    0
                ) +
                1

            );

        }
    );


    /*
    First perform obvious cleanup.

    Removes stray single-character OCR words:

    L Kishan -> Kishan
    Kishan L -> Kishan
    L Brian  -> Brian
    Chris L  -> Chris

    But does NOT remove actual names consisting
    of more than one character.
    */

    const simplified =
        new Map();


    for (
        const name of
        frequency.keys()
    ) {

        simplified.set(
            name,
            simplifyOCRName(
                name
            )
        );

    }


    /*
    Group names by their simplified spelling.
    */

    const groups =
        new Map();


    for (
        const [
            raw,
            simple
        ] of simplified
    ) {

        const key =
            normalizeNameKey(
                simple
            );


        if (!key) {
            continue;
        }


        if (
            !groups.has(
                key
            )
        ) {

            groups.set(
                key,
                []
            );

        }


        groups
            .get(
                key
            )
            .push(
                raw
            );

    }


    /*
    Choose canonical name for each group.
    */

    const replacement =
        new Map();


    for (
        const [
            key,
            variants
        ] of groups
    ) {

        let bestName =
            null;


        let bestScore =
            -Infinity;


        variants.forEach(
            variant => {

                const simple =
                    simplifyOCRName(
                        variant
                    );


                const count =
                    frequency.get(
                        variant
                    ) ||
                    0;


                /*
                Prefer:
                - names occurring more often
                - names without junk tokens
                - shorter clean spelling
                */

                let score =
                    count *
                    100;


                if (
                    variant ===
                    simple
                ) {

                    score +=
                        30;

                }


                score -=
                    simple.length *
                    0.01;


                if (
                    score >
                    bestScore
                ) {

                    bestScore =
                        score;


                    bestName =
                        simple;

                }

            }
        );


        variants.forEach(
            variant => {

                replacement.set(
                    variant,
                    bestName
                );

            }
        );

    }


    /*
    SECOND PASS:
    Merge near-duplicate spelling mistakes.

    Example:
    Kishan
    Kisham

    Only merges names that are extremely similar.
    */

    const canonicalNames =
        [
            ...new Set(
                [
                    ...replacement.values()
                ]
            )
        ];


    const nearDuplicateMap =
        new Map();


    canonicalNames.forEach(
        name => {

            let best =
                name;


            let bestDistance =
                Infinity;


            canonicalNames.forEach(
                other => {

                    if (
                        name ===
                        other
                    ) {

                        return;

                    }


                    const a =
                        normalizeNameKey(
                            name
                        );


                    const b =
                        normalizeNameKey(
                            other
                        );


                    if (
                        Math.abs(
                            a.length -
                            b.length
                        ) >
                        1
                    ) {

                        return;

                    }


                    const distance =
                        levenshteinDistance(
                            a,
                            b
                        );


                    /*
                    Only merge very close spellings.

                    Longer names tolerate one typo.
                    */

                    const threshold =
                        Math.min(
                            a.length,
                            b.length
                        ) >= 5
                            ? 1
                            : 0;


                    if (
                        distance <=
                        threshold
                    ) {

                        if (
                            distance <
                            bestDistance
                        ) {

                            /*
                            Prefer spelling that appears
                            more frequently in raw OCR.
                            */

                            const nameFrequency =
                                totalFrequencyForCanonical(
                                    name,
                                    replacement,
                                    frequency
                                );


                            const otherFrequency =
                                totalFrequencyForCanonical(
                                    other,
                                    replacement,
                                    frequency
                                );


                            if (
                                otherFrequency >
                                nameFrequency
                            ) {

                                best =
                                    other;


                                bestDistance =
                                    distance;

                            }

                        }

                    }

                }
            );


            nearDuplicateMap.set(
                name,
                best
            );

        }
    );


    /*
    Update every server assignment.
    */

    lineupData.forEach(
        showing => {

            showing.servers.forEach(
                server => {

                    const first =
                        replacement.get(
                            server.name
                        ) ||
                        simplifyOCRName(
                            server.name
                        );


                    server.name =
                        nearDuplicateMap.get(
                            first
                        ) ||
                        first;

                }
            );

        }
    );


    /*
    Remove duplicate server records if OCR somehow
    put the exact same person twice in one showing.
    */

    lineupData.forEach(
        showing => {

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
// SIMPLIFY OCR NAME
// =========================================================

function simplifyOCRName(
    name
) {

    if (!name) {
        return "";
    }


    let tokens =
        name
            .replace(
                /[^A-Za-zÀ-ÿ' -]/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim()
            .split(" ")
            .filter(Boolean);


    /*
    Remove stray 1-character OCR fragments.

    Examples:

    L Kishan
    Kishan L
    L Brian
    Chris L
    */

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


    return tokens
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

}


// =========================================================
// NORMALIZED COMPARISON KEY
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
// LEVENSHTEIN DISTANCE
// =========================================================

function levenshteinDistance(
    a,
    b
) {

    if (
        a === b
    ) {

        return 0;

    }


    if (
        !a.length
    ) {

        return b.length;

    }


    if (
        !b.length
    ) {

        return a.length;

    }


    const matrix =
        Array.from(
            {
                length:
                    b.length +
                    1
            },

            () =>
                new Array(
                    a.length +
                    1
                )
        );


    for (
        let i = 0;
        i <= b.length;
        i++
    ) {

        matrix[i][0] =
            i;

    }


    for (
        let j = 0;
        j <= a.length;
        j++
    ) {

        matrix[0][j] =
            j;

    }


    for (
        let i = 1;
        i <= b.length;
        i++
    ) {

        for (
            let j = 1;
            j <= a.length;
            j++
        ) {

            const cost =
                b[i - 1] ===
                a[j - 1]
                    ? 0
                    : 1;


            matrix[i][j] =
                Math.min(

                    matrix[i - 1][j] +
                    1,

                    matrix[i][j - 1] +
                    1,

                    matrix[i - 1][j - 1] +
                    cost

                );

        }

    }


    return matrix[
        b.length
    ][
        a.length
    ];

}


// =========================================================
// TOTAL FREQUENCY OF CANONICAL NAME
// =========================================================

function totalFrequencyForCanonical(
    canonical,
    replacement,
    frequency
) {

    let total =
        0;


    for (
        const [
            raw,
            converted
        ] of replacement
    ) {

        if (
            converted ===
            canonical
        ) {

            total +=
                frequency.get(
                    raw
                ) ||
                0;

        }

    }


    return total;

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


    // -----------------------------------------------------
    // ONE NORMAL SERVER
    // -----------------------------------------------------

    if (
        normalServers.length === 1
    ) {

        const server =
            normalServers[0];


        server.rows =
            "ALL ROWS";


        if (
            conditionalServers.length === 0
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


    // -----------------------------------------------------
    // TWO NORMAL SERVERS
    // -----------------------------------------------------

    else if (
        normalServers.length >= 2
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


    // -----------------------------------------------------
    // CONDITIONAL THIRD SERVER
    // -----------------------------------------------------

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
// COMBINE ROW LETTERS
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
        period === "PM" &&
        h !== 12
    ) {

        h +=
            12;

    }


    if (
        period === "AM" &&
        h === 12
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

    const names =
        new Set();


    lineupData.forEach(
        showing => {

            showing.servers.forEach(
                server => {

                    if (
                        server.name
                    ) {

                        names.add(
                            server.name
                        );

                    }

                }
            );

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

}


// =========================================================
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

                    ${escapeHTML(
                        item.start
                    )}

                    –

                    ${escapeHTML(
                        item.end
                    )}

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
