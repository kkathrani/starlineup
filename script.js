/*
=========================================================
STAR CINEMA PERSONAL LINEUP
Adaptive Parser - Version 5
=========================================================

Workflow:

1. Upload screenshot
2. Detect spreadsheet bounds
3. OCR screenshot once with positional data
4. Locate Theater 1-8
5. Normalize theater/showing cells
6. Read movie/time/server cells
7. Read theater row rules
8. Apply one/two/three-server rules
9. Build chronological personal schedule
*/


/*
=========================================================
PAGE ELEMENTS
=========================================================
*/

const imageInput = document.getElementById("lineupImage");
const imagePreview = document.getElementById("imagePreview");
const previewContainer = document.getElementById("previewContainer");

const readButton = document.getElementById("readButton");

const serverSection = document.getElementById("serverSection");
const serverSelect = document.getElementById("serverSelect");

const scheduleSection = document.getElementById("scheduleSection");
const scheduleList = document.getElementById("scheduleList");

const scheduleName = document.getElementById("scheduleName");
const scheduleDate = document.getElementById("scheduleDate");

const loading = document.getElementById("loading");
const progressBar = document.getElementById("progressBar");

const debugSection = document.getElementById("debugSection");
const detectedText = document.getElementById("detectedText");

let uploadedFile = null;
let lineupData = [];


/*
=========================================================
FALLBACK ROW RULES

These are ONLY used if OCR cannot successfully read the
row labels printed on the left side of the spreadsheet.
=========================================================
*/

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


/*
=========================================================
UPLOAD IMAGE
=========================================================
*/

imageInput.addEventListener("change", () => {

    uploadedFile = imageInput.files[0];

    if (!uploadedFile) {
        return;
    }

    const previewURL = URL.createObjectURL(uploadedFile);

    imagePreview.src = previewURL;

    imagePreview.onload = () => {
        URL.revokeObjectURL(previewURL);
    };

    previewContainer.classList.remove("hidden");
    readButton.classList.remove("hidden");

    serverSection.classList.add("hidden");
    scheduleSection.classList.add("hidden");
    debugSection.classList.add("hidden");

    lineupData = [];
});


/*
=========================================================
READ LINEUP
=========================================================
*/

readButton.addEventListener("click", async () => {

    if (!uploadedFile) {

        alert("Upload a lineup screenshot first.");
        return;
    }


    readButton.disabled = true;
    readButton.textContent = "Reading Lineup...";

    loading.classList.remove("hidden");

    progressBar.style.width = "0%";

    serverSection.classList.add("hidden");
    scheduleSection.classList.add("hidden");

    debugSection.classList.remove("hidden");

    detectedText.textContent =
        "Preparing image...\n";


    try {

        /*
        ---------------------------
        Load original image
        ---------------------------
        */

        const image =
            await loadImage(uploadedFile);


        detectedText.textContent +=
            `Original image: ${image.width} x ${image.height}\n`;


        /*
        ---------------------------
        Detect actual spreadsheet
        ---------------------------
        */

        const sheet =
            detectSheetBounds(image);


        detectedText.textContent +=
            `Spreadsheet detected:\n`;

        detectedText.textContent +=
            `x=${Math.round(sheet.left)}, ` +
            `y=${Math.round(sheet.top)}, ` +
            `w=${Math.round(sheet.width)}, ` +
            `h=${Math.round(sheet.height)}\n`;


        /*
        ---------------------------
        Preprocess image for OCR
        ---------------------------
        */

        const processed =
            preprocessImage(image);


        detectedText.textContent +=
            "Starting OCR...\n";


        /*
        ---------------------------
        Create Tesseract worker
        ---------------------------
        */

        const worker =
            await Tesseract.createWorker(
                "eng",
                1,
                {
                    logger: message => {

                        if (
                            message.status ===
                            "recognizing text"
                        ) {

                            const percentage =
                                Math.round(
                                    message.progress * 100
                                );

                            progressBar.style.width =
                                percentage + "%";
                        }
                    }
                }
            );


        /*
        ---------------------------
        Perform OCR
        ---------------------------
        */

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


        if (!result.data) {

            throw new Error(
                "OCR returned no data."
            );
        }


        if (!result.data.tsv) {

            throw new Error(
                "OCR did not return positional data."
            );
        }


        /*
        ---------------------------
        Convert TSV to words
        ---------------------------
        */

        const words =
            parseTSV(
                result.data.tsv,
                processed.scale
            );


        detectedText.textContent +=
            `OCR words found: ${words.length}\n`;


        /*
        ---------------------------
        Determine theater layout
        ---------------------------
        */

        const layout =
            detectLayout(
                image,
                sheet,
                words
            );


        /*
        ---------------------------
        Parse entire lineup
        ---------------------------
        */

        lineupData =
            parseLineup(
                words,
                layout
            );


        /*
        ---------------------------
        Apply business rules
        ---------------------------
        */

        lineupData.forEach(
            applyServerRules
        );


        /*
        ---------------------------
        Debug output
        ---------------------------
        */

        showDetectedLineup(
            layout
        );


        /*
        ---------------------------
        Build server dropdown
        ---------------------------
        */

        populateServers();


        if (!lineupData.length) {

            alert(
                "No showings were detected. " +
                "Scroll down to the Detected Text section."
            );

        } else {

            serverSection.classList.remove(
                "hidden"
            );

            serverSection.scrollIntoView({
                behavior: "smooth"
            });
        }

    }

    catch (error) {

        console.error(error);

        detectedText.textContent +=
            "\n\nERROR\n====================\n";

        detectedText.textContent +=
            (
                error?.stack ||
                error?.message ||
                String(error)
            );

        alert(
            "There was a problem reading the lineup. " +
            "The technical error is shown below."
        );
    }


    loading.classList.add("hidden");

    readButton.disabled = false;
    readButton.textContent = "Read Lineup";
});


