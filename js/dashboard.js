const VERSION_URL = 'data/version.json';
const BASE_DATA_URL = 'data/training_load.json';
const BASE_RACES_URL = 'data/races.json';
const BASE_WEEKLY_URL = 'data/weekly_training.json';
const BASE_OVERVIEW_URL = 'data/overview.json';
const BASE_HEALTH_URL = 'data/health.json';
const BASE_GEAR_URL = 'data/gear.json';
const BASE_SYSTEM_HEALTH_URL = 'data/system_health.json';
const BASE_COMPLETED_RACES_URL = 'data/completed_races.json';
const BASE_PR_SB_URL = 'data/pr_sb.json';
const BASE_SPORT_ANALYSIS_URL = 'data/sport_analysis.json';
let dataVersion = '';
let DATA_URL = BASE_DATA_URL;
let RACES_URL = BASE_RACES_URL;
let WEEKLY_URL = BASE_WEEKLY_URL;
let OVERVIEW_URL = BASE_OVERVIEW_URL;
let HEALTH_URL = BASE_HEALTH_URL;
let GEAR_URL = BASE_GEAR_URL;
let SYSTEM_HEALTH_URL = BASE_SYSTEM_HEALTH_URL;
let COMPLETED_RACES_URL = BASE_COMPLETED_RACES_URL;
let PR_SB_URL = BASE_PR_SB_URL;
let SPORT_ANALYSIS_URL = BASE_SPORT_ANALYSIS_URL;

const SYSTEM_HEALTH_STALE_SECONDS = 43200;
const CHART_ID = 'training-load';
const STATUS_ID = 'status';
const UPDATED_ID = 'updated';
const RACES_STATE_ID = 'races-state';
const WEEKLY_TSS_ID = 'weekly-tss';
const WEEKLY_TSS_STATUS_ID = 'weekly-tss-status';
const WEEKLY_TIME_ID = 'weekly-time';
const WEEKLY_TIME_STATUS_ID = 'weekly-time-status';

let selectedRace = null;
let racesData = [];

let trainingLoadChart = null;
let weeklyTssChart = null;
let weeklyTimeChart = null;
let healthCharts = [];
let runningLoadChart = null;
let runningDistanceChart = null;
let runningLongChart = null;

let fullTrainingLoad = null;
let fullWeekly = null;
let fullHealth = null;
let dailyRange = null;
let weeklyRange = null;
let healthRange = null;
let overviewDoc = null;
let overviewHealthDoc = null;
let gearData = [];
let gearFilter = 'active';
let fullSportAnalysis = null;
let runningRange = null;
let activeSport = 'running';

let completedRacesData = [];
let racingSubtab = 'upcoming';
let historyYear = null;
let historyCategory = 'all';
let historySort = 'newest';
let prSbData = [];
let prSbType = 'PR';
let prSbSeason = String(new Date().getFullYear());

const PR_SB_EVENT_ORDER = [
  '1 Mile', '5K', '4 Mile', '5 Mile', '8K', '10K', '10 Mile',
  'Half Marathon', 'Marathon', 'Sprint', 'Olympic', '70.3', '140.6',
];

const TAB_PANELS = ['overview', 'training', 'sports', 'racing', 'health', 'gear'];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CHICAGO_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
});

function cssVar(name) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || undefined;
}

const palette = {
  get text() { return cssVar('--text'); },
  get muted() { return cssVar('--muted'); },
  get line() { return cssVar('--accent-line'); },
  get lineBg() { return cssVar('--accent-line-bg'); },
  get bar() { return cssVar('--accent-bar'); },
  get barBorder() { return cssVar('--accent-bar-border'); },
  get atl() { return cssVar('--atl'); },
  get atlBg() { return cssVar('--atl-bg'); },
  get swimBg() { return cssVar('--sport-swim-bg'); },
  get swimBd() { return cssVar('--sport-swim-bd'); },
  get bikeBg() { return cssVar('--sport-bike-bg'); },
  get bikeBd() { return cssVar('--sport-bike-bd'); },
  get runBg() { return cssVar('--sport-run-bg'); },
  get runBd() { return cssVar('--sport-run-bd'); },
  get otherBg() { return cssVar('--sport-other-bg'); },
  get otherBd() { return cssVar('--sport-other-bd'); },
  get panelBorder() { return cssVar('--panel-border'); },
  get grid() { return cssVar('--grid'); },
};

function splitDate(isoDate) {
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)
      || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }
  return { y, m, d };
}

function fmtAxis(dateStr) {
  const p = splitDate(dateStr);
  if (!p) return dateStr;
  return `${MONTHS_SHORT[p.m - 1]} ${p.d}`;
}

function fmtFullDate(dateStr) {
  const p = splitDate(dateStr);
  if (!p) return dateStr;
  return `${MONTHS_LONG[p.m - 1]} ${p.d}, ${p.y}`;
}

function fmtMediumDate(dateStr) {
  const p = splitDate(dateStr);
  if (!p) return dateStr;
  return `${MONTHS_SHORT[p.m - 1]} ${p.d}, ${p.y}`;
}

function setStatus(message, kind = 'info') {
  const box = document.getElementById(STATUS_ID);
  if (!box) return;
  box.textContent = message || '';
  box.className = `status ${kind}`;
  box.style.display = message ? 'flex' : 'none';
}

function setLoading(loading) {
  const box = document.getElementById(STATUS_ID);
  if (!box) return;
  box.className = `status ${loading ? 'loading' : 'placeholder'}`;
  box.innerHTML = loading
    ? `<span class="loader"></span>Loading training load…`
    : '';
  box.style.display = loading ? 'flex' : 'none';
}

