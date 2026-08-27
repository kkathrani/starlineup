/*
============================================================
STAR CINEMA PERSONAL LINEUP
VERSION 6 — GRID-DETECTION PARSER
============================================================

This version:

✓ Works with different screenshot dimensions
✓ Finds the spreadsheet automatically
✓ Detects actual vertical grid lines
✓ Detects actual horizontal grid lines
✓ Uses OCR word positions inside detected cells
✓ Does NOT assume fixed pixel coordinates
✓ Handles 1-server = ALL ROWS
✓ Handles 2-server row splits
✓ Handles parenthetical third servers
✓ Handles over-50 row changes
✓ Sorts the final schedule chronologically
============================================================
*/


/* =========================================================
   PAGE ELEMENTS
========================================================= */

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


/* =========================================================
   FALLBACK THEATER ROW RULES

   These are only used when OCR cannot read the row labels
   on the left side of the spreadsheet.
========================================================= */

const fallbackRows = {

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


/* =========================================================
   IMAGE UPLOAD
========================================================= */

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


        debugSection
            .classList
            .add("hidden");


        lineupData = [];

    }
);


/* =========================================================
   READ LINEUP
========================================================= */

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
            "Reading Lineup...";


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
            "Preparing image...\n";


        try {

            /* -----------------------------------------
               Load image
            ------------------------------------------ */

            const image =
                await loadImage(
                    uploadedFile
                );


            detectedText.textContent +=
                `Image: ${image.width} × ${image.height}\n`;


            /* -----------------------------------------
               Make analysis canvas
            ------------------------------------------ */

            const analysis =
                createAnalysisCanvas(
                    image
                );


            /* -----------------------------------------
               Detect major vertical grid lines
            ------------------------------------------ */

            const verticalLines =
                detectShowingColumns(
                    analysis
                );


            detectedText.textContent +=
                `Showing column edges found: ${verticalLines.length}\n`;


            if (
                verticalLines.length !== 6
            ) {

                throw new Error(
                    "Could not reliably detect the 5 showing columns. " +
                    `Found ${verticalLines.length} column edges instead of 6.`
                );

            }


            /* -----------------------------------------
               Detect horizontal theater grid
            ------------------------------------------ */

            const horizontalLines =
                detectTheaterGrid(
                    analysis,
                    verticalLines[0],
                    verticalLines[5]
                );


            detectedText.textContent +=
                `Theater grid lines found: ${horizontalLines.length}\n`;


            if (
                horizontalLines.length !== 41
            ) {

                throw new Error(
                    "Could not reliably detect the theater rows. " +
                    `Found ${horizontalLines.length} grid lines instead of 41.`
                );

            }


            /* -----------------------------------------
               OCR image
            ------------------------------------------ */

            detectedText.textContent +=
                "Starting OCR...\n";


            const processed =
                preprocessForOCR(
                    image
                );


            const worker =
                await Tesseract.createWorker(
                    "eng",
                    1,
                    {

                        logger:
                            message => {

                                if (
                                    message.status ===
                                    "recognizing text"
                                ) {

                                    const percent =
                                        Math.round(
                                            message.progress *
                                            100
                                        );


                                    progressBar.style.width =
                                        percent + "%";

                                }

                            }

                    }
                );


            const result =
                await worker.recognize(
                    processed.canvas,
                    undefined,
                    {
                        text: true,
                        tsv: true
                    }
                );


            await worker.terminate();


            if (
                !result.data ||
                !result.data.tsv
            ) {

                throw new Error(
                    "Tesseract did not provide positional OCR data."
                );

            }


            const words =
                parseTSV(
                    result.data.tsv,
                    processed.scale
                );


            detectedText.textContent +=
                `OCR words: ${words.length}\n`;


            /* -----------------------------------------
               Parse cells
            ------------------------------------------ */

            lineupData =
                parseDetectedGrid(
                    words,
                    verticalLines,
                    horizontalLines
                );


            /* -----------------------------------------
               Apply Star Cinema assignment rules
            ------------------------------------------ */

            lineupData.forEach(
                applyAssignmentRules
            );


            /* -----------------------------------------
               Display interpreted result
            ------------------------------------------ */

            showDetectedLineup(
                verticalLines,
                horizontalLines
            );


            populateServers();


            if (
                lineupData.length === 0
            ) {

                alert(
                    "The grid was detected, but no showtimes were successfully read. " +
                    "Scroll to Detected Text."
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
                "\n\nERROR\n" +
                "====================================\n" +
                (
                    error?.stack ||
                    error?.message ||
                    String(error)
                );


            alert(
                "There was a problem reading the lineup. " +
                "Scroll down to Detected Text."
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


/* =========================================================
   LOAD IMAGE
========================================================= */

function loadImage(file) {

    return new Promise(
        (resolve, reject) => {

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
                            "Could not load uploaded image."
                        )
                    );

                };


            image.src =
                url;

        }
    );

}


/* =========================================================
   ANALYSIS CANVAS
========================================================= */

function createAnalysisCanvas(image) {

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
                willReadFrequently: true
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

        canvas,

        ctx,

        data:
            imageData.data,

        width:
            canvas.width,

        height:
            canvas.height

    };

}


