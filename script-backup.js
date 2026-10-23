const generateButton = document.getElementById("generateButton");
const regenerateButton = document.getElementById("regenerateButton");
const printButton = document.getElementById("printButton");
const paperSection = document.getElementById("paperSection");
const questionsContainer = document.getElementById("questionsContainer");
const solutionsContainer = document.getElementById("solutionsContainer");
const paperInfo = document.getElementById("paperInfo");
const topicTree = document.getElementById("topicTree");
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
const questionCountInput = document.getElementById("questionCount");
const targetMarksInput = document.getElementById("targetMarks");
const earliestYear = 1998;
const currentYear = new Date().getFullYear();
let currentPaperQuestions = [];
let selectedSchools = [];
// Question shuffling
// Returns a randomly shuffled copy without changing the original array
function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
// Dotpoint labels
// Turns internal dotpoint IDs into cleaner text for the user
function makeReadableDotpoint(dotpoint) {
    const prefixes = ["functions_", "trig_", "seq_", "calc_", "exp_", "log_", "stats_", "finance_"];
    let readable = dotpoint;
    prefixes.forEach(prefix => {
        if (readable.startsWith(prefix)) {
            readable = readable.slice(prefix.length);
        }
    });
    return readable.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}
// Topic tree
// Builds expandable topic, focus-area and dotpoint checkboxes from syllabus.js
function createTopicTree() {
    topicTree.innerHTML = "";
    for (const topicName in SYLLABUS) {
        const topic = SYLLABUS[topicName];
        const topicBlock = document.createElement("div");
        topicBlock.className = "topic-block";
        const topicRow = document.createElement("div");
        topicRow.className = "topic-row";
        const expandButton = document.createElement("button");
        expandButton.type = "button";
        expandButton.className = "expand-topic";
        expandButton.textContent = "+";
        const topicCheckbox = document.createElement("input");
        topicCheckbox.type = "checkbox";
        topicCheckbox.className = "topic-checkbox";
        topicCheckbox.dataset.topic = topicName;
        const topicLabel = document.createElement("span");
        topicLabel.textContent = topicName;
        topicRow.appendChild(expandButton);
        topicRow.appendChild(topicCheckbox);
        topicRow.appendChild(topicLabel);
        const topicContents = document.createElement("div");
        topicContents.className = "topic-contents hidden";
        for (const focusAreaName in topic.focusAreas) {
            const focusAreaBlock = document.createElement("div");
            focusAreaBlock.className = "focus-area-block";
            const focusAreaRow = document.createElement("div");
            focusAreaRow.className = "focus-area-row";
            const focusCheckbox = document.createElement("input");
            focusCheckbox.type = "checkbox";
            focusCheckbox.className = "focus-area-checkbox";
            focusCheckbox.dataset.topic = topicName;
            focusCheckbox.dataset.focusArea = focusAreaName;
            const focusLabel = document.createElement("span");
            focusLabel.textContent = focusAreaName;
            focusAreaRow.appendChild(focusCheckbox);
            focusAreaRow.appendChild(focusLabel);
            const dotpointContainer = document.createElement("div");
            dotpointContainer.className = "dotpoint-container";
            const dotpoints = topic.focusAreas[focusAreaName];
            dotpoints.forEach(dotpoint => {
                const dotpointRow = document.createElement("label");
                dotpointRow.className = "dotpoint-row";
                const dotpointCheckbox = document.createElement("input");
                dotpointCheckbox.type = "checkbox";
                dotpointCheckbox.className = "dotpoint-checkbox";
                dotpointCheckbox.value = dotpoint;
                dotpointCheckbox.dataset.topic = topicName;
                dotpointCheckbox.dataset.focusArea = focusAreaName;
                const dotpointLabel = document.createElement("span");
                dotpointLabel.textContent = makeReadableDotpoint(dotpoint);
                dotpointRow.appendChild(dotpointCheckbox);
                dotpointRow.appendChild(dotpointLabel);
                dotpointContainer.appendChild(dotpointRow);
                dotpointCheckbox.addEventListener("change", () => {
                    updateParentCheckboxes(topicBlock);
                });
            });
            focusCheckbox.addEventListener("change", () => {
                const children = dotpointContainer.querySelectorAll(".dotpoint-checkbox");
                children.forEach(checkbox => {
                    checkbox.checked = focusCheckbox.checked;
                    checkbox.indeterminate = false;
                });
                updateParentCheckboxes(topicBlock);
            });
            focusAreaBlock.appendChild(focusAreaRow);
            focusAreaBlock.appendChild(dotpointContainer);
            topicContents.appendChild(focusAreaBlock);
        }
        expandButton.addEventListener("click", () => {
            const wasHidden = topicContents.classList.contains("hidden");
            topicContents.classList.toggle("hidden");
            expandButton.textContent = wasHidden ? "−" : "+";
        });
        topicCheckbox.addEventListener("change", () => {
            const children = topicContents.querySelectorAll("input[type='checkbox']");
            children.forEach(checkbox => {
                checkbox.checked = topicCheckbox.checked;
                checkbox.indeterminate = false;
            });
            topicCheckbox.indeterminate = false;
        });
        topicBlock.appendChild(topicRow);
        topicBlock.appendChild(topicContents);
        topicTree.appendChild(topicBlock);
    }
}
// Parent checkbox state
// Shows checked or partial states when only some syllabus content is selected
function updateParentCheckboxes(topicBlock) {
    const topicCheckbox = topicBlock.querySelector(".topic-checkbox");
    const focusAreaBlocks = topicBlock.querySelectorAll(".focus-area-block");
    focusAreaBlocks.forEach(block => {
        const parent = block.querySelector(".focus-area-checkbox");
        const children = [...block.querySelectorAll(".dotpoint-checkbox")];
        const checkedCount = children.filter(child => child.checked).length;
        parent.checked = children.length > 0 && checkedCount === children.length;
        parent.indeterminate = checkedCount > 0 && checkedCount < children.length;
    });
    const allDotpoints = [...topicBlock.querySelectorAll(".dotpoint-checkbox")];
    const selectedCount = allDotpoints.filter(checkbox => checkbox.checked).length;
    topicCheckbox.checked = allDotpoints.length > 0 && selectedCount === allDotpoints.length;
    topicCheckbox.indeterminate = selectedCount > 0 && selectedCount < allDotpoints.length;
}
// Selected syllabus content
// Returns every selected dotpoint from the expandable topic tree
function getSelectedDotpoints() {
    return [...document.querySelectorAll(".dotpoint-checkbox:checked")].map(checkbox => checkbox.value);
}
// School dropdown
// Displays every school or filters the list as the user types
function showSchoolOptions(searchText = "") {
    schoolDropdown.innerHTML = "";
    const search = searchText.trim().toLowerCase();
    const matches = SCHOOLS.filter(school => {
        const alreadySelected = selectedSchools.includes(school);
        const matchesSearch = school.toLowerCase().includes(search);
        return !alreadySelected && matchesSearch;
    });
    if (matches.length === 0) {
        const message = document.createElement("div");
        message.className = "school-no-results";
        message.textContent = "No matching school found.";
        schoolDropdown.appendChild(message);
    } else {
        matches.forEach(school => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "school-option";
            option.textContent = school;
            option.addEventListener("mousedown", event => {
                event.preventDefault();
                addSchool(school);
            });
            schoolDropdown.appendChild(option);
        });
    }
    schoolDropdown.classList.remove("hidden");
}
// Selected schools
// Adds a school to the filter and shows it as a removable selection
function addSchool(school) {
    if (!SCHOOLS.includes(school) || selectedSchools.includes(school)) {
        return;
    }
    selectedSchools.push(school);
    schoolSearch.value = "";
    schoolError.classList.add("hidden");
    schoolDropdown.classList.add("hidden");
    renderSelectedSchools();
}
// Selected schools
// Removes a school from the current school filters
function removeSchool(school) {
    selectedSchools = selectedSchools.filter(selectedSchool => selectedSchool !== school);
    renderSelectedSchools();
}
// Selected schools
// Draws the currently selected schools underneath the search input
function renderSelectedSchools() {
    selectedSchoolsContainer.innerHTML = "";
    selectedSchools.forEach(school => {
        const tag = document.createElement("div");
        tag.className = "school-tag";
        const name = document.createElement("span");
        name.textContent = school;
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.addEventListener("click", () => {
            removeSchool(school);
        });
        tag.appendChild(name);
        tag.appendChild(removeButton);
        selectedSchoolsContainer.appendChild(tag);
    });
}
// School validation
// Prevents typed school names that are not actually present in the question bank
function validateSchoolSearch() {
    const entered = schoolSearch.value.trim();
    schoolError.classList.add("hidden");
    if (entered === "") {
        return true;
    }
    const match = SCHOOLS.find(school => school.toLowerCase() === entered.toLowerCase());
    if (!match) {
        schoolError.textContent = "That school isn't available in the question bank. Choose one from the list.";
        schoolError.classList.remove("hidden");
        return false;
    }
    addSchool(match);
    return true;
}
// Year validation
// Allows only exam years between 1998 and the current calendar year
function validateYears() {
    yearError.classList.add("hidden");
    const fromValue = yearFromInput.value;
    const toValue = yearToInput.value;
    const fromYear = Number(fromValue);
    const toYear = Number(toValue);
    if (fromValue !== "" && (fromYear < earliestYear || fromYear > currentYear)) {
        yearError.textContent = `Year must be between ${earliestYear} and ${currentYear}.`;
        yearError.classList.remove("hidden");
        return false;
    }
    if (toValue !== "" && (toYear < earliestYear || toYear > currentYear)) {
        yearError.textContent = `Year must be between ${earliestYear} and ${currentYear}.`;
        yearError.classList.remove("hidden");
        return false;
    }
    if (fromValue !== "" && toValue !== "" && fromYear > toYear) {
        yearError.textContent = `"From" year cannot be later than "To" year.`;
        yearError.classList.remove("hidden");
        return false;
    }
    return true;
}
// Question filtering
// Applies syllabus, difficulty, school, year and syllabus-version filters
function getMatchingQuestions() {
    const selectedDotpoints = getSelectedDotpoints();
    const selectedDifficulties = [...document.querySelectorAll(".difficulty:checked")].map(checkbox => checkbox.value);
    const yearFrom = yearFromInput.value === "" ? null : Number(yearFromInput.value);
    const yearTo = yearToInput.value === "" ? null : Number(yearToInput.value);
    const syllabusVersion = document.getElementById("syllabusVersion").value;
    return questions.filter(question => {
        const contentMatches = selectedDotpoints.length === 0 || question.syllabusDotpoints?.some(dotpoint => selectedDotpoints.includes(dotpoint));
        const difficultyMatches = selectedDifficulties.includes(question.difficulty);
        const schoolMatches = selectedSchools.length === 0 || selectedSchools.includes(question.school);
        const yearFromMatches = yearFrom === null || question.year >= yearFrom;
        const yearToMatches = yearTo === null || question.year <= yearTo;
        const syllabusMatches = syllabusVersion === "all" || question.syllabusVersion === syllabusVersion;
        return contentMatches && difficultyMatches && schoolMatches && yearFromMatches && yearToMatches && syllabusMatches;
    });
}
// Mark-based paper generation
// Finds a random combination that reaches the requested mark total exactly where possible
function chooseQuestionsByMarks(matchingQuestions, targetMarks) {
    const shuffled = shuffle(matchingQuestions);
    const combinations = new Array(targetMarks + 1).fill(null);
    combinations[0] = [];
    for (const question of shuffled) {
        for (let marks = targetMarks; marks >= question.marks; marks--) {
            if (combinations[marks] === null && combinations[marks - question.marks] !== null) {
                combinations[marks] = [...combinations[marks - question.marks], question];
            }
        }
    }
    if (combinations[targetMarks] !== null) {
        return combinations[targetMarks];
    }
    for (let marks = targetMarks - 1; marks >= 1; marks--) {
        if (combinations[marks] !== null) {
            return combinations[marks];
        }
    }
    const smallestQuestion = [...shuffled].sort((a, b) => a.marks - b.marks)[0];
    return smallestQuestion ? [smallestQuestion] : [];
}
// Paper size
// Chooses questions according to either question count or requested total marks
function chooseQuestions(matchingQuestions) {
    const mode = document.querySelector('input[name="paperSizeMode"]:checked').value;
    if (mode === "questions") {
        const count = Number(questionCountInput.value);
        return shuffle(matchingQuestions).slice(0, count);
    }
    const targetMarks = Number(targetMarksInput.value);
    return chooseQuestionsByMarks(matchingQuestions, targetMarks);
}
// Paper generation
// Validates the filters and creates the custom practice paper
function generatePaper() {
    if (!validateYears() || !validateSchoolSearch()) {
        return;
    }
    const selectedDifficulties = document.querySelectorAll(".difficulty:checked");
    if (selectedDifficulties.length === 0) {
        alert("Select at least one difficulty.");
        return;
    }
    const mode = document.querySelector('input[name="paperSizeMode"]:checked').value;
    if (mode === "questions" && Number(questionCountInput.value) < 1) {
        alert("Enter a valid number of questions.");
        return;
    }
    if (mode === "marks" && Number(targetMarksInput.value) < 1) {
        alert("Enter a valid mark total.");
        return;
    }
    const matchingQuestions = getMatchingQuestions();
    if (matchingQuestions.length === 0) {
        alert("No questions match those filters.");
        return;
    }
    const selectedQuestions = chooseQuestions(matchingQuestions);
    if (selectedQuestions.length === 0) {
        alert("A paper could not be created from those filters.");
        return;
    }
    currentPaperQuestions = selectedQuestions;
    displayPaper(selectedQuestions);
}
// Paper display
// Renders selected questions and their matching solutions using new question numbering
function displayPaper(selectedQuestions) {
    questionsContainer.innerHTML = "";
    solutionsContainer.innerHTML = "";
    let totalMarks = 0;
    selectedQuestions.forEach((question, index) => {
        totalMarks += question.marks;
        const questionDiv = document.createElement("div");
        questionDiv.className = "question";
        const questionHeader = document.createElement("div");
        questionHeader.className = "question-header";
        questionHeader.innerHTML = `<h3>Question ${index + 1}</h3><span>${question.marks} ${question.marks === 1 ? "mark" : "marks"}</span>`;
        questionDiv.appendChild(questionHeader);
        if (question.questionImages?.length) {
            question.questionImages.forEach(imagePath => {
                const image = document.createElement("img");
                image.src = imagePath;
                image.alt = `Question ${index + 1}`;
                image.className = "question-image";
                questionDiv.appendChild(image);
            });
        } else if (question.questionImage) {
            const image = document.createElement("img");
            image.src = question.questionImage;
            image.alt = `Question ${index + 1}`;
            image.className = "question-image";
            questionDiv.appendChild(image);
        } else if (question.question) {
            const text = document.createElement("p");
            text.textContent = question.question;
            questionDiv.appendChild(text);
        }
        const workingSpace = document.createElement("div");
        workingSpace.className = "working-space";
        questionDiv.appendChild(workingSpace);
        questionsContainer.appendChild(questionDiv);
        const solutionDiv = document.createElement("div");
        solutionDiv.className = "solution";
        const solutionHeading = document.createElement("h3");
        solutionHeading.textContent = `Question ${index + 1}`;
        solutionDiv.appendChild(solutionHeading);
        if (question.solutionImages?.length) {
            question.solutionImages.forEach(imagePath => {
                const image = document.createElement("img");
                image.src = imagePath;
                image.alt = `Solution for Question ${index + 1}`;
                image.className = "solution-image";
                solutionDiv.appendChild(image);
            });
        } else if (question.solutionImage) {
            const image = document.createElement("img");
            image.src = question.solutionImage;
            image.alt = `Solution for Question ${index + 1}`;
            image.className = "solution-image";
            solutionDiv.appendChild(image);
        } else if (question.answer) {
            const answer = document.createElement("p");
            answer.textContent = question.answer;
            solutionDiv.appendChild(answer);
        }
        solutionsContainer.appendChild(solutionDiv);
    });
    paperInfo.textContent = `${selectedQuestions.length} questions • ${totalMarks} marks`;
    paperSection.classList.remove("hidden");
    paperSection.scrollIntoView({ behavior: "smooth" });
}
// Advanced filters
// Resets school, year and syllabus source filters without changing topic selections
function resetAdvancedFilterValues() {
    selectedSchools = [];
    renderSelectedSchools();
    schoolSearch.value = "";
    yearFromInput.value = "";
    yearToInput.value = "";
    document.getElementById("syllabusVersion").value = "all";
    schoolError.classList.add("hidden");
    yearError.classList.add("hidden");
}
// Initial setup
// Applies dynamic year limits and builds the syllabus selector
function initialisePage() {
    yearFromInput.min = earliestYear;
    yearFromInput.max = currentYear;
    yearToInput.min = earliestYear;
    yearToInput.max = currentYear;
    yearHelp.textContent = `Available years: ${earliestYear}–${currentYear}`;
    createTopicTree();
}
schoolSearch.addEventListener("focus", () => {
    showSchoolOptions(schoolSearch.value);
});
schoolSearch.addEventListener("input", () => {
    schoolError.classList.add("hidden");
    showSchoolOptions(schoolSearch.value);
});
schoolSearch.addEventListener("blur", () => {
    setTimeout(() => {
        schoolDropdown.classList.add("hidden");
    }, 100);
});
document.querySelectorAll('input[name="paperSizeMode"]').forEach(radio => {
    radio.addEventListener("change", () => {
        const mode = document.querySelector('input[name="paperSizeMode"]:checked').value;
        questionCountInput.disabled = mode !== "questions";
        targetMarksInput.disabled = mode !== "marks";
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
initialisePage();