
const generateButton = document.getElementById("generateButton");
const regenerateButton = document.getElementById("regenerateButton");
const printButton = document.getElementById("printButton");
const paperSection = document.getElementById("paperSection");
const questionsContainer = document.getElementById("questionsContainer");
const solutionsContainer = document.getElementById("solutionsContainer");
const paperInfo = document.getElementById("paperInfo");

const topicTree = document.getElementById("topicTree");
const questionCountInput = document.getElementById("questionCount");
const targetMarksInput = document.getElementById("targetMarks");

const advancedFiltersButton = document.getElementById("advancedFiltersButton");
const advancedFiltersPanel = document.getElementById("advancedFiltersPanel");
const closeAdvancedFilters = document.getElementById("closeAdvancedFilters");
const resetAdvancedFilters = document.getElementById("resetAdvancedFilters");

const schoolSearch = document.getElementById("schoolSearch");
const schoolDropdown = document.getElementById("schoolDropdown");
const selectedSchoolsContainer = document.getElementById("selectedSchools");
const schoolError = document.getElementById("schoolError");

const yearFromInput = document.getElementById("yearFrom");
const yearToInput = document.getElementById("yearTo");
const yearError = document.getElementById("yearError");
const yearHelp = document.getElementById("yearHelp");
const syllabusVersionInput = document.getElementById("syllabusVersion");

const earliestYear = 1998;
const currentYear = new Date().getFullYear();
const selectedSchools = new Set();

const matchingCount = document.getElementById("matchingCount");


// Question shuffling
// Returns a shuffled copy without changing the original list
function shuffle(items) {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}