/* =========================================================
   PIXEL BRIGHTNESS
========================================================= */

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


    const index =
        (
            y *
            analysis.width +
            x
        ) * 4;


    return (
        analysis.data[index] +
        analysis.data[index + 1] +
        analysis.data[index + 2]
    ) / 3;

}


/* =========================================================
   DETECT VERTICAL SHOWING COLUMN LINES

   We are looking for:

   | B | C | D | E | F |

   Therefore we need SIX vertical edges.

   These lines run through nearly the entire theater grid.
========================================================= */

function detectShowingColumns(
    analysis
) {

    const candidates = [];


    /*
    Ignore top/bottom portions of screenshot when
    measuring continuous vertical lines.
    */

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


    const sampleCount =
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


        const ratio =
            dark /
            sampleCount;


        /*
        Spreadsheet vertical lines run almost all
        the way down the page.
        */

        if (
            ratio > 0.68
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


    /*
    Remove screenshot borders / black margins.

    We want actual spreadsheet column lines,
    not x=0 or a browser-image border.
    */

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


    /*
    There may be more than 6 vertical lines.

    Find the group of 6 with approximately equal
    spacing, because columns B-F are consistently
    sized.
    */

    return findBestColumnSet(
        lines
    );

}


/* =========================================================
   FIND BEST 6 COLUMN EDGES
========================================================= */

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


        const gaps = [];


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
                (sum, value) =>
                    sum + value,
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
                (sum, value) => {

                    const difference =
                        value -
                        average;


                    return (
                        sum +
                        difference *
                        difference
                    );

                },
                0
            ) /
            gaps.length;


        const coefficient =
            Math.sqrt(
                variance
            ) /
            average;


        /*
        The showing columns don't have to be
        perfectly identical, just reasonably close.
        */

        if (
            coefficient <
            bestScore
        ) {

            bestScore =
                coefficient;

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


/* =========================================================
   DETECT HORIZONTAL THEATER GRID

   Each theater contributes 5 row heights:

   Movie
   Time
   Server 1
   Server 2
   Server 3

   Across 8 theaters that produces:

   41 boundary lines

   because neighboring theaters share one boundary.
========================================================= */

function detectTheaterGrid(
    analysis,
    left,
    right
) {

    const candidates =
        [];


    const xStart =
        Math.max(
            0,
            Math.floor(
                left + 2
            )
        );


    const xEnd =
        Math.min(
            analysis.width - 1,
            Math.ceil(
                right - 2
            )
        );


    const sampleWidth =
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


        const ratio =
            dark /
            sampleWidth;


        /*
        Real horizontal spreadsheet borders cross
        almost all five showing columns.
        */

        if (
            ratio > 0.60
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


    /*
    Ignore screenshot top/bottom borders.
    */

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


/* =========================================================
   FIND THE REPEATING 41-LINE THEATER GRID
========================================================= */

function findBestTheaterGrid(
    lines
) {

    if (
        lines.length <
        41
    ) {

        return [];

    }


    let bestSet =
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


            /*
            Reject bizarre gaps.
            */

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


        /*
        Every theater follows:

        large movie row
        short time row
        short server row
        short server row
        short server row

        Repeated 8 times.
        */


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
            smallMedian <= 0
        ) {

            continue;

        }


        /*
        Movie-title row should be substantially taller.
        */

        if (
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

            bestSet =
                set;

        }

    }


    return (
        bestSet ||
        []
    );

}


/* =========================================================
   CLUSTER NEARBY BLACK PIXELS INTO SINGLE LINES

   A 2-pixel-thick border shouldn't be treated as two
   separate grid lines.
========================================================= */

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
                (a, b) =>
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
                (sum, value) =>
                    sum + value,
                0
            ) /
            cluster.length

    );

}