function numOrNU(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const DEFAULT_VISIBLE_DAYS = 90;
const DEFAULT_VISIBLE_WEEKS = 52;

// --- date helpers: treat YYYY-MM-DD as calendar dates, no timezone shifts ---

function dateToUtcMs(dateStr) {
  const p = splitDate(dateStr);
  if (!p) return NaN;
  return Date.UTC(p.y, p.m - 1, p.d);
}

function msToIsoDate(ms) {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function clampDate(dateStr, minDate, maxDate) {
  if (!dateStr) return dateStr;
  if (minDate && dateStr < minDate) return minDate;
  if (maxDate && dateStr > maxDate) return maxDate;
  return dateStr;
}

function filterDailyRange(rows, start, end) {
  if (!Array.isArray(rows) || rows.length === 0 || (!start && !end)) return rows;
  return rows.filter((r) => {
    if (!r || r.date == null) return false;
    const d = String(r.date);
    return (!start || d >= start) && (!end || d <= end);
  });
}

function filterWeeklyOverlap(rows, start, end) {
  if (!Array.isArray(rows) || rows.length === 0 || !start || !end) return rows;
  return rows.filter((r) => {
    if (!r || r.week_start == null || r.week_end == null) return false;
    return String(r.week_end) >= start && String(r.week_start) <= end;
  });
}

function dailyDefaultRange(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (first == null || last == null
      || first.date == null || last.date == null) return null;
  const endStr = String(last.date);
  const endMs = dateToUtcMs(endStr);
  if (!Number.isFinite(endMs)) return null;
  const startStr = msToIsoDate(endMs - (DEFAULT_VISIBLE_DAYS - 1) * 86400000);
  const firstDate = String(first.date);
  const startClamped = startStr < firstDate ? firstDate : startStr;
  return { start: startClamped, end: endStr };
}

function weeklyDefaultRange(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (first == null || last == null
      || first.week_start == null || last.week_start == null
      || last.week_end == null) return null;
  const endStr = String(last.week_end);
  const lastStartMs = dateToUtcMs(String(last.week_start));
  if (!Number.isFinite(lastStartMs)) return null;
  const startStr = msToIsoDate(lastStartMs - (DEFAULT_VISIBLE_WEEKS - 1) * 7 * 86400000);
  const firstStart = String(first.week_start);
  const startClamped = startStr < firstStart ? firstStart : startStr;
  return { start: startClamped, end: endStr };
}

function buildChart(rows) {
  const canvas = document.getElementById(CHART_ID);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  rows = Array.isArray(rows) ? rows : [];

  const labels = rows.map((row) => (row && row.date != null ? String(row.date) : ''));
  const tss = rows.map((row) => numOrNU(row && row.tss));
  const swim = rows.map((row) => numOrNU(row && row.swim_tss));
  const bike = rows.map((row) => numOrNU(row && row.bike_tss));
  const run = rows.map((row) => numOrNU(row && row.run_tss));
  const other = rows.map((row) => numOrNU(row && row.other_tss));
  const ctl = rows.map((row) => numOrNU(row && row.ctl));
  const atl = rows.map((row) => numOrNU(row && row.atl));

  const commonLine = {
    type: 'line',
    tension: 0,
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4,
    fill: false,
  };

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Swim',
          data: swim,
          yAxisID: 'yTss',
          stack: 'tss',
          backgroundColor: palette.swimBg,
          borderColor: palette.swimBd,
          borderWidth: 0,
          barPercentage: 1,
        },
        {
          type: 'bar',
          label: 'Bike',
          data: bike,
          yAxisID: 'yTss',
          stack: 'tss',
          backgroundColor: palette.bikeBg,
          borderColor: palette.bikeBd,
          borderWidth: 0,
          barPercentage: 1,
        },
        {
          type: 'bar',
          label: 'Run',
          data: run,
          yAxisID: 'yTss',
          stack: 'tss',
          backgroundColor: palette.runBg,
          borderColor: palette.runBd,
          borderWidth: 0,
          barPercentage: 1,
        },
        {
          type: 'bar',
          label: 'Other',
          data: other,
          yAxisID: 'yTss',
          stack: 'tss',
          backgroundColor: palette.otherBg,
          borderColor: palette.otherBd,
          borderWidth: 0,
          barPercentage: 1,
        },
        {
          type: 'line',
          label: 'CTL',
          data: ctl,
          yAxisID: 'yCtl',
          borderColor: palette.line,
          backgroundColor: palette.lineBg,
          ...commonLine,
        },
        {
          type: 'line',
          label: 'ATL',
          data: atl,
          yAxisID: 'yCtl',
          borderColor: palette.atl,
          backgroundColor: palette.atlBg,
          ...commonLine,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: palette.text,
            font: { size: 12 },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 18,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(18, 19, 22, 0.96)',
          titleColor: '#ffffff',
          bodyColor: '#e0e0e0',
          titleFont: { size: 13, weight: 500 },
          bodyFont: { size: 12 },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          callbacks: {
            title: (tooltipItems) => {
              const item = tooltipItems && tooltipItems[0];
              if (!item) return '';
              const label = labels[item.index];
              return fmtFullDate(label);
            },
            label: (ctx) => {
              const value = ctx.parsed.y;
              if (value === null || value === undefined) {
                return `${ctx.dataset.label}: —`;
              }
              return `${ctx.dataset.label}: ${Number(value).toFixed(1)}`;
            },
            afterTitle: (tooltipItems) => {
              const item = tooltipItems && tooltipItems[0];
              if (!item) return '';
              const total = tss[item.dataIndex];
              if (total === null || total === undefined) return '';
              return `Total TSS: ${Number(total).toFixed(1)}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          border: { color: palette.panelBorder },
          ticks: {
            maxTicksLimit: 12,
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
            color: palette.muted,
            font: { size: 11 },
            callback: function (value) {
              return fmtAxis(this.getLabelForValue(value));
            },
          },
          grid: {
            color: palette.grid,
            drawBorder: false,
          },
        },
        yCtl: {
          type: 'linear',
          position: 'left',
          beginAtZero: false,
          ticks: {
            maxTicksLimit: 6,
            color: palette.muted,
            font: { size: 11 },
            callback: (value) => Number(value).toFixed(0),
          },
          grid: {
            color: palette.grid,
            drawBorder: false,
          },
          title: {
            display: false,
            text: 'CTL / ATL',
            color: palette.muted,
            font: { size: 10 },
            align: 'end',
          },
        },
        yTss: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            display: false,
          },
          title: {
            display: false,
          },
        },
      },
    },
    plugins: [
      {
        id: 'tss-axis-label',
        afterDraw: (chart) => {
          const scale = chart.scales && chart.scales.yCtl;
          if (!scale || !scale.ticks || scale.ticks.length === 0) return;
          const ctx = chart.ctx;
          const fontSize = 10;
          const y = scale.top - fontSize;
          ctx.save();
          ctx.fillStyle = palette.muted;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText('TSS', scale.left + 2, y);
          ctx.restore();
        },
      },
    ],
  });
}

function fmtWeekLabel(weekStart) {
  const p = splitDate(weekStart);
  if (!p) return weekStart;
  return `${MONTHS_SHORT[p.m - 1]} ${p.d}, ${p.y}`;
}

function fmtHMSShort(sec) {
  if (sec === null || sec === undefined || Number(sec) === 0) return '0:00';
  const total = Number(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function fmtWeeklyTooltipBody(rows, weekIndex) {
  const row = rows[weekIndex];
  if (!row) return [];
  const no = (v) => Number(v || 0);
  const totalTss = no(row.total_tss).toFixed(1);
  const totalSecs = no(row.total_moving_seconds);
  const totalH = Math.floor(totalSecs / 3600);
  const totalM = Math.floor((totalSecs % 3600) / 60);
  const t = (v) => no(v).toFixed(1);
  const yd = (v) => no(v).toLocaleString('en-US');
  const mi = (v) => no(v).toFixed(1);
  const tm = (v) => fmtHMSShort(v);
  return [
    `Total TSS: ${totalTss}`,
    `Total time: ${totalH}:${String(totalM).padStart(2, '0')}`,
    '',
    `Swim: ${t(row.swim_tss)} TSS \u00b7 ${tm(row.swim_moving_seconds)} \u00b7 ${yd(row.swim_distance_yards)} yd`,
    `Bike: ${t(row.bike_tss)} TSS \u00b7 ${tm(row.bike_moving_seconds)} \u00b7 ${mi(row.bike_distance_miles)} mi`,
    `Run: ${t(row.run_tss)} TSS \u00b7 ${tm(row.run_moving_seconds)} \u00b7 ${mi(row.run_distance_miles)} mi`,
    `Other: ${t(row.other_tss)} TSS \u00b7 ${tm(row.other_moving_seconds)}`,
  ];
}

function buildWeeklyTssChart(rows) {
  const canvas = document.getElementById(WEEKLY_TSS_ID);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  rows = Array.isArray(rows) ? rows : [];

  const labels = rows.map((row) =>
    row && row.week_start != null ? String(row.week_start) : '',
  );
  const total = rows.map((row) => numOrNU(row && row.total_tss));
  const swim = rows.map((row) => numOrNU(row && row.swim_tss));
  const bike = rows.map((row) => numOrNU(row && row.bike_tss));
  const run = rows.map((row) => numOrNU(row && row.run_tss));
  const other = rows.map((row) => numOrNU(row && row.other_tss));

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          yAxisID: 'yTss',
          label: 'Swim',
          data: swim,
          stack: 'tss',
          backgroundColor: palette.swimBg,
          borderColor: palette.swimBd,
          borderWidth: 0,
          barPercentage: 0.85,
        },
        {
          type: 'bar',
          yAxisID: 'yTss',
          label: 'Bike',
          data: bike,
          stack: 'tss',
          backgroundColor: palette.bikeBg,
          borderColor: palette.bikeBd,
          borderWidth: 0,
          barPercentage: 0.85,
        },
        {
          type: 'bar',
          yAxisID: 'yTss',
          label: 'Run',
          data: run,
          stack: 'tss',
          backgroundColor: palette.runBg,
          borderColor: palette.runBd,
          borderWidth: 0,
          barPercentage: 0.85,
        },
        {
          type: 'bar',
          yAxisID: 'yTss',
          label: 'Other',
          data: other,
          stack: 'tss',
          backgroundColor: palette.otherBg,
          borderColor: palette.otherBd,
          borderWidth: 0,
          barPercentage: 0.85,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: palette.text,
            font: { size: 12 },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 18,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(18, 19, 22, 0.96)',
          titleColor: '#ffffff',
          bodyColor: '#e0e0e0',
          titleFont: { size: 13, weight: 500 },
          bodyFont: { size: 12 },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          callbacks: {
            title: (tooltipItems) => {
              const item = tooltipItems && tooltipItems[0];
              if (!item) return '';
              const label = labels[item.dataIndex];
              return `Week of ${fmtWeekLabel(label)}`;
            },
            label: () => null,
            afterTitle: (tooltipItems) => {
              const item = tooltipItems && tooltipItems[0];
              if (!item) return '';
              return fmtWeeklyTooltipBody(rows, item.dataIndex);
            },
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          border: { color: palette.panelBorder },
          grid: {
            color: palette.grid,
            drawBorder: false,
          },
          ticks: {
            maxTicksLimit: 12,
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
            color: palette.muted,
            font: { size: 11 },
            callback: function (value) {
              const label = this.getLabelForValue(value);
              const p = splitDate(label);
              if (!p) return label;
              return `${MONTHS_SHORT[p.m - 1]} ${p.d}`;
            },
          },
        },
        yTss: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          grid: {
            color: palette.grid,
            drawBorder: false,
          },
          ticks: {
            maxTicksLimit: 6,
            color: palette.muted,
            font: { size: 11 },
            callback: (value) => Number(value).toFixed(0),
          },
        },
      },
    },
  });
}

function buildWeeklyTimeChart(rows) {
  const canvas = document.getElementById(WEEKLY_TIME_ID);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  rows = Array.isArray(rows) ? rows : [];

  const labels = rows.map((row) =>
    row && row.week_start != null ? String(row.week_start) : '',
  );
  const swim = rows.map((row) => numOrNU(row && row.swim_moving_seconds));
  const bike = rows.map((row) => numOrNU(row && row.bike_moving_seconds));
  const run = rows.map((row) => numOrNU(row && row.run_moving_seconds));
  const other = rows.map((row) => numOrNU(row && row.other_moving_seconds));

  function fmtSecondsToHMS(sec) {
    if (sec === null || sec === undefined) return '—';
    const total = Number(sec);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}h ${m}m`;
  }

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          yAxisID: 'yTime',
          label: 'Swim',
          data: swim,
          stack: 'time',
          backgroundColor: palette.swimBg,
          borderColor: palette.swimBd,
          borderWidth: 0,
          barPercentage: 0.85,
        },
        {
          type: 'bar',
          yAxisID: 'yTime',
          label: 'Bike',
          data: bike,
          stack: 'time',
          backgroundColor: palette.bikeBg,
          borderColor: palette.bikeBd,
          borderWidth: 0,
          barPercentage: 0.85,
        },
        {
          type: 'bar',
          yAxisID: 'yTime',
          label: 'Run',
          data: run,
          stack: 'time',
          backgroundColor: palette.runBg,
          borderColor: palette.runBd,
          borderWidth: 0,
          barPercentage: 0.85,
        },
        {
          type: 'bar',
          yAxisID: 'yTime',
          label: 'Other',
          data: other,
          stack: 'time',
          backgroundColor: palette.otherBg,
          borderColor: palette.otherBd,
          borderWidth: 0,
          barPercentage: 0.85,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: palette.text,
            font: { size: 12 },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 18,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(18, 19, 22, 0.96)',
          titleColor: '#ffffff',
          bodyColor: '#e0e0e0',
          titleFont: { size: 13, weight: 500 },
          bodyFont: { size: 12 },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          callbacks: {
            title: (tooltipItems) => {
              const item = tooltipItems && tooltipItems[0];
              if (!item) return '';
              const label = labels[item.dataIndex];
              return `Week of ${fmtWeekLabel(label)}`;
            },
            label: () => null,
            afterTitle: (tooltipItems) => {
              const item = tooltipItems && tooltipItems[0];
              if (!item) return '';
              return fmtWeeklyTooltipBody(rows, item.dataIndex);
            },
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          border: { color: palette.panelBorder },
          grid: {
            color: palette.grid,
            drawBorder: false,
          },
          ticks: {
            maxTicksLimit: 12,
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
            color: palette.muted,
            font: { size: 11 },
            callback: function (value) {
              const label = this.getLabelForValue(value);
              const p = splitDate(label);
              if (!p) return label;
              return `${MONTHS_SHORT[p.m - 1]} ${p.d}`;
            },
          },
        },
        yTime: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          grid: {
            color: palette.grid,
            drawBorder: false,
          },
          ticks: {
            maxTicksLimit: 6,
            color: palette.muted,
            font: { size: 11 },
            callback: (value) => fmtSecondsToHMS(value),
          },
        },
      },
    },
  });
}

function setUpdatedTimestamp(generatedAt) {
  const el = document.getElementById(UPDATED_ID);
  if (!el) return;
  const datePart = generatedAt && typeof generatedAt === 'string'
    ? generatedAt.slice(0, 10)
    : '';
  if (datePart) {
    const label = fmtMediumDate(datePart);
    el.textContent = 'Updated ' + label;
    el.setAttribute('aria-label', 'Refresh dashboard, last updated ' + label);
  } else {
    el.textContent = '';
    el.setAttribute('aria-label', 'Refresh dashboard');
  }
}

function fmtStatus(status) {
  if (status == null) return null;
  const s = String(status).trim();
  if (s === '') return null;
  const map = {
    registered: 'Registered',
    planning: 'Planning',
    not_registered: 'Not registered',
  };
  return map[s] || s;
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = String(value);
  return span.innerHTML;
}

function raceNameLink(label) {
  return String(label);
}

function externalLink(url, label) {
  if (!url) return label;
  return `<a href="${String(url)}" target="_blank" rel="noopener noreferrer" class="race-event-btn">${label} <span class="ext-icon" aria-hidden="true">↗</span></a>`;
}

function renderRaces(json) {
  const container = document.getElementById('races-container');
  if (!container) return;

  const rows = Array.isArray(json && json.data) ? json.data : [];
  racesData = rows;

  if (rows.length === 0) {
    container.innerHTML = '<p class="races-empty">No upcoming races.</p>';
    return;
  }

  if (selectedRace !== null) {
    renderRaceDetail(container, racesData[selectedRace]);
    return;
  }

  const state = document.getElementById(RACES_STATE_ID);
  if (state) state.textContent = 'list';

  const isDesktop = window.matchMedia('(min-width: 640px)').matches;

  if (isDesktop) {
    renderRacesTable(container, rows);
  } else {
    renderRacesCards(container, rows);
  }
}