/*
=========================================================
LOAD IMAGE
=========================================================
*/

function loadImage(file) {

    return new Promise(
        (resolve, reject) => {

            const img =
                new Image();

            const url =
                URL.createObjectURL(file);


            img.onload = () => {

                URL.revokeObjectURL(url);
                resolve(img);
            };


            img.onerror = () => {

                URL.revokeObjectURL(url);

                reject(
                    new Error(
                        "Could not load image."
                    )
                );
            };


            img.src = url;
        }
    );
}


/*
=========================================================
DETECT SPREADSHEET BOUNDS

This means screenshots do NOT need to have identical
pixel dimensions.

We look for the large light-colored spreadsheet region
inside the image.
=========================================================
*/

function detectSheetBounds(image) {

    const canvas =
        document.createElement("canvas");

    canvas.width = image.width;
    canvas.height = image.height;


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


    const data =
        imageData.data;


    const width =
        canvas.width;

    const height =
        canvas.height;


    /*
    Count light/gray spreadsheet pixels in every row.
    */

    const rowScores =
        new Array(height)
            .fill(0);

    const colScores =
        new Array(width)
            .fill(0);


    for (
        let y = 0;
        y < height;
        y++
    ) {

        for (
            let x = 0;
            x < width;
            x++
        ) {

            const i =
                (
                    y * width +
                    x
                ) * 4;


            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];


            const brightness =
                (
                    r +
                    g +
                    b
                ) / 3;


            /*
            Spreadsheet is mostly white/gray.
            Black screenshot margins do not count.
            */

            if (
                brightness > 115
            ) {

                rowScores[y]++;
                colScores[x]++;
            }
        }
    }


    /*
    A row is considered part of the spreadsheet when
    enough of it is bright.
    */

    const rowThreshold =
        width * 0.12;

    const colThreshold =
        height * 0.12;


    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;


    for (
        let y = 0;
        y < height;
        y++
    ) {

        if (
            rowScores[y] >
            rowThreshold
        ) {

            top = y;
            break;
        }
    }


    for (
        let y = height - 1;
        y >= 0;
        y--
    ) {

        if (
            rowScores[y] >
            rowThreshold
        ) {

            bottom = y;
            break;
        }
    }


    for (
        let x = 0;
        x < width;
        x++
    ) {

        if (
            colScores[x] >
            colThreshold
        ) {

            left = x;
            break;
        }
    }


    for (
        let x = width - 1;
        x >= 0;
        x--
    ) {

        if (
            colScores[x] >
            colThreshold
        ) {

            right = x;
            break;
        }
    }


    /*
    Sanity check.

    If automatic detection fails, safely use
    the whole image.
    */

    if (
        right - left <
        width * 0.5 ||
        bottom - top <
        height * 0.5
    ) {

        return {
            left: 0,
            top: 0,
            right: width,
            bottom: height,
            width,
            height
        };
    }


    return {

        left,
        top,

        right,
        bottom,

        width:
            right - left,

        height:
            bottom - top
    };
}