/* =========================================================
   MEDIAN
========================================================= */

function median(values) {

    if (
        !values.length
    ) {

        return 0;

    }


    const sorted =
        [...values]
            .sort(
                (a, b) =>
                    a - b
            );


    const middle =
        Math.floor(
            sorted.length / 2
        );


    if (
        sorted.length % 2
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


/* =========================================================
   OCR PREPROCESSING
========================================================= */

function preprocessForOCR(
    image
) {

    const scale =
        2;


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        image.width *
        scale;


    canvas.height =
        image.height *
        scale;


    const ctx =
        canvas.getContext(
            "2d",
            {
                willReadFrequently: true
            }
        );


    ctx.imageSmoothingEnabled =
        false;


    ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
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

        const r =
            pixels[i];

        const g =
            pixels[i + 1];

        const b =
            pixels[i + 2];


        const gray =
            (
                0.299 *
                    r +
                0.587 *
                    g +
                0.114 *
                    b
            );


        /*
        Preserve text while turning gray spreadsheet
        backgrounds white.
        */

        const value =
            gray <
            180
                ? 0
                : 255;


        pixels[i] =
            value;

        pixels[i + 1] =
            value;

        pixels[i + 2] =
            value;

    }


    ctx.putImageData(
        imageData,
        0,
        0
    );


    return {

        canvas,

        scale

    };

}


/* =========================================================
   PARSE TESSERACT TSV
========================================================= */

function parseTSV(
    tsv,
    scale
) {

    if (!tsv) {
        return [];
    }


    const lines =
        tsv
            .trim()
            .split("\n");


    if (
        lines.length <
        2
    ) {

        return [];

    }


    const headers =
        lines[0]
            .split("\t");


    const index =
        {};


    headers.forEach(
        (
            field,
            i
        ) => {

            index[field] =
                i;

        }
    );


    const words =
        [];


    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const values =
            lines[i]
                .split("\t");


        const text =
            (
                values[
                    index.text
                ] ||
                ""
            ).trim();


        if (!text) {
            continue;
        }


        const confidence =
            Number(
                values[
                    index.conf
                ]
            );


        if (
            Number.isFinite(
                confidence
            ) &&
            confidence < 10
        ) {

            continue;

        }


        const left =
            Number(
                values[
                    index.left
                ]
            ) /
            scale;


        const top =
            Number(
                values[
                    index.top
                ]
            ) /
            scale;


        const width =
            Number(
                values[
                    index.width
                ]
            ) /
            scale;


        const height =
            Number(
                values[
                    index.height
                ]
            ) /
            scale;


        if (
            !Number.isFinite(
                left
            ) ||
            !Number.isFinite(
                top
            ) ||
            !Number.isFinite(
                width
            ) ||
            !Number.isFinite(
                height
            )
        ) {

            continue;

        }


        words.push({

            text,

            confidence,

            left,

            top,

            width,

            height,

            centerX:
                left +
                width / 2,

            centerY:
                top +
                height / 2

        });

    }


    return words;

}


/* =========================================================
   PARSE THE DETECTED GRID

   41 horizontal lines means:

   Theater 1 = lines 0..5
   Theater 2 = lines 5..10
   Theater 3 = lines 10..15
   etc.
========================================================= */

