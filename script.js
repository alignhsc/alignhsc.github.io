const generateButton = document.getElementById("generateButton");
const regenerateButton = document.getElementById("regenerateButton");
const printButton = document.getElementById("printButton");

const paperSection = document.getElementById("paperSection");
const questionsContainer = document.getElementById("questionsContainer");
const solutionsContainer = document.getElementById("solutionsContainer");
const paperInfo = document.getElementById("paperInfo");


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

    displayPaper(selectedQuestions);
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


generateButton.addEventListener("click", generatePaper);

regenerateButton.addEventListener("click", generatePaper);

printButton.addEventListener("click", () => window.print());