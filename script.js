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



/*
----------------------------------------
IMAGE UPLOAD
----------------------------------------
*/

imageInput.addEventListener("change", () => {

    const file = imageInput.files[0];

    if (!file) return;

    imagePreview.src = URL.createObjectURL(file);

    previewContainer.classList.remove("hidden");
    readButton.classList.remove("hidden");

});



/*
----------------------------------------
READ IMAGE
----------------------------------------
*/

readButton.addEventListener("click", async () => {

    const file = imageInput.files[0];

    if (!file) return;


    loading.classList.remove("hidden");
    readButton.disabled = true;


    try {

        const result = await Tesseract.recognize(
            file,
            "eng",
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


        const text = result.data.text;


        detectedText.textContent = text;
        debugSection.classList.remove("hidden");


        /*
        TEMPORARY:

        Instead of parsing OCR yet,
        load our sample lineup.

        Once everything else works,
        this will be replaced by
        parseLineup(text).
        */

        loadSampleLineup();


        populateServers();


        serverSection.classList.remove("hidden");


    }

    catch (error) {

        console.error(error);

        alert(
            "There was a problem reading the image."
        );

    }


    loading.classList.add("hidden");

    readButton.disabled = false;

});



/*
----------------------------------------
SAMPLE LINEUP
----------------------------------------
*/

function loadSampleLineup() {

    lineupData = [

        {
            theater: 4,
            movie: "Paw Patrol",
            start: "2:50 PM",
            end: "4:33 PM",

            servers: [

                {
                    name: "Kishan",
                    rows: "BDF",
                    over50: "BE"
                }

            ]
        },


        {
            theater: 6,
            movie: "SpiderMan",
            start: "2:30 PM",
            end: "5:05 PM",

            servers: [

                {
                    name: "Kishan",
                    rows: "BDFH",
                    over50: "BEH"
                }

            ]
        },


        {
            theater: 8,
            movie: "Oak Street",
            start: "3:45 PM",
            end: "5:39 PM",

            servers: [

                {
                    name: "Kishan",
                    rows: "BD",
                    over50: "BE"
                }

            ]
        },


        {
            theater: 3,
            movie: "Oak Street",
            start: "5:00 PM",
            end: "7:01 PM",

            servers: [

                {
                    name: "Kishan",
                    rows: "ACEG",
                    over50: "ADG"
                },

                {
                    name: "Brian",
                    rows: "BDFH",
                    over50: "BEH"
                }

            ]

        },



        {
            theater: 3,
            movie: "Insidious",
            start: "7:55 PM",
            end: "9:56 PM",

            servers: [

                {
                    name: "Brenna",
                    rows: "ACEG",
                    over50: "ADG"
                },

                {
                    name: "Chris",
                    rows: "BDFH",
                    over50: "BEH"
                },

                {
                    name: "Blake",
                    rows: "CF",
                    conditional: true
                }

            ]

        }

    ];

}



/*
----------------------------------------
BUILD SERVER LIST
----------------------------------------
*/

function populateServers() {

    const names = new Set();


    lineupData.forEach(showing => {

        showing.servers.forEach(server => {

            names.add(server.name);

        });

    });


    serverSelect.innerHTML =
        '<option value="">Select your name</option>';


    [...names]
        .sort()
        .forEach(name => {

            const option =
                document.createElement("option");

            option.value = name;
            option.textContent = name;

            serverSelect.appendChild(option);

        });

}



/*
----------------------------------------
SHOW PERSONAL SCHEDULE
----------------------------------------
*/

document
    .getElementById("showSchedule")
    .addEventListener("click", () => {

        const name = serverSelect.value;

        if (!name) {

            alert("Select your name first.");

            return;

        }


        buildSchedule(name);

    });



function buildSchedule(name) {


    let assignments = [];


    lineupData.forEach(showing => {


        const server =
            showing.servers.find(
                person =>
                    person.name === name
            );


        if (server) {

            assignments.push({

                ...showing,

                server: server

            });

        }

    });



    assignments.sort(
        (a, b) =>
            convertTime(a.start) -
            convertTime(b.start)
    );


    scheduleList.innerHTML = "";


    scheduleName.textContent =
        name + "'s Lineup";


    scheduleDate.textContent =
        "Saturday, August 22, 2026";


    assignments.forEach(item => {


        const card =
            document.createElement("div");


        card.className =
            "assignment" +
            (
                item.server.conditional
                ? " conditional"
                : ""
            );


        let extra = "";


        if (item.server.conditional) {

            extra = `
                <div class="conditional-label">
                    Only if occupancy exceeds 50
                </div>
            `;

        }


        else if (item.server.over50) {

            extra = `
                <div class="over50">
                    Over 50 guests:
                    <strong>
                        ${item.server.over50}
                    </strong>
                </div>
            `;

        }


        card.innerHTML = `

            <div class="assignment-time">
                ${item.start} – ${item.end}
            </div>

            <div class="assignment-title">
                Theater ${item.theater}
            </div>

            <div class="assignment-movie">
                ${item.movie}
            </div>

            <div class="rows">
                ${item.server.rows}
            </div>

            ${extra}

        `;


        scheduleList.appendChild(card);

    });



    if (assignments.length === 0) {

        scheduleList.innerHTML =
            "<p>No assignments found.</p>";

    }


    scheduleSection.classList.remove(
        "hidden"
    );


    scheduleSection.scrollIntoView({
        behavior: "smooth"
    });

}



/*
----------------------------------------
TIME SORTING
----------------------------------------
*/

function convertTime(timeString) {

    const cleaned =
        timeString.trim().toUpperCase();


    const parts =
        cleaned.match(
            /(\d{1,2}):(\d{2})\s*(AM|PM)/
        );


    if (!parts) return 0;


    let hour =
        parseInt(parts[1]);


    const minute =
        parseInt(parts[2]);


    const period =
        parts[3];


    if (
        period === "PM" &&
        hour !== 12
    ) {

        hour += 12;

    }


    if (
        period === "AM" &&
        hour === 12
    ) {

        hour = 0;

    }


    return hour * 60 + minute;

}
