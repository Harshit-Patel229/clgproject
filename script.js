// Tab Switching
const navButtons = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

function switchTab(tabId) {
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Dark / Light Theme Toggle
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
  const current = document.body.getAttribute('data-theme');
  const target = current === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', target);
  themeToggle.innerHTML = target === 'light' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
});

// Digital Clock Logic
let is24Hour = false;
const clockTime = document.getElementById('clockTime');
const clockAmPm = document.getElementById('clockAmPm');
const clockDate = document.getElementById('clockDate');
const toggleFormatBtn = document.getElementById('toggleFormatBtn');

toggleFormatBtn.addEventListener('click', () => {
  is24Hour = !is24Hour;
  toggleFormatBtn.textContent = is24Hour ? 'Switch to 12-Hour' : 'Switch to 24-Hour';
  clockAmPm.style.display = is24Hour ? 'none' : 'inline';
});

function updateDigitalClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  if (!is24Hour) {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    clockAmPm.textContent = ampm;
  }
  clockTime.textContent = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  clockDate.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateDigitalClock, 1000);
updateDigitalClock();

// World Clock Module
const timeZones = [
  { city: 'London (GMT)', zone: 'Europe/London' },
  { city: 'New York (EST)', zone: 'America/New_York' },
  { city: 'Tokyo (JST)', zone: 'Asia/Tokyo' },
  { city: 'New Delhi (IST)', zone: 'Asia/Kolkata' },
  { city: 'Sydney (AEST)', zone: 'Australia/Sydney' },
  { city: 'Dubai (GST)', zone: 'Asia/Dubai' }
];

function updateWorldClock() {
  const container = document.getElementById('worldClockGrid');
  container.innerHTML = '';
  const now = new Date();

  timeZones.forEach(({ city, zone }) => {
    const timeString = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(now);

    const card = document.createElement('div');
    card.className = 'dashboard-card';
    card.innerHTML = `
      <div class="icon-wrap"><i class="fa-solid fa-earth-americas"></i></div>
      <h3>${city}</h3>
      <div class="world-time">${timeString}</div>
    `;
    container.appendChild(card);
  });
}
setInterval(updateWorldClock, 1000);
updateWorldClock();

// Precision Stopwatch
let stopwatchTimer = null;
let stopwatchStart = 0;
let stopwatchElapsed = 0;
let lapCounter = 1;

const stopwatchDisplay = document.getElementById('stopwatchDisplay');
const startStopwatchBtn = document.getElementById('startStopwatchBtn');
const lapStopwatchBtn = document.getElementById('lapStopwatchBtn');
const resetStopwatchBtn = document.getElementById('resetStopwatchBtn');
const lapList = document.getElementById('lapList');