function renderRacesTable(container, rows) {
  let html = '<table class="races-table"><thead><tr>';
  const headers = ['Date', 'Race', 'Location', 'Type', 'Status', 'When'];
  html += headers.map((h) => `<th>${h}</th>`).join('');
  html += '</tr></thead><tbody>';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const dateStr = r && r.date != null ? fmtMediumDate(String(r.date)) : '—';
    const name = r && r.name != null ? String(r.name) : '—';
    const location = r && r.location != null ? String(r.location) : null;
    const raceType = r && r.race_type != null ? String(r.race_type) : null;
    const status = fmtStatus(r && r.registration_status);
    const when = r && r.when != null ? String(r.when) : null;
    const selected = selectedRace === i;
    const rowClass = selected ? ' race-row-selected' : '';
    html += `<tr class="race-row${rowClass}" data-race-index="${i}" tabindex="0" aria-label="View details for ${name}">`;
    html += `<td class="races-col-date">${dateStr}</td>`;
    html += `<td class="races-col-name">${raceNameLink(name)}</td>`;
    html += `<td class="races-col-location">${location || '—'}</td>`;
    html += `<td class="races-col-type">${raceType || '—'}</td>`;
    html += `<td class="races-col-status">${status ? `<span class="status-badge">${status}</span>` : '—'}</td>`;
    html += `<td class="races-col-when">${when || '—'}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('.race-row').forEach((rowEl) => {
    rowEl.addEventListener('click', () => {
      const idx = Number(rowEl.getAttribute('data-race-index'));
      selectRace(idx);
    });
    rowEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const idx = Number(rowEl.getAttribute('data-race-index'));
        selectRace(idx);
      }
    });
  });
}

function renderRacesCards(container, rows) {
  let html = '<div class="races-cards">';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const dateStr = r && r.date != null ? fmtMediumDate(String(r.date)) : '';
    const name = r && r.name != null ? String(r.name) : '';
    const location = r && r.location != null ? String(r.location) : null;
    const raceType = r && r.race_type != null ? String(r.race_type) : null;
    const status = fmtStatus(r && r.registration_status);
    const when = r && r.when != null ? String(r.when) : null;
    const subParts = [];
    if (location) subParts.push(location);
    if (raceType) subParts.push(raceType);
    const subText = subParts.join(' · ');
    html += `<div class="race-card" data-race-index="${i}" tabindex="0" aria-label="View details for ${name}">`;
    html += `<div class="race-card-date">${dateStr}</div>`;
    html += `<div class="race-card-when">${when || ''}</div>`;
    html += `<div class="race-card-name">${raceNameLink(name)}</div>`;
    if (subText) html += `<div class="race-card-sub">${subText}</div>`;
    if (status) html += `<span class="status-badge">${status}</span>`;
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.race-card').forEach((cardEl) => {
    cardEl.addEventListener('click', () => {
      const idx = Number(cardEl.getAttribute('data-race-index'));
      selectRace(idx);
    });
    cardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const idx = Number(cardEl.getAttribute('data-race-index'));
        selectRace(idx);
      }
    });
  });
}

function selectRace(index) {
  if (!racesData[index]) return;
  selectedRace = index;
  const container = document.getElementById('races-container');
  if (container) {
    renderRaceDetail(container, racesData[index]);
  }
  const state = document.getElementById(RACES_STATE_ID);
  if (state) state.textContent = 'detail';
}

function clearSelectedRace() {
  selectedRace = null;
  const state = document.getElementById(RACES_STATE_ID);
  if (state) state.textContent = 'list';
  const container = document.getElementById('races-container');
  if (!container) return;

  if (racesData.length === 0) {
    container.innerHTML = '<p class="races-empty">No upcoming races.</p>';
    return;
  }

  const isDesktop = window.matchMedia('(min-width: 640px)').matches;
  if (isDesktop) {
    renderRacesTable(container, racesData);
  } else {
    renderRacesCards(container, racesData);
  }
}

function renderRaceDetail(container, race) {
  const dateStr = race && race.date != null
    ? fmtFullDate(String(race.date))
    : '';
  const name = race && race.name != null ? String(race.name) : '';
  const when = race && race.when != null ? String(race.when) : '';
  const location = race && race.location != null
    ? String(race.location) : null;
  const raceType = race && race.race_type != null
    ? String(race.race_type) : null;
  const status = fmtStatus(race && race.registration_status);
  const series = race && race.series != null
    ? String(race.series) : null;
  const priority = race && race.priority != null
    ? String(race.priority) : null;
  const notes = race && race.notes != null
    ? String(race.notes) : null;
  const url = race && race.url;

  let html = '<div class="races-detail">';
  html += `<button type="button" id="race-back" class="race-back" aria-label="Back to races list">`;
  html += '<span class="race-back-icon" aria-hidden="true">←</span>';
  html += ' Back to races';
  html += '</button>';
  html += `<h3 class="races-detail-name">${raceNameLink(name)}</h3>`;
  if (dateStr) html += `<p class="races-detail-date">${dateStr}</p>`;
  if (when) html += `<p class="races-detail-when">${when}</p>`;
  if (location) html += `<div class="races-detail-row"><span class="races-detail-label">Location</span><span class="races-detail-value">${location}</span></div>`;
  if (raceType) html += `<div class="races-detail-row"><span class="races-detail-label">Type</span><span class="races-detail-value">${raceType}</span></div>`;
  if (status) html += `<div class="races-detail-row"><span class="races-detail-label">Status</span><span class="races-detail-value status-value">${status}</span></div>`;
  if (series) html += `<div class="races-detail-row"><span class="races-detail-label">Series</span><span class="races-detail-value">${series}</span></div>`;
  if (priority) html += `<div class="races-detail-row"><span class="races-detail-label">Priority</span><span class="races-detail-value priority-badge">${priority}</span></div>`;
  if (notes) {
    html += `<div class="races-detail-row"><span class="races-detail-label">Notes</span><div class="races-detail-notes" id="race-notes"></div></div>`;
  }
  if (url) {
    html += `<div class="races-detail-actions">`;
    html += externalLink(String(url), 'Event website');
    html += `</div>`;
  }
  html += '</div>';
  container.innerHTML = html;

  // Notes must NEVER go through innerHTML — render via textContent for XSS safety.
  if (notes) {
    const notesEl = container.querySelector('#race-notes');
    if (notesEl) {
      notesEl.textContent = notes;
    }
  }

  const backBtn = container.querySelector('#race-back');
  if (backBtn) {
    backBtn.addEventListener('click', clearSelectedRace);
  }
  backBtn.focus();
}

async function loadRaces() {
  const wrap = document.getElementById('races-wrap');
  if (wrap) {
    wrap.classList.add('is-loading');
  }

  let response;
  try {
    response = await fetch(RACES_URL, { cache: 'no-store' });
  } catch (err) {
    console.error('[dashboard] network error fetching races:', err);
    const container = document.getElementById('races-container');
    if (container) {
      container.innerHTML = '<p class="races-error" role="status">Upcoming race data unavailable.</p>';
    }
    if (wrap) wrap.classList.remove('is-loading');
    return;
  }

  if (!response.ok) {
    console.error(
      `[dashboard] HTTP ${response.status} ${response.statusText} for ${RACES_URL}`,
    );
    const container = document.getElementById('races-container');
    if (container) {
      container.innerHTML = '<p class="races-error" role="status">Upcoming race data unavailable.</p>';
    }
    if (wrap) wrap.classList.remove('is-loading');
    return;
  }

  let json;
  try {
    json = await response.json();
  } catch (err) {
    console.error('[dashboard] failed to parse races.json:', err);
    const container = document.getElementById('races-container');
    if (container) {
      container.innerHTML = '<p class="races-error" role="status">Upcoming race data unavailable.</p>';
    }
    if (wrap) wrap.classList.remove('is-loading');
    return;
  }

  if (!json || !Array.isArray(json.data)) {
    const container = document.getElementById('races-container');
    if (container) {
      container.innerHTML = '<p class="races-error" role="status">Upcoming race data unavailable.</p>';
    }
    if (wrap) wrap.classList.remove('is-loading');
    return;
  }

  if (wrap) {
    wrap.classList.remove('is-loading');
  }

  renderRaces(json);
}

// ---------------------------------------------------------------------------
// Race History sub-view under the Racing tab.
// Consumes data/completed_races.json (read-only export). All filtering,
// sorting, and formatting happens client-side -- no DB or backend logic.
// Year and category controls are generated dynamically from the exported
// data so a widened export window (e.g. older years) needs no front-end
// change.
// ---------------------------------------------------------------------------

const COMPLETED_RACES_AMBIGUOUS_CATEGORY = '5 Mile / 8K';
const COMPLETED_RACES_5MILE_CATEGORY = '5 Mile';
const COMPLETED_RACES_8K_CATEGORY = '8K';

const COMPLETED_RACE_SORTS = [
  { value: 'newest',  label: 'Newest first'  },
  { value: 'oldest',  label: 'Oldest first'  },
  { value: 'fastest', label: 'Fastest first' },
  { value: 'slowest', label: 'Slowest first' },
];

function normalizeCompletedRace(record) {
  if (!record || typeof record !== 'object') return null;
  const date = record.date != null ? String(record.date) : null;
  const name = record.activity_name != null ? String(record.activity_name).trim() : '';
  let category = record.category != null ? String(record.category).trim() : null;
  if (category === '') {
    category = null;
  } else if (category === COMPLETED_RACES_AMBIGUOUS_CATEGORY) {
    category = COMPLETED_RACES_5MILE_CATEGORY;
  }
  const duration = typeof record.duration_seconds === 'number'
    ? record.duration_seconds
    : null;
  return { date: date, name: name, category: category, duration: duration };
}

function fmtRaceTime(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '—';
  const total = Number(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h < 1) {
    return m + ':' + String(s).padStart(2, '0');
  }
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function collectHistoryYears(records) {
  const set = new Set();
  records.forEach((r) => {
    if (r && r.date) {
      const y = String(r.date).slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(Number(y));
    }
  });
  return Array.from(set).sort((a, b) => b - a);
}

function collectHistoryCategoryOptions(records) {
  const options = [{ value: 'all', label: 'All' }];
  let hasUnclassified = false;
  const set = new Set();
  set.add(COMPLETED_RACES_8K_CATEGORY);
  records.forEach((r) => {
    if (!r) return;
    if (r.category === null) {
      hasUnclassified = true;
    } else {
      set.add(r.category);
    }
  });
  if (hasUnclassified) {
    options.push({ value: 'unclassified', label: 'Unclassified' });
  }
  Array.from(set).sort().forEach((c) => options.push({ value: c, label: c }));
  return options;
}

function historyRaceSort(a, b, sort) {
  let cmp = 0;
  if (sort === 'newest' || sort === 'oldest') {
    if (a.date && b.date) cmp = String(a.date).localeCompare(String(b.date));
    else if (a.date) cmp = -1;
    else if (b.date) cmp = 1;
    if (sort === 'newest') cmp = -cmp;
  } else {
    const ad = a.duration != null ? a.duration : Infinity;
    const bd = b.duration != null ? b.duration : Infinity;
    cmp = ad - bd;
    if (sort === 'slowest') cmp = -cmp;
  }
  if (cmp === 0 && a.date && b.date) cmp = String(a.date).localeCompare(String(b.date));
  if (cmp === 0) cmp = String(a.name || '').localeCompare(b.name || '');
  return cmp;
}

function filterAndSortHistory() {
  const records = completedRacesData
    .map(normalizeCompletedRace)
    .filter((r) => r !== null);
  const year = historyYear;
  const category = historyCategory;
  return records
    .filter((r) => {
      if (year !== 'all' && year != null) {
        if (!r.date || String(r.date).slice(0, 4) !== String(year)) return false;
      }
      if (category !== 'all' && category != null) {
        if (category === 'unclassified') {
          if (r.category !== null) return false;
        } else if (r.category !== category) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => historyRaceSort(a, b, historySort));
}

function buildRaceHistoryControls() {
  if (historyYear == null) {
    const years = collectHistoryYears(completedRacesData);
    const currentYear = new Date().getFullYear();
    historyYear = years.includes(currentYear) ? currentYear : 'all';
  }

  const yearContainer = document.querySelector('#racing-sub-history .race-history-years');
  if (yearContainer) {
    const years = collectHistoryYears(completedRacesData);
    let html = '<button type="button" class="year-btn" data-year="all">All</button>';
    years.forEach((y) => {
      html += '<button type="button" class="year-btn" data-year="' + y + '">' + y + '</button>';
    });
    yearContainer.innerHTML = html;
    yearContainer.querySelectorAll('.year-btn').forEach((btn) => {
      if (String(btn.getAttribute('data-year')) === String(historyYear)) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', function () {
        historyYear = btn.getAttribute('data-year') === 'all'
          ? 'all'
          : Number(btn.getAttribute('data-year'));
        yearContainer.querySelectorAll('.year-btn').forEach((b) => {
          b.classList.toggle('active', String(b.getAttribute('data-year')) === String(historyYear));
        });
        renderRaceHistoryTable();
      });
    });
  }

  const catSelect = document.getElementById('history-category');
  if (catSelect) {
    const options = collectHistoryCategoryOptions(
      completedRacesData.map(normalizeCompletedRace).filter((r) => r !== null)
    );
    catSelect.innerHTML = options
      .map((o) => '<option value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</option>')
      .join('');
    catSelect.value = historyCategory;
    catSelect.onchange = function () {
      historyCategory = catSelect.value;
      renderRaceHistoryTable();
    };
  }

  const sortSelect = document.getElementById('history-sort');
  if (sortSelect) {
    sortSelect.innerHTML = COMPLETED_RACE_SORTS
      .map((s) => '<option value="' + escapeHtml(s.value) + '">' + escapeHtml(s.label) + '</option>')
      .join('');
    sortSelect.value = historySort;
    sortSelect.onchange = function () {
      historySort = sortSelect.value;
      renderRaceHistoryTable();
    };
  }
}

function renderRaceHistoryTable() {
  const tbody = document.querySelector('#race-history-table tbody');
  const empty = document.getElementById('race-history-empty');
  if (!tbody) return;

  const rows = filterAndSortHistory();
  if (rows.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  let html = '';
  rows.forEach((r) => {
    const dateCell = r.date ? fmtMediumDate(r.date) : '—';
    const nameCell = r.name ? escapeHtml(r.name) : '—';
    const catCell = r.category === null ? 'Unclassified' : escapeHtml(r.category);
    const timeCell = r.duration != null ? fmtRaceTime(r.duration) : '—';
    html += '<tr>'
      + '<td class="races-col-date">' + dateCell + '</td>'
      + '<td class="races-col-name">' + nameCell + '</td>'
      + '<td class="races-col-type">' + catCell + '</td>'
      + '<td class="race-history-col-time">' + timeCell + '</td>'
      + '</tr>';
  });
  tbody.innerHTML = html;
}

function renderRaceHistory() {
  buildRaceHistoryControls();
  renderRaceHistoryTable();
}

function switchRacingSubtab(tab) {
  racingSubtab = tab;
  const isHistory = tab === 'history';
  document.querySelectorAll('.racing-subview').forEach((view) => {
    view.classList.toggle('active', view.getAttribute('id') === 'racing-sub-' + tab);
  });
  document.querySelectorAll('.subtab-link').forEach((btn) => {
    const selected = btn.getAttribute('data-subtab') === tab;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-selected', String(selected));
    btn.setAttribute('tabindex', selected ? '0' : '-1');
  });
  if (isHistory) {
    renderRaceHistory();
  } else if (tab === 'prsb') {
    renderPrSb();
  }
}

function normalizePrSb(record) {
  if (!record || typeof record !== 'object') return null;
  const type = record.type === 'PR' || record.type === 'SB' ? record.type : null;
  if (!type || !record.sport || !record.event || !record.result || !record.date) return null;
  return {
    sport: String(record.sport), event: String(record.event), result: String(record.result),
    date: String(record.date), eventName: record.event_name ? String(record.event_name) : '',
    type: type, seasonYear: record.season_year == null ? null : Number(record.season_year),
  };
}

function buildPrSbSeasonOptions(records) {
  const current = String(new Date().getFullYear());
  const years = Array.from(new Set(records
    .filter((record) => record.type === 'SB' && Number.isInteger(record.seasonYear))
    .map((record) => record.seasonYear))).sort((a, b) => b - a);
  const select = document.getElementById('prsb-season');
  if (!select) return;
  let html = '<option value="' + current + '">Current season (' + current + ')</option>';
  years.filter((year) => String(year) !== current).forEach((year) => {
    html += '<option value="' + year + '">' + year + '</option>';
  });
  select.innerHTML = html;
  if (!Array.from(select.options).some((option) => option.value === prSbSeason)) {
    prSbSeason = current;
  }
  select.value = prSbSeason;
}

function updatePrSbControls() {
  const seasonControl = document.getElementById('prsb-season-control');
  if (seasonControl) seasonControl.hidden = prSbType !== 'SB';
}

function comparePrSbEvents(left, right) {
  const leftIndex = PR_SB_EVENT_ORDER.indexOf(left.event);
  const rightIndex = PR_SB_EVENT_ORDER.indexOf(right.event);
  return (leftIndex === -1 ? PR_SB_EVENT_ORDER.length : leftIndex)
    - (rightIndex === -1 ? PR_SB_EVENT_ORDER.length : rightIndex);
}

function renderPrSb() {
  const container = document.getElementById('prsb-container');
  if (!container) return;
  const records = prSbData.map(normalizePrSb).filter((record) => record !== null);
  buildPrSbSeasonOptions(records);
  updatePrSbControls();
  const filtered = records.filter((record) => {
    if (record.type !== prSbType) return false;
    return prSbType === 'PR' || String(record.seasonYear) === prSbSeason;
  }).sort(comparePrSbEvents);
  if (filtered.length === 0) {
    container.innerHTML = '<p class="races-empty">No PR or SB records for this view.</p>';
    return;
  }
  let html = '<div class="prsb-cards">';
  filtered.forEach((record) => {
    const detail = [record.eventName, fmtMediumDate(record.date)].filter(Boolean).join(' · ');
    html += '<article class="prsb-card">'
      + '<span class="prsb-badge prsb-' + record.type.toLowerCase() + '">' + record.type + '</span>'
      + '<div class="prsb-result">' + escapeHtml(record.result) + '</div>'
      + '<div class="prsb-event">' + escapeHtml(record.event) + '</div>'
      + '<div class="prsb-sport">' + escapeHtml(record.sport) + '</div>'
      + (detail ? '<div class="prsb-detail">' + escapeHtml(detail) + '</div>' : '')
      + (record.type === 'SB' ? '<div class="prsb-season">Season ' + record.seasonYear + '</div>' : '')
      + '</article>';
  });
  container.innerHTML = html + '</div>';
}

async function loadPrSb() {
  try {
    const response = await fetch(PR_SB_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const json = await response.json();
    prSbData = Array.isArray(json && json.data) ? json.data : [];
  } catch (err) {
    console.error('[dashboard] failed to load pr_sb.json:', err);
    prSbData = [];
  }
  if (racingSubtab === 'prsb') renderPrSb();
}

function initRacingSubtabs() {
  document.querySelectorAll('.subtab-link').forEach((btn) => {
    btn.addEventListener('click', function () {
      switchRacingSubtab(btn.getAttribute('data-subtab'));
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
  const typeSelect = document.getElementById('prsb-type');
  if (typeSelect) typeSelect.addEventListener('change', () => {
    prSbType = typeSelect.value;
    renderPrSb();
  });
  const seasonSelect = document.getElementById('prsb-season');
  if (seasonSelect) seasonSelect.addEventListener('change', () => {
    prSbSeason = seasonSelect.value;
    renderPrSb();
  });
}

async function loadCompletedRaces() {
  let json;
  try {
    const response = await fetch(COMPLETED_RACES_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' ' + response.statusText);
    }
    json = await response.json();
  } catch (err) {
    console.error('[dashboard] failed to load completed_races.json:', err);
    completedRacesData = [];
    if (racingSubtab === 'history') renderRaceHistoryTable();
    return;
  }
  completedRacesData = Array.isArray(json && json.data) ? json.data : [];
  if (racingSubtab === 'history') {
    renderRaceHistory();
  }
}

async function loadVersion() {
  try {
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const json = await response.json();
    if (json && typeof json.version === 'string' && json.version.length > 0) {
      dataVersion = json.version;
      const qs = '?v=' + encodeURIComponent(json.version);
      DATA_URL = BASE_DATA_URL + qs;
      RACES_URL = BASE_RACES_URL + qs;
      WEEKLY_URL = BASE_WEEKLY_URL + qs;
      OVERVIEW_URL = BASE_OVERVIEW_URL + qs;
      HEALTH_URL = BASE_HEALTH_URL + qs;
      GEAR_URL = BASE_GEAR_URL + qs;
      SYSTEM_HEALTH_URL = BASE_SYSTEM_HEALTH_URL + qs;
      COMPLETED_RACES_URL = BASE_COMPLETED_RACES_URL + qs;
      PR_SB_URL = BASE_PR_SB_URL + qs;
      SPORT_ANALYSIS_URL = BASE_SPORT_ANALYSIS_URL + qs;
    }
  } catch (err) {
    console.error('[dashboard] failed to load version.json, using unversioned URLs:', err);
  }
}

async function loadTrainingLoad() {
  const wrap = document.getElementById('chart-wrap');
  if (wrap) {
    wrap.classList.add('is-loading');
  }
  setLoading(true);

  let response;
  try {
    response = await fetch(DATA_URL, { cache: 'no-store' });
  } catch (err) {
    console.error('[dashboard] network error fetching data:', err);
    setLoading(false);
    setStatus('Training load data unavailable.', 'error');
    return;
  }

  if (!response.ok) {
    console.error(
      `[dashboard] HTTP ${response.status} ${response.statusText} for ${DATA_URL}`,
    );
    setLoading(false);
    setStatus('Training load data unavailable.', 'error');
    return;
  }

  let json;
  try {
    json = await response.json();
  } catch (err) {
    console.error('[dashboard] failed to parse training_load.json:', err);
    setLoading(false);
    setStatus('Training load data unavailable.', 'error');
    return;
  }

  if (!json || !Array.isArray(json.data) || json.data.length === 0) {
    console.error('[dashboard] training_load.json has no data rows', json);
    setLoading(false);
    setStatus('Training load data unavailable.', 'error');
    return;
  }

  setLoading(false);

  const first = json.data[0];
  const last = json.data[json.data.length - 1];
  console.info('[dashboard] loaded', json.data.length, 'rows');
  console.info('[dashboard] range', first && first.date, '->', last && last.date);
  console.info(
    '[dashboard] metadata start/end',
    json.start_date,
    '/',
    json.end_date,
    '| days',
    json.days,
  );

  setUpdatedTimestamp(json.generated_at);

  if (wrap) {
    wrap.classList.remove('is-loading');
  }

  fullTrainingLoad = json;
  const tdata = Array.isArray(json.data) ? json.data : [];
  dailyRange = dailyDefaultRange(tdata);
  if (!dailyRange) {
    dailyRange = {
      start: String(tdata[0].date),
      end: String(tdata[tdata.length - 1].date),
    };
  }
  initDailyControls();
  renderTrainingLoad();
}

async function loadWeekly() {
  const tssWrap = document.getElementById('weekly-tss-wrap');
  const timeWrap = document.getElementById('weekly-time-wrap');
  if (tssWrap) {
    tssWrap.classList.add('is-loading');
  }
  if (timeWrap) {
    timeWrap.classList.add('is-loading');
  }
  const setStatus = (id, message, kind) => {
    const box = document.getElementById(id);
    if (!box) return;
    box.textContent = message || '';
    box.className = `status ${kind || 'placeholder'}`;
    box.style.display = message ? 'flex' : 'none';
  };

  let response;
  try {
    response = await fetch(WEEKLY_URL, { cache: 'no-store' });
  } catch (err) {
    console.error('[dashboard] network error fetching weekly_training.json:', err);
    setStatus(WEEKLY_TSS_STATUS_ID, 'Weekly data unavailable.', 'error');
    if (tssWrap) tssWrap.classList.remove('is-loading');
    if (timeWrap) timeWrap.classList.remove('is-loading');
    return;
  }

  if (!response.ok) {
    console.error(
      `[dashboard] HTTP ${response.status} ${response.statusText} for ${WEEKLY_URL}`,
    );
    setStatus(WEEKLY_TSS_STATUS_ID, 'Weekly data unavailable.', 'error');
    if (tssWrap) tssWrap.classList.remove('is-loading');
    if (timeWrap) timeWrap.classList.remove('is-loading');
    return;
  }

  let json;
  try {
    json = await response.json();
  } catch (err) {
    console.error('[dashboard] failed to parse weekly_training.json:', err);
    setStatus(WEEKLY_TSS_STATUS_ID, 'Weekly data unavailable.', 'error');
    if (tssWrap) tssWrap.classList.remove('is-loading');
    if (timeWrap) timeWrap.classList.remove('is-loading');
    return;
  }

  if (!json || !Array.isArray(json.data) || json.data.length === 0) {
    console.error('[dashboard] weekly_training.json has no data rows', json);
    setStatus(WEEKLY_TSS_STATUS_ID, 'Weekly data unavailable.', 'error');
    if (tssWrap) tssWrap.classList.remove('is-loading');
    if (timeWrap) timeWrap.classList.remove('is-loading');
    return;
  }

  console.info('[dashboard] loaded', json.data.length, 'weekly rows');

  if (tssWrap) {
    tssWrap.classList.remove('is-loading');
  }
  if (timeWrap) {
    timeWrap.classList.remove('is-loading');
  }

  fullWeekly = json;
  const wdata = Array.isArray(json.data) ? json.data : [];
  weeklyRange = weeklyDefaultRange(wdata);
  if (!weeklyRange) {
    weeklyRange = {
      start: String(wdata[0].week_start),
      end: String(wdata[wdata.length - 1].week_end),
    };
  }
  initWeeklyControls();
  renderWeekly();
}

// ---------------------------------------------------------------------------
// Phase 8B: flexible date-range controls on the Training tab
// Full-history JSON is kept in memory; charts are re-rendered from
// derived filtered arrays without re-fetching.
// ---------------------------------------------------------------------------

function renderTrainingLoad() {
  if (!fullTrainingLoad) return;
  const rows = filterDailyRange(
    fullTrainingLoad.data,
    dailyRange && dailyRange.start,
    dailyRange && dailyRange.end,
  );
  if (trainingLoadChart) trainingLoadChart.destroy();
  trainingLoadChart = buildChart(rows);
}

function renderWeekly() {
  if (!fullWeekly) return;
  const rows = filterWeeklyOverlap(
    fullWeekly.data,
    weeklyRange && weeklyRange.start,
    weeklyRange && weeklyRange.end,
  );
  if (weeklyTssChart) weeklyTssChart.destroy();
  if (weeklyTimeChart) weeklyTimeChart.destroy();
  weeklyTssChart = buildWeeklyTssChart(rows);
  weeklyTimeChart = buildWeeklyTimeChart(rows);
}

function showValidation(el, message) {
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('show', !!message);
}

function initDailyControls() {
  const startEl = document.getElementById('daily-start');
  const endEl = document.getElementById('daily-end');
  const resetEl = document.getElementById('daily-reset');
  const validateEl = document.getElementById('daily-validation');
  if (!startEl || !endEl || !resetEl) return;

  const rows = fullTrainingLoad && Array.isArray(fullTrainingLoad.data)
    ? fullTrainingLoad.data : [];
  if (rows.length === 0) {
    startEl.disabled = true;
    endEl.disabled = true;
    resetEl.disabled = true;
    return;
  }

  const minDate = String(rows[0].date);
  const maxDate = String(rows[rows.length - 1].date);
  startEl.min = minDate;
  startEl.max = maxDate;
  endEl.min = minDate;
  endEl.max = maxDate;
  startEl.disabled = false;
  endEl.disabled = false;
  resetEl.disabled = false;
  startEl.value = dailyRange.start;
  endEl.value = dailyRange.end;
  showValidation(validateEl, '');

  startEl.addEventListener('change', onDailyChange);
  endEl.addEventListener('change', onDailyChange);
  resetEl.addEventListener('click', onDailyReset);
}

function initWeeklyControls() {
  const startEl = document.getElementById('weekly-start');
  const endEl = document.getElementById('weekly-end');
  const resetEl = document.getElementById('weekly-reset');
  const validateEl = document.getElementById('weekly-validation');
  if (!startEl || !endEl || !resetEl) return;

  const rows = fullWeekly && Array.isArray(fullWeekly.data)
    ? fullWeekly.data : [];
  if (rows.length === 0) {
    startEl.disabled = true;
    endEl.disabled = true;
    resetEl.disabled = true;
    return;
  }

  const minDate = String(rows[0].week_start);
  const maxDate = String(rows[rows.length - 1].week_end);
  startEl.min = minDate;
  startEl.max = maxDate;
  endEl.min = minDate;
  endEl.max = maxDate;
  startEl.disabled = false;
  endEl.disabled = false;
  resetEl.disabled = false;
  startEl.value = weeklyRange.start;
  endEl.value = weeklyRange.end;
  showValidation(validateEl, '');

  startEl.addEventListener('change', onWeeklyChange);
  endEl.addEventListener('change', onWeeklyChange);
  resetEl.addEventListener('click', onWeeklyReset);
}

function onDailyChange() {
  const startEl = document.getElementById('daily-start');
  const endEl = document.getElementById('daily-end');
  const validateEl = document.getElementById('daily-validation');
  if (!startEl || !endEl || !validateEl) return;
  if (startEl.disabled || endEl.disabled) return;

  const startStr = startEl.value;
  const endStr = endEl.value;
  if (!startStr || !endStr) return;

  const minDate = startEl.min;
  const maxDate = startEl.max;
  const clampedStart = clampDate(startStr, minDate, maxDate);
  const clampedEnd = clampDate(endStr, minDate, maxDate);
  if (clampedStart !== startStr) startEl.value = clampedStart;
  if (clampedEnd !== endStr) endEl.value = clampedEnd;

  if (clampedStart > clampedEnd) {
    showValidation(validateEl, 'Start date must be on or before end date.');
    if (dailyRange) {
      startEl.value = dailyRange.start;
      endEl.value = dailyRange.end;
    }
    return;
  }
  showValidation(validateEl, '');
  dailyRange = { start: clampedStart, end: clampedEnd };
  renderTrainingLoad();
}

function onDailyReset() {
  const startEl = document.getElementById('daily-start');
  const endEl = document.getElementById('daily-end');
  const validateEl = document.getElementById('daily-validation');
  const rows = fullTrainingLoad && Array.isArray(fullTrainingLoad.data)
    ? fullTrainingLoad.data : [];
  const def = dailyDefaultRange(rows);
  if (def) dailyRange = def;
  showValidation(validateEl, '');
  if (startEl && dailyRange) startEl.value = dailyRange.start;
  if (endEl && dailyRange) endEl.value = dailyRange.end;
  renderTrainingLoad();
}

function onWeeklyChange() {
  const startEl = document.getElementById('weekly-start');
  const endEl = document.getElementById('weekly-end');
  const validateEl = document.getElementById('weekly-validation');
  if (!startEl || !endEl || !validateEl) return;
  if (startEl.disabled || endEl.disabled) return;

  const startStr = startEl.value;
  const endStr = endEl.value;
  if (!startStr || !endStr) return;

  const minDate = startEl.min;
  const maxDate = startEl.max;
  const clampedStart = clampDate(startStr, minDate, maxDate);
  const clampedEnd = clampDate(endStr, minDate, maxDate);
  if (clampedStart !== startStr) startEl.value = clampedStart;
  if (clampedEnd !== endStr) endEl.value = clampedEnd;

  if (clampedStart > clampedEnd) {
    showValidation(validateEl, 'Start date must be on or before end date.');
    if (weeklyRange) {
      startEl.value = weeklyRange.start;
      endEl.value = weeklyRange.end;
    }
    return;
  }
  showValidation(validateEl, '');
  weeklyRange = { start: clampedStart, end: clampedEnd };
  renderWeekly();
}

function onWeeklyReset() {
  const startEl = document.getElementById('weekly-start');
  const endEl = document.getElementById('weekly-end');
  const validateEl = document.getElementById('weekly-validation');
  const rows = fullWeekly && Array.isArray(fullWeekly.data)
    ? fullWeekly.data : [];
  const def = weeklyDefaultRange(rows);
  if (def) weeklyRange = def;
  showValidation(validateEl, '');
  if (startEl && weeklyRange) startEl.value = weeklyRange.start;
  if (endEl && weeklyRange) endEl.value = weeklyRange.end;
  renderWeekly();
}

function healthDefaultRange(rows) {
  return dailyDefaultRange(rows);
}

function initHealthControls() {
  const startEl = document.getElementById('health-start');
  const endEl = document.getElementById('health-end');
  const resetEl = document.getElementById('health-reset');
  const validateEl = document.getElementById('health-validation');
  if (!startEl || !endEl || !resetEl) return;
  const rows = fullHealth && Array.isArray(fullHealth.data) ? fullHealth.data : [];
  if (rows.length === 0) {
    startEl.disabled = true;
    endEl.disabled = true;
    resetEl.disabled = true;
    return;
  }
  const minDate = String(rows[0].date);
  const maxDate = String(rows[rows.length - 1].date);
  startEl.min = minDate;
  startEl.max = maxDate;
  endEl.min = minDate;
  endEl.max = maxDate;
  startEl.disabled = false;
  endEl.disabled = false;
  resetEl.disabled = false;
  startEl.value = healthRange.start;
  endEl.value = healthRange.end;
  showValidation(validateEl, '');
  startEl.addEventListener('change', onHealthChange);
  endEl.addEventListener('change', onHealthChange);
  resetEl.addEventListener('click', onHealthReset);
}

function onHealthChange() {
  const startEl = document.getElementById('health-start');
  const endEl = document.getElementById('health-end');
  const validateEl = document.getElementById('health-validation');
  if (!startEl || !endEl || !validateEl) return;
  if (startEl.disabled || endEl.disabled) return;
  const startStr = clampDate(startEl.value, startEl.min, startEl.max);
  const endStr = clampDate(endEl.value, endEl.min, endEl.max);
  if (startStr !== startEl.value) startEl.value = startStr;
  if (endStr !== endEl.value) endEl.value = endStr;
  if (startStr && endStr && startStr > endStr) {
    showValidation(validateEl, 'Start date must be on or before end date.');
    if (healthRange) {
      startEl.value = healthRange.start;
      endEl.value = healthRange.end;
    }
    return;
  }
  showValidation(validateEl, '');
  healthRange = { start: startStr, end: endStr };
  renderHealth();
}

function onHealthReset() {
  const startEl = document.getElementById('health-start');
  const endEl = document.getElementById('health-end');
  const validateEl = document.getElementById('health-validation');
  const rows = fullHealth && Array.isArray(fullHealth.data) ? fullHealth.data : [];
  healthRange = healthDefaultRange(rows);
  showValidation(validateEl, '');
  if (startEl && healthRange) startEl.value = healthRange.start;
  if (endEl && healthRange) endEl.value = healthRange.end;
  renderHealth();
}

// ---------------------------------------------------------------------------
// Overview (Phase 7) -- single-page snapshot from overview.json
// ---------------------------------------------------------------------------

function fmtDate(value) {
  return value != null ? fmtMediumDate(String(value)) : '—';
}

function fmtNum1(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(1) : '—';
}

function fmtTss(value) {
  return fmtNum1(value);
}

function fmtTime(value) {
  if (value == null) return '—';
  return fmtHMSShort(value);
}

function fmtMaybe(value) {
  if (value == null || value === '') return '—';
  return String(value);
}

function fmtDistanceMiles(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(1) + ' mi';
}

function fmtDistanceYards(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return Number(value).toLocaleString('en-US') + ' yd';
}

function fmtWeight(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(1) + ' lbs';
}

function fmtHrv(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(1) + ' ms';
}

function fmtInt(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return String(Math.round(value));
}

function fmtIntUnit(value, unit) {
  const n = fmtInt(value);
  return n === '—' ? '—' : n + '\u202f' + unit;
}

function statHtml(label, value) {
  return '<div class="overview-stat">'
    + '<span class="overview-stat-label">' + label + '</span>'
    + '<span class="overview-stat-value">' + value + '</span>'
    + '</div>';
}

function overviewCard(title, rows) {
  let html = '<div class="overview-card">'
    + '<div class="overview-card-title">' + title + '</div>';
  rows.forEach((r) => {
    html += statHtml(r[0], r[1]);
  });
  html += '</div>';
  return html;
}

function setOverviewStatus(message, kind) {
  const container = document.getElementById('overview-cards');
  if (!container) return;
  const loading = kind === 'loading';
  const cls = loading ? 'status loading' : 'status ' + (kind || 'error');
  container.innerHTML = '<div class="' + cls + '" role="status">'
    + (loading ? '<span class="loader"></span>' : '')
    + (message || '')
    + '</div>';
}

function renderOverview(doc) {
  const container = document.getElementById('overview-cards');
  if (!container) return;

  const cl = doc.current_load || {};
  const rt = doc.recent_training || {};
  const hl = doc.health || {};
  const th = doc.thresholds || {};
  const nr = doc.next_race;

  const cards = [
    overviewCard('Current Load', [
      ['As of', fmtDate(cl.date)],
      ['CTL (chronic)', fmtTss(cl.ctl)],
      ['ATL (acute)', fmtTss(cl.atl)],
      ['TSS', fmtTss(cl.tss)],
      ['TSB', fmtTss(cl.tsb)],
      ['Load Ratio', fmtTss(cl.load_ratio)],
      ['Ramp Rate', fmtTss(cl.ramp_rate)],
    ]),
    overviewCard('Recent Training (7 days)', [
      ['Window', fmtDate(rt.start_date) + ' – ' + fmtDate(rt.end_date)],
      ['Total TSS', fmtTss(rt.total_tss)],
      ['Run', fmtDistanceMiles(rt.run_distance_miles) + ' · ' + fmtTime(rt.run_time_seconds)],
      ['Bike', fmtDistanceMiles(rt.bike_distance_miles) + ' · ' + fmtTime(rt.bike_time_seconds)],
      ['Swim', fmtDistanceYards(rt.swim_distance_yards) + ' · ' + fmtTime(rt.swim_time_seconds)],
      ['Other', fmtTime(rt.other_time_seconds)],
      ['Total Time', fmtTime(rt.total_time_seconds)],
    ]),
    overviewCard('Health Snapshot', [
      ['As of', fmtDate(hl.date)],
      ['Weight', fmtWeight(hl.weight_lbs)],
      ['Sleep', fmtTime(hl.sleep_seconds)],
      ['Sleep Score', fmtMaybe(hl.sleep_score)],
      ['Resting HR', fmtMaybe(hl.resting_heart_rate)],
      ['HRV', fmtHrv(hl.hrv)],
    ]),
    overviewCard('Current Thresholds', [
      ['Bike FTP', fmtIntUnit(th.ftp_watts, 'W')],
      ['Run rFTP', fmtIntUnit(th.rftp_watts, 'W')],
      ['Swim CSS', fmtMaybe(th.css_pace)],
      ['Swim Threshold', fmtMaybe(th.swim_threshold_pace)],
      ['Threshold HR', fmtIntUnit(th.threshold_heart_rate_bpm, 'bpm')],
    ]),
  ];

  let html = cards.join('');

  if (nr) {
    html += '<div class="overview-card"><div class="overview-card-title">Next Race</div>';
    const rows = [
      ['Date', fmtDate(nr.date)],
      ['Name', fmtMaybe(nr.name)],
      ['Location', fmtMaybe(nr.location)],
      ['Type', fmtMaybe(nr.race_type)],
      ['Status', fmtMaybe(nr.registration_status)],
      ['When', fmtMaybe(nr.when)],
    ];
    if (nr.priority != null) rows.push(['Priority', fmtMaybe(nr.priority)]);
    if (nr.series != null) rows.push(['Series', fmtMaybe(nr.series)]);
    rows.forEach((r) => { html += statHtml(r[0], r[1]); });
    if (nr.url) {
      html += '<div class="overview-race-link">'
        + externalLink(String(nr.url), 'Event website') + '</div>';
    }
    html += '</div>';
  } else {
    html += overviewCard('Next Race', [['Upcoming', 'No upcoming races.']]);
  }

  container.innerHTML = html;
  renderPiHealthCard(overviewHealthDoc);
}

async function loadOverview() {
  const container = document.getElementById('overview-cards');
  if (!container) return;

  setOverviewStatus('Loading overview…', 'loading');

  let response;
  try {
    response = await fetch(OVERVIEW_URL, { cache: 'no-store' });
  } catch (err) {
    console.error('[dashboard] network error fetching overview:', err);
    setOverviewStatus('Overview data unavailable.', 'error');
    return;
  }

  if (!response.ok) {
    console.error(
      '[dashboard] HTTP ' + response.status + ' ' + response.statusText
      + ' for ' + OVERVIEW_URL,
    );
    setOverviewStatus('Overview data unavailable.', 'error');
    return;
  }

  let doc;
  try {
    doc = await response.json();
  } catch (err) {
    console.error('[dashboard] failed to parse overview.json:', err);
    setOverviewStatus('Overview data unavailable.', 'error');
    return;
  }

  container.innerHTML = '';
  overviewDoc = doc;
  renderOverview(doc);
}

function healthStat(label, value) {
  return '<div class="health-stat"><span class="health-stat-label">' + label
    + '</span><span class="health-stat-value">' + value + '</span></div>';
}

function latestAverage(rows, key) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const value = numOrNU(rows[i] && rows[i][key]);
    if (value !== null) return value;
  }
  return null;
}

function latestHealthValues(rows) {
  const latest = { date: rows.length ? rows[rows.length - 1].date : null };
  ['weight_lbs', 'sleep_hours', 'sleep_score', 'resting_heart_rate_bpm', 'hrv_ms']
    .forEach((key) => { latest[key] = latestAverage(rows, key); });
  return latest;
}

function buildHealthChart(id, rows, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  const labels = rows.map((row) => String(row.date));
  const raw = rows.map((row) => numOrNU(row && row[config.rawKey]));
  const average = config.averageKey
    ? rows.map((row) => numOrNU(row && row[config.averageKey])) : [];
  const datasets = [{
    type: config.bar ? 'bar' : 'line',
    label: 'Daily',
    data: raw,
    backgroundColor: palette.bar,
    borderColor: palette.barBorder,
    borderWidth: config.bar ? 1 : 1.5,
    pointRadius: config.bar ? 0 : 2,
    spanGaps: false,
  }];
  if (config.averageKey) {
    datasets.push({
      type: 'line', label: '7-day average', data: average,
      borderColor: palette.line, backgroundColor: palette.lineBg,
      borderWidth: 2, pointRadius: 0, tension: 0.15, spanGaps: false,
    });
  }
  const center = config.averageKey ? latestAverage(rows, config.averageKey) : null;
  const scale = {
    beginAtZero: false,
    grid: { color: palette.grid },
    ticks: { color: palette.muted, maxTicksLimit: 6 },
  };
  if (center !== null && config.radius) {
    scale.min = Math.max(config.floor == null ? -Infinity : config.floor, center - config.radius);
    scale.max = center + config.radius;
  }
  return new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: palette.text, usePointStyle: true } },
        tooltip: {
          callbacks: {
            title: (items) => items.length ? fmtFullDate(labels[items[0].dataIndex]) : '',
            label: (ctx) => ctx.parsed.y == null ? null
              : ctx.dataset.label + ': ' + Number(ctx.parsed.y).toFixed(config.decimals) + config.unit,
          },
        },
      },
      scales: {
        x: {
          grid: { color: palette.grid },
          ticks: {
            color: palette.muted, maxTicksLimit: 12, maxRotation: 0,
            callback: function (value) { return fmtAxis(this.getLabelForValue(value)); },
          },
        },
        y: scale,
      },
    },
  });
}

function renderHealth() {
  const summary = document.getElementById('health-summary');
  if (!summary || !fullHealth) return;
  const rows = filterDailyRange(
    fullHealth.data,
    healthRange && healthRange.start,
    healthRange && healthRange.end,
  );
  const latest = latestHealthValues(rows);
  summary.innerHTML = [
    healthStat('Latest date', fmtDate(latest.date)),
    healthStat('Weight', fmtWeight(latest.weight_lbs)),
    healthStat('Sleep', latest.sleep_hours == null ? '—' : fmtNum1(latest.sleep_hours) + ' h'),
    healthStat('Sleep score', fmtMaybe(latest.sleep_score)),
    healthStat('Resting HR', latest.resting_heart_rate_bpm == null ? '—' : fmtMaybe(latest.resting_heart_rate_bpm) + ' bpm'),
    healthStat('HRV', fmtHrv(latest.hrv_ms)),
  ].join('');
  healthCharts.forEach((chart) => chart.destroy());
  healthCharts = [
    buildHealthChart('health-sleep', rows, { rawKey: 'sleep_hours', averageKey: 'sleep_hours_7d', bar: true, radius: 4, floor: 0, decimals: 1, unit: ' h' }),
    buildHealthChart('health-weight', rows, { rawKey: 'weight_lbs', averageKey: 'weight_lbs_7d', bar: true, radius: 15, floor: 0, decimals: 1, unit: ' lb' }),
    buildHealthChart('health-rhr', rows, { rawKey: 'resting_heart_rate_bpm', averageKey: 'resting_heart_rate_7d', bar: false, decimals: 1, unit: ' bpm' }),
    buildHealthChart('health-hrv', rows, { rawKey: 'hrv_ms', averageKey: 'hrv_7d', bar: false, decimals: 1, unit: ' ms' }),
    buildHealthChart('health-sleep-score', rows, { rawKey: 'sleep_score', bar: false, decimals: 0, unit: '' }),
  ].filter(Boolean);
}

async function loadHealth() {
  try {
    const response = await fetch(HEALTH_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const doc = await response.json();
    if (!doc || !Array.isArray(doc.data)) throw new Error('Invalid health document');
    if (doc.data.length === 0) throw new Error('Health document has no data rows');
    fullHealth = doc;
    healthRange = healthDefaultRange(doc.data);
    initHealthControls();
    renderHealth();
  } catch (err) {
    console.error('[dashboard] failed to load health.json:', err);
    const summary = document.getElementById('health-summary');
    if (summary) summary.innerHTML = '<div class="status error" role="status">Health data unavailable.</div>';
  }
}

const GEAR_CATEGORY_ORDER = ['Shoes', 'Bikes', 'Bike Components', 'Other'];

function gearRowsForFilter() {
  return gearData.filter((row) => (
    gearFilter === 'all'
      || String(row.status || '').toLowerCase() === gearFilter
  ));
}

function gearCategory(row) {
  return GEAR_CATEGORY_ORDER.includes(row.category) ? row.category : 'Other';
}

function groupedGearRows(rows) {
  const groups = new Map(GEAR_CATEGORY_ORDER.map((category) => [category, []]));
  rows.forEach((row) => groups.get(gearCategory(row)).push(row));
  groups.forEach((group) => group.sort((a, b) => (
    String(a.name || '').localeCompare(String(b.name || ''))
      || String(a.id || '').localeCompare(String(b.id || ''))
  )));
  return GEAR_CATEGORY_ORDER
    .map((category) => [category, groups.get(category)])
    .filter(([, group]) => group.length > 0);
}

function formatGearMiles(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(1)} mi`
    : null;
}

function formatGearFirstUse(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(date);
}

function gearMetric(label, value) {
  if (value == null || value === '') return '';
  return `<div class="gear-metric"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderGearCard(row) {
  const distance = formatGearMiles(row.distance_miles);
  const maximum = formatGearMiles(row.maximum_distance_miles);
  const hasTarget = distance && maximum && row.maximum_distance_miles > 0;
  const percent = hasTarget
    ? Math.min(100, Math.max(0, (row.distance_miles / row.maximum_distance_miles) * 100))
    : null;
  const retiredInAll = gearFilter === 'all' && String(row.status || '').toLowerCase() === 'retired';
  const target = hasTarget
    ? `<div class="gear-target"><div class="gear-target-text">${distance} <span>of ${maximum}</span></div><div class="gear-progress" role="progressbar" aria-label="${escapeHtml(row.name || 'Gear')} distance target" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><span style="width:${percent}%"></span></div></div>`
    : '';
  const metrics = [
    gearMetric('Distance', distance),
    gearMetric('Activities', typeof row.activity_count === 'number' ? row.activity_count.toLocaleString('en-US') : null),
    gearMetric('First Use', formatGearFirstUse(row.first_use_date)),
    gearMetric('Hours of Use', row.hours_of_use),
    gearMetric('Days of Use', row.days_of_use),
  ].filter(Boolean).join('');
  return `<article class="gear-card">
    <div class="gear-card-heading"><h3>${escapeHtml(row.name || 'Unnamed gear')}</h3>${retiredInAll ? '<span class="gear-retired">Retired</span>' : ''}</div>
    ${target}
    ${metrics ? `<div class="gear-metrics">${metrics}</div>` : ''}
  </article>`;
}

function renderGear() {
  const container = document.getElementById('gear-container');
  if (!container) return;
  const filterHtml = `
    <div class="gear-filter" role="group" aria-label="Filter gear by status">
      ${['active', 'retired', 'all'].map((status) => `<button type="button" class="gear-filter-button${gearFilter === status ? ' is-selected' : ''}" data-gear-filter="${status}" aria-pressed="${gearFilter === status}">${status[0].toUpperCase() + status.slice(1)}</button>`).join('')}
    </div>`;
  container.innerHTML = filterHtml;
  container.querySelectorAll('[data-gear-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      gearFilter = button.getAttribute('data-gear-filter');
      renderGear();
    });
  });
  if (gearData.length === 0) {
    container.insertAdjacentHTML('beforeend', '<p class="gear-empty">No gear found.</p>');
    return;
  }
  const groups = groupedGearRows(gearRowsForFilter());
  if (groups.length === 0) {
    container.insertAdjacentHTML('beforeend', `<p class="gear-empty">No ${escapeHtml(gearFilter)} gear found.</p>`);
    return;
  }
  container.insertAdjacentHTML('beforeend', groups.map(([category, rows]) => `
    <section class="gear-category" aria-labelledby="gear-category-${category.toLowerCase().replace(/[^a-z]+/g, '-')}">
      <h3 id="gear-category-${category.toLowerCase().replace(/[^a-z]+/g, '-')}">${escapeHtml(category)}</h3>
      <div class="gear-cards">${rows.map(renderGearCard).join('')}</div>
    </section>`).join(''));
}

async function loadGear() {
  try {
    const response = await fetch(GEAR_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const doc = await response.json();
    if (!doc || !Array.isArray(doc.gear)) throw new Error('Invalid gear document');
    gearData = doc.gear;
    renderGear();
  } catch (err) {
    console.error('[dashboard] failed to load gear.json:', err);
    const container = document.getElementById('gear-container');
    if (container) container.innerHTML = '<div class="status error" role="status">Gear data unavailable.</div>';
  }
}

// ---------------------------------------------------------------------------
// Sport-specific analytics
// ---------------------------------------------------------------------------

function sportRows(sportName = activeSport) {
  const sport = fullSportAnalysis && fullSportAnalysis.sports
    ? fullSportAnalysis.sports[sportName] : null;
  return sport || { activities: [], daily: [] };
}

function runningRows() {
  return sportRows('running');
}

function runningDefaultRange(daily) {
  const fallback = dailyDefaultRange(daily);
  if (!fallback) return null;
  try {
    const saved = JSON.parse(localStorage.getItem('sport-analysis-range') || 'null');
    if (saved && saved.start >= String(daily[0].date)
        && saved.end <= String(daily[daily.length - 1].date)
        && saved.start <= saved.end) {
      return { start: saved.start, end: saved.end };
    }
  } catch (_) {
    // A malformed or unavailable localStorage value should not block charts.
  }
  return fallback;
}

function selectedRunningActivities() {
  const activities = sportRows().activities;
  if (!runningRange) return [];
  return activities.filter((row) => row && row.date >= runningRange.start
    && row.date <= runningRange.end);
}

function fmtRunningTime(seconds) {
  const totalMinutes = Math.round(Number(seconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')} h`;
}

function fmtRunningPace(secondsPerMile) {
  if (!Number.isFinite(secondsPerMile)) return '—';
  const total = Math.round(secondsPerMile);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}/mi`;
}

function fmtSwimPace(secondsPer100Yd) {
  if (!Number.isFinite(secondsPer100Yd)) return '—';
  const total = Math.round(secondsPer100Yd);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}/100 yd`;
}

function fmtAverageDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return fmtRunningTime(seconds);
}

function sportSummary(activities, sportName = activeSport) {
  const seconds = activities.reduce((sum, row) => sum + Number(row.duration_seconds || 0), 0);
  const count = activities.length;
  const selectedDays = runningRange
    ? Math.round((dateToUtcMs(runningRange.end) - dateToUtcMs(runningRange.start)) / 86400000) + 1
    : 0;
  const tss = activities.reduce((sum, row) => sum + Number(row.tss || 0), 0);
  if (sportName === 'strength') {
    return {
      seconds,
      count,
      perWeek: selectedDays > 0 ? count / (selectedDays / 7) : 0,
      tss,
      averageDuration: count > 0 ? seconds / count : null,
      averageTss: count > 0 ? tss / count : null,
    };
  }

  const distanceKey = sportName === 'swimming' ? 'distance_yards' : 'distance_miles';
  const distanceRows = activities.filter((row) => Number.isFinite(Number(row[distanceKey]))
    && Number(row[distanceKey]) > 0);
  const distance = distanceRows.reduce((sum, row) => sum + Number(row[distanceKey]), 0);
  const result = {
    distance,
    seconds,
    count,
    perWeek: selectedDays > 0 ? count / (selectedDays / 7) : 0,
    races: activities.filter((row) => row.is_race === true).length,
    tss,
    longest: distanceRows.reduce((best, row) => Math.max(best, Number(row[distanceKey])), 0),
    average: distanceRows.length > 0 ? distance / distanceRows.length : null,
  };
  if (sportName === 'cycling') {
    const pairedRows = distanceRows.filter((row) => Number.isFinite(Number(row.duration_seconds))
      && Number(row.duration_seconds) > 0);
    const pairedDistance = pairedRows.reduce((sum, row) => sum + Number(row[distanceKey]), 0);
    const pairedSeconds = pairedRows.reduce((sum, row) => sum + Number(row.duration_seconds), 0);
    result.speed = pairedSeconds > 0 ? pairedDistance / (pairedSeconds / 3600) : null;
  } else if (sportName === 'swimming') {
    const pairedRows = distanceRows.filter((row) => Number.isFinite(Number(row.duration_seconds))
      && Number(row.duration_seconds) > 0);
    const pairedDistance = pairedRows.reduce((sum, row) => sum + Number(row[distanceKey]), 0);
    const pairedSeconds = pairedRows.reduce((sum, row) => sum + Number(row.duration_seconds), 0);
    result.pace = pairedDistance > 0 ? pairedSeconds / pairedDistance * 100 : null;
  } else {
    result.pace = distance > 0 ? seconds / distance : null;
    // Preserve Running v1: Avg Distance divides by every run.
    result.average = count > 0 ? distance / count : null;
  }
  return result;
}

function runningSummary(activities) {
  const result = sportSummary(activities, 'running');
  result.runsPerWeek = result.perWeek;
  return result;
}

function renderRunningSummary(activities) {
  const container = document.getElementById('running-summary');
  if (!container) return;
  const value = sportSummary(activities);
  const cycling = activeSport === 'cycling';
  const swimming = activeSport === 'swimming';
  const strength = activeSport === 'strength';
  const metrics = strength ? [
    ['Workouts', String(value.count)],
    ['Time', fmtRunningTime(value.seconds)],
    ['Workouts/week', value.perWeek.toFixed(1)],
    ['TSS', Math.round(value.tss).toLocaleString('en-US')],
    ['Avg Duration', fmtAverageDuration(value.averageDuration)],
    ['Avg TSS', value.averageTss == null ? '—' : value.averageTss.toFixed(1)],
  ] : swimming ? [
    ['Distance', `${Math.round(value.distance).toLocaleString('en-US')} yd`],
    ['Time', fmtRunningTime(value.seconds)],
    ['Swims/week', value.perWeek.toFixed(1)],
    ['Races', String(value.races)],
    ['TSS', Math.round(value.tss).toLocaleString('en-US')],
    ['Avg Pace', fmtSwimPace(value.pace)],
    ['Longest Swim', `${Math.round(value.longest).toLocaleString('en-US')} yd`],
    ['Avg Distance', value.average == null ? '—' : `${Math.round(value.average).toLocaleString('en-US')} yd/swim`],
  ] : cycling ? [
    ['Distance', `${value.distance.toFixed(1)} mi`],
    ['Time', fmtRunningTime(value.seconds)],
    ['Rides/week', value.perWeek.toFixed(1)],
    ['Races', String(value.races)],
    ['TSS', Math.round(value.tss).toLocaleString('en-US')],
    ['Avg Speed', value.speed == null ? '—' : `${value.speed.toFixed(1)} mph`],
    ['Longest Ride', `${value.longest.toFixed(1)} mi`],
    ['Avg Distance', value.average == null ? '—' : `${value.average.toFixed(1)} mi/ride`],
  ] : [
    ['Distance', `${value.distance.toFixed(1)} mi`],
    ['Time', fmtRunningTime(value.seconds)],
    ['Runs/week', value.perWeek.toFixed(1)],
    ['Races', String(value.races)],
    ['TSS', Math.round(value.tss).toLocaleString('en-US')],
    ['Avg Pace', fmtRunningPace(value.pace)],
    ['Longest Run', `${value.longest.toFixed(1)} mi`],
    ['Avg Distance', value.average == null ? '—' : `${value.average.toFixed(1)} mi/run`],
  ];
  container.innerHTML = metrics.map(([label, display]) =>
    `<div class="running-metric"><span class="running-metric-value">${display}</span><span class="running-metric-label">${label}</span></div>`,
  ).join('');
}

function mondayForDate(isoDate) {
  const ms = dateToUtcMs(isoDate);
  if (!Number.isFinite(ms)) return null;
  const day = new Date(ms).getUTCDay();
  return msToIsoDate(ms - ((day + 6) % 7) * 86400000);
}

function sportWeeks(activities) {
  if (!runningRange) return [];
  const firstMonday = mondayForDate(runningRange.start);
  const lastMonday = mondayForDate(runningRange.end);
  const byWeek = new Map();
  for (let ms = dateToUtcMs(firstMonday); ms <= dateToUtcMs(lastMonday); ms += 7 * 86400000) {
    const weekStart = msToIsoDate(ms);
    byWeek.set(weekStart, {
      week_start: weekStart,
      distance: 0,
      longest: 0,
      time_hours: 0,
      workouts: 0,
    });
  }
  activities.forEach((row) => {
    const week = byWeek.get(mondayForDate(row.date));
    if (!week) return;
    const distanceKey = activeSport === 'swimming' ? 'distance_yards' : 'distance_miles';
    const distance = Number(row[distanceKey] || 0);
    week.distance += distance;
    week.longest = Math.max(week.longest, distance);
    week.time_hours += Number(row.duration_seconds || 0) / 3600;
    week.workouts += 1;
  });
  const weeks = Array.from(byWeek.values());
  weeks.forEach((week, index) => {
    const window = weeks.slice(Math.max(0, index - 3), index + 1);
    week.moving_average = window.reduce((sum, row) => sum + row.distance, 0) / window.length;
    week.time_moving_average = window.reduce((sum, row) => sum + row.time_hours, 0) / window.length;
    week.workouts_moving_average = window.reduce((sum, row) => sum + row.workouts, 0) / window.length;
  });
  return weeks;
}

function runningWeeks(activities) {
  return sportWeeks(activities);
}

function sportChartBase(labels, datasets, yTitle) {
  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: palette.text, usePointStyle: true, pointStyle: 'circle', padding: 16 },
        },
        tooltip: {
          backgroundColor: 'rgba(18, 19, 22, 0.96)',
          titleColor: '#fff',
          bodyColor: '#e0e0e0',
          callbacks: { title: (items) => items.length ? fmtMediumDate(labels[items[0].dataIndex]) : '' },
        },
      },
      scales: {
        x: {
          grid: { color: palette.grid },
          ticks: { color: palette.muted, maxTicksLimit: 12, maxRotation: 0, callback: function (v) { return fmtAxis(this.getLabelForValue(v)); } },
        },
        y: {
          beginAtZero: true,
          grid: { color: palette.grid },
          ticks: { color: palette.muted },
          title: { display: true, text: yTitle, color: palette.muted },
        },
      },
    },
  };
}

function buildRunningLoadChart(rows) {
  const labels = rows.map((row) => row.date);
  const cycling = activeSport === 'cycling';
  const swimming = activeSport === 'swimming';
  const strength = activeSport === 'strength';
  const barBackground = strength ? palette.otherBg : swimming ? palette.swimBg : cycling ? palette.bikeBg : palette.runBg;
  const barBorder = strength ? palette.otherBd : swimming ? palette.swimBd : cycling ? palette.bikeBd : palette.runBd;
  const shortName = strength ? 'Strength' : swimming ? 'Swim' : cycling ? 'Bike' : 'Run';
  const config = sportChartBase(labels, [
    { type: 'bar', label: `${shortName} TSS`, data: rows.map((row) => row.tss), backgroundColor: barBackground, borderColor: barBorder, borderWidth: 0 },
    { type: 'line', label: `${shortName} CTL`, data: rows.map((row) => row.ctl), borderColor: palette.line, backgroundColor: palette.lineBg, borderWidth: 2, pointRadius: 1, tension: 0 },
    { type: 'line', label: `${shortName} ATL`, data: rows.map((row) => row.atl), borderColor: palette.atl, backgroundColor: palette.atlBg, borderWidth: 2, pointRadius: 1, tension: 0 },
  ], 'TSS / Load');
  return new Chart(document.getElementById('running-load').getContext('2d'), config);
}

function buildRunningDistanceChart(weeks) {
  const labels = weeks.map((row) => row.week_start);
  const cycling = activeSport === 'cycling';
  const swimming = activeSport === 'swimming';
  const strength = activeSport === 'strength';
  const config = sportChartBase(labels, strength ? [
    { type: 'bar', label: 'Weekly Time', data: weeks.map((row) => row.time_hours), backgroundColor: palette.otherBg, borderColor: palette.otherBd, borderWidth: 0 },
    { type: 'line', label: '4-week average', data: weeks.map((row) => row.time_moving_average), borderColor: palette.line, backgroundColor: palette.lineBg, borderWidth: 2, pointRadius: 2, tension: 0 },
  ] : [
    { type: 'bar', label: 'Weekly Distance', data: weeks.map((row) => row.distance), backgroundColor: swimming ? palette.swimBg : cycling ? palette.bikeBg : palette.runBg, borderColor: swimming ? palette.swimBd : cycling ? palette.bikeBd : palette.runBd, borderWidth: 0 },
    { type: 'line', label: '4-week average', data: weeks.map((row) => row.moving_average), borderColor: palette.line, backgroundColor: palette.lineBg, borderWidth: 2, pointRadius: 2, tension: 0 },
  ], strength ? 'Hours' : swimming ? 'Yards' : 'Miles');
  return new Chart(document.getElementById('running-distance').getContext('2d'), config);
}

function buildRunningLongChart(weeks) {
  const labels = weeks.map((row) => row.week_start);
  const cycling = activeSport === 'cycling';
  const swimming = activeSport === 'swimming';
  const strength = activeSport === 'strength';
  const config = sportChartBase(labels, strength ? [
    { type: 'bar', label: 'Weekly Workouts', data: weeks.map((row) => row.workouts), backgroundColor: palette.otherBg, borderColor: palette.otherBd, borderWidth: 0 },
    { type: 'line', label: '4-week average', data: weeks.map((row) => row.workouts_moving_average), borderColor: palette.line, backgroundColor: palette.lineBg, borderWidth: 2, pointRadius: 2, tension: 0 },
  ] : [
    { type: 'bar', label: swimming ? 'Longest Swim' : cycling ? 'Longest Ride' : 'Longest Run', data: weeks.map((row) => row.longest), backgroundColor: swimming ? palette.swimBg : cycling ? palette.bikeBg : palette.runBg, borderColor: swimming ? palette.swimBd : cycling ? palette.bikeBd : palette.runBd, borderWidth: 0 },
  ], strength ? 'Workouts' : swimming ? 'Yards' : 'Miles');
  config.options.plugins.legend.display = strength;
  return new Chart(document.getElementById('running-long').getContext('2d'), config);
}

function renderRunning() {
  if (!fullSportAnalysis || !runningRange) return;
  const source = sportRows();
  const activities = selectedRunningActivities();
  const daily = filterDailyRange(source.daily, runningRange.start, runningRange.end);
  const weeks = sportWeeks(activities);
  const cycling = activeSport === 'cycling';
  const swimming = activeSport === 'swimming';
  const strength = activeSport === 'strength';
  const pageTitle = document.getElementById('running-title');
  const loadTitle = document.getElementById('running-load-title');
  const distanceTitle = document.getElementById('running-distance-title');
  const longTitle = document.getElementById('running-long-title');
  if (pageTitle) pageTitle.textContent = strength ? 'Strength' : swimming ? 'Swimming' : cycling ? 'Cycling' : 'Running';
  if (loadTitle) loadTitle.textContent = strength ? 'Strength Load' : swimming ? 'Swimming Load' : cycling ? 'Cycling Load' : 'Running Load';
  if (distanceTitle) distanceTitle.textContent = strength ? 'Weekly Time' : 'Weekly Distance';
  if (longTitle) longTitle.textContent = strength ? 'Weekly Workouts' : swimming ? 'Long Swim Progression' : cycling ? 'Long Ride Progression' : 'Long Run Progression';
  renderRunningSummary(activities);
  [runningLoadChart, runningDistanceChart, runningLongChart].forEach((chart) => {
    if (chart) chart.destroy();
  });
  runningLoadChart = buildRunningLoadChart(daily);
  runningDistanceChart = buildRunningDistanceChart(weeks);
  runningLongChart = buildRunningLongChart(weeks);
}

function initRunningControls() {
  const start = document.getElementById('running-start');
  const end = document.getElementById('running-end');
  const reset = document.getElementById('running-reset');
  const validation = document.getElementById('running-validation');
  const daily = runningRows().daily;
  if (!start || !end || !reset || daily.length === 0 || !runningRange) return;
  const min = String(daily[0].date);
  const max = String(daily[daily.length - 1].date);
  [start, end].forEach((input) => { input.min = min; input.max = max; input.disabled = false; });
  reset.disabled = false;
  start.value = runningRange.start;
  end.value = runningRange.end;

  function applyRange() {
    if (!start.value || !end.value || start.value > end.value) {
      showValidation(validation, 'Start date must be on or before end date.');
      return;
    }
    showValidation(validation, '');
    runningRange = { start: start.value, end: end.value };
    try { localStorage.setItem('sport-analysis-range', JSON.stringify(runningRange)); } catch (_) {}
    renderRunning();
  }
  start.addEventListener('change', applyRange);
  end.addEventListener('change', applyRange);
  reset.addEventListener('click', () => {
    runningRange = dailyDefaultRange(daily);
    start.value = runningRange.start;
    end.value = runningRange.end;
    try { localStorage.setItem('sport-analysis-range', JSON.stringify(runningRange)); } catch (_) {}
    showValidation(validation, '');
    renderRunning();
  });
}

function initSportSubtabs() {
  document.querySelectorAll('.sport-subtab[data-sport]').forEach((button) => {
    button.addEventListener('click', () => {
      const requested = button.getAttribute('data-sport');
      if (requested !== 'running' && requested !== 'cycling'
          && requested !== 'swimming' && requested !== 'strength') return;
      activeSport = requested;
      document.querySelectorAll('.sport-subtab[data-sport]').forEach((item) => {
        const selected = item.getAttribute('data-sport') === activeSport;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
      // runningRange is deliberately shared: switching sports preserves the
      // exact selected dates and the same value remains in localStorage.
      renderRunning();
    });
  });
}

async function loadSportAnalysis() {
  try {
    const response = await fetch(SPORT_ANALYSIS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const doc = await response.json();
    if (!doc || !doc.sports || !doc.sports.running || !doc.sports.cycling
        || !doc.sports.swimming || !doc.sports.strength
        || !Array.isArray(doc.sports.running.activities)
        || !Array.isArray(doc.sports.running.daily)
        || !Array.isArray(doc.sports.cycling.activities)
        || !Array.isArray(doc.sports.cycling.daily)
        || !Array.isArray(doc.sports.swimming.activities)
        || !Array.isArray(doc.sports.swimming.daily)
        || !Array.isArray(doc.sports.strength.activities)
        || !Array.isArray(doc.sports.strength.daily)) {
      throw new Error('Invalid sport analysis document');
    }
    fullSportAnalysis = doc;
    runningRange = runningDefaultRange(doc.sports.running.daily);
    initSportSubtabs();
    initRunningControls();
    renderRunning();
  } catch (err) {
    console.error('[dashboard] failed to load sport_analysis.json:', err);
    const container = document.getElementById('running-summary');
    if (container) container.innerHTML = '<div class="status error" role="status">Sport data unavailable.</div>';
  }
}

// ---------------------------------------------------------------------------
// Pi / System Health card (system_health.json)
// ---------------------------------------------------------------------------

function _isStale(checkedAt) {
  if (!checkedAt || typeof checkedAt !== 'string') return true;
  const ms = Date.parse(checkedAt);
  if (!Number.isFinite(ms)) return true;
  return (Date.now() - ms) / 1000 > SYSTEM_HEALTH_STALE_SECONDS;
}

function _fmtStatus(status, checkedAt) {
  if (_isStale(checkedAt)) return 'not reporting';
  if (status == null) return '—';
  const s = String(status);
  const map = { healthy: 'Healthy', warning: 'Warning', error: 'Error' };
  return map[s] || s;
}

function _statusClass(status, checkedAt) {
  if (_isStale(checkedAt)) return 'pi-status-stale';
  const map = { healthy: 'pi-status-healthy', warning: 'pi-status-warning', error: 'pi-status-error' };
  return map[String(status)] || '';
}

function _fmtUptime(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '—';
  const s = Number(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

function _fmtTemp(c) {
  if (c == null || !Number.isFinite(Number(c))) return '—';
  return Number(c).toFixed(1) + '\u202f°C';
}

function _fmtBytes(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return '—';
  const b = Number(bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(i === 0 ? 0 : 1) + '\u202f' + units[i];
}

function _fmtCheckedAt(checkedAt) {
  if (!checkedAt || typeof checkedAt !== 'string') return '—';
  const ms = Date.parse(checkedAt);
  if (!Number.isFinite(ms)) return '—';
  const parts = CHICAGO_FMT.formatToParts(ms);
  const out = Object.create(null);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.type !== 'literal') out[p.type] = (out[p.type] || '') + p.value;
  }
  return out.year + '-' + out.month + '-' + out.day + ' ' + out.hour + ':' + out.minute + ' ' + out.timeZoneName;
}

function _fmtRunResult(result, at) {
  if (result == null && at == null) return '—';
  const label = result != null ? String(result) : '?';
  const time = at ? fmtMediumDate(String(at).slice(0, 10)) : '';
  return time ? label + ' · ' + time : label;
}

function renderPiHealthCard(doc) {
  const container = document.getElementById('overview-cards');
  if (!container) return;

  const old = document.getElementById('pi-health-card');
  if (old) old.remove();

  const checkedAt = doc && doc.checked_at;
  const status = doc && doc.overall_status;
  const stale = _isStale(checkedAt);

  const statusLabel = _fmtStatus(status, checkedAt);
  const statusCls = _statusClass(status, checkedAt);

  const rows = [
    ['Status', '<span class="pi-status-badge ' + statusCls + '">' + statusLabel + '</span>'],
    ['Pi uptime', _fmtUptime(doc && doc.uptime_seconds)],
    ['CPU temp', _fmtTemp(doc && doc.cpu_temperature_c)],
    ['SSD free', _fmtBytes(doc && doc.storage_free_bytes)],
    ['Last checked', stale
      ? '<span class="pi-stale-note">' + _fmtCheckedAt(checkedAt) + '</span>'
      : _fmtCheckedAt(checkedAt)],
  ];

  let html = '<div class="overview-card" id="pi-health-card">'
    + '<div class="overview-card-title">Pi / System Health</div>';
  rows.forEach(([label, value]) => {
    html += '<div class="overview-stat">'
      + '<span class="overview-stat-label">' + label + '</span>'
      + '<span class="overview-stat-value">' + value + '</span>'
      + '</div>';
  });
  html += '</div>';
  container.insertAdjacentHTML('beforeend', html);
}

async function loadPiHealth() {
  try {
    const response = await fetch(SYSTEM_HEALTH_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const doc = await response.json();
    if (!doc || typeof doc !== 'object') throw new Error('Invalid system_health document');
    overviewHealthDoc = doc;
  } catch (err) {
    console.error('[dashboard] failed to load system_health.json:', err);
    overviewHealthDoc = null;
  }

  if (overviewDoc) {
    renderOverview(overviewDoc);
  }
}

// ---------------------------------------------------------------------------
// Tab navigation (hash routing)
// ---------------------------------------------------------------------------

function currentTab() {
  const hash = (window.location.hash || '').replace(/^#/, '');
  return TAB_PANELS.includes(hash) ? hash : 'overview';
}

function showTab(tabId) {
  TAB_PANELS.forEach((id) => {
    const panel = document.getElementById('tab-' + id);
    const link = document.querySelector('.tab-link[data-tab="' + id + '"]');
    if (!panel || !link) return;
    const active = id === tabId;
    panel.classList.toggle('active', active);
    link.classList.toggle('active', active);
  });
  if (tabId === 'training') {
    requestAnimationFrame(() => {
      [trainingLoadChart, weeklyTssChart, weeklyTimeChart].forEach((c) => {
        if (c) c.resize();
      });
    });
  }
  if (tabId === 'health') {
    requestAnimationFrame(() => healthCharts.forEach((chart) => chart.resize()));
  }
  if (tabId === 'sports') {
    requestAnimationFrame(() => {
      [runningLoadChart, runningDistanceChart, runningLongChart].forEach((chart) => {
        if (chart) chart.resize();
      });
    });
  }
}

function initTabs() {
  const tab = currentTab();
  history.replaceState(null, '', '#' + tab);
  showTab(tab);
  window.addEventListener('hashchange', () => showTab(currentTab()));
}

function bindUpdatedRefresh() {
  const el = document.getElementById(UPDATED_ID);
  if (!el) return;
  el.addEventListener('click', () => {
    window.location.reload();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initRacingSubtabs();
  bindUpdatedRefresh();
  loadVersion().then(() => {
    loadOverview();
    loadPiHealth();
    loadTrainingLoad();
    loadRaces();
    loadCompletedRaces();
    loadPrSb();
    loadWeekly();
    loadHealth();
    loadGear();
    loadSportAnalysis();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selectedRace !== null) {
    clearSelectedRace();
  }
});