// Dotpoint labels
// Changes internal IDs into readable names
function readableDotpoint(id) {
    return id.replace(/^(functions|trig|seq|calc|exp|log|stats|finance)_/, "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}


// Topic tree
// Creates all topics, focus areas and dotpoints using HTML templates
function createTopicTree() {
    topicTree.innerHTML = Object.entries(SYLLABUS).map(([topicName, topic]) => `
        <div class="topic-block">
            <div class="topic-row">
                <button type="button" class="expand-topic" aria-expanded="false" aria-label="Expand ${topicName}">+</button>
                <label>
                    <input type="checkbox" class="topic-checkbox">
                    ${topicName}
                </label>
            </div>

            <div class="topic-contents hidden">
                ${Object.entries(topic.focusAreas).map(([focusArea, dotpoints]) => `
                    <div class="focus-area-block">
                        <label class="focus-area-row">
                            <input type="checkbox" class="focus-area-checkbox">
                            ${focusArea}
                        </label>

                        <div class="dotpoint-container">
                            ${dotpoints.map(id => `
                                <label class="dotpoint-row">
                                    <input type="checkbox" class="dotpoint-checkbox" value="${id}">
                                    ${readableDotpoint(id)}
                                </label>
                            `).join("")}
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `).join("");
}


// Checkbox states
// Updates whole-topic and focus-area boxes when their dotpoints change
function updateParentCheckboxes(topicBlock) {
    topicBlock.querySelectorAll(".focus-area-block").forEach(block => {
        const parent = block.querySelector(".focus-area-checkbox");
        const children = [...block.querySelectorAll(".dotpoint-checkbox")];
        const checked = children.filter(box => box.checked).length;

        parent.checked = children.length > 0 && checked === children.length;
        parent.indeterminate = checked > 0 && checked < children.length;
    });

    const parent = topicBlock.querySelector(".topic-checkbox");
    const children = [...topicBlock.querySelectorAll(".dotpoint-checkbox")];
    const checked = children.filter(box => box.checked).length;

    parent.checked = children.length > 0 && checked === children.length;
    parent.indeterminate = checked > 0 && checked < children.length;
}


// Topic selection
// Allows whole topics, focus areas or individual dotpoints to be selected
function handleTopicChange(event) {
    const box = event.target;

    if (!box.matches("input[type='checkbox']")) return;

    const topicBlock = box.closest(".topic-block");

    if (box.classList.contains("topic-checkbox")) {
        topicBlock.querySelectorAll(".focus-area-checkbox, .dotpoint-checkbox")
            .forEach(child => {
                child.checked = box.checked;
            });
    } else if (box.classList.contains("focus-area-checkbox")) {
        box.closest(".focus-area-block").querySelectorAll(".dotpoint-checkbox")
            .forEach(child => {
                child.checked = box.checked;
            });
    }

    updateParentCheckboxes(topicBlock);
}


// Selected content
// Returns the chosen dotpoint IDs; no selection means all topics
function getSelectedDotpoints() {
    return [...topicTree.querySelectorAll(".dotpoint-checkbox:checked")]
        .map(box => box.value);
}


// School dropdown
// Lists all unselected schools and narrows them as the user types
function showSchoolOptions() {
    const search = schoolSearch.value.trim().toLowerCase();

    const matches = SCHOOLS.filter(school =>
        !selectedSchools.has(school) && school.toLowerCase().includes(search)
    );

    schoolDropdown.replaceChildren();

    if (matches.length === 0) {
        const message = document.createElement("div");
        message.className = "school-no-results";
        message.textContent = "No matching school found.";

        schoolDropdown.append(message);
    }

    matches.forEach(school => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "school-option";
        option.textContent = school;

        option.addEventListener("click", () => addSchool(school));
        schoolDropdown.append(option);
    });

    schoolDropdown.classList.remove("hidden");
}


// Selected schools
// Adds a school and clears the search input
function addSchool(school) {
    if (selectedSchools.has(school)) return;

    selectedSchools.add(school);
    schoolSearch.value = "";
    schoolError.classList.add("hidden");
    schoolDropdown.classList.add("hidden");

    renderSelectedSchools();
}


// Selected schools
// Displays removable tags for the chosen schools
function renderSelectedSchools() {
    selectedSchoolsContainer.replaceChildren();

    selectedSchools.forEach(school => {
        const tag = document.createElement("span");
        tag.className = "school-tag";
        tag.append(document.createTextNode(school));

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "\u00D7";
        removeButton.setAttribute("aria-label", `Remove ${school}`);

        removeButton.addEventListener("click", () => {
            selectedSchools.delete(school);
            renderSelectedSchools();
        });

        tag.append(removeButton);
        selectedSchoolsContainer.append(tag);
    });
    updateMatchingCount();
}


// School validation
// Rejects unmatched typed names before generating a paper
function validateSchoolSearch() {
    const typed = schoolSearch.value.trim();
    schoolError.classList.add("hidden");

    if (!typed) return true;

    const match = SCHOOLS.find(school =>
        school.toLowerCase() === typed.toLowerCase()
    );

    if (!match) {
        schoolError.textContent = "That school isn't in the list. Please choose an available school.";
        schoolError.classList.remove("hidden");
        return false;
    }

    addSchool(match);
    return true;
}


// Year validation
// Allows whole years from 1998 through the current year
function validateYears() {
    yearError.classList.add("hidden");

    const from = yearFromInput.value;
    const to = yearToInput.value;

    const validYear = value => value === "" || (
        Number.isInteger(Number(value)) &&
        Number(value) >= earliestYear &&
        Number(value) <= currentYear
    );

    if (!validYear(from) || !validYear(to)) {
        yearError.textContent = `Choose whole years between ${earliestYear} and ${currentYear}.`;
    } else if (from !== "" && to !== "" && Number(from) > Number(to)) {
        yearError.textContent = 'The "From" year cannot be after the "To" year.';
    } else {
        return true;
    }

    yearError.classList.remove("hidden");
    return false;
}


/* Topic matching helpers
   Normalises labels to compare them consistently */
function normaliseTopic(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}


// Topic hierarchy
// Finds the topic and focus area containing a particular dotpoint
function findDotpointLocation(id) {
    for (const [topicName, topic] of Object.entries(SYLLABUS)) {
        for (const [focusArea, dotpoints] of Object.entries(topic.focusAreas)) {
            if (dotpoints.includes(id)) {
                return { topicName, focusArea };
            }
        }
    }

    return null;
}


// Question topics
// Returns the primary and additional topic labels
function getQuestionTopicLabels(question) {
    return [
        question.topic,
        question.subtopic,
        ...(question.additionalTopics || [])
    ].map(normaliseTopic);
}


// Content matching
// Matches whole topics broadly but individual dotpoints precisely
function matchesSelectedContent(question) {
    const selected = getSelectedDotpoints();

    if (selected.length === 0) return true;

    const questionDotpoints = question.syllabusDotpoints || [];
    const labels = getQuestionTopicLabels(question);

    const topicBlocks = [...topicTree.querySelectorAll(".topic-block")];

    for (const block of topicBlocks) {
        const topicName = Object.keys(SYLLABUS)[topicBlocks.indexOf(block)];
        const topicCheckbox = block.querySelector(".topic-checkbox");

        const selectedIds = [...block.querySelectorAll(".dotpoint-checkbox:checked")]
            .map(box => box.value);

        if (selectedIds.length === 0) continue;

        // Selecting an entire topic includes all its questions
        if (topicCheckbox.checked) {
            if (normaliseTopic(question.topic) === normaliseTopic(topicName)) {
                return true;
            }

            if (labels.some(label =>
                label.startsWith(normaliseTopic(topicName) + " ")
            )) {
                return true;
            }
        }

        // Exact dotpoint matching for tagged questions
        if (questionDotpoints.some(id => selectedIds.includes(id))) {
            return true;
        }

        // For untagged questions, match only a known focus-area label
        if (questionDotpoints.length === 0) {
            for (const id of selectedIds) {
                const location = findDotpointLocation(id);

                if (!location) continue;

                const focusLabel = normaliseTopic(location.focusArea);

                if (labels.includes(focusLabel)) {
                    return true;
                }
            }
        }
    }

    return false;
}


// Question filtering
// Combines selected content, difficulty, schools, years and syllabus version
function getMatchingQuestions() {
    const dotpoints = getSelectedDotpoints();

    const difficulties = [...document.querySelectorAll(".difficulty:checked")]
        .map(box => box.value);

    const from = yearFromInput.value === ""
        ? null
        : Number(yearFromInput.value);

    const to = yearToInput.value === ""
        ? null
        : Number(yearToInput.value);

    const version = syllabusVersionInput.value;

    return questions.filter(question => {
        const contentMatches = matchesSelectedContent(question);

        const difficultyMatches = difficulties.includes(question.difficulty);

        const schoolMatches = selectedSchools.size === 0 ||
            selectedSchools.has(question.school);

        const fromMatches = from === null || question.year >= from;
        const toMatches = to === null || question.year <= to;

        const versionMatches = version === "all" ||
            question.syllabusVersion === version;

        return contentMatches &&
            difficultyMatches &&
            schoolMatches &&
            fromMatches &&
            toMatches &&
            versionMatches;
    });
}

// Matching question count
// Shows how many questions meet the user's selected filters
function updateMatchingCount() {
    if (schoolSearch.value.trim()) {
        matchingCount.textContent = "Select a school from the dropdown to apply the filter.";
        return;
    }

    const count = getMatchingQuestions().length;

    matchingCount.textContent =
        `${count} matching question${count === 1 ? "" : "s"} available`;
}


// Mark-based selection
// Finds an exact mark total where possible, otherwise the closest total below it
function chooseQuestionsByMarks(matchingQuestions, target) {
    const combinations = Array(target + 1).fill(null);
    combinations[0] = [];

    for (const question of shuffle(matchingQuestions)) {
        for (let marks = target; marks >= question.marks; marks--) {
            if (
                combinations[marks] === null &&
                combinations[marks - question.marks] !== null
            ) {
                combinations[marks] = [
                    ...combinations[marks - question.marks],
                    question
                ];
            }
        }
    }

    for (let marks = target; marks >= 1; marks--) {
        if (combinations[marks] !== null) {
            return combinations[marks];
        }
    }

    return [];
}


// Paper size
// Chooses either a number of questions or a requested total mark value
function chooseQuestions(matchingQuestions) {
    const mode = document.querySelector('input[name="paperSizeMode"]:checked').value;

    if (mode === "questions") {
        return shuffle(matchingQuestions).slice(0, Number(questionCountInput.value));
    }

    return chooseQuestionsByMarks(matchingQuestions, Number(targetMarksInput.value));
}


// Media rendering
// Adds one or several question images, or the available text fallback
function appendContent(container, images, text, className, alt) {
    if (images.length) {
        images.forEach(path => {
            const image = document.createElement("img");
            image.src = path;
            image.alt = alt;
            image.className = className;

            container.append(image);
        });
    } else if (text) {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;

        container.append(paragraph);
    }
}


//
//
// Cross-topic notes
// Returns additional topics not already covered by the student's selection
function getOtherTopics(question) {
    const additional = question.additionalTopics || [];

    if (!additional.length) return [];

    const selectedDotpoints = getSelectedDotpoints();

    // No topic filter means the student is practising everything
    if (selectedDotpoints.length === 0) return [];

    const selectedTopics = new Set();

    document.querySelectorAll(".topic-block").forEach((block, index) => {
        const topicName = Object.keys(SYLLABUS)[index];

        if (block.querySelector(".topic-checkbox").checked) {
            selectedTopics.add(topicName);
        }
    });

    return additional.filter(label => {
        const topicName = label.split(":")[0].trim();

        return !selectedTopics.has(topicName);
    });
}

// Paper display
// Renders the renumbered questions with their matching solutions
function displayPaper(selectedQuestions) {
    questionsContainer.replaceChildren();
    solutionsContainer.replaceChildren();

    let totalMarks = 0;

    selectedQuestions.forEach((question, index) => {
        totalMarks += question.marks;

        const number = index + 1;
        const questionDiv = document.createElement("article");
        questionDiv.className = "question";

        questionDiv.innerHTML = `
            <div class="question-header">
                <h3>Question ${number}</h3>
                <span>${question.marks} ${question.marks === 1 ? "mark" : "marks"}</span>
            </div>
        `;

        // Additional topic notice
        // Shows relevant topics outside the student's selected content
        const otherTopics = getOtherTopics(question);

        if (otherTopics.length > 0) {
            const notice = document.createElement("p");
            notice.className = "cross-topic-note";

            notice.textContent = `Note: Covers additional topics including ${otherTopics.join(", ")}`;

            questionDiv.append(notice);
        }

        const questionImages = question.questionImages ??
            (question.questionImage ? [question.questionImage] : []);

        appendContent(
            questionDiv,
            questionImages,
            question.question,
            "question-image",
            `Question ${number}`
        );

        questionDiv.insertAdjacentHTML("beforeend", '<div class="working-space"></div>');
        questionsContainer.append(questionDiv);

        const solutionDiv = document.createElement("article");
        solutionDiv.className = "solution";
        solutionDiv.innerHTML = `<h3>Question ${number}</h3>`;

        const solutionImages = question.solutionImages ??
            (question.solutionImage ? [question.solutionImage] : []);

        appendContent(
            solutionDiv,
            solutionImages,
            question.answer,
            "solution-image",
            `Solution for Question ${number}`
        );

        solutionsContainer.append(solutionDiv);
    });

    const mode = document.querySelector('input[name="paperSizeMode"]:checked').value;
    const requested = Number(targetMarksInput.value);

    const note = mode === "marks" && totalMarks !== requested
        ? ` • closest available to ${requested} marks`
        : "";

    paperInfo.textContent = `${selectedQuestions.length} questions • ${totalMarks} marks${note}`;

    paperSection.classList.remove("hidden");
    paperSection.scrollIntoView({ behavior: "smooth" });
}


// Paper generation
// Checks the inputs before filtering and displaying a custom paper
function generatePaper() {
    if (!validateYears() || !validateSchoolSearch()) return;

    if (!document.querySelector(".difficulty:checked")) {
        alert("Select at least one difficulty.");
        return;
    }

    const mode = document.querySelector('input[name="paperSizeMode"]:checked').value;

    const amount = Number(
        mode === "questions"
            ? questionCountInput.value
            : targetMarksInput.value
    );

    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
        alert("Enter a whole number between 1 and 100 for the paper size.");
        return;
    }

    const matchingQuestions = getMatchingQuestions();

    if (!matchingQuestions.length) {
        alert("No questions match those filters.");
        return;
    }

    const selectedQuestions = chooseQuestions(matchingQuestions);

    if (!selectedQuestions.length) {
        alert("No question fits within that mark total. Try increasing it.");
        return;
    }

    displayPaper(selectedQuestions);
}


// Advanced filters
// Clears source, year and syllabus filters without changing topics or difficulty
function resetAdvancedFilterValues() {
    selectedSchools.clear();
    renderSelectedSchools();

    schoolSearch.value = "";
    yearFromInput.value = "";
    yearToInput.value = "";
    syllabusVersionInput.value = "all";

    schoolError.classList.add("hidden");
    yearError.classList.add("hidden");
    schoolDropdown.classList.add("hidden");
    updateMatchingCount();
}


// Page setup
// Loads the syllabus tree, dynamic year limits and button interactions
function initialisePage() {
    yearFromInput.min = earliestYear;
    yearFromInput.max = currentYear;
    yearToInput.min = earliestYear;
    yearToInput.max = currentYear;

    yearHelp.textContent = `Available years: ${earliestYear}–${currentYear}`;
    createTopicTree();

    topicTree.addEventListener("change", event => {
        handleTopicChange(event);
        updateMatchingCount();
    });

    document.querySelectorAll(".difficulty").forEach(checkbox => {
        checkbox.addEventListener("change", updateMatchingCount);
    });

    yearFromInput.addEventListener("input", updateMatchingCount);
    yearToInput.addEventListener("input", updateMatchingCount);
    syllabusVersionInput.addEventListener("change", updateMatchingCount);

    topicTree.addEventListener("click", event => {
        const button = event.target.closest(".expand-topic");

        if (!button) return;

        const contents = button.closest(".topic-block").querySelector(".topic-contents");
        const opening = contents.classList.contains("hidden");

        contents.classList.toggle("hidden");
        button.textContent = opening ? "−" : "+";
        button.setAttribute("aria-expanded", String(opening));
    });

    schoolSearch.addEventListener("focus", showSchoolOptions);

    schoolSearch.addEventListener("input", () => {
        schoolError.classList.add("hidden");
        showSchoolOptions();
        updateMatchingCount();
    });

    schoolSearch.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            validateSchoolSearch();
        }
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".school-filter")) {
            schoolDropdown.classList.add("hidden");
        }
    });

    document.querySelectorAll('input[name="paperSizeMode"]').forEach(radio => {
        radio.addEventListener("change", () => {
            const marksMode = document.querySelector(
                'input[name="paperSizeMode"]:checked'
            ).value === "marks";

            questionCountInput.disabled = marksMode;
            targetMarksInput.disabled = !marksMode;
        });
    });

    advancedFiltersButton.addEventListener("click", () => {
        advancedFiltersPanel.classList.remove("hidden");
    });

    closeAdvancedFilters.addEventListener("click", () => {
        advancedFiltersPanel.classList.add("hidden");
    });

    resetAdvancedFilters.addEventListener("click", resetAdvancedFilterValues);
    generateButton.addEventListener("click", generatePaper);
    regenerateButton.addEventListener("click", generatePaper);

    printButton.addEventListener("click", () => {
        window.print();
    });
    updateMatchingCount();
}

initialisePage();