function formatStopwatch(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const centi = Math.floor((ms % 1000) / 10);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(centi).padStart(2, '0')}`;
}

startStopwatchBtn.addEventListener('click', () => {
  if (!stopwatchTimer) {
    stopwatchStart = Date.now() - stopwatchElapsed;
    stopwatchTimer = setInterval(() => {
      stopwatchElapsed = Date.now() - stopwatchStart;
      stopwatchDisplay.textContent = formatStopwatch(stopwatchElapsed);
    }, 20);
    startStopwatchBtn.textContent = 'Pause';
    startStopwatchBtn.classList.add('btn-danger');
    startStopwatchBtn.classList.remove('btn-primary');
    lapStopwatchBtn.disabled = false;
    resetStopwatchBtn.disabled = false;
  } else {
    clearInterval(stopwatchTimer);
    stopwatchTimer = null;
    startStopwatchBtn.textContent = 'Resume';
    startStopwatchBtn.classList.remove('btn-danger');
    startStopwatchBtn.classList.add('btn-primary');
  }
});

lapStopwatchBtn.addEventListener('click', () => {
  const li = document.createElement('li');
  li.innerHTML = `<span>Lap ${lapCounter++}</span> <span>${stopwatchDisplay.textContent}</span>`;
  lapList.prepend(li);
});

resetStopwatchBtn.addEventListener('click', () => {
  clearInterval(stopwatchTimer);
  stopwatchTimer = null;
  stopwatchElapsed = 0;
  lapCounter = 1;
  stopwatchDisplay.textContent = '00:00:00.00';
  startStopwatchBtn.textContent = 'Start';
  startStopwatchBtn.classList.remove('btn-danger');
  startStopwatchBtn.classList.add('btn-primary');
  lapStopwatchBtn.disabled = true;
  resetStopwatchBtn.disabled = true;
  lapList.innerHTML = '';
});

// Countdown Timer with Web Audio API chime
let timerInterval = null;
let timerTotalSeconds = 0;
const timerDisplay = document.getElementById('timerDisplay');
const startTimerBtn = document.getElementById('startTimerBtn');
const resetTimerBtn = document.getElementById('resetTimerBtn');

function playAudioAlert() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) {
    console.warn('AudioContext requires direct user interaction');
  }
}

function updateTimerDisplay(totalSecs) {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  timerDisplay.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

startTimerBtn.addEventListener('click', () => {
  if (!timerInterval) {
    const h = parseInt(document.getElementById('timerHours').value) || 0;
    const m = parseInt(document.getElementById('timerMinutes').value) || 0;
    const s = parseInt(document.getElementById('timerSeconds').value) || 0;

    if (timerTotalSeconds === 0) timerTotalSeconds = h * 3600 + m * 60 + s;
    if (timerTotalSeconds <= 0) return;

    updateTimerDisplay(timerTotalSeconds);
    startTimerBtn.textContent = 'Pause';
    startTimerBtn.classList.add('btn-danger');
    startTimerBtn.classList.remove('btn-primary');

    timerInterval = setInterval(() => {
      timerTotalSeconds--;
      updateTimerDisplay(timerTotalSeconds);
      if (timerTotalSeconds <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        playAudioAlert();
        startTimerBtn.textContent = 'Start Timer';
        startTimerBtn.classList.remove('btn-danger');
        startTimerBtn.classList.add('btn-primary');
      }
    }, 1000);
  } else {
    clearInterval(timerInterval);
    timerInterval = null;
    startTimerBtn.textContent = 'Resume';
    startTimerBtn.classList.remove('btn-danger');
    startTimerBtn.classList.add('btn-primary');
  }
});

resetTimerBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerTotalSeconds = 0;
  const h = parseInt(document.getElementById('timerHours').value) || 0;
  const m = parseInt(document.getElementById('timerMinutes').value) || 0;
  const s = parseInt(document.getElementById('timerSeconds').value) || 0;
  updateTimerDisplay(h * 3600 + m * 60 + s);
  startTimerBtn.textContent = 'Start Timer';
  startTimerBtn.classList.remove('btn-danger');
  startTimerBtn.classList.add('btn-primary');
});

// Interactive Calendar
let currentDate = new Date();

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthYearLabel = document.getElementById('monthYearLabel');
  const daysContainer = document.getElementById('calendarDays');

  monthYearLabel.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate);
  daysContainer.innerHTML = '';

  ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'calendar-col-head';
    el.textContent = d;
    daysContainer.appendChild(el);
  });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDayIndex; i++) {
    daysContainer.appendChild(document.createElement('div'));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.textContent = d;

    if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      cell.classList.add('today');
    }

    cell.addEventListener('click', () => {
      const note = prompt(`Add a reminder note for ${month + 1}/${d}/${year}:`);
      if (note) {
        const item = document.createElement('li');
        item.textContent = `${month + 1}/${d}/${year}: ${note}`;
        document.getElementById('calendarEventsList').appendChild(item);
      }
    });

    daysContainer.appendChild(cell);
  }
}

document.getElementById('prevMonthBtn').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById('nextMonthBtn').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

renderCalendar();