function parseDetectedGrid(
    words,
    columns,
    rows
) {

    const result =
        [];


    /*
    Approximate width of theater-label column A.

    We infer it from the showing columns, rather than
    using a fixed coordinate.
    */

    const columnWidths =
        [];


    for (
        let i = 0;
        i < 5;
        i++
    ) {

        columnWidths.push(
            columns[i + 1] -
            columns[i]
        );

    }


    const showingColumnWidth =
        median(
            columnWidths
        );


    const labelLeft =
        Math.max(
            0,
            columns[0] -
            showingColumnWidth
        );


    for (
        let theater = 1;
        theater <= 8;
        theater++
    ) {

        const base =
            (
                theater - 1
            ) * 5;


        /*
        Actual detected rows:
        */

        const movieTop =
            rows[base];

        const movieBottom =
            rows[base + 1];


        const timeTop =
            rows[base + 1];

        const timeBottom =
            rows[base + 2];


        const server1Top =
            rows[base + 2];

        const server1Bottom =
            rows[base + 3];


        const server2Top =
            rows[base + 3];

        const server2Bottom =
            rows[base + 4];


        const server3Top =
            rows[base + 4];

        const server3Bottom =
            rows[base + 5];


        const serverRows =
            [
                [
                    server1Top,
                    server1Bottom
                ],

                [
                    server2Top,
                    server2Bottom
                ],

                [
                    server3Top,
                    server3Bottom
                ]
            ];


        /*
        Read authoritative row labels from column A.
        */

        const rules =
            [];


        for (
            let rowIndex = 0;
            rowIndex < 3;
            rowIndex++
        ) {

            const label =
                textInsideCell(
                    words,

                    labelLeft,

                    serverRows[
                        rowIndex
                    ][0],

                    columns[0],

                    serverRows[
                        rowIndex
                    ][1]
                );


            const parsed =
                parseRowAssignment(
                    label,
                    rowIndex
                );


            rules.push(
                parsed ||
                {
                    ...fallbackRows[
                        theater
                    ][
                        rowIndex
                    ]
                }
            );

        }


        /*
        Five possible showing columns.
        */

        for (
            let column = 0;
            column < 5;
            column++
        ) {

            const left =
                columns[
                    column
                ];

            const right =
                columns[
                    column + 1
                ];


            const movieRaw =
                textInsideCell(
                    words,
                    left,
                    movieTop,
                    right,
                    movieBottom
                );


            const timeRaw =
                textInsideCell(
                    words,
                    left,
                    timeTop,
                    right,
                    timeBottom
                );


            const parsedTime =
                parseShowtime(
                    timeRaw
                );


            /*
            If the time cell isn't a recognizable
            showtime, this is probably a blank showing
            cell.
            */

            if (
                !parsedTime
            ) {

                continue;

            }


            const servers =
                [];


            for (
                let serverIndex = 0;
                serverIndex < 3;
                serverIndex++
            ) {

                const raw =
                    textInsideCell(
                        words,

                        left,

                        serverRows[
                            serverIndex
                        ][0],

                        right,

                        serverRows[
                            serverIndex
                        ][1]
                    );


                const name =
                    cleanServerName(
                        raw
                    );


                if (!name) {
                    continue;
                }


                servers.push({

                    name,

                    position:
                        serverIndex +
                        1,

                    /*
                    The third spreadsheet server row is
                    the parenthetical conditional server.
                    */

                    conditional:
                        serverIndex === 2,

                    rows:
                        "",

                    over50:
                        ""

                });

            }


            result.push({

                theater,

                movie:
                    cleanMovieTitle(
                        movieRaw
                    ),

                start:
                    parsedTime.start,

                end:
                    parsedTime.end,

                startMinutes:
                    parsedTime.startMinutes,

                endMinutes:
                    parsedTime.endMinutes,

                servers,

                rules

            });

        }

    }


    return result;

}


/* =========================================================
   TEXT INSIDE A DETECTED CELL
========================================================= */

function textInsideCell(
    words,
    left,
    top,
    right,
    bottom
) {

    const width =
        right -
        left;


    const height =
        bottom -
        top;


    /*
    Slight inset avoids capturing border artifacts.
    */

    const insetX =
        Math.max(
            1,
            width *
            0.015
        );


    const insetY =
        Math.max(
            1,
            height *
            0.05
        );


    const matches =
        words.filter(
            word =>

                word.centerX >
                    left +
                    insetX &&

                word.centerX <
                    right -
                    insetX &&

                word.centerY >
                    top +
                    insetY &&

                word.centerY <
                    bottom -
                    insetY

        );


    matches.sort(
        (
            a,
            b
        ) => {

            const yDifference =
                a.centerY -
                b.centerY;


            if (
                Math.abs(
                    yDifference
                ) > 5
            ) {

                return yDifference;

            }


            return (
                a.left -
                b.left
            );

        }
    );


    return matches
        .map(
            word =>
                word.text
        )
        .join(" ")
        .trim();

}


/* =========================================================
   PARSE THEATER ROW LABEL

   Examples:

   ACEG (ADG)
   BDFH (BEH)
   (CF)
========================================================= */

function parseRowAssignment(
    value,
    rowIndex
) {

    if (!value) {
        return null;
    }


    let cleaned =
        value
            .toUpperCase()
            .replace(
                /[^A-H()]/g,
                ""
            );


    if (!cleaned) {
        return null;
    }


    const groups =
        cleaned.match(
            /[A-H]+/g
        );


    if (
        !groups ||
        !groups.length
    ) {

        return null;

    }


    /*
    Third row:
    (CF)

    Same letters are used when activated.
    */

    if (
        rowIndex === 2
    ) {

        return {

            normal:
                groups[0],

            over50:
                groups[0]

        };

    }


    return {

        normal:
            groups[0],

        over50:
            groups[1] ||
            groups[0]

    };

}


