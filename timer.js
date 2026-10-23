// Timer navigation
// Switches between the landing page and the four independent timer modes.
const timerHome = document.querySelector('#timerHome');
const timerBack = document.querySelector('#timerBack');
const timerShell = document.querySelector('.timer-shell');
const panels = Object.fromEntries(['stopwatch', 'countdown', 'focus', 'exam'].map(mode => [mode, document.querySelector(`#${mode}Panel`)]));

// Appearance preferences
// Keep the selected colour palette and light/dark preference on this device.
const themeInput = document.querySelector('#timerTheme');
const appearanceToggle = document.querySelector('#appearanceToggle');
const storedTheme = localStorage.getItem('alignhscTimerTheme');
const storedAppearance = localStorage.getItem('alignhscTimerAppearance');
if ([...themeInput.options].some(option => option.value === storedTheme)) themeInput.value = storedTheme;
timerShell.dataset.theme = themeInput.value;
timerShell.dataset.appearance = storedAppearance === 'dark' ? 'dark' : 'light';
function updateAppearance() {
    appearanceToggle.textContent = timerShell.dataset.appearance === 'dark' ? '☀ Light mode' : '☾ Dark mode';
    appearanceToggle.setAttribute('aria-label', `Switch to ${timerShell.dataset.appearance === 'dark' ? 'light' : 'dark'} mode`);
}
updateAppearance();
themeInput.addEventListener('change', () => {
    timerShell.dataset.theme = themeInput.value;
    localStorage.setItem('alignhscTimerTheme', themeInput.value);
});
appearanceToggle.addEventListener('click', () => {
    timerShell.dataset.appearance = timerShell.dataset.appearance === 'dark' ? 'light' : 'dark';
    localStorage.setItem('alignhscTimerAppearance', timerShell.dataset.appearance);
    updateAppearance();
});

// Distraction-free view
// Expand only the clock stage and provide a visible exit control.
const exitZen = document.querySelector('#exitZen');
async function enterZen() {
    timerShell.classList.add('zen-mode');
    exitZen.hidden = false;
    try { await document.documentElement.requestFullscreen?.(); } catch (_) { /* CSS fallback stays active. */ }
}
async function leaveZen() {
    timerShell.classList.remove('zen-mode');
    exitZen.hidden = true;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
}
document.querySelectorAll('[data-zen]').forEach(button => button.addEventListener('click', enterZen));
exitZen.addEventListener('click', leaveZen);
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && timerShell.classList.contains('zen-mode')) {
        timerShell.classList.remove('zen-mode'); exitZen.hidden = true;
    }
});

function showMode(mode) {
    if (timerShell.classList.contains('zen-mode')) leaveZen();
    timerShell.classList.toggle('home-mode', !mode);
    timerHome.hidden = Boolean(mode);
    timerBack.hidden = !mode;
    Object.entries(panels).forEach(([name, panel]) => { panel.hidden = name !== mode; });
    if (mode) history.replaceState(null, '', `#${mode}`);
    else history.replaceState(null, '', location.pathname);
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => showMode(button.dataset.mode)));
timerBack.addEventListener('click', () => showMode(null));
const initialMode = location.hash.slice(1);
if (panels[initialMode]) showMode(initialMode);
else timerShell.classList.add('home-mode');

// Shared clock utilities
// Calculate from timestamps so background tabs do not make clocks drift.
const pad = number => String(number).padStart(2, '0');
function formatTime(ms, tenths = false) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total % 3600 / 60);
    const seconds = total % 60;
    return `${hours ? `${pad(hours)}:` : ''}${pad(minutes)}:${pad(seconds)}${tenths ? `.${Math.floor(ms % 1000 / 100)}` : ''}`;
}

function chime() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const tone = context.createOscillator();
        const gain = context.createGain();
        tone.connect(gain); gain.connect(context.destination);
        tone.frequency.value = 740; gain.gain.value = 0.08;
        tone.start(); tone.stop(context.currentTime + 0.2);
        tone.onended = () => context.close();
    } catch (_) { /* Sound can be blocked by browser permissions. */ }
}

