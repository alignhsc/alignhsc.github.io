const generateButton = document.getElementById("generateButton");
const regenerateButton = document.getElementById("regenerateButton");
const printButton = document.getElementById("printButton");

const paperSection = document.getElementById("paperSection");
const questionsContainer = document.getElementById("questionsContainer");
const solutionsContainer = document.getElementById("solutionsContainer");
const paperInfo = document.getElementById("paperInfo");

const resultsSection = document.getElementById("resultsSection");
const resultsContainer = document.getElementById("resultsContainer");
const saveResultsButton = document.getElementById("saveResultsButton");

const progressContainer = document.getElementById("progressContainer");
const overallCoverage = document.getElementById("overallCoverage");

let currentPaperQuestions = [];


function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}


function generatePaper() {
    const selectedTopic = document.getElementById("topic").value;

    const questionCount =
        Number(document.getElementById("questionCount").value);

    const selectedDifficulties =
        [...document.querySelectorAll(".difficulty:checked")]
            .map(box => box.value);


    const filteredQuestions = questions.filter(question => {
        const topicMatches =
            selectedTopic === "all" ||
            question.topic === selectedTopic;

        const difficultyMatches =
            selectedDifficulties.includes(question.difficulty);

        return topicMatches && difficultyMatches;
    });


    if (filteredQuestions.length === 0) {
        alert("No questions match those filters.");
        return;
    }


    const shuffledQuestions = shuffle(filteredQuestions);

    const selectedQuestions =
        shuffledQuestions.slice(0, questionCount);

    currentPaperQuestions = selectedQuestions;

    displayPaper(selectedQuestions);
    createResultsForm(selectedQuestions);

    resultsSection.classList.remove("hidden");
}


function displayPaper(selectedQuestions) {
    questionsContainer.innerHTML = "";
    solutionsContainer.innerHTML = "";

    let totalMarks = 0;

    selectedQuestions.forEach((question, index) => {
        totalMarks += question.marks;

        const questionDiv = document.createElement("div");

        questionDiv.className = "question";

        questionDiv.innerHTML = `
            <div class="question-header">
                <h3>Question ${index + 1}</h3>

                <span>
                    ${question.marks}
                    ${question.marks === 1 ? "mark" : "marks"}
                </span>
            </div>

            <img
                src="${question.questionImage}"
                alt="Question ${question.questionNumber}"
                class="question-image"
            >

            <div class="working-space"></div>
        `;

        questionsContainer.appendChild(questionDiv);


        const solutionDiv = document.createElement("div");

        solutionDiv.className = "solution";

        solutionDiv.innerHTML = `
            <h3>Question ${index + 1}</h3>
            <img
                src="${question.solutionImage}"
                alt="Solution for Question ${question.questionNumber}"
                class="solution-image"
            >
        `;

        solutionsContainer.appendChild(solutionDiv);
    });


    paperInfo.textContent =
        `${selectedQuestions.length} questions • ${totalMarks} marks`;

    paperSection.classList.remove("hidden");
}

function createResultsForm(selectedQuestions) {

    resultsContainer.innerHTML = "";

    selectedQuestions.forEach((question, index) => {
        const resultRow = document.createElement("div");
        resultRow.className = "result-row";

        resultRow.innerHTML = `
            <label>
                Question ${index + 1}:
            </label>

            <input
                type="number"
                class="result-input"
                data-question-id="${question.id}"
                min="0"
                max="${question.marks}"
            >

            <span>
                / ${question.marks}
            </span>
        `;

        resultsContainer.appendChild(resultRow);
    });
}

function saveResults() {

    const inputs = document.querySelectorAll(".result-input");

    const savedAttempts =
        JSON.parse(localStorage.getItem("hscAlignAttempts")) || [];

    inputs.forEach(input => {

        if (input.value === "") {
            return;
        }
        const questionId = input.dataset.questionId;
        const marksEarned = Number(input.value);

        if (marksEarned < 0 || marksEarned > question.marks) {
            alert(
                `Invalid mark for Question ${question.questionNumber}.`
            );
            return;
        }

        const question =
            currentPaperQuestions.find(q => q.id === questionId);

        if (!question) {
            return;
        }

        const attempt = {
            questionId: question.id,
            marksEarned: marksEarned,
            marksAvailable: question.marks,
            topic: question.topic,
            subtopic: question.subtopic,
            syllabusDotpoints: question.syllabusDotpoints,
            difficulty: question.difficulty,
            date: new Date().toISOString()
        };

        savedAttempts.push(attempt);
    });

    localStorage.setItem(
        "hscAlignAttempts",
        JSON.stringify(savedAttempts)
    );

    displaySyllabusProgress();

    alert("Results saved!");
}

