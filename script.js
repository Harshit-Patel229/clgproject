/* =====================================================================
 * CHRONOHUB COMPREHENSIVE CONTROLLER
 * Single unified JavaScript logic for all pages and components
 * ===================================================================== */

// ---------------------------------------------------------------------
// 1. STATE MANAGEMENT
// ---------------------------------------------------------------------
const state = {
  currentPage: 'home',
  isDarkTheme: true,
  clock: {
    is24Hour: false,
    showSeconds: true,
    blinkColons: true,
    theme: 'cyan',
    isFullscreen: false
  },
  worldClock: {
    cities: [
      { name: 'New York', country: 'USA', tz: 'America/New_York' },
      { name: 'London', country: 'United Kingdom', tz: 'Europe/London' },
      { name: 'Tokyo', country: 'Japan', tz: 'Asia/Tokyo' },
      { name: 'New Delhi', country: 'India', tz: 'Asia/Kolkata' },
      { name: 'Sydney', country: 'Australia', tz: 'Australia/Sydney' },
      { name: 'Dubai', country: 'UAE', tz: 'Asia/Dubai' },
      { name: 'Paris', country: 'France', tz: 'Europe/Paris' }
    ]
  },
  stopwatch: {
    startTime: 0,
    elapsedTime: 0,
    timerInterval: null,
    isRunning: false,
    laps: []
  },
  timer: {
    totalSeconds: 300,
    remainingSeconds: 300,
    timerInterval: null,
    isRunning: false
  },
  calendar: {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDateStr: null,
    notes: {} // keyed by 'YYYY-MM-DD'
  }
};

// Load persistent notes from localStorage safely
try {
  const savedNotes = localStorage.getItem('chronohub_calendar_notes');
  if (savedNotes) {
    state.calendar.notes = JSON.parse(savedNotes);
  }
} catch(e) {
  console.warn('LocalStorage access issue:', e);
}

// ---------------------------------------------------------------------
// 2. WEB AUDIO SYNTHESIZER (NO EXTERNAL AUDIO FILES)
// ---------------------------------------------------------------------
const AudioService = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  playChime(type = 'alarm') {
    try {
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'alarm') {
        // Pleasant 3-tone chime sequence
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.15); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.3); // D6
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        osc.start(now);
        osc.stop(now + 0.95);
      } else {
        // Subtle click sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (err) {
      console.warn('Web Audio error:', err);
    }
  }
};