/* =========================================================
   APPLY STAR CINEMA ASSIGNMENT RULES
========================================================= */

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


    /*
    ========================================================
    ONE NORMAL SERVER

    One server means the ENTIRE theater.

    Their physical spreadsheet row does NOT matter.
    ========================================================
    */

    if (
        normalServers.length === 1
    ) {

        const server =
            normalServers[0];


        server.rows =
            "ALL ROWS";


        /*
        If nobody conditional is listed, they keep
        the entire theater regardless of occupancy.
        */

        if (
            conditionalServers.length === 0
        ) {

            server.over50 =
                "ALL ROWS";

        }

        else {

            /*
            If a parenthetical third server joins over 50,
            the original server keeps the over-50 portions
            assigned to the first two server groups.
            */

            const first =
                showing.rules[0]
                    ?.over50 ||
                "";


            const second =
                showing.rules[1]
                    ?.over50 ||
                "";


            server.over50 =
                combineRows(
                    first,
                    second
                );

        }

    }


    /*
    ========================================================
    TWO NORMAL SERVERS

    Their physical first/second assignment position matters.
    ========================================================
    */

    else if (
        normalServers.length >= 2
    ) {

        normalServers.forEach(
            server => {

                const ruleIndex =
                    Math.min(
                        server.position -
                        1,
                        1
                    );


                const rule =
                    showing.rules[
                        ruleIndex
                    ];


                server.rows =
                    rule?.normal ||
                    "";


                server.over50 =
                    rule?.over50 ||
                    server.rows;

            }
        );

    }


    /*
    ========================================================
    THIRD / PARENTHETICAL SERVER

    Only joins when occupancy goes above 50.
    ========================================================
    */

    conditionalServers.forEach(
        server => {

            const rule =
                showing.rules[2];


            server.rows =
                rule?.over50 ||
                rule?.normal ||
                "CF";


            server.over50 =
                server.rows;

        }
    );

}


/* =========================================================
   COMBINE ROWS
========================================================= */

function combineRows(
    first,
    second
) {

    const letters =
        (
            first +
            second
        )
            .toUpperCase()
            .split("")
            .filter(
                character =>
                    /[A-H]/.test(
                        character
                    )
            );


    return [
        ...new Set(
            letters
        )
    ]
        .sort()
        .join("");

}


/* =========================================================
   CLEAN SERVER NAME
========================================================= */

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
                ""
            )
            .replace(
                /[^A-Za-zÀ-ÿ' -]/g,
                ""
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
        24
    ) {

        return "";

    }


    /*
    Don't mistake assignment letters for names.
    */

    if (
        /^[A-H]{1,8}$/i.test(
            cleaned
        )
    ) {

        return "";

    }


    const forbidden =
        [
            "THEATER",
            "SEATING",
            "CAPACITY",
            "TODAY",
            "MOVIE"
        ];


    if (
        forbidden.includes(
            cleaned.toUpperCase()
        )
    ) {

        return "";

    }


    /*
    A server name should be short.
    */

    if (
        cleaned
            .split(" ")
            .length >
        3
    ) {

        return "";

    }


    return cleaned
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

}


/* =========================================================
   CLEAN MOVIE
========================================================= */

function cleanMovieTitle(
    value
) {

    if (!value) {
        return "";
    }


    return value
        .replace(
            /[|_[\]{}]/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


/* =========================================================
   PARSE SHOWTIME
========================================================= */

function parseShowtime(
    value
) {

    if (!value) {
        return null;
    }


    let text =
        value
            .toLowerCase()
            .replace(
                /\s+/g,
                ""
            )
            .replace(
                /[–—]/g,
                "-"
            )
            .replace(
                /[;.]/g,
                ":"
            );


    /*
    Common OCR substitutions around digits.
    */

    text =
        text
            .replace(
                /(?<=\d)o(?=\d)/g,
                "0"
            )
            .replace(
                /(?<=\d)l(?=\d)/g,
                "1"
            );


    const match =
        text.match(
            /(\d{1,2}):(\d{2})([ap](?:m)?)?-(\d{1,2}):(\d{2})([ap](?:m)?)?/
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
        startHour <
        1 ||

        startHour >
        12 ||

        endHour <
        1 ||

        endHour >
        12 ||

        startMinute >
        59 ||

        endMinute >
        59
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


    /*
    Infer start AM/PM from Star Cinema schedule.

    10-11 = morning
    12 onward through evening = PM
    */

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


    /*
    Infer ending period.
    */

    if (!endPeriod) {

        /*
        Late evening show ending at 12/1/2
        crosses midnight.
        */

        if (
            startPeriod ===
            "PM" &&
            startHour >=
            7 &&
            (
                endHour ===
                12 ||
                endHour <=
                2
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


/* =========================================================
   PERIOD
========================================================= */

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


/* =========================================================
   TIME TO MINUTES
========================================================= */

function clockMinutes(
    hour,
    minute,
    period
) {

    let adjusted =
        hour;


    if (
        period ===
        "PM" &&
        adjusted !==
        12
    ) {

        adjusted +=
            12;

    }


    if (
        period ===
        "AM" &&
        adjusted ===
        12
    ) {

        adjusted =
            0;

    }


    return (
        adjusted *
        60 +
        minute
    );

}


/* =========================================================
   FORMAT TIME
========================================================= */

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


/* =========================================================
   SERVER DROPDOWN
========================================================= */

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


/* =========================================================
   SHOW SCHEDULE BUTTON
========================================================= */

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


/* =========================================================
   BUILD PERSONAL SCHEDULE
========================================================= */

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


    /*
    Chronological order.
    */

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
        assignments.length ===
        0
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
                        ?
                        " conditional"
                        :
                        ""
                );


            let rowHTML =
                "";


            /*
            Parenthetical / conditional server.
            */

            if (
                item.server
                    .conditional
            ) {

                rowHTML = `

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

                rowHTML = `

                    <div class="rows">
                        ${escapeHTML(
                            item.server.rows
                        )}
                    </div>

                `;


                if (
                    item.server
                        .over50 &&
                    item.server
                        .over50 !==
                    item.server
                        .rows
                ) {

                    rowHTML += `

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

                    Theater
                    ${item.theater}

                </div>


                ${
                    item.movie
                        ?
                        `
                        <div class="assignment-movie">

                            ${escapeHTML(
                                item.movie
                            )}

                        </div>
                        `
                        :
                        ""
                }


                ${rowHTML}

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


/* =========================================================
   DEBUG OUTPUT
========================================================= */

function showDetectedLineup(
    columns,
    rows
) {

    let output =
        "";


    output +=
        "GRID DETECTION SUCCESSFUL\n";

    output +=
        "====================================\n\n";


    output +=
        "Showing column edges:\n";

    output +=
        columns
            .map(
                value =>
                    Math.round(
                        value
                    )
            )
            .join(", ");


    output +=
        "\n\n";


    output +=
        `Horizontal grid lines: ${rows.length}\n`;


    output +=
        `Showings detected: ${lineupData.length}\n\n`;


    output +=
        "DETECTED LINEUP\n";

    output +=
        "====================================\n\n";


    for (
        let theater = 1;
        theater <= 8;
        theater++
    ) {

        output +=
            `THEATER ${theater}\n`;


        const showings =
            lineupData.filter(
                item =>
                    item.theater ===
                    theater
            );


        if (
            !showings.length
        ) {

            output +=
                "  No showings detected\n";

        }


        showings.forEach(
            showing => {

                output +=
                    "\n";


                output +=
                    "  " +
                    showing.start +
                    " - " +
                    showing.end +
                    "\n";


                if (
                    showing.movie
                ) {

                    output +=
                        "  " +
                        showing.movie +
                        "\n";

                }


                if (
                    !showing.servers
                        .length
                ) {

                    output +=
                        "  ! No servers detected\n";

                }


                showing.servers.forEach(
                    server => {

                        if (
                            server
                                .conditional
                        ) {

                            output +=
                                "  -> (" +
                                server.name +
                                ") : " +
                                server.rows +
                                " ONLY OVER 50\n";

                        }

                        else {

                            output +=
                                "  -> " +
                                server.name +
                                " : " +
                                server.rows;


                            if (
                                server.over50 &&
                                server.over50 !==
                                server.rows
                            ) {

                                output +=
                                    " -> " +
                                    server.over50 +
                                    " over 50";

                            }


                            output +=
                                "\n";

                        }

                    }
                );

            }
        );


        output +=
            "\n------------------------------------\n\n";

    }


    detectedText.textContent =
        output;

}


/* =========================================================
   ESCAPE HTML
========================================================= */

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
