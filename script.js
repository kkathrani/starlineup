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

let lineupData = [];
let uploadedFile = null;


/*
====================================================
THEATER ROW ASSIGNMENTS
====================================================
*/

const theaterRows = {
    1: [
        { normal: "ACE",  over50: "AD" },
        { normal: "BD",   over50: "BE" },
        { normal: "C",    over50: "C", conditional: true }
    ],

    2: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDF",  over50: "BE" },
        { normal: "CF",   over50: "CF", conditional: true }
    ],

    3: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDFH", over50: "BEH" },
        { normal: "CF",   over50: "CF", conditional: true }
    ],

    4: [
        { normal: "ACE",  over50: "ADG" },
        { normal: "BDF",  over50: "BE" },
        { normal: "CF",   over50: "CF", conditional: true }
    ],

    5: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDF",  over50: "BE" },
        { normal: "CF",   over50: "CF", conditional: true }
    ],

    6: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDFH", over50: "BEH" },
        { normal: "CF",   over50: "CF", conditional: true }
    ],

    7: [
        { normal: "ACEG", over50: "ADG" },
        { normal: "BDF",  over50: "BE" },
        { normal: "CF",   over50: "CF", conditional: true }
    ],

    8: [
        { normal: "ACE",  over50: "AD" },
        { normal: "BD",   over50: "BE" },
        { normal: "C",    over50: "C", conditional: true }
    ]
};


/*
====================================================
IMAGE UPLOAD
====================================================
*/

imageInput.addEventListener("change", () => {

    uploadedFile = imageInput.files[0];

    if (!uploadedFile) {
        return;
    }

    imagePreview.src = URL.createObjectURL(uploadedFile);

    previewContainer.classList.remove("hidden");
    readButton.classList.remove("hidden");

    serverSection.classList.add("hidden");
    scheduleSection.classList.add("hidden");
    debugSection.classList.add("hidden");

    lineupData = [];
});


/*
====================================================
READ LINEUP
====================================================
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

        const image = await loadImage(uploadedFile);

        const processed = preprocessImage(image);

        detectedText.textContent +=
            `Image prepared: ${image.width} x ${image.height}\n`;

        detectedText.textContent +=
            "Starting OCR...\n";


        /*
        ====================================================
        CREATE OCR WORKER
        ====================================================
        */

        const worker = await Tesseract.createWorker(
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
        ====================================================
        OCR WITH TSV POSITION OUTPUT
        ====================================================
        */

        const result = await worker.recognize(
            processed.canvas,
            undefined,
            {
                text: true,
                tsv: true
            }
        );

        console.log(
            "Tesseract result:",
            result
        );

        console.log(
            "Tesseract data:",
            result.data
        );

        console.log(
            "TSV:",
            result.data.tsv
        );

        await worker.terminate();


        /*
        ====================================================
        CHECK OCR OUTPUT
        ====================================================
        */

        if (!result.data) {
            throw new Error(
                "Tesseract returned no data."
            );
        }

        if (!result.data.tsv) {

            detectedText.textContent +=
                "\nTesseract did not return TSV positional data.\n";

            detectedText.textContent +=
                "\nRaw text:\n\n";

            detectedText.textContent +=
                result.data.text || "(no text returned)";

            throw new Error(
                "No TSV output was returned by Tesseract."
            );
        }


        /*
        ====================================================
        CONVERT TSV TO POSITIONED WORDS
        ====================================================
        */

        const words = parseTSV(
            result.data.tsv,
            processed.scale
        );

        console.log(
            "Positioned OCR words:",
            words
        );


        detectedText.textContent =
            `OCR found ${words.length} positioned words.\n\n`;


        /*
        ====================================================
        PARSE STAR CINEMA GRID
        ====================================================
        */

        lineupData = parseStarCinemaSheet(
            words,
            image.width,
            image.height
        );


        console.log(
            "Parsed lineup:",
            lineupData
        );


        /*
        ====================================================
        SHOW DEBUG RESULT
        ====================================================
        */

        showDetectedLineup();


        /*
        ====================================================
        POPULATE SERVER LIST
        ====================================================
        */

        populateServers();


        if (lineupData.length === 0) {

            alert(
                "I couldn't detect any showings. " +
                "Check the Detected Lineup section below."
            );

        } else {

            serverSection.classList.remove("hidden");

            serverSection.scrollIntoView({
                behavior: "smooth"
            });
        }

    }

    catch (error) {

        console.error(error);

        detectedText.textContent +=
            "\n\nERROR:\n" +
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
====================================================
LOAD IMAGE
====================================================
*/

function loadImage(file) {

    return new Promise(
        (resolve, reject) => {

            const img = new Image();

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
                        "Could not load the uploaded image."
                    )
                );
            };

            img.src = url;
        }
    );
}