// ---------------------------------------------------------------------
// 3. TOAST NOTIFICATIONS HELPER
// ---------------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  const bgColors = {
    info: 'bg-indigo-600 text-white',
    success: 'bg-emerald-600 text-white',
    warn: 'bg-amber-600 text-white',
    rose: 'bg-rose-600 text-white'
  };

  toast.className = `px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg ${bgColors[type] || bgColors.info} flex items-center gap-2 transform transition-all duration-300 opacity-0 translate-y-2 pointer-events-auto`;
  toast.innerHTML = `<i class="fa-solid fa-circle-info text-xs"></i> <span>${message}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  }, 20);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---------------------------------------------------------------------
// 4. NAVIGATION & VIEW SWITCHER
// ---------------------------------------------------------------------
function navTo(pageId) {
  state.currentPage = pageId;

  // Hide all page views
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.add('hidden');
  });

  // Show targeted view
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Update Navigation Links Active State
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.getAttribute('data-nav') === pageId) {
      btn.classList.add('text-white', 'bg-indigo-600/30', 'font-semibold');
      btn.classList.remove('text-slate-300');
    } else {
      btn.classList.remove('text-white', 'bg-indigo-600/30', 'font-semibold');
      btn.classList.add('text-slate-300');
    }
  });

  // Special page triggers
  if (pageId === 'world-clock') {
    renderWorldClocks();
  } else if (pageId === 'calendar') {
    renderCalendar();
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('hidden');
}

// ---------------------------------------------------------------------
// 5. THEME TOGGLING (Dark / Light mode)
// ---------------------------------------------------------------------
function toggleTheme() {
  const html = document.documentElement;
  const themeIcon = document.getElementById('themeIcon');
  state.isDarkTheme = !state.isDarkTheme;

  if (state.isDarkTheme) {
    html.classList.add('dark');
    html.classList.remove('light');
    themeIcon.className = 'fa-solid fa-moon text-sm';
    showToast('Dark mode activated', 'info');
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
    themeIcon.className = 'fa-solid fa-sun text-sm text-amber-400';
    showToast('Light mode activated', 'info');
  }
}

// ---------------------------------------------------------------------
// 6. MAIN DIGITAL CLOCK MODULE
// ---------------------------------------------------------------------
function updateClock() {
  const now = new Date();

  // Top mini clock
  const navLive = document.getElementById('navLiveClock');
  if (navLive) {
    navLive.innerText = now.toTimeString().split(' ')[0];
  }

  // Hero clock preview
  const heroTime = document.getElementById('heroTime');
  const heroDate = document.getElementById('heroDate');
  if (heroTime) {
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    heroTime.innerText = `${String(h).padStart(2, '0')}:${m}:${s} ${ampm}`;
  }
  if (heroDate) {
    heroDate.innerText = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Digital Clock Page Elements
  let hours = now.getHours();
  let period = '';
  if (!state.clock.is24Hour) {
    period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
  }
  
  const minutesStr = String(now.getMinutes()).padStart(2, '0');
  const secondsStr = String(now.getSeconds()).padStart(2, '0');
  const hoursStr = String(hours).padStart(2, '0');

  const elHours = document.getElementById('clockHours');
  const elMinutes = document.getElementById('clockMinutes');
  const elSeconds = document.getElementById('clockSeconds');
  const elPeriod = document.getElementById('clockPeriod');
  const elDay = document.getElementById('clockDayBadge');
  const elDate = document.getElementById('clockDateBadge');
  const elTz = document.getElementById('clockTimezoneBadge');

  if (elHours) elHours.innerText = hoursStr;
  if (elMinutes) elMinutes.innerText = minutesStr;
  if (elSeconds) elSeconds.innerText = secondsStr;
  if (elPeriod) elPeriod.innerText = state.clock.is24Hour ? '' : period;

  if (elDay) {
    elDay.innerText = now.toLocaleDateString(undefined, { weekday: 'long' });
  }
  if (elDate) {
    elDate.innerText = now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }
  if (elTz) {
    try {
      elTz.innerText = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    } catch(e) {
      elTz.innerText = 'Local Time';
    }
  }

  // Blinking colon management
  const colon1 = document.getElementById('clockColon1');
  const colon2 = document.getElementById('clockColon2');
  if (colon1 && colon2) {
    if (state.clock.blinkColons) {
      colon1.style.opacity = now.getSeconds() % 2 === 0 ? '1' : '0.2';
      colon2.style.opacity = now.getSeconds() % 2 === 0 ? '1' : '0.2';
    } else {
      colon1.style.opacity = '1';
      colon2.style.opacity = '1';
    }
  }

  // Day Completion Progress calculation
  const dayProgressPercent = document.getElementById('dayProgressPercent');
  const dayProgressBar = document.getElementById('dayProgressBar');
  if (dayProgressPercent && dayProgressBar) {
    const totalSecInDay = 86400;
    const currentSec = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    const pct = ((currentSec / totalSecInDay) * 100).toFixed(1);
    dayProgressPercent.innerText = `${pct}%`;
    dayProgressBar.style.width = `${pct}%`;
  }
}

function toggleClockFormat() {
  state.clock.is24Hour = !state.clock.is24Hour;
  document.getElementById('clockFormatLabel').innerText = state.clock.is24Hour ? '24-Hour' : '12-Hour';
  updateClock();
}

function toggleSecondsDisplay() {
  state.clock.showSeconds = !state.clock.showSeconds;
  const secWrapper = document.getElementById('clockSecondsWrapper');
  const secLabel = document.getElementById('clockSecondsLabel');
  
  if (state.clock.showSeconds) {
    secWrapper.style.display = 'flex';
    secLabel.innerText = 'ON';
  } else {
    secWrapper.style.display = 'none';
    secLabel.innerText = 'OFF';
  }
}

function toggleBlinkingColons() {
  state.clock.blinkColons = !state.clock.blinkColons;
  document.getElementById('clockBlinkLabel').innerText = state.clock.blinkColons ? 'ON' : 'OFF';
}

function setClockTheme(themeKey) {
  state.clock.theme = themeKey;
  const hours = document.getElementById('clockHours');
  const mins = document.getElementById('clockMinutes');
  const secs = document.getElementById('clockSeconds');
  const c1 = document.getElementById('clockColon1');
  const c2 = document.getElementById('clockColon2');
  const aura = document.getElementById('clockAura');

  const themeMap = {
    cyan: {
      textClass: 'text-cyan-400',
      drop: 'drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]',
      aura: 'bg-cyan-500/10'
    },
    indigo: {
      textClass: 'text-indigo-400',
      drop: 'drop-shadow-[0_0_20px_rgba(99,102,241,0.5)]',
      aura: 'bg-indigo-500/15'
    },
    emerald: {
      textClass: 'text-emerald-400',
      drop: 'drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]',
      aura: 'bg-emerald-500/15'
    },
    rose: {
      textClass: 'text-rose-400',
      drop: 'drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]',
      aura: 'bg-rose-500/15'
    },
    amber: {
      textClass: 'text-amber-400',
      drop: 'drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]',
      aura: 'bg-amber-500/15'
    }
  };

  const selected = themeMap[themeKey] || themeMap.cyan;

  [hours, mins, secs, c1, c2].forEach(el => {
    el.className = el.className.replace(/text-[a-z]+-[0-9]+/g, selected.textClass);
  });
  aura.className = `absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl pointer-events-none transition-colors ${selected.aura}`;
  showToast(`Aesthetic theme changed to ${themeKey.toUpperCase()}`, 'info');
}

function toggleFullscreenClock() {
  const container = document.getElementById('digitalClockContainer');
  const exitBtn = document.getElementById('exitFsBtn');
  state.clock.isFullscreen = !state.clock.isFullscreen;

  if (state.clock.isFullscreen) {
    container.classList.add('is-fullscreen');
    exitBtn.classList.remove('hidden');
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else {
    container.classList.remove('is-fullscreen');
    exitBtn.classList.add('hidden');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

// Escape listener for fullscreen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.clock.isFullscreen) {
    toggleFullscreenClock();
  }
});

// ---------------------------------------------------------------------
// 7. WORLD CLOCK MODULE
// ---------------------------------------------------------------------
function renderWorldClocks() {
  const grid = document.getElementById('worldCitiesGrid');
  if (!grid) return;

  const now = new Date();
  grid.innerHTML = '';

  state.worldClock.cities.forEach((city, index) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: city.tz,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });

      // Accurate time calculation
      const cityTimeStr = formatter.format(now);
      
      // Calculate approximate hours difference relative to local
      const localDate = new Date();
      const targetDate = new Date(now.toLocaleString('en-US', { timeZone: city.tz }));
      const diffHours = Math.round((targetDate.getTime() - localDate.getTime()) / (1000 * 60 * 60));
      const diffLabel = diffHours === 0 ? 'Same time as local' : `${Math.abs(diffHours)}h ${diffHours > 0 ? 'ahead' : 'behind'}`;

      const card = document.createElement('div');
      card.className = 'relative p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all shadow-md group';
      card.innerHTML = `
        <div class="flex items-start justify-between mb-4">
          <div>
            <h4 class="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">${city.name}</h4>
            <p class="text-xs text-slate-400 font-medium">${city.country} • <span class="text-slate-500">${city.tz}</span></p>
          </div>
          <button onclick="removeWorldCity(${index})" class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-all text-xs" title="Remove City">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>

        <div class="my-3">
          <div class="text-3xl font-mono font-extrabold text-cyan-300">${cityTimeStr.split(',')[1] || cityTimeStr}</div>
          <div class="text-xs text-slate-400 mt-1 font-medium">${cityTimeStr.split(',')[0]}</div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span class="inline-flex items-center gap-1.5">
            <i class="fa-solid fa-clock-rotate-left text-slate-500"></i> ${diffLabel}
          </span>
          <span class="px-2 py-0.5 rounded bg-slate-800 font-mono text-[11px] text-cyan-400">SYNCED</span>
        </div>
      `;
      grid.appendChild(card);
    } catch (err) {
      console.error('Error formatting timezone for', city.name, err);
    }
  });
}

function addSelectedCity() {
  const select = document.getElementById('worldCitySelect');
  const val = select.value;
  if (!val) {
    showToast('Please select a city from the list', 'warn');
    return;
  }
  const [tz, name, country] = val.split('|');
  
  // Avoid duplicates
  const exists = state.worldClock.cities.some(c => c.tz === tz);
  if (exists) {
    showToast('City is already in your world clock dashboard', 'info');
    return;
  }

  state.worldClock.cities.push({ name, country, tz });
  renderWorldClocks();
  showToast(`Added ${name} to World Clock`, 'success');
  select.value = '';
}

function removeWorldCity(index) {
  const removed = state.worldClock.cities.splice(index, 1);
  renderWorldClocks();
  if (removed.length > 0) {
    showToast(`Removed ${removed[0].name}`, 'info');
  }
}

// ---------------------------------------------------------------------
// 8. STOPWATCH MODULE
// ---------------------------------------------------------------------
function formatStopwatchTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const millis = Math.floor((ms % 1000) / 10);

  return {
    m: String(minutes).padStart(2, '0'),
    s: String(seconds).padStart(2, '0'),
    ms: String(millis).padStart(2, '0')
  };
}

function updateStopwatchDisplay() {
  const currentElapsed = state.stopwatch.elapsedTime + (state.stopwatch.isRunning ? (Date.now() - state.stopwatch.startTime) : 0);
  const formatted = formatStopwatchTime(currentElapsed);

  document.getElementById('swMinutes').innerText = formatted.m;
  document.getElementById('swSeconds').innerText = formatted.s;
  document.getElementById('swMillis').innerText = formatted.ms;
}

function startStopwatch() {
  if (state.stopwatch.isRunning) return;
  AudioService.playChime('click');

  state.stopwatch.isRunning = true;
  state.stopwatch.startTime = Date.now();
  
  state.stopwatch.timerInterval = setInterval(() => {
    updateStopwatchDisplay();
  }, 10);

  document.getElementById('swStartBtn').classList.add('hidden');
  document.getElementById('swPauseBtn').classList.remove('hidden');
  document.getElementById('swLapBtn').disabled = false;
}

function pauseStopwatch() {
  if (!state.stopwatch.isRunning) return;
  AudioService.playChime('click');

  clearInterval(state.stopwatch.timerInterval);
  state.stopwatch.elapsedTime += (Date.now() - state.stopwatch.startTime);
  state.stopwatch.isRunning = false;

  document.getElementById('swStartBtn').classList.remove('hidden');
  document.getElementById('swPauseBtn').classList.add('hidden');
  document.getElementById('swLapBtn').disabled = true;
}

function resetStopwatch() {
  AudioService.playChime('click');
  clearInterval(state.stopwatch.timerInterval);
  state.stopwatch.isRunning = false;
  state.stopwatch.elapsedTime = 0;
  state.stopwatch.startTime = 0;

  updateStopwatchDisplay();

  document.getElementById('swStartBtn').classList.remove('hidden');
  document.getElementById('swPauseBtn').classList.add('hidden');
  document.getElementById('swLapBtn').disabled = true;
}

function recordLap() {
  if (!state.stopwatch.isRunning) return;
  AudioService.playChime('click');

  const totalMs = state.stopwatch.elapsedTime + (Date.now() - state.stopwatch.startTime);
  const prevTotalMs = state.stopwatch.laps.length > 0 ? state.stopwatch.laps[0].totalMs : 0;
  const splitMs = totalMs - prevTotalMs;

  const lapData = {
    lapIndex: state.stopwatch.laps.length + 1,
    splitMs: splitMs,
    totalMs: totalMs
  };

  state.stopwatch.laps.unshift(lapData); // newest lap on top
  renderLapsTable();
}

function renderLapsTable() {
  const tbody = document.getElementById('lapsTableBody');
  const badge = document.getElementById('lapCountBadge');
  badge.innerText = state.stopwatch.laps.length;

  if (state.stopwatch.laps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500 font-sans">No lap intervals recorded yet. Press "Lap" while running to track splits.</td></tr>`;
    return;
  }

  // Identify fastest and slowest splits
  let minSplit = Infinity;
  let maxSplit = -Infinity;

  if (state.stopwatch.laps.length > 1) {
    state.stopwatch.laps.forEach(l => {
      if (l.splitMs < minSplit) minSplit = l.splitMs;
      if (l.splitMs > maxSplit) maxSplit = l.splitMs;
    });
  }

  tbody.innerHTML = state.stopwatch.laps.map(lap => {
    const splitF = formatStopwatchTime(lap.splitMs);
    const totalF = formatStopwatchTime(lap.totalMs);

    let remark = `<span class="text-slate-500">-</span>`;
    let rowClass = 'hover:bg-slate-800/40';

    if (state.stopwatch.laps.length > 1) {
      if (lap.splitMs === minSplit) {
        remark = `<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-sans font-semibold text-[10px]">FASTEST</span>`;
        rowClass = 'bg-emerald-950/20 hover:bg-emerald-900/30';
      } else if (lap.splitMs === maxSplit) {
        remark = `<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-sans font-semibold text-[10px]">SLOWEST</span>`;
        rowClass = 'bg-rose-950/20 hover:bg-rose-900/30';
      }
    }

    return `
      <tr class="${rowClass} transition-colors">
        <td class="py-2.5 px-4 font-bold text-slate-200">#${String(lap.lapIndex).padStart(2, '0')}</td>
        <td class="py-2.5 px-4 text-emerald-400">${splitF.m}:${splitF.s}.${splitF.ms}</td>
        <td class="py-2.5 px-4 text-slate-300">${totalF.m}:${totalF.s}.${totalF.ms}</td>
        <td class="py-2.5 px-4 text-right">${remark}</td>
      </tr>
    `;
  }).join('');
}