// Stopwatch
// Tracks elapsed time and individual lap splits.
let stopwatchElapsed = 0;
let stopwatchStarted = 0;
let stopwatchRunning = false;
let previousLap = 0;
const stopwatchDisplay = document.querySelector('#stopwatchDisplay');
const stopwatchStart = document.querySelector('#stopwatchStart');
const stopwatchCurrent = () => stopwatchElapsed + (stopwatchRunning ? performance.now() - stopwatchStarted : 0);
stopwatchStart.addEventListener('click', () => {
    if (stopwatchRunning) stopwatchElapsed = stopwatchCurrent();
    else stopwatchStarted = performance.now();
    stopwatchRunning = !stopwatchRunning;
    stopwatchStart.textContent = stopwatchRunning ? 'Pause' : 'Resume';
});
document.querySelector('#stopwatchLap').addEventListener('click', () => {
    if (!stopwatchRunning) return;
    const now = stopwatchCurrent();
    const entry = document.createElement('li');
    entry.textContent = `Lap ${document.querySelector('#stopwatchLaps').children.length + 1}: ${formatTime(now - previousLap, true)} (total ${formatTime(now, true)})`;
    document.querySelector('#stopwatchLaps').prepend(entry);
    previousLap = now;
});
document.querySelector('#stopwatchReset').addEventListener('click', () => {
    stopwatchElapsed = 0; stopwatchRunning = false; previousLap = 0;
    stopwatchStart.textContent = 'Start'; stopwatchDisplay.textContent = '00:00:00.0';
    document.querySelector('#stopwatchLaps').replaceChildren();
});

// Countdown widget gallery
// Load WidgetForge's own embed for the selected design and target date.
const widgetStyles = ['classic', 'cards', 'flip', 'bounce', 'circles', 'minimal', 'neon', 'split-flap'];
let selectedWidget = 'flip';
const widgetStyleContainer = document.querySelector('#widgetStyles');
widgetStyles.forEach(style => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'timer-style-button';
    button.textContent = style.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('-');
    button.dataset.style = style;
    button.addEventListener('click', () => { selectedWidget = style; refreshWidget(); });
    widgetStyleContainer.append(button);
});
const targetInput = document.querySelector('#countdownTarget');
const defaultTarget = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
targetInput.value = `${defaultTarget.getFullYear()}-${pad(defaultTarget.getMonth() + 1)}-${pad(defaultTarget.getDate())}T${pad(defaultTarget.getHours())}:${pad(defaultTarget.getMinutes())}`;

function refreshWidget() {
    document.querySelector('#selectedWidgetName').textContent = selectedWidget.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('-');
    document.querySelectorAll('.timer-style-button').forEach(button => button.classList.toggle('selected', button.dataset.style === selectedWidget));
    const target = new Date(targetInput.value);
    const mount = document.querySelector('#widgetMount');
    const fallback = document.querySelector('#widgetFallback');
    const moreLink = document.querySelector('#configureWidget');
    moreLink.href = `https://widget-forge.com/widgets/countdown/${selectedWidget}/`;
    mount.replaceChildren();
    if (!Number.isFinite(target.getTime()) || target.getTime() <= Date.now()) {
        fallback.hidden = false; fallback.textContent = 'Please choose a future target date and time.'; return;
    }
    fallback.hidden = true;
    const widget = document.createElement('div');
    widget.dataset.wfWidget = `countdown-${selectedWidget}`;
    widget.dataset.wfTarget = target.toISOString();
    widget.dataset.wfTitle = document.querySelector('#countdownTitle').value || 'Countdown';
    widget.dataset.wfSize = 'inline';
    mount.append(widget);
    const script = document.createElement('script');
    script.src = `https://widget-forge.com/embed.js?refresh=${Date.now()}`;
    script.async = true;
    script.onerror = () => { fallback.hidden = false; fallback.textContent = 'Widget could not load. Open the WidgetForge configurator to use this style.'; };
    mount.append(script);
}
document.querySelector('#applyWidget').addEventListener('click', refreshWidget);
refreshWidget();