/*
====================================================
PREPROCESS IMAGE
====================================================
*/

function preprocessImage(image) {

    const scale = 2;

    const canvas =
        document.createElement("canvas");

    canvas.width =
        image.width * scale;

    canvas.height =
        image.height * scale;

    const ctx =
        canvas.getContext("2d");

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

    const pixels =
        imageData.data;


    /*
    Convert to black/white.

    This helps OCR deal with gray spreadsheet cells.
    */

    for (
        let i = 0;
        i < pixels.length;
        i += 4
    ) {

        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const brightness =
            (
                0.299 * r +
                0.587 * g +
                0.114 * b
            );


        const value =
            brightness < 175
                ? 0
                : 255;


        pixels[i] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;
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
====================================================
PARSE TSV
====================================================
*/

function parseTSV(tsv, scale) {

    if (!tsv) {
        return [];
    }


    const lines =
        tsv
            .trim()
            .split("\n");


    if (lines.length <= 1) {
        return [];
    }


    const headers =
        lines[0].split("\t");


    const index = {};

    headers.forEach(
        (header, i) => {

            index[header] = i;

        }
    );


    const required = [
        "text",
        "conf",
        "left",
        "top",
        "width",
        "height"
    ];


    for (const field of required) {

        if (
            index[field] === undefined
        ) {

            throw new Error(
                `TSV is missing required field: ${field}`
            );
        }
    }


    const words = [];


    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const parts =
            lines[i].split("\t");


        const text =
            (
                parts[index.text] ||
                ""
            ).trim();


        if (!text) {
            continue;
        }


        const confidence =
            parseFloat(
                parts[index.conf]
            );


        if (
            Number.isFinite(confidence) &&
            confidence < 20
        ) {
            continue;
        }


        const left =
            parseFloat(
                parts[index.left]
            ) / scale;


        const top =
            parseFloat(
                parts[index.top]
            ) / scale;


        const width =
            parseFloat(
                parts[index.width]
            ) / scale;


        const height =
            parseFloat(
                parts[index.height]
            ) / scale;


        if (
            !Number.isFinite(left) ||
            !Number.isFinite(top) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height)
        ) {
            continue;
        }


        words.push({

            text,

            left,
            top,
            width,
            height,

            centerX:
                left +
                width / 2,

            centerY:
                top +
                height / 2,

            confidence
        });
    }


    return words;
}


/*
====================================================
STAR CINEMA GRID PARSER
====================================================
*/

function parseStarCinemaSheet(
    words,
    imageWidth,
    imageHeight
) {

    const detected = [];


    /*
    Column edges for columns B through F.

    These are percentages of the image width.
    */

    const columnBounds = [
        0.164,
        0.325,
        0.482,
        0.648,
        0.814,
        0.979
    ];


    /*
    Approximate top and bottom of the 8 theater blocks.
    */

    const theaterTop =
        imageHeight * 0.066;

    const theaterBottom =
        imageHeight * 0.963;

    const theaterHeight =
        (
            theaterBottom -
            theaterTop
        ) / 8;


    for (
        let theaterNumber = 1;
        theaterNumber <= 8;
        theaterNumber++
    ) {

        const theaterY =
            theaterTop +
            (
                theaterNumber - 1
            ) *
            theaterHeight;


        /*
        Approximate vertical sections inside
        each theater block.
        */

        const movieTop =
            theaterY;

        const movieBottom =
            theaterY +
            theaterHeight * 0.34;


        const timeTop =
            theaterY +
            theaterHeight * 0.28;

        const timeBottom =
            theaterY +
            theaterHeight * 0.51;


        const server1Top =
            theaterY +
            theaterHeight * 0.49;

        const server1Bottom =
            theaterY +
            theaterHeight * 0.67;


        const server2Top =
            theaterY +
            theaterHeight * 0.65;

        const server2Bottom =
            theaterY +
            theaterHeight * 0.83;


        const server3Top =
            theaterY +
            theaterHeight * 0.81;

        const server3Bottom =
            theaterY +
            theaterHeight;


        for (
            let column = 0;
            column < 5;
            column++
        ) {

            const left =
                imageWidth *
                columnBounds[column];


            const right =
                imageWidth *
                columnBounds[column + 1];


            /*
            Get movie title.
            */

            const movieText =
                wordsInRegion(
                    words,
                    left,
                    movieTop,
                    right,
                    movieBottom
                );


            /*
            Get showtime.
            */

            const rawTime =
                wordsInRegion(
                    words,
                    left,
                    timeTop,
                    right,
                    timeBottom
                );


            const parsedTime =
                parseShowtime(
                    rawTime
                );


            /*
            Blank cells should not become showings.
            */

            if (!parsedTime) {
                continue;
            }


            const serverRegions = [

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


            const servers = [];


            serverRegions.forEach(
                (
                    region,
                    serverRow
                ) => {

                    const rawName =
                        wordsInRegion(
                            words,
                            left,
                            region[0],
                            right,
                            region[1]
                        );


                    const name =
                        cleanServerName(
                            rawName
                        );


                    if (!name) {
                        return;
                    }


                    const config =
                        theaterRows[
                            theaterNumber
                        ][
                            serverRow
                        ];


                    servers.push({

                        name,

                        rows:
                            config.normal,

                        over50:
                            config.over50,

                        conditional:
                            Boolean(
                                config.conditional
                            )
                    });
                }
            );


            detected.push({

                theater:
                    theaterNumber,

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

                servers
            });
        }
    }


    return detected;
}


/*
====================================================
WORDS INSIDE REGION
====================================================
*/

function wordsInRegion(
    words,
    left,
    top,
    right,
    bottom
) {

    const found =
        words
            .filter(
                word => {

                    return (
                        word.centerX >= left &&
                        word.centerX <= right &&
                        word.centerY >= top &&
                        word.centerY <= bottom
                    );

                }
            )
            .sort(
                (a, b) => {

                    if (
                        Math.abs(
                            a.centerY -
                            b.centerY
                        ) > 7
                    ) {

                        return (
                            a.centerY -
                            b.centerY
                        );
                    }

                    return (
                        a.left -
                        b.left
                    );
                }
            );


    return found
        .map(
            word => word.text
        )
        .join(" ")
        .trim();
}


/*
====================================================
CLEAN MOVIE TITLE
====================================================
*/

function cleanMovieTitle(text) {

    if (!text) {
        return "Movie";
    }


    let cleaned =
        text
            .replace(
                /[|_[\]{}]/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    /*
    Remove time if OCR included it.
    */

    cleaned =
        cleaned
            .replace(
                /\d{1,2}[:;.]\d{2}.*$/i,
                ""
            )
            .trim();


    return (
        cleaned ||
        "Movie"
    );
}


/*
====================================================
CLEAN SERVER NAME
====================================================
*/

function cleanServerName(text) {

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


    const badValues = [
        "ACE",
        "ACEG",
        "AD",
        "ADG",

        "BD",
        "BDF",
        "BDFH",
        "BE",
        "BEH",

        "C",
        "CF",

        "SEATING",
        "CAPACITY",

        "THEATER",

        "MOVIE"
    ];


    if (
        badValues.includes(
            cleaned.toUpperCase()
        )
    ) {
        return "";
    }


    if (
        cleaned.length < 2 ||
        cleaned.length > 25
    ) {
        return "";
    }


    /*
    Reject strings with too many words,
    since names should generally be short.
    */

    if (
        cleaned.split(" ").length > 3
    ) {
        return "";
    }


    return cleaned
        .split(" ")
        .map(
            word => {

                return (
                    word.charAt(0)
                        .toUpperCase() +
                    word
                        .slice(1)
                        .toLowerCase()
                );

            }
        )
        .join(" ");
}


/*
====================================================
PARSE SHOWTIME
====================================================
*/

function parseShowtime(text) {

    if (!text) {
        return null;
    }


    let cleaned =
        text
            .toLowerCase()
            .replace(
                /\s/g,
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
    OCR may recognize:
    11:00a-1:00
    1:50-3:33pm
    10:35-12:35a
    */

    const match =
        cleaned.match(
            /(\d{1,2}):(\d{2})([ap]m?)?-(\d{1,2}):(\d{2})([ap]m?)?/
        );


    if (!match) {
        return null;
    }


    const startHour =
        Number(match[1]);

    const startMinute =
        Number(match[2]);

    const startMarker =
        match[3] || "";


    const endHour =
        Number(match[4]);

    const endMinute =
        Number(match[5]);

    const endMarker =
        match[6] || "";


    if (
        startHour > 12 ||
        endHour > 12 ||
        startMinute > 59 ||
        endMinute > 59
    ) {
        return null;
    }


    let startPeriod =
        markerToPeriod(
            startMarker
        );


    let endPeriod =
        markerToPeriod(
            endMarker
        );


    /*
    Infer periods when the spreadsheet omits AM/PM.
    */

    if (!startPeriod) {

        if (
            startHour === 10 ||
            startHour === 11
        ) {

            startPeriod = "AM";

        } else {

            startPeriod = "PM";
        }
    }


    if (!endPeriod) {

        /*
        Evening movies ending at 12/1/2
        are assumed to end after midnight.
        */

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

            endPeriod = "AM";

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
====================================================
TIME HELPERS
====================================================
*/

function markerToPeriod(marker) {

    if (!marker) {
        return "";
    }


    const lower =
        marker.toLowerCase();


    if (
        lower.startsWith("a")
    ) {
        return "AM";
    }


    if (
        lower.startsWith("p")
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

    let adjustedHour =
        hour;


    if (
        period === "PM" &&
        adjustedHour !== 12
    ) {

        adjustedHour += 12;
    }


    if (
        period === "AM" &&
        adjustedHour === 12
    ) {

        adjustedHour = 0;
    }


    return (
        adjustedHour * 60 +
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
        String(minute)
            .padStart(2, "0") +
        " " +
        period
    );
}


/*
====================================================
DEBUG OUTPUT
====================================================
*/

function showDetectedLineup() {

    let output =
        "DETECTED LINEUP\n" +
        "==============================\n\n";


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
                    item.theater === theater
            );


        if (
            showings.length === 0
        ) {

            output +=
                "  No showings detected\n\n";

            output +=
                "------------------------------\n\n";

            continue;
        }


        showings.forEach(
            showing => {

                output +=
                    "\n" +
                    `  ${showing.start} - ${showing.end}\n`;

                output +=
                    `  ${showing.movie}\n`;


                if (
                    showing.servers.length === 0
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
                                `  -> (${server.name}) : ${server.rows} IF OVER 50\n`;

                        } else {

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


                            output += "\n";
                        }

                    }
                );

            }
        );


        output +=
            "\n------------------------------\n\n";
    }


    detectedText.textContent =
        output;
}


/*
====================================================
POPULATE SERVER DROPDOWN
====================================================
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


    [...names]
        .sort(
            (a, b) =>
                a.localeCompare(b)
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
====================================================
SHOW PERSONAL SCHEDULE BUTTON
====================================================
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
====================================================
BUILD PERSONAL SCHEDULE
====================================================
*/

function buildSchedule(name) {

    const assignments = [];


    lineupData.forEach(
        showing => {

            showing.servers.forEach(
                server => {

                    if (
                        server.name === name
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
        assignments.length === 0
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
                    item.server.conditional
                        ? " conditional"
                        : ""
                );


            let rowDisplay =
                "";


            /*
            Conditional third server
            */

            if (
                item.server.conditional
            ) {

                rowDisplay = `

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
            Normal first or second server
            */

            else {

                rowDisplay = `

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

                    rowDisplay += `

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

                <div class="assignment-movie">
                    ${escapeHTML(
                        item.movie
                    )}
                </div>

                ${rowDisplay}

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
        behavior: "smooth"
    });
}


/*
====================================================
HTML ESCAPING
====================================================
*/

function escapeHTML(value) {

    return String(value)
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