function clearLapsList() {
  state.stopwatch.laps = [];
  renderLapsTable();
  showToast('Laps cleared', 'info');
}

function exportLapsData() {
  if (state.stopwatch.laps.length === 0) {
    showToast('No laps to export', 'warn');
    return;
  }
  let csv = 'Lap,Split,Total\n';
  state.stopwatch.laps.slice().reverse().forEach(l => {
    const s = formatStopwatchTime(l.splitMs);
    const t = formatStopwatchTime(l.totalMs);
    csv += `${l.lapIndex},${s.m}:${s.s}.${s.ms},${t.m}:${t.s}.${t.ms}\n`;
  });

  // Browser download simulation
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ChronoHub_Laps_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Laps exported successfully as CSV', 'success');
}

// ---------------------------------------------------------------------
// 9. COUNTDOWN TIMER MODULE
// ---------------------------------------------------------------------
function updateTimerUI() {
  const hours = Math.floor(state.timer.remainingSeconds / 3600);
  const minutes = Math.floor((state.timer.remainingSeconds % 3600) / 60);
  const seconds = state.timer.remainingSeconds % 60;

  let displayStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (hours > 0) {
    displayStr = `${String(hours).padStart(2, '0')}:${displayStr}`;
  }

  document.getElementById('timerDisplay').innerText = displayStr;

  // Update circular SVG dashoffset (Perimeter = 2 * PI * 44 ≈ 276.46)
  const ring = document.getElementById('timerProgressRing');
  const circumference = 276.46;
  if (state.timer.totalSeconds > 0) {
    const ratio = state.timer.remainingSeconds / state.timer.totalSeconds;
    const offset = circumference * (1 - ratio);
    ring.style.strokeDashoffset = offset;
  } else {
    ring.style.strokeDashoffset = 0;
  }
}

