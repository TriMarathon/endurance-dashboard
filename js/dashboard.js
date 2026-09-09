const DATA_URL = 'data/training_load.json';
const CHART_ID = 'training-load';
const STATUS_ID = 'status';
const UPDATED_ID = 'updated';

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

function buildChart(json) {
  const canvas = document.getElementById(CHART_ID);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const rows = Array.isArray(json.data) ? json.data : [];

  const labels = rows.map((row) => (row && row.date != null ? String(row.date) : ''));
  const tss = rows.map((row) => numOrNU(row && row.tss));
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
          label: 'TSS',
          data: tss,
          yAxisID: 'yTss',
          backgroundColor: palette.bar,
          borderColor: palette.barBorder,
          borderWidth: 1,
          barPercentage: 0.75,
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
            // Chart.js category-scale tick callbacks receive the numeric category
            // index (0..N), not the label string, so resolve the real label first.
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
            display: true,
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
  });
}

function setUpdatedTimestamp(generatedAt) {
  const el = document.getElementById(UPDATED_ID);
  if (!el) return;
  const datePart = generatedAt && typeof generatedAt === 'string'
    ? generatedAt.slice(0, 10)
    : '';
  el.textContent = datePart ? `Updated ${fmtMediumDate(datePart)}` : '';
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

  buildChart(json);
}

document.addEventListener('DOMContentLoaded', loadTrainingLoad);