// Focus timer
// Alternates between study sessions and breaks, keeping the last phase duration.
let focusStage = 'work', focusRemaining = 25 * 60000, focusEnd = 0, focusRunning = false, focusCompleted = 0;
const focusStart = document.querySelector('#focusStart');
const focusMinutes = () => Math.max(1, Number(document.querySelector(focusStage === 'work' ? '#focusWork' : '#focusBreak').value) || 1);
function focusNext() {
    if (focusStage === 'work') focusCompleted++;
    focusStage = focusStage === 'work' ? 'break' : 'work';
    focusRemaining = focusMinutes() * 60000;
    if (focusRunning) focusEnd = Date.now() + focusRemaining;
    document.querySelector('#focusSessions').textContent = `Study sessions completed: ${focusCompleted}`;
    chime();
}
focusStart.addEventListener('click', () => {
    if (focusRunning) focusRemaining = Math.max(0, focusEnd - Date.now());
    else focusEnd = Date.now() + focusRemaining;
    focusRunning = !focusRunning;
    focusStart.textContent = focusRunning ? 'Pause' : 'Resume';
});
document.querySelector('#focusSkip').addEventListener('click', focusNext);
function resetFocus() {
    focusStage = 'work'; focusRunning = false;
    focusRemaining = Math.max(1, Number(document.querySelector('#focusWork').value) || 25) * 60000;
    focusStart.textContent = 'Start'; renderFocus();
}
document.querySelector('#focusReset').addEventListener('click', resetFocus);
document.querySelectorAll('#focusWork, #focusBreak').forEach(input => input.addEventListener('change', () => { if (!focusRunning) resetFocus(); }));
function renderFocus() {
    const remaining = focusRunning ? Math.max(0, focusEnd - Date.now()) : focusRemaining;
    if (focusRunning && remaining <= 0) { focusNext(); return; }
    document.querySelector('#focusPhase').textContent = focusStage === 'work' ? 'Study session' : 'Break time';
    document.querySelector('#focusDisplay').textContent = formatTime(remaining);
    document.querySelector('#focusProgress').style.width = `${Math.max(0, Math.min(100, 100 * (1 - remaining / (focusMinutes() * 60000))))}%`;
}

// Exam timer
// Uses distinct reading and writing stages with one-way warning checkpoints.
let examStage = 'ready', examEnd = 0, examDuration = 0, examFired = new Set();
const examStart = document.querySelector('#examStart');
const readingMs = () => Math.max(0, Number(document.querySelector('#examReading').value) || 0) * 60000;
const writingMs = () => Math.max(1, Number(document.querySelector('#examWriting').value) || 180) * 60000;
const examNotice = document.querySelector('#examNotice');
function resetExam() {
    examStage = 'ready'; examFired.clear();
    examStart.textContent = 'Start exam'; examStart.disabled = false;
    document.querySelectorAll('#examReading, #examWriting, #examMarks').forEach(input => input.disabled = false);
    document.querySelector('#examPhase').textContent = 'Ready to begin';
    document.querySelector('#examDisplay').textContent = formatTime(readingMs() + writingMs());
    document.querySelector('#examProgress').style.width = '0%';
    document.querySelector('#examStatusBadge').textContent = '◉ Ready for exam';
    document.querySelector('#examElapsed').textContent = 'Reading and writing time';
    document.querySelector('#examReadingBadge').textContent = 'Reading not started';
    document.querySelector('#examWritingBadge').textContent = 'Writing not started';
    document.querySelector('#examNextWarning').textContent = '30 minutes remaining — stay aware of your pacing.';
    const marks = Math.max(1, Number(document.querySelector('#examMarks').value) || 100);
    document.querySelector('#examPacing').textContent = `${(writingMs() / 60000 / marks).toFixed(2)} minutes per mark during writing time`;
    examNotice.textContent = 'Reading time will automatically transition to writing time.';
}
function beginWriting() {
    examStage = 'writing'; examDuration = writingMs(); examEnd = Date.now() + examDuration;
    for (const minutes of [30, 15, 10, 5, 1]) {
        if (examDuration <= minutes * 60000) examFired.add(minutes);
    }
    examNotice.textContent = 'Reading time finished. Writing time has begun.';
    if (document.querySelector('#examSounds').checked) chime();
}
examStart.addEventListener('click', () => {
    if (examStage !== 'ready') return;
    if (!Number.isFinite(readingMs() + writingMs())) return;
    document.querySelectorAll('#examReading, #examWriting, #examMarks').forEach(input => input.disabled = true);
    examStart.disabled = true; examStart.textContent = 'Exam running';
    if (!readingMs()) beginWriting();
    else { examStage = 'reading'; examDuration = readingMs(); examEnd = Date.now() + examDuration; }
    renderExam();
});
document.querySelector('#examReset').addEventListener('click', () => {
    if (examStage !== 'ready' && examStage !== 'done' && !confirm('Reset the current exam? Your elapsed time will be lost.')) return;
    resetExam();
});
document.querySelectorAll('#examReading, #examWriting, #examMarks').forEach(input => input.addEventListener('change', resetExam));
document.querySelector('#examFullscreen').addEventListener('click', enterZen);
function renderExam() {
    if (examStage === 'ready' || examStage === 'done') return;
    let remaining = Math.max(0, examEnd - Date.now());
    if (remaining <= 0 && examStage === 'reading') { beginWriting(); remaining = examDuration; }
    else if (remaining <= 0) {
        examStage = 'done'; examStart.textContent = 'Exam finished';
        examNotice.textContent = 'Time is up. Your exam session has ended.';
        if (document.querySelector('#examSounds').checked) chime();
    }
    document.querySelector('#examPhase').textContent = examStage === 'reading' ? 'Reading time' : examStage === 'writing' ? 'Writing time' : 'Exam finished';
    document.querySelector('#examDisplay').textContent = formatTime(remaining);
    document.querySelector('#examProgress').style.width = `${100 * (1 - remaining / examDuration)}%`;
    document.querySelector('#examStatusBadge').textContent = examStage === 'done' ? '✓ Exam complete' : '◉ Exam in progress';
    document.querySelector('#examElapsed').textContent = `${Math.floor((examDuration - remaining) / 60000)} minutes elapsed of ${Math.round(examDuration / 60000)} minutes`;
    document.querySelector('#examReadingBadge').textContent = examStage === 'reading' ? '◉ Reading in progress' : '✓ Reading completed';
    document.querySelector('#examWritingBadge').textContent = examStage === 'reading' ? 'Writing upcoming' : examStage === 'writing' ? '◉ Writing in progress' : '✓ Writing completed';
    if (examStage === 'writing') {
        for (const minutes of [30, 15, 10, 5, 1]) {
            if (remaining <= minutes * 60000 && !examFired.has(minutes)) {
                examFired.add(minutes);
                examNotice.textContent = `${minutes} minute${minutes === 1 ? '' : 's'} remaining. Keep an eye on your pacing.`;
                if (document.querySelector('#examSounds').checked) chime();
            }
        }
        const next = [30, 15, 10, 5, 1].find(minutes => remaining > minutes * 60000);
        document.querySelector('#examNextWarning').textContent = next ? `${next} minutes remaining — stay aware of your pacing.` : 'Final minute — prepare to finish.';
    } else if (examStage === 'reading') {
        document.querySelector('#examNextWarning').textContent = 'Writing time begins when reading time ends.';
    } else {
        document.querySelector('#examNextWarning').textContent = 'Your exam session is complete.';
    }
}
resetExam();
setInterval(() => {
    if (stopwatchRunning) stopwatchDisplay.textContent = formatTime(stopwatchCurrent(), true);
    renderFocus(); renderExam();
}, 100);