/*
=========================================================
OCR PREPROCESSING
=========================================================
*/

function preprocessImage(image) {

    /*
    2X enlargement improves small spreadsheet text.
    */

    const scale = 2;


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        image.width * scale;

    canvas.height =
        image.height * scale;


    const ctx =
        canvas.getContext(
            "2d",
            {
                willReadFrequently: true
            }
        );


    ctx.imageSmoothingEnabled = false;


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


    const data =
        imageData.data;


    for (
        let i = 0;
        i < data.length;
        i += 4
    ) {

        const r =
            data[i];

        const g =
            data[i + 1];

        const b =
            data[i + 2];


        const gray =
            (
                0.299 * r +
                0.587 * g +
                0.114 * b
            );


        /*
        High contrast black/white.
        */

        const value =
            gray < 185
                ? 0
                : 255;


        data[i] =
            value;

        data[i + 1] =
            value;

        data[i + 2] =
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


/*
=========================================================
PARSE TESSERACT TSV
=========================================================
*/

function parseTSV(tsv, scale) {

    const lines =
        tsv
            .trim()
            .split("\n");


    if (
        lines.length < 2
    ) {

        return [];
    }


    const headers =
        lines[0]
            .split("\t");


    const indexes = {};


    headers.forEach(
        (header, index) => {

            indexes[header] =
                index;
        }
    );


    const words = [];


    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const values =
            lines[i].split("\t");


        const text =
            (
                values[
                    indexes.text
                ] || ""
            ).trim();


        if (!text) {
            continue;
        }


        const confidence =
            parseFloat(
                values[
                    indexes.conf
                ]
            );


        if (
            Number.isFinite(confidence) &&
            confidence < 15
        ) {

            continue;
        }


        const left =
            parseFloat(
                values[
                    indexes.left
                ]
            ) / scale;


        const top =
            parseFloat(
                values[
                    indexes.top
                ]
            ) / scale;


        const width =
            parseFloat(
                values[
                    indexes.width
                ]
            ) / scale;


        const height =
            parseFloat(
                values[
                    indexes.height
                ]
            ) / scale;


        if (
            !Number.isFinite(left) ||
            !Number.isFinite(top)
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


/*
=========================================================
DETECT LAYOUT

Coordinates are normalized RELATIVE TO THE DETECTED SHEET,
not to the screenshot's raw pixel size.
=========================================================
*/

function detectLayout(
    image,
    sheet,
    words
) {

    /*
    The sheet contains:

    Column A = theater information
    Columns B-F = 5 possible showings
    */


    const vertical =
        detectVerticalGridLines(
            image,
            sheet
        );


    /*
    If actual line detection fails, use proportions
    INSIDE the detected spreadsheet.

    These are scale-independent.
    */

    let columnEdges;


    if (
        vertical.length >= 7
    ) {

        columnEdges =
            chooseBestSevenLines(
                vertical,
                sheet
            );

    } else {

        columnEdges = [

            sheet.left,

            sheet.left +
            sheet.width * 0.154,

            sheet.left +
            sheet.width * 0.323,

            sheet.left +
            sheet.width * 0.492,

            sheet.left +
            sheet.width * 0.661,

            sheet.left +
            sheet.width * 0.830,

            sheet.right

        ];
    }


    /*
    Find Theater labels with OCR.

    This allows vertical positioning to adapt if
    the screenshot includes more/less header area.
    */

    const theaterPositions =
        findTheaterPositions(
            words
        );


    let theaterTop;
    let theaterHeight;


    if (
        theaterPositions.length >= 4
    ) {

        const fitted =
            fitTheaterPositions(
                theaterPositions
            );


        theaterHeight =
            fitted.spacing;


        /*
        Theater label is near the upper part of
        each theater block.
        */

        theaterTop =
            fitted.firstCenter -
            theaterHeight * 0.15;

    } else {

        /*
        Fallback relative to detected sheet.
        */

        theaterTop =
            sheet.top +
            sheet.height * 0.055;


        const theaterBottom =
            sheet.top +
            sheet.height * 0.975;


        theaterHeight =
            (
                theaterBottom -
                theaterTop
            ) / 8;
    }


    return {

        sheet,

        columnEdges,

        theaterTop,

        theaterHeight
    };
}


/*
=========================================================
DETECT VERTICAL GRID LINES
=========================================================
*/

function detectVerticalGridLines(
    image,
    sheet
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
                willReadFrequently: true
            }
        );


    ctx.drawImage(
        image,
        0,
        0
    );


    const data =
        ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        ).data;


    const yStart =
        Math.max(
            0,
            Math.floor(
                sheet.top +
                sheet.height * 0.07
            )
        );


    const yEnd =
        Math.min(
            image.height - 1,
            Math.ceil(
                sheet.bottom -
                sheet.height * 0.02
            )
        );


    const scores = [];


    for (
        let x =
            Math.floor(sheet.left);
        x <=
            Math.ceil(sheet.right);
        x++
    ) {

        let darkPixels = 0;


        for (
            let y = yStart;
            y <= yEnd;
            y += 2
        ) {

            const index =
                (
                    y *
                    image.width +
                    x
                ) * 4;


            const brightness =
                (
                    data[index] +
                    data[index + 1] +
                    data[index + 2]
                ) / 3;


            if (
                brightness < 70
            ) {

                darkPixels++;
            }
        }


        scores.push({
            x,
            score:
                darkPixels
        });
    }


    const heightSamples =
        (
            yEnd -
            yStart
        ) / 2;


    const threshold =
        heightSamples * 0.34;


    const candidates =
        scores.filter(
            point =>
                point.score >
                threshold
        );


    return clusterLines(
        candidates
            .map(
                item =>
                    item.x
            )
    );
}


/*
=========================================================
CLUSTER NEARBY GRID PIXELS INTO ONE LINE
=========================================================
*/

function clusterLines(values) {

    if (!values.length) {
        return [];
    }


    values.sort(
        (a, b) =>
            a - b
    );


    const clusters = [];

    let cluster = [
        values[0]
    ];


    for (
        let i = 1;
        i < values.length;
        i++
    ) {

        if (
            values[i] -
            values[i - 1] <= 4
        ) {

            cluster.push(
                values[i]
            );

        } else {

            clusters.push(
                cluster
            );

            cluster = [
                values[i]
            ];
        }
    }


    clusters.push(
        cluster
    );


    return clusters.map(
        values => {

            return (
                values.reduce(
                    (sum, x) =>
                        sum + x,
                    0
                ) /
                values.length
            );
        }
    );
}


/*
=========================================================
CHOOSE BEST 7 COLUMN LINES
=========================================================
*/

function chooseBestSevenLines(
    lines,
    sheet
) {

    /*
    Keep grid-looking lines within spreadsheet.
    */

    const valid =
        lines.filter(
            x =>
                x >= sheet.left &&
                x <= sheet.right
        );


    if (
        valid.length === 7
    ) {

        return valid;
    }


    /*
    Match detected lines to expected normalized
    positions.
    */

    const expected = [
        0,
        0.154,
        0.323,
        0.492,
        0.661,
        0.830,
        1
    ];


    return expected.map(
        ratio => {

            const target =
                sheet.left +
                sheet.width *
                ratio;


            let closest =
                target;

            let distance =
                Infinity;


            valid.forEach(
                candidate => {

                    const d =
                        Math.abs(
                            candidate -
                            target
                        );


                    if (
                        d < distance
                    ) {

                        distance = d;
                        closest = candidate;
                    }
                }
            );


            /*
            Only trust a detected line if reasonably
            close to where a column should exist.
            */

            if (
                distance <
                sheet.width * 0.04
            ) {

                return closest;
            }


            return target;
        }
    );
}


/*
=========================================================
FIND THEATER LABELS
=========================================================
*/

function findTheaterPositions(
    words
) {

    const found = [];


    words.forEach(
        (word, index) => {

            const cleaned =
                word.text
                    .replace(
                        /[^A-Za-z0-9]/g,
                        ""
                    );


            /*
            Example:
            Theater3
            */

            let match =
                cleaned.match(
                    /^Theater([1-8])$/i
                );


            if (match) {

                found.push({

                    theater:
                        Number(
                            match[1]
                        ),

                    y:
                        word.centerY
                });

                return;
            }


            /*
            Example:
            Theater 3
            */

            if (
                /^Theater$/i.test(
                    cleaned
                )
            ) {

                const nearby =
                    words.find(
                        other => {

                            const number =
                                other.text
                                    .replace(
                                        /\D/g,
                                        ""
                                    );


                            return (

                                /^[1-8]$/.test(
                                    number
                                ) &&

                                Math.abs(
                                    other.centerY -
                                    word.centerY
                                ) < 12 &&

                                other.centerX >
                                    word.centerX &&

                                other.centerX -
                                    word.centerX <
                                    120
                            );
                        }
                    );


                if (nearby) {

                    found.push({

                        theater:
                            Number(
                                nearby.text
                                    .replace(
                                        /\D/g,
                                        ""
                                    )
                            ),

                        y:
                            (
                                word.centerY +
                                nearby.centerY
                            ) / 2
                    });
                }
            }
        }
    );


    /*
    Remove duplicates.
    */

    const best =
        new Map();


    found.forEach(
        item => {

            if (
                !best.has(
                    item.theater
                )
            ) {

                best.set(
                    item.theater,
                    item
                );
            }
        }
    );


    return [
        ...best.values()
    ].sort(
        (a, b) =>
            a.theater -
            b.theater
    );
}


/*
=========================================================
FIT THEATER SPACING
=========================================================
*/

function fitTheaterPositions(
    positions
) {

    /*
    Linear regression:

    y = intercept + spacing * (theater - 1)
    */

    const points =
        positions.map(
            item => ({
                x:
                    item.theater - 1,
                y:
                    item.y
            })
        );


    const n =
        points.length;


    const sumX =
        points.reduce(
            (sum, p) =>
                sum + p.x,
            0
        );


    const sumY =
        points.reduce(
            (sum, p) =>
                sum + p.y,
            0
        );


    const sumXY =
        points.reduce(
            (sum, p) =>
                sum +
                p.x * p.y,
            0
        );


    const sumXX =
        points.reduce(
            (sum, p) =>
                sum +
                p.x * p.x,
            0
        );


    const denominator =
        (
            n * sumXX -
            sumX * sumX
        );


    const spacing =
        denominator !== 0
            ?
            (
                n * sumXY -
                sumX * sumY
            ) /
            denominator
            :
            100;


    const intercept =
        (
            sumY -
            spacing *
            sumX
        ) / n;


    return {

        firstCenter:
            intercept,

        spacing
    };
}


/*
=========================================================
PARSE ENTIRE LINEUP
=========================================================
*/

function parseLineup(
    words,
    layout
) {

    const showings = [];


    for (
        let theater = 1;
        theater <= 8;
        theater++
    ) {

        const bandTop =
            layout.theaterTop +
            (
                theater - 1
            ) *
            layout.theaterHeight;


        const bandBottom =
            bandTop +
            layout.theaterHeight;


        /*
        Approximate row boundaries inside theater.

        These are RELATIVE fractions, not pixels.

        Row 0: movie
        Row 1: time
        Row 2: server 1
        Row 3: server 2
        Row 4: server 3
        */

        const rowEdges = [

            bandTop,

            bandTop +
            layout.theaterHeight * 0.30,

            bandTop +
            layout.theaterHeight * 0.47,

            bandTop +
            layout.theaterHeight * 0.64,

            bandTop +
            layout.theaterHeight * 0.81,

            bandBottom

        ];


        /*
        First read the theater's row rules.
        */

        const theaterRules =
            readTheaterRules(
                theater,
                words,
                layout.columnEdges[0],
                layout.columnEdges[1],
                rowEdges
            );


        /*
        Columns 1-5 are movie/showing columns.
        */

        for (
            let column = 1;
            column <= 5;
            column++
        ) {

            const left =
                layout.columnEdges[
                    column
                ];

            const right =
                layout.columnEdges[
                    column + 1
                ];


            const movieText =
                wordsInBox(
                    words,
                    left,
                    rowEdges[0],
                    right,
                    rowEdges[1]
                );


            const timeText =
                wordsInBox(
                    words,
                    left,
                    rowEdges[1],
                    right,
                    rowEdges[2]
                );


            const parsedTime =
                parseShowtime(
                    timeText
                );


            /*
            No valid time = no showing in this cell.
            */

            if (
                !parsedTime
            ) {

                continue;
            }


            const servers = [];


            for (
                let serverRow = 0;
                serverRow < 3;
                serverRow++
            ) {

                const rawName =
                    wordsInBox(
                        words,

                        left,

                        rowEdges[
                            serverRow + 2
                        ],

                        right,

                        rowEdges[
                            serverRow + 3
                        ]
                    );


                const name =
                    cleanServerName(
                        rawName
                    );


                if (!name) {
                    continue;
                }


                servers.push({

                    name,

                    position:
                        serverRow + 1,

                    /*
                    Third physical server row is the
                    parenthetical/conditional position.
                    */

                    conditional:
                        serverRow === 2
                });
            }


            showings.push({

                theater,

                movie:
                    cleanMovieTitle(
                        movieText
                    ),

                start:
                    parsedTime.start,

                end:
                    parsedTime.end,

                startMinutes:
                    parsedTime.startMinutes,

                endMinutes:
                    parsedTime.endMinutes,

                rules:
                    theaterRules,

                servers
            });
        }
    }


    return showings;
}


/*
=========================================================
READ ROW RULES FROM LEFT SIDE

Example:

ACEG (ADG)
BDFH (BEH)
(CF)
=========================================================
*/

function readTheaterRules(
    theater,
    words,
    left,
    right,
    rowEdges
) {

    const rules = [];


    for (
        let row = 0;
        row < 3;
        row++
    ) {

        const text =
            wordsInBox(
                words,

                left,

                rowEdges[
                    row + 2
                ],

                right,

                rowEdges[
                    row + 3
                ]
            );


        const parsed =
            parseRowRule(
                text,
                row
            );


        if (parsed) {

            rules.push(
                parsed
            );

        } else {

            rules.push({
                ...fallbackRows[
                    theater
                ][row]
            });
        }
    }


    return rules;
}


/*
=========================================================
PARSE A ROW LABEL
=========================================================
*/

function parseRowRule(
    text,
    rowIndex
) {

    if (!text) {
        return null;
    }


    const cleaned =
        text
            .toUpperCase()
            .replace(
                /[^A-H() ]/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    /*
    Capture letter groups such as:

    ACEG
    ADG
    BDFH
    BEH
    CF
    */

    const groups =
        cleaned.match(
            /[A-H]{1,6}/g
        );


    if (
        !groups ||
        !groups.length
    ) {

        return null;
    }


    /*
    Third assignment row is inherently conditional.
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


/*
=========================================================
APPLY STAR CINEMA SERVER RULES
=========================================================
*/

function applyServerRules(
    showing
) {

    /*
    Server positions 1 and 2 are normal servers.
    Position 3 is conditional / parenthetical.
    */

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
    =====================================================
    ONE NORMAL SERVER

    They are responsible for the entire theater.
    =====================================================
    */

    if (
        normalServers.length === 1
    ) {

        const server =
            normalServers[0];


        server.rows =
            "ALL ROWS";


        /*
        No conditional helper:
        server stays responsible for whole theater.
        */

        if (
            conditionalServers.length === 0
        ) {

            server.over50 =
                "ALL ROWS";
        }


        /*
        If there IS a conditional third server,
        that third server joins over 50.

        The original server keeps all rows except
        the conditional server's row group.
        */

        else {

            const first =
                showing.rules[0]
                    ?.over50 || "";

            const second =
                showing.rules[1]
                    ?.over50 || "";


            server.over50 =
                combineRows(
                    first,
                    second
                );
        }
    }


    /*
    =====================================================
    TWO NORMAL SERVERS

    Use physical assignment row.
    =====================================================
    */

    else if (
        normalServers.length >= 2
    ) {

        normalServers.forEach(
            server => {

                const index =
                    Math.min(
                        server.position - 1,
                        1
                    );


                const rule =
                    showing.rules[
                        index
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
    =====================================================
    CONDITIONAL THIRD SERVER

    Only joins when occupancy > 50.
    =====================================================
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


/*
=========================================================
COMBINE ROW LETTERS

Example:
ADG + BEH -> ABDEGH
=========================================================
*/

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
                char =>
                    /[A-H]/.test(
                        char
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


/*
=========================================================
WORDS INSIDE A BOX
=========================================================
*/

function wordsInBox(
    words,
    left,
    top,
    right,
    bottom
) {

    /*
    Slight inset keeps neighboring cell borders from
    causing as many OCR overlaps.
    */

    const insetX =
        Math.max(
            1,
            (
                right -
                left
            ) * 0.015
        );


    const insetY =
        Math.max(
            1,
            (
                bottom -
                top
            ) * 0.03
        );


    const found =
        words.filter(
            word => {

                return (

                    word.centerX >=
                        left + insetX &&

                    word.centerX <=
                        right - insetX &&

                    word.centerY >=
                        top + insetY &&

                    word.centerY <=
                        bottom - insetY
                );
            }
        );


    found.sort(
        (a, b) => {

            const yDifference =
                a.centerY -
                b.centerY;


            if (
                Math.abs(
                    yDifference
                ) > 6
            ) {

                return yDifference;
            }


            return (
                a.left -
                b.left
            );
        }
    );


    return found
        .map(
            word =>
                word.text
        )
        .join(" ")
        .trim();
}


/*
=========================================================
CLEAN SERVER NAME
=========================================================
*/

function cleanServerName(
    text
) {

    if (!text) {
        return "";
    }


    let cleaned =
        text
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
        cleaned.length < 2 ||
        cleaned.length > 22
    ) {

        return "";
    }


    /*
    Reject row codes accidentally OCR'd as names.
    */

    if (
        /^[A-H]{1,8}$/i.test(
            cleaned
        )
    ) {

        return "";
    }


    const rejected = [

        "SEATING",
        "CAPACITY",
        "THEATER",
        "MOVIE"

    ];


    if (
        rejected.includes(
            cleaned.toUpperCase()
        )
    ) {

        return "";
    }


    /*
    A person's name shouldn't contain a large
    number of words.
    */

    if (
        cleaned
            .split(" ")
            .length > 3
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


/*
=========================================================
CLEAN MOVIE TITLE
=========================================================
*/

function cleanMovieTitle(
    text
) {

    if (!text) {
        return "";
    }


    return text
        .replace(
            /[|_[\]{}]/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .replace(
            /\d{1,2}[:;.]\d{2}.*$/i,
            ""
        )
        .trim();
}


/*
=========================================================
SHOWTIME PARSER
=========================================================
*/

function parseShowtime(
    text
) {

    if (!text) {
        return null;
    }


    let cleaned =
        text
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
    Common OCR correction:
    lowercase l often replaces 1.
    */

    cleaned =
        cleaned.replace(
            /l(?=\d)/g,
            "1"
        );


    const match =
        cleaned.match(
            /(\d{1,2}):(\d{2})([ap]m?)?-(\d{1,2}):(\d{2})([ap]m?)?/
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
        markerToPeriod(
            match[3]
        );


    let endPeriod =
        markerToPeriod(
            match[6]
        );


    /*
    Infer start period.

    Star Cinema day normally begins late morning.
    */

    if (!startPeriod) {

        if (
            startHour === 10 ||
            startHour === 11
        ) {

            startPeriod =
                "AM";

        } else {

            startPeriod =
                "PM";
        }
    }


    /*
    Infer ending period.
    */

    if (!endPeriod) {

        if (

            startPeriod === "PM" &&

            (
                endHour === 12 ||

                (
                    startHour >= 7 &&
                    endHour <= 2
                )
            )

        ) {

            endPeriod =
                "AM";

        } else {

            endPeriod =
                startPeriod;
        }
    }


    const startMinutes =
        clockToMinutes(
            startHour,
            startMinute,
            startPeriod
        );


    let endMinutes =
        clockToMinutes(
            endHour,
            endMinute,
            endPeriod
        );


    if (
        endMinutes <
        startMinutes
    ) {

        endMinutes +=
            24 * 60;
    }


    return {

        start:
            formatClock(
                startHour,
                startMinute,
                startPeriod
            ),

        end:
            formatClock(
                endHour,
                endMinute,
                endPeriod
            ),

        startMinutes,

        endMinutes
    };
}


/*
=========================================================
TIME HELPERS
=========================================================
*/

function markerToPeriod(
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


function clockToMinutes(
    hour,
    minute,
    period
) {

    let value =
        hour;


    if (
        period === "PM" &&
        value !== 12
    ) {

        value += 12;
    }


    if (
        period === "AM" &&
        value === 12
    ) {

        value = 0;
    }


    return (
        value * 60 +
        minute
    );
}


function formatClock(
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


/*
=========================================================
POPULATE SERVER DROPDOWN
=========================================================
*/

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
            (a, b) =>
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


/*
=========================================================
SHOW SCHEDULE BUTTON
=========================================================
*/

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


/*
=========================================================
BUILD PERSONAL SCHEDULE
=========================================================
*/

function buildSchedule(
    name
) {

    const assignments = [];


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
        (a, b) =>

            a.startMinutes -
            b.startMinutes
    );


    scheduleList.innerHTML =
        "";


    scheduleName.textContent =
        name + "'s Lineup";


    scheduleDate.textContent =
        "Today's schedule";


    if (
        !assignments.length
    ) {

        scheduleList.innerHTML =
            "<p>No assignments found.</p>";

        scheduleSection.classList.remove(
            "hidden"
        );

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


            /*
            Conditional server
            */

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


            /*
            Normal server
            */

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
                                    item.server
                                        .over50
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


                <div class="assignment-movie">

                    ${escapeHTML(
                        item.movie ||
                        ""
                    )}

                </div>


                ${rowsHTML}

            `;


            scheduleList.appendChild(
                card
            );
        }
    );


    scheduleSection.classList.remove(
        "hidden"
    );


    scheduleSection.scrollIntoView({
        behavior:
            "smooth"
    });
}


/*
=========================================================
DEBUG / VERIFICATION OUTPUT
=========================================================
*/

function showDetectedLineup(
    layout
) {

    let output =

        "DETECTED LINEUP\n" +
        "====================================\n\n";


    output +=
        `Showings detected: ${lineupData.length}\n\n`;


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


                if (
                    showing.movie
                ) {

                    output +=
                        `  ${showing.movie}\n`;
                }


                if (
                    !showing.servers.length
                ) {

                    output +=
                        "  ! No server detected\n";
                }


                showing.servers.forEach(
                    server => {

                        if (
                            server.conditional
                        ) {

                            output +=
                                `  -> (${server.name})`;

                            output +=
                                ` : ${server.rows}`;

                            output +=
                                " ONLY OVER 50\n";

                        } else {

                            output +=
                                `  -> ${server.name}`;

                            output +=
                                ` : ${server.rows}`;


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


/*
=========================================================
ESCAPE HTML
=========================================================
*/

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
