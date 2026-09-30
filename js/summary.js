/* Compact view of the existing sport_analysis activity contract. */
const SUMMARY_SPORTS = [
  ['running', 'Run', 'run'], ['cycling', 'Bike', 'bike'],
  ['swimming', 'Swim', 'swim'], ['strength', 'Strength', 'other'],
  ['elliptical', 'Elliptical', 'other'], ['other', 'Other', 'other'],
];
const SUMMARY_DAY_MS = 86400000;
function summaryToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function summaryDate(ms) { return new Date(ms).toISOString().slice(0, 10); }
function summaryEmptySports() {
  return Object.fromEntries(SUMMARY_SPORTS.map(([key]) => [key, { tss: 0, seconds: 0 }]));
}
function buildSummary(doc, today = summaryToday()) {
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const monday = todayMs - ((new Date(todayMs).getUTCDay() + 6) % 7) * SUMMARY_DAY_MS;
  const days = new Map();
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const start = monday + (index - 3) * 7 * SUMMARY_DAY_MS;
    return {
      start: summaryDate(start), end: summaryDate(start + 6 * SUMMARY_DAY_MS),
      current: index === 3, tss: 0, seconds: 0, sports: summaryEmptySports(),
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const date = summaryDate(start + dayIndex * SUMMARY_DAY_MS);
        const day = { date, tss: 0, seconds: 0, sports: summaryEmptySports(),
          future: date > today, unavailable: date <= today && date > doc.end_date };
        days.set(date, day);
        return day;
      }),
    };
  });
  // Exported dates are already local calendar dates. Never parse activity timestamps.
  SUMMARY_SPORTS.forEach(([sport]) => {
    (doc.sports[sport]?.activities || []).forEach((activity) => {
      const day = days.get(activity.date);
      if (!day || day.future || day.unavailable) return;
      const positive = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;
      day.sports[sport].tss += positive(activity.tss);
      day.sports[sport].seconds += positive(activity.duration_seconds);
    });
  });
  weeks.forEach((week) => week.days.forEach((day) => {
    SUMMARY_SPORTS.forEach(([sport]) => {
      day.tss += day.sports[sport].tss;
      day.seconds += day.sports[sport].seconds;
      week.sports[sport].tss += day.sports[sport].tss;
      week.sports[sport].seconds += day.sports[sport].seconds;
    });
    week.tss += day.tss;
    week.seconds += day.seconds;
  }));
  return weeks;
}
function summaryDotDiameter(tss) {
  return tss > 0 ? Math.min(36, Math.max(8, 2.4 * Math.sqrt(tss))) : 4;
}
function summaryTime(seconds) {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
function summaryDateLabel(date, weekday = false) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', ...(weekday ? { weekday: 'short', year: 'numeric' } : {}),
  }).format(new Date(`${date}T00:00:00Z`));
}
function summaryDayDetails(day) {
  const date = summaryDateLabel(day.date, true);
  if (day.future) return `${date} · Future day`;
  if (day.unavailable) return `${date} · Awaiting synced data`;
  const sports = SUMMARY_SPORTS.filter(([key]) => day.sports[key].tss || day.sports[key].seconds)
    .map(([key, label]) => `${label}: ${Math.round(day.sports[key].tss)} TSS, ${summaryTime(day.sports[key].seconds)}`);
  return `${date} · ${Math.round(day.tss)} TSS · ${summaryTime(day.seconds)}${sports.length ? ' · ' + sports.join(' · ') : ' · Rest day'}`;
}
function renderSummary(doc, today = summaryToday()) {
  const container = document.getElementById('summary-content');
  if (!container) return;
  const weeks = buildSummary(doc, today);
  const maxima = { seconds: Math.max(1, ...weeks.map((w) => w.seconds)), tss: Math.max(1, ...weeks.map((w) => w.tss)) };
  const bar = (week, metric, label) => {
    const detail = SUMMARY_SPORTS.map(([key, name]) => `${name}: ${metric === 'seconds' ? summaryTime(week.sports[key][metric]) : Math.round(week.sports[key][metric]) + ' TSS'}`).join(' · ');
    return `<div class="summary-metric"><span>${label}</span><div class="summary-bar" role="img" aria-label="${label}: ${detail}" title="${detail}">${SUMMARY_SPORTS.map(([key, , color]) => `<span class="summary-segment summary-sport-${key}" style="width:${week.sports[key][metric] / maxima[metric] * 100}%;--summary-color:var(--sport-${color}-bg)"></span>`).join('')}</div><strong>${metric === 'seconds' ? summaryTime(week.seconds) : Math.round(week.tss) + ' TSS'}</strong></div>`;
  };
  container.innerHTML = `<div class="summary-legend">${SUMMARY_SPORTS.map(([key, label, color]) => `<span><i class="summary-sport-${key}" style="--summary-color:var(--sport-${color}-bg)"></i>${label}</span>`).join('')}</div>
    <p class="summary-hint">Dot area represents daily TSS. Select a day for details. Data through ${summaryDateLabel(doc.end_date)}.</p>
    <div class="summary-weeks">${weeks.map((week, wi) => `<section class="summary-week" aria-label="Week of ${summaryDateLabel(week.start)}">
      <div class="summary-week-label">${summaryDateLabel(week.start)} – ${summaryDateLabel(week.end)}${week.current ? '<small>This week · so far</small>' : ''}</div>
      <div class="summary-days">${week.days.map((day, di) => `<div class="summary-day"><span aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'][di]}</span><button type="button" class="summary-day-button${day.future ? ' future' : day.unavailable ? ' unavailable' : day.tss === 0 ? ' rest' : ''}" data-summary-day="${wi * 7 + di}" aria-label="${summaryDayDetails(day)}" aria-controls="summary-detail" aria-pressed="false"><i style="width:${day.future || day.unavailable ? 8 : summaryDotDiameter(day.tss)}px;height:${day.future || day.unavailable ? 8 : summaryDotDiameter(day.tss)}px" aria-hidden="true"></i></button></div>`).join('')}</div>
      <div class="summary-bars">${bar(week, 'seconds', 'Time')}${bar(week, 'tss', 'TSS')}</div>
    </section>`).join('')}</div><div id="summary-detail" class="summary-detail" role="status" aria-live="polite">Select a day to see training details.</div>`;
  const allDays = weeks.flatMap((week) => week.days);
  let pinned = null;
  const display = (index) => {
    document.getElementById('summary-detail').textContent = index === null
      ? 'Select a day to see training details.' : summaryDayDetails(allDays[index]);
  };
  const buttons = container.querySelectorAll('[data-summary-day]');
  buttons.forEach((button) => {
    const index = Number(button.dataset.summaryDay);
    button.addEventListener('mouseenter', () => display(index));
    button.addEventListener('mouseleave', () => display(pinned));
    button.addEventListener('focus', () => display(index));
    button.addEventListener('blur', () => display(pinned));
    button.addEventListener('click', () => {
      pinned = pinned === index ? null : index;
      buttons.forEach((item) => item.setAttribute('aria-pressed', String(Number(item.dataset.summaryDay) === pinned)));
      display(pinned);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      pinned = null;
      buttons.forEach((item) => item.setAttribute('aria-pressed', 'false'));
      display(null);
    });
  });
}
if (typeof module !== 'undefined') module.exports = { buildSummary, summaryToday, summaryDotDiameter, summaryDayDetails, summaryTime, renderSummary };
