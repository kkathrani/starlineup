/*
============================================================
STAR CINEMA PERSONAL LINEUP
VERSION 8 — PER-CELL OCR + TIME DEBUGGING
============================================================

This version:
✓ Detects 5 showing columns automatically
✓ Detects all theater row lines automatically
✓ OCRs each time/server cell individually
✓ Logs EVERY raw time-cell OCR result
✓ Handles 1-server = ALL ROWS
✓ Handles 2-server row splits
✓ Handles conditional 3rd server
✓ Handles over-50 row changes
✓ Sorts final schedule chronologically
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
   THEATER ROW RULES
========================================================= */

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
                URL.revokeObjectURL(url);
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
                `Image: ${image.width} × ${image.height}\n`;


            const analysis =
                createAnalysisCanvas(
                    image
                );


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
                    `Expected 6 showing-column edges but detected ${columns.length}.`
                );
            }


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
                    `Expected 41 horizontal grid lines but detected ${rows.length}.`
                );
            }


            detectedText.textContent +=
                "\nGrid detected successfully.\n";

            detectedText.textContent +=
                "Reading individual cells...\n\n";


            const worker =
                await Tesseract.createWorker(
                    "eng",
                    1
                );


            if (
                Tesseract.PSM &&
                Tesseract.PSM.SINGLE_LINE
            ) {

                await worker.setParameters({

                    tessedit_pageseg_mode:
                        Tesseract.PSM.SINGLE_LINE

                });
            }


            lineupData =
                await readGridCells(
                    image,
                    worker,
                    columns,
                    rows
                );


            await worker.terminate();


            lineupData.forEach(
                applyAssignmentRules
            );


            showDetectedLineup(
                columns,
                rows
            );


            populateServers();


            if (
                lineupData.length === 0
            ) {

                alert(
                    "The spreadsheet grid was detected, but no showtimes could be read."
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
                "================================\n" +
                (
                    error?.stack ||
                    error?.message ||
                    String(error)
                );


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
   CREATE ANALYSIS CANVAS
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
   DETECT SHOWING COLUMNS
========================================================= */

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


/* =========================================================
   FIND BEST COLUMN SET
========================================================= */

function findBestColumnSet(lines) {

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
                (a, b) =>
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
                (sum, gap) => {

                    const difference =
                        gap -
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


/* =========================================================
   DETECT THEATER GRID
========================================================= */

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


/* =========================================================
   FIND BEST THEATER GRID
========================================================= */

function findBestTheaterGrid(lines) {

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


        const smallerGaps =
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

                    smallerGaps.push(
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
                smallerGaps
            );


        if (
            smallMedian <= 0
        ) {

            continue;
        }


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


        smallerGaps.forEach(
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


/* =========================================================
   CLUSTER GRID POSITIONS
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


/* =========================================================
   READ ALL GRID CELLS
========================================================= */

async function readGridCells(
    image,
    worker,
    columns,
    rows
) {

    const showings =
        [];


    let processedCells =
        0;


    const maximumCells =
        40;


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


        const server1Top =
            rows[
                base + 2
            ];


        const server1Bottom =
            rows[
                base + 3
            ];


        const server2Top =
            rows[
                base + 3
            ];


        const server2Bottom =
            rows[
                base + 4
            ];


        const server3Top =
            rows[
                base + 4
            ];


        const server3Bottom =
            rows[
                base + 5
            ];


        for (
            let column = 0;
            column < 5;
            column++
        ) {

            processedCells++;


            readButton.textContent =
                `Reading ${processedCells}/${maximumCells}...`;


            progressBar.style.width =
                (
                    processedCells /
                    maximumCells *
                    100
                ) +
                "%";


            const left =
                columns[
                    column
                ];


            const right =
                columns[
                    column + 1
                ];


            const rawTime =
                await ocrSingleCell(
                    worker,
                    image,
                    left,
                    timeTop,
                    right,
                    timeBottom
                );


            /*
            IMPORTANT DEBUG OUTPUT
            */

            console.log(
                `T${theater} C${column + 1} raw time:`,
                JSON.stringify(
                    rawTime
                )
            );


            detectedText.textContent +=
                `T${theater} C${column + 1}: "${rawTime || "(blank)"}"\n`;


            const parsedTime =
                parseShowtime(
                    rawTime
                );


            if (
                !parsedTime
            ) {

                continue;
            }


            const rawServer1 =
                await ocrSingleCell(
                    worker,
                    image,
                    left,
                    server1Top,
                    right,
                    server1Bottom
                );


            const rawServer2 =
                await ocrSingleCell(
                    worker,
                    image,
                    left,
                    server2Top,
                    right,
                    server2Bottom
                );


            const rawServer3 =
                await ocrSingleCell(
                    worker,
                    image,
                    left,
                    server3Top,
                    right,
                    server3Bottom
                );


            const servers =
                [];


            const server1 =
                cleanServerName(
                    rawServer1
                );


            const server2 =
                cleanServerName(
                    rawServer2
                );


            const server3 =
                cleanServerName(
                    rawServer3
                );


            if (
                server1
            ) {

                servers.push({

                    name:
                        server1,

                    position:
                        1,

                    conditional:
                        false,

                    rows:
                        "",

                    over50:
                        ""
                });
            }


            if (
                server2
            ) {

                servers.push({

                    name:
                        server2,

                    position:
                        2,

                    conditional:
                        false,

                    rows:
                        "",

                    over50:
                        ""
                });
            }


            if (
                server3
            ) {

                servers.push({

                    name:
                        server3,

                    position:
                        3,

                    conditional:
                        true,

                    rows:
                        "",

                    over50:
                        ""
                });
            }


            showings.push({

                theater,

                start:
                    parsedTime.start,

                end:
                    parsedTime.end,

                startMinutes:
                    parsedTime.startMinutes,

                endMinutes:
                    parsedTime.endMinutes,

                servers,

                rules:
                    theaterRows[
                        theater
                    ],

                raw: {

                    time:
                        rawTime,

                    server1:
                        rawServer1,

                    server2:
                        rawServer2,

                    server3:
                        rawServer3
                }

            });
        }
    }


    return showings;
}


/* =========================================================
   OCR ONE CELL
========================================================= */

async function ocrSingleCell(
    worker,
    image,
    left,
    top,
    right,
    bottom
) {

    const originalWidth =
        right -
        left;


    const originalHeight =
        bottom -
        top;


    const insetX =
        Math.max(
            2,
            originalWidth *
            0.035
        );


    const insetY =
        Math.max(
            1,
            originalHeight *
            0.10
        );


    const cropLeft =
        left +
        insetX;


    const cropTop =
        top +
        insetY;


    const cropWidth =
        Math.max(
            2,
            originalWidth -
            insetX *
            2
        );


    const cropHeight =
        Math.max(
            2,
            originalHeight -
            insetY *
            2
        );


    const scale =
        4;


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        Math.max(
            1,
            Math.round(
                cropWidth *
                scale
            )
        );


    canvas.height =
        Math.max(
            1,
            Math.round(
                cropHeight *
                scale
            )
        );


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

        cropLeft,
        cropTop,
        cropWidth,
        cropHeight,

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

        const gray =

            0.299 *
            pixels[i] +

            0.587 *
            pixels[i + 1] +

            0.114 *
            pixels[i + 2];


        const value =
            gray <
            205
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


    const result =
        await worker.recognize(
            canvas
        );


    return (
        result.data?.text ||
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


/* =========================================================
   APPLY ASSIGNMENT RULES
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


/* =========================================================
   COMBINE ROW LETTERS
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
            .split("")
            .filter(
                value =>
                    /[A-H]/i.test(
                        value
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

function cleanServerName(value) {

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


    if (
        /^[A-H]{1,8}$/i.test(
            cleaned
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
   SHOWTIME PARSER
========================================================= */

function parseShowtime(value) {

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


    text =
        text.replace(
            /(?<=\d)[oO](?=\d)/g,
            "0"
        );


    text =
        text.replace(
            /(?<=\d)[lI](?=\d)/g,
            "1"
        );


    text =
        text.replace(
            /[^0-9:apm-]/g,
            ""
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
                endHour < startHour
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


/* =========================================================
   TIME HELPERS
========================================================= */

function periodFromMarker(marker) {

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

    let adjusted =
        hour;


    if (
        period === "PM" &&
        adjusted !== 12
    ) {

        adjusted +=
            12;
    }


    if (
        period === "AM" &&
        adjusted === 12
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
   SHOW PERSONAL SCHEDULE
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

function buildSchedule(name) {

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
        "Column edges:\n";


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
        `Horizontal lines: ${rows.length}\n`;


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
                    `  ${showing.start} - ${showing.end}\n`;


                output +=
                    `  OCR time: "${showing.raw.time}"\n`;


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
                            server.conditional
                        ) {

                            output +=
                                `  -> (${server.name}) : ${server.rows} ONLY OVER 50\n`;
                        }

                        else {

                            output +=
                                `  -> ${server.name} : ${server.rows}`;


                            if (
                                server.over50 &&
                                server.over50 !==
                                server.rows
                            ) {

                                output +=
                                    ` -> ${server.over50} over 50`;
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

function escapeHTML(value) {

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