function setTimerPreset(seconds) {
  if (state.timer.isRunning) {
    pauseTimer();
  }
  state.timer.totalSeconds = seconds;
  state.timer.remainingSeconds = seconds;
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  document.getElementById('inputTimerHours').value = h;
  document.getElementById('inputTimerMinutes').value = m;
  document.getElementById('inputTimerSeconds').value = s;

  document.getElementById('timerStatusLabel').innerText = 'Ready';
  updateTimerUI();
  showToast(`Timer configured for ${Math.round(seconds / 60)} minutes`, 'info');
}

function startTimer() {
  if (state.timer.isRunning) return;

  // Read from inputs if newly starting from custom values
  const h = parseInt(document.getElementById('inputTimerHours').value) || 0;
  const m = parseInt(document.getElementById('inputTimerMinutes').value) || 0;
  const s = parseInt(document.getElementById('inputTimerSeconds').value) || 0;
  const calcSec = (h * 3600) + (m * 60) + s;

  if (state.timer.remainingSeconds <= 0 || (state.timer.remainingSeconds === state.timer.totalSeconds && calcSec !== state.timer.totalSeconds)) {
    if (calcSec <= 0) {
      showToast('Please set a duration greater than 0 seconds', 'warn');
      return;
    }
    state.timer.totalSeconds = calcSec;
    state.timer.remainingSeconds = calcSec;
  }

  AudioService.playChime('click');
  state.timer.isRunning = true;
  document.getElementById('timerStatusLabel').innerText = 'Running';
  document.getElementById('timerStartBtn').classList.add('hidden');
  document.getElementById('timerPauseBtn').classList.remove('hidden');

  state.timer.timerInterval = setInterval(() => {
    if (state.timer.remainingSeconds > 0) {
      state.timer.remainingSeconds--;
      updateTimerUI();
    } else {
      // Timer Complete
      clearInterval(state.timer.timerInterval);
      state.timer.isRunning = false;
      document.getElementById('timerStatusLabel').innerText = 'Time Up!';
      document.getElementById('timerStartBtn').classList.remove('hidden');
      document.getElementById('timerPauseBtn').classList.add('hidden');
      
      AudioService.playChime('alarm');
      showToast('Timer Finished!', 'rose');
    }
  }, 1000);

  updateTimerUI();
}