function calculateDotpointProgress() {
    const attempts =
        JSON.parse(localStorage.getItem("hscAlignAttempts")) || [];

    // Keep only the latest attempt for each question
    const latestAttempts = {};

    attempts.forEach(attempt => {
        latestAttempts[attempt.questionId] = attempt;
    });

    const dotpointStats = {};

    Object.values(latestAttempts).forEach(attempt => {
        const question =
            questions.find(q => q.id === attempt.questionId);

        if (!question || !question.syllabusDotpoints) {
            return;
        }

        question.syllabusDotpoints.forEach(dotpoint => {

            if (!dotpointStats[dotpoint]) {
                dotpointStats[dotpoint] = {
                    questionIds: new Set(),
                    marksEarned: 0,
                    marksAvailable: 0,

                    mediumQuestions: new Set(),
                    hardQuestions: new Set()
                };
            }

            const stats = dotpointStats[dotpoint];

            stats.questionIds.add(question.id);

            stats.marksEarned += attempt.marksEarned;
            stats.marksAvailable += attempt.marksAvailable;

            if (question.difficulty === "Medium") {
                stats.mediumQuestions.add(question.id);
            }

            if (question.difficulty === "Hard") {
                stats.hardQuestions.add(question.id);
            }
        });
    });


    const progress = {};

    // Start by marking every syllabus dotpoint as Not started
    for (const topicName in SYLLABUS) {
        const focusAreas = SYLLABUS[topicName].focusAreas;

        for (const focusAreaName in focusAreas) {
            focusAreas[focusAreaName].forEach(dotpoint => {
                progress[dotpoint] = "Not started";
            });
        }
    }


    // Update the ones the student has attempted
    for (const dotpoint in dotpointStats) {

        const stats = dotpointStats[dotpoint];

        const uniqueQuestions =
            stats.questionIds.size;

        const percentage =
            stats.marksAvailable === 0
                ? 0
                : stats.marksEarned / stats.marksAvailable;

        const mediumQuestions =
            stats.mediumQuestions.size;

        const hardQuestions =
            stats.hardQuestions.size;


        if (
            uniqueQuestions >= 8 &&
            percentage >= 0.9 &&
            mediumQuestions >= 4 &&
            hardQuestions >= 3
        ) {
            progress[dotpoint] = "Mastered";
        }

        else if (
            uniqueQuestions >= 5 &&
            percentage >= 0.8 &&
            mediumQuestions >= 3 &&
            hardQuestions >= 1
        ) {
            progress[dotpoint] = "Proficient";
        }

        else {
            progress[dotpoint] = "Developing";
        }
    }

    return progress;
}

function displaySyllabusProgress() {
    const skillProgress = calculateSkillProgress();

    progressContainer.innerHTML = "";

    for (const topicName in SYLLABUS) {

        const topicDiv = document.createElement("div");
        topicDiv.className = "progress-topic";

        const topicHeading = document.createElement("h3");
        topicHeading.textContent = topicName;

        topicDiv.appendChild(topicHeading);


        const focusAreas = SYLLABUS[topicName].focusAreas;

        for (const focusAreaName in focusAreas) {

            const focusHeading = document.createElement("h4");
            focusHeading.textContent = focusAreaName;

            topicDiv.appendChild(focusHeading);


            focusAreas[focusAreaName].forEach(skill => {

                const skillRow = document.createElement("div");

                skillRow.className = "skill-row";

                const readableSkill =
                    skill
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, letter =>
                            letter.toUpperCase()
                        );

                skillRow.innerHTML = `
                    <span>${readableSkill}</span>
                    <span>${skillProgress[skill]}</span>
                `;

                topicDiv.appendChild(skillRow);
            });
        }

        progressContainer.appendChild(topicDiv);
    }
}

function calculateCoverage() {
    const skillProgress = calculateSkillProgress();

    const topicCoverage = {};

    let totalSkills = 0;
    let coveredSkills = 0;

    for (const topicName in SYLLABUS) {
        let topicTotal = 0;
        let topicCovered = 0;

        const focusAreas = SYLLABUS[topicName].focusAreas;

        for (const focusAreaName in focusAreas) {
            const skills = focusAreas[focusAreaName];

            skills.forEach(skill => {
                topicTotal += 1;
                totalSkills += 1;

                if (skillProgress[skill] !== "Not practised") {
                    topicCovered += 1;
                    coveredSkills += 1;
                }
            });
        }

        topicCoverage[topicName] = {
            covered: topicCovered,
            total: topicTotal,
            percentage:
                topicTotal === 0
                    ? 0
                    : Math.round((topicCovered / topicTotal) * 100)
        };
    }

    const overallPercentage =
        totalSkills === 0
            ? 0
            : Math.round((coveredSkills / totalSkills) * 100);

    return {
        topicCoverage,
        overallPercentage
    };
}

function displaySyllabusProgress() {
    const skillProgress = calculateSkillProgress();
    const coverage = calculateCoverage();

    progressContainer.innerHTML = "";

    overallCoverage.textContent =
        `Whole syllabus coverage: ${coverage.overallPercentage}%`;

    for (const topicName in SYLLABUS) {

        const topicDiv = document.createElement("div");
        topicDiv.className = "progress-topic";

        const topicData =
            coverage.topicCoverage[topicName];

        const topicHeading =
            document.createElement("h3");

        topicHeading.textContent =
            `${topicName} — ${topicData.percentage}%`;

        topicDiv.appendChild(topicHeading);


        const focusAreas =
            SYLLABUS[topicName].focusAreas;

        for (const focusAreaName in focusAreas) {

            const focusHeading =
                document.createElement("h4");

            focusHeading.textContent =
                focusAreaName;

            topicDiv.appendChild(focusHeading);


            focusAreas[focusAreaName].forEach(skill => {

                const skillRow =
                    document.createElement("div");

                skillRow.className = "skill-row";

                const readableSkill =
                    skill
                        .replaceAll("_", " ")
                        .replace(
                            /\b\w/g,
                            letter => letter.toUpperCase()
                        );

                skillRow.innerHTML = `
                    <span>${readableSkill}</span>
                    <span>${skillProgress[skill]}</span>
                `;

                topicDiv.appendChild(skillRow);
            });
        }

        progressContainer.appendChild(topicDiv);
    }
}

generateButton.addEventListener("click", generatePaper);

regenerateButton.addEventListener("click", generatePaper);

printButton.addEventListener("click", () => window.print());

saveResultsButton.addEventListener("click", saveResults);


// Show existing progress when the page first loads
displaySyllabusProgress();