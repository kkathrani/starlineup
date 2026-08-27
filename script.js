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
STAR CINEMA THEATER ROW CONFIGURATION
====================================================

These correspond to the labels printed on the
left side of the Star Cinema lineup.

normal = assignment below 50 guests
over50 = assignment when the theater exceeds 50

The third server is conditional and only joins
when occupancy exceeds 50.
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

    if (!uploadedFile) return;

    imagePreview.src = URL.createObjectURL(uploadedFile);

    previewContainer.classList.remove("hidden");
    readButton.classList.remove("hidden");

    // Reset old results
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

    detectedText.textContent =
        "Preparing image...\n";

    debugSection.classList.remove("hidden");

    try {

        /*
        --------------------------------------------
        Load image
        --------------------------------------------
        */

        const image = await loadImage(uploadedFile);

        /*
        --------------------------------------------
        Preprocess image

        We enlarge it 2X and convert it to very
        high contrast black/white.

        This makes spreadsheet text dramatically
        easier for OCR to recognize.
        --------------------------------------------
        */

        const processed = preprocessImage(image);

        detectedText.textContent +=
            `Image prepared: ${image.width} × ${image.height}\n`;

        detectedText.textContent +=
            "Starting OCR...\n\n";


        /*
        --------------------------------------------
        Create one OCR worker.

        This is faster than starting Tesseract
        over and over for every spreadsheet cell.
        --------------------------------------------
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

                        const percent =
                            Math.round(
                                message.progress * 100
                            );

                        progressBar.style.width =
                            percent + "%";

                    }
                }
            }
        );


        /*
        Request TSV output.

        TSV gives us the X/Y position of every
        recognized word.

        THAT is the important change from our
        previous version.
        */

        const result = await worker.recognize(
            processed.canvas,
            {},
            {
                text: true,
                tsv: true
            }
        );

        await worker.terminate();


        /*
        --------------------------------------------
        Extract positioned words
        --------------------------------------------
        */

        const words =
            parseTSV(
                result.data.tsv,
                processed.scale
            );


        detectedText.textContent =
            `OCR found ${words.length} positioned words.\n\n`;


        /*
        --------------------------------------------
        Convert the positioned OCR into theaters
        --------------------------------------------
        */

        lineupData =
            parseStarCinemaSheet(
                words,
                image.width,
                image.height
            );


        /*
        --------------------------------------------
        Show our interpretation for debugging
        --------------------------------------------
        */

        showDetectedLineup();


        /*
        --------------------------------------------
        Generate server dropdown
        --------------------------------------------
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
            "\nERROR:\n" +
            error.message;

        alert(
            "There was a problem reading the lineup. " +
            "Scroll down to Detected Text for details."
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

    return new Promise((resolve, reject) => {

        const img = new Image();

        const url =
            URL.createObjectURL(file);

        img.onload = () => {

            URL.revokeObjectURL(url);
            resolve(img);

        };

        img.onerror = reject;

        img.src = url;

    });
}


/*
====================================================
IMAGE PREPROCESSING
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
    Convert to grayscale + threshold.

    Spreadsheet background becomes white.
    Text and borders stay black.
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
            0.299 * r +
            0.587 * g +
            0.114 * b;


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
PARSE TESSERACT TSV
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
        lines[0]
            .split("\t");


    const index = {};

    headers.forEach(
        (header, i) => {
            index[header] = i;
        }
    );


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
                parts[index.text] || ""
            ).trim();


        if (!text) continue;


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
            !Number.isFinite(top)
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
    These coordinates are proportions of the image.

    Because the spreadsheet keeps the same layout,
    this works whether the screenshot is 900px,
    1800px, etc.
    */


    /*
    The showtime area starts after the left theater
    labels.

    Approximate spreadsheet columns:

    A = theater information
    B-F = five possible showings
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
    Theater 1 starts around 6.6% down the image.

    Theater 8 ends around 96.3%.
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
        Inside each theater:

        Movie title
        Showtime
        Server 1
        Server 2
        Server 3
        */

        const movieTop =
            theaterY;

        const movieBottom =
            theaterY +
            theaterHeight * 0.34;


        const timeTop =
            theaterY +
            theaterHeight * 0.31;

        const timeBottom =
            theaterY +
            theaterHeight * 0.51;


        const server1Top =
            theaterY +
            theaterHeight * 0.50;

        const server1Bottom =
            theaterY +
            theaterHeight * 0.68;


        const server2Top =
            theaterY +
            theaterHeight * 0.66;

        const server2Bottom =
            theaterY +
            theaterHeight * 0.84;


        const server3Top =
            theaterY +
            theaterHeight * 0.82;

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
            Read movie
            */

            const movie =
                wordsInRegion(
                    words,
                    left,
                    movieTop,
                    right,
                    movieBottom
                );


            /*
            Read time
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
                parseShowtime(rawTime);


            /*
            If there isn't a recognizable showtime,
            this spreadsheet cell is probably blank.
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

                    let name =
                        wordsInRegion(
                            words,
                            left,
                            region[0],
                            right,
                            region[1]
                        );


                    name =
                        cleanServerName(
                            name
                        );


                    if (!name) return;


                    const rowConfig =
                        theaterRows[
                            theaterNumber
                        ][
                            serverRow
                        ];


                    servers.push({

                        name,

                        rows:
                            rowConfig.normal,

                        over50:
                            rowConfig.over50,

                        conditional:
                            Boolean(
                                rowConfig
                                    .conditional
                            )

                    });

                }
            );


            detected.push({

                theater:
                    theaterNumber,

                movie:
                    cleanMovieTitle(
                        movie
                    ),

                start:
                    parsedTime.start,

                end:
                    parsedTime.end,

                startMinutes:
                    parsedTime
                        .startMinutes,

                servers

            });

        }

    }


    return detected;

}


/*
====================================================
GET WORDS INSIDE A REGION
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
            .filter(word => {

                return (
                    word.centerX >= left &&
                    word.centerX <= right &&
                    word.centerY >= top &&
                    word.centerY <= bottom
                );

            })
            .sort((a, b) => {

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

            });


    return found
        .map(word => word.text)
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
    If OCR accidentally captured part of the time,
    remove it.
    */

    cleaned =
        cleaned.replace(
            /\d{1,2}[:.]\d{2}.*$/i,
            ""
        ).trim();


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

    if (!text) return "";


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


    /*
    Ignore common spreadsheet/OCR garbage.
    */

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
        "CAPACITY"
    ];


    if (
        badValues.includes(
            cleaned.toUpperCase()
        )
    ) {

        return "";

    }


    /*
    Don't accept extremely long garbage strings.
    */

    if (
        cleaned.length < 2 ||
        cleaned.length > 20
    ) {

        return "";

    }


    /*
    Capitalize names nicely.
    */

    return cleaned
        .split(" ")
        .map(word => {

            return (
                word.charAt(0)
                    .toUpperCase() +
                word
                    .slice(1)
                    .toLowerCase()
            );

        })
        .join(" ");

}


/*
====================================================
PARSE SHOWTIME
====================================================
*/

function parseShowtime(text) {

    if (!text) return null;


    let cleaned =
        text
            .toLowerCase()
            .replace(/\s/g, "")
            .replace(/[–—]/g, "-")
            .replace(/\./g, ":");


    /*
    OCR sometimes reads:
    10;35 instead of 10:35
    */

    cleaned =
        cleaned.replace(
            /;/g,
            ":"
        );


    /*
    Expected examples:

    11:00a-1:00
    1:50-3:33pm
    10:35-12:35a
    7:30-9:20
    */


    const match =
        cleaned.match(
            /(\d{1,2})[:](\d{2})([ap]m?|)?-(\d{1,2})[:](\d{2})([ap]m?|)?/
        );


    if (!match) {
        return null;
    }


    let startHour =
        Number(match[1]);

    const startMinute =
        Number(match[2]);

    const startMarker =
        match[3] || "";


    let endHour =
        Number(match[4]);

    const endMinute =
        Number(match[5]);

    const endMarker =
        match[6] || "";


    /*
    Determine AM/PM.

    Star Cinema schedules generally begin in the
    late morning/afternoon and continue after
    midnight.

    We use the explicit marker when OCR sees it,
    otherwise infer the most logical period.
    */

    let startPeriod =
        markerToPeriod(
            startMarker
        );

    let endPeriod =
        markerToPeriod(
            endMarker
        );


    if (!startPeriod) {

        if (
            startHour >= 10 &&
            startHour <= 11
        ) {

            startPeriod = "AM";

        } else {

            startPeriod = "PM";

        }

    }


    if (!endPeriod) {

        /*
        If ending hour is 12, 1 or 2 and this is a
        late evening showing, it may end after
        midnight.
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


    /*
    If end occurs after midnight,
    move it into the next day.
    */

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

    if (!marker) return "";

    marker =
        marker.toLowerCase();

    if (
        marker.startsWith("a")
    ) {

        return "AM";

    }

    if (
        marker.startsWith("p")
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

    let h = hour;

    if (
        period === "PM" &&
        h !== 12
    ) {

        h += 12;

    }

    if (
        period === "AM" &&
        h === 12
    ) {

        h = 0;

    }

    return (
        h * 60 +
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
                        "  ⚠ No servers detected\n";

                }


                showing.servers.forEach(
                    server => {

                        if (
                            server.conditional
                        ) {

                            output +=
                                `  → (${server.name}) : ${server.rows} IF OVER 50\n`;

                        } else {

                            output +=
                                `  → ${server.name} : ${server.rows}`;

                            if (
                                server.over50 &&
                                server.over50 !==
                                server.rows
                            ) {

                                output +=
                                    ` → ${server.over50} over 50`;

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
SERVER DROPDOWN
====================================================
*/

function populateServers() {

    const names =
        new Set();


    lineupData.forEach(
        showing => {

            showing.servers.forEach(
                server => {

                    if (server.name) {
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
SHOW PERSONAL SCHEDULE
====================================================
*/

document
    .getElementById("showSchedule")
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

            buildSchedule(name);

        }
    );


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


    scheduleList.innerHTML = "";


    scheduleName.textContent =
        name + "'s Lineup";


    scheduleDate.textContent =
        "Today's schedule";


    if (
        assignments.length === 0
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


            let rowDisplay = "";


            if (
                item.server
                    .conditional
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

            } else {

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


    scheduleSection
        .classList
        .remove("hidden");


    scheduleSection.scrollIntoView({
        behavior: "smooth"
    });

}


/*
====================================================
HTML SAFETY
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