function pauseTimer() {
  if (!state.timer.isRunning) return;
  AudioService.playChime('click');

  clearInterval(state.timer.timerInterval);
  state.timer.isRunning = false;

  document.getElementById('timerStatusLabel').innerText = 'Paused';
  document.getElementById('timerStartBtn').classList.remove('hidden');
  document.getElementById('timerPauseBtn').classList.add('hidden');
}

function resetTimer() {
  AudioService.playChime('click');
  clearInterval(state.timer.timerInterval);
  state.timer.isRunning = false;

  // Re-read current inputs
  const h = parseInt(document.getElementById('inputTimerHours').value) || 0;
  const m = parseInt(document.getElementById('inputTimerMinutes').value) || 0;
  const s = parseInt(document.getElementById('inputTimerSeconds').value) || 0;
  const customSec = (h * 3600) + (m * 60) + s;

  state.timer.totalSeconds = customSec > 0 ? customSec : 300;
  state.timer.remainingSeconds = state.timer.totalSeconds;

  document.getElementById('timerStatusLabel').innerText = 'Ready';
  document.getElementById('timerStartBtn').classList.remove('hidden');
  document.getElementById('timerPauseBtn').classList.add('hidden');

  updateTimerUI();
}

// ---------------------------------------------------------------------
// 10. CALENDAR & PERSISTENT NOTES MODULE
// ---------------------------------------------------------------------
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function changeCalendarMonth(delta) {
  state.calendar.currentMonth += delta;
  if (state.calendar.currentMonth < 0) {
    state.calendar.currentMonth = 11;
    state.calendar.currentYear--;
  } else if (state.calendar.currentMonth > 11) {
    state.calendar.currentMonth = 0;
    state.calendar.currentYear++;
  }
  renderCalendar();
}

function jumpToCalendarToday() {
  const today = new Date();
  state.calendar.currentMonth = today.getMonth();
  state.calendar.currentYear = today.getFullYear();
  selectCalendarDate(today.getFullYear(), today.getMonth(), today.getDate());
  renderCalendar();
}

function renderCalendar() {
  const year = state.calendar.currentYear;
  const month = state.calendar.currentMonth;

  document.getElementById('calendarMonthYear').innerText = `${MONTH_NAMES[month]} ${year}`;

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = document.getElementById('calendarDaysGrid');
  grid.innerHTML = '';

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Blank slots before the first day
  for (let i = 0; i < firstDayOfMonth; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'h-12 sm:h-14 rounded-xl bg-slate-900/20 border border-transparent';
    grid.appendChild(emptyCell);
  }

  // Day slots
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = isCurrentMonth && today.getDate() === day;
    const isSelected = state.calendar.selectedDateStr === dateKey;
    const hasNotes = state.calendar.notes[dateKey] && state.calendar.notes[dateKey].length > 0;

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.onclick = () => selectCalendarDate(year, month, day);

    let cellClasses = 'h-12 sm:h-14 rounded-xl flex flex-col items-center justify-center relative font-mono text-xs sm:text-sm transition-all border ';

    if (isSelected) {
      cellClasses += 'bg-indigo-600 text-white font-bold border-indigo-400 shadow-md shadow-indigo-600/30 scale-105';
    } else if (isToday) {
      cellClasses += 'bg-slate-800 text-indigo-400 font-bold border-indigo-500/60 hover:bg-slate-700';
    } else {
      cellClasses += 'bg-slate-900/50 text-slate-300 hover:bg-slate-800/80 border-slate-800';
    }

    cell.className = cellClasses;
    cell.innerHTML = `
      <span>${day}</span>
      ${hasNotes ? `<span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-400'} mt-1"></span>` : ''}
    `;

    grid.appendChild(cell);
  }

  // Default select today if none selected
  if (!state.calendar.selectedDateStr) {
    selectCalendarDate(today.getFullYear(), today.getMonth(), today.getDate());
  }
}

function selectCalendarDate(year, month, day) {
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  state.calendar.selectedDateStr = dateKey;

  const dateObj = new Date(year, month, day);
  document.getElementById('selectedDateHeader').innerText = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  document.getElementById('selectedDateBadge').innerText = dateKey;

  renderSelectedDateNotes();
  renderCalendar();
}

function renderSelectedDateNotes() {
  const container = document.getElementById('dateNotesContainer');
  const dateKey = state.calendar.selectedDateStr;
  const notes = state.calendar.notes[dateKey] || [];

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-500 text-xs">
        <i class="fa-regular fa-clipboard text-xl mb-2 text-slate-600 block"></i>
        No reminders scheduled for this date.
      </div>
    `;
    return;
  }

  container.innerHTML = notes.map((note, idx) => `
    <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-2 text-xs">
      <div class="flex items-start gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span>
        <span class="text-slate-200 leading-relaxed">${escapeHtml(note)}</span>
      </div>
      <button onclick="deleteNote(${idx})" class="text-slate-500 hover:text-rose-400 p-1 transition-colors" title="Delete Note">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `).join('');
}

function saveNoteForSelectedDate() {
  const input = document.getElementById('newNoteInput');
  const text = input.value.trim();
  if (!text) {
    showToast('Please type a reminder note before adding', 'warn');
    return;
  }

  const dateKey = state.calendar.selectedDateStr;
  if (!state.calendar.notes[dateKey]) {
    state.calendar.notes[dateKey] = [];
  }

  state.calendar.notes[dateKey].push(text);
  input.value = '';

  // Persist in localStorage
  try {
    localStorage.setItem('chronohub_calendar_notes', JSON.stringify(state.calendar.notes));
  } catch(e) {}

  AudioService.playChime('click');
  renderSelectedDateNotes();
  renderCalendar();
  showToast('Reminder saved', 'success');
}


function deleteNote(index) {
  const dateKey = state.calendar.selectedDateStr;
  if (state.calendar.notes[dateKey]) {
    state.calendar.notes[dateKey].splice(index, 1);
    if (state.calendar.notes[dateKey].length === 0) {
      delete state.calendar.notes[dateKey];
    }
    try {
      localStorage.setItem('chronohub_calendar_notes', JSON.stringify(state.calendar.notes));
    } catch(e) {}
    
    renderSelectedDateNotes();
    renderCalendar();
    showToast('Reminder deleted', 'info');
  }
}

function escapeHtml(string) {
  const div = document.createElement('div');
  div.innerText = string;
  return div.innerHTML;
}

// ---------------------------------------------------------------------
// 11. APPLICATION INITIALIZATION LIFECYCLE
// ---------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  // 1. Start live clock tickers
  updateClock();
  setInterval(updateClock, 1000);

  // 2. Periodic world clock update
  setInterval(() => {
    if (state.currentPage === 'world-clock') {
      renderWorldClocks();
    }
  }, 5000);

  // 3. Initialize default displays
  updateTimerUI();
  jumpToCalendarToday();
  renderWorldClocks();

  // 4. Default to Home view
  navTo('home');
});