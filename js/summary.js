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
function buildSummary(doc, today = summaryToday(), weekOffset = 0, races = []) {
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const monday = todayMs - ((new Date(todayMs).getUTCDay() + 6) % 7) * SUMMARY_DAY_MS;
  const days = new Map();
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const start = monday + (index - 3 + weekOffset) * 7 * SUMMARY_DAY_MS;
    return {
      start: summaryDate(start), end: summaryDate(start + 6 * SUMMARY_DAY_MS),
      current: start === monday, future: start > todayMs, tss: 0, seconds: 0, sports: summaryEmptySports(),
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const date = summaryDate(start + dayIndex * SUMMARY_DAY_MS);
        const day = { date, tss: 0, seconds: 0, sports: summaryEmptySports(),
          outsideRange: Boolean(doc.start_date && date < doc.start_date),
          races: races.filter((race) => race.date === date && date >= today),
          future: date > today, unavailable: date <= today &&
            (date > doc.end_date || (doc.start_date && date < doc.start_date)) };
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
  if (day.outsideRange) return `${date} · Outside exported activity range`;
  if (day.unavailable) return `${date} · Awaiting synced data`;
  const sports = SUMMARY_SPORTS.filter(([key]) => day.sports[key].tss || day.sports[key].seconds)
    .map(([key, label]) => `${label}: ${Math.round(day.sports[key].tss)} TSS, ${summaryTime(day.sports[key].seconds)}`);
  return `${date} · ${Math.round(day.tss)} TSS · ${summaryTime(day.seconds)}${sports.length ? ' · ' + sports.join(' · ') : ' · Rest day'}`;
}
// All data and navigation stay in memory; either fetch may finish first.
const summaryState = { doc: null, today: null, weekOffset: 0, races: [], selectedDate: null };
function setSummaryRaces(races) {
  summaryState.races = races;
  if (summaryState.doc) renderSummary(summaryState.doc, summaryState.today);
}
function summaryEscape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function summaryRangeLabel(weeks) {
  const first = weeks[0].start;
  const last = weeks[3].end;
  const label = (date) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
  return `${label(first)} – ${label(last)}`;
}
function summaryAccessibleDay(day) {
  const races = day.races.map((race) => `Race: ${race.name || 'Scheduled race'}`).join(' · ');
  return summaryDayDetails(day) + (races ? ' · ' + races : '');
}
function summaryRaceDetails(race) {
  // Only display fields from the public Future Race contract.
  const fields = [race.date, race.race_type, race.registration_status]
    .filter((value) => value != null && value !== '').map(summaryEscape).join(' · ');
  const note = typeof race.pre_race_notes === 'string' && race.pre_race_notes.trim()
    ? `<details class="race-plan"><summary>Race Plan / Notes</summary><div class="race-plan-text">${summaryEscape(race.pre_race_notes)}</div></details>` : '';
  return `<section class="summary-race"><strong>${summaryEscape(race.name || 'Scheduled race')}</strong><div>${fields}</div>${note}</section>`;
}
function renderSummary(doc, today = summaryToday()) {
  summaryState.doc = doc;
  summaryState.today = today;
  const container = document.getElementById('summary-content');
  if (!container) return;
  const weeks = buildSummary(doc, today, summaryState.weekOffset, summaryState.races);
  const maxima = { seconds: Math.max(1, ...weeks.map((w) => w.seconds)), tss: Math.max(1, ...weeks.map((w) => w.tss)) };
  const bar = (week, metric, label) => {
    const unavailable = week.future || week.days.every((day) => day.unavailable);
    const detail = unavailable ? (week.future ? 'Future week' : 'Outside exported activity range') :
      SUMMARY_SPORTS.map(([key, name]) => `${name}: ${metric === 'seconds' ? summaryTime(week.sports[key][metric]) : Math.round(week.sports[key][metric]) + ' TSS'}`).join(' · ');
    return `<div class="summary-metric"><span>${label}</span><div class="summary-bar" role="img" aria-label="${label}: ${detail}" title="${detail}">${unavailable ? '' : SUMMARY_SPORTS.map(([key, , color]) => `<span class="summary-segment summary-sport-${key}" style="width:${week.sports[key][metric] / maxima[metric] * 100}%;--summary-color:var(--sport-${color}-bg)"></span>`).join('')}</div><strong>${unavailable ? '—' : metric === 'seconds' ? summaryTime(week.seconds) : Math.round(week.tss) + ' TSS'}</strong></div>`;
  };
  container.innerHTML = `<div class="summary-navigation" aria-label="Calendar navigation">
    <button type="button" data-summary-nav="-1" aria-label="Previous week">‹</button>
    <span class="summary-range" aria-live="polite">${summaryRangeLabel(weeks)}</span>
    <button type="button" data-summary-nav="1" aria-label="Next week">›</button>
    <button type="button" data-summary-nav="today" aria-label="Return to current week">Today</button>
    <small>Data through ${summaryDateLabel(doc.end_date)}</small>
    </div><div class="summary-legend">${SUMMARY_SPORTS.map(([key, label, color]) => `<span><i class="summary-sport-${key}" style="--summary-color:var(--sport-${color}-bg)"></i>${label}</span>`).join('')}</div>
    <div class="summary-weeks">${weeks.map((week, wi) => `<section class="summary-week${week.current ? ' summary-current-week' : ''}" aria-label="Week of ${summaryDateLabel(week.start)}">
      <div class="summary-week-label">${summaryDateLabel(week.start)} – ${summaryDateLabel(week.end)}${week.current ? '<small>This week · so far</small>' : ''}</div>
      <div class="summary-days">${week.days.map((day, di) => `<div class="summary-day"><span aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'][di]}</span><button type="button" class="summary-day-button${day.future ? ' future' : day.unavailable ? ' unavailable' : day.tss === 0 ? ' rest' : ''}" data-summary-day="${wi * 7 + di}" data-summary-date="${day.date}" aria-label="${summaryEscape(summaryAccessibleDay(day))}" aria-controls="summary-detail" aria-pressed="false"><i style="width:${day.future || day.unavailable ? 8 : summaryDotDiameter(day.tss)}px;height:${day.future || day.unavailable ? 8 : summaryDotDiameter(day.tss)}px" aria-hidden="true"></i>${day.races.length ? `<span class="summary-race-flag" aria-hidden="true">⚑${day.races.length > 1 ? '<b>' + day.races.length + '</b>' : ''}</span>` : ''}</button></div>`).join('')}</div>
      <div class="summary-bars">${bar(week, 'seconds', 'Time')}${bar(week, 'tss', 'TSS')}</div>
    </section>`).join('')}</div><div class="summary-detail-slot"></div>`;
  container.querySelectorAll('[data-summary-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      const direction = button.dataset.summaryNav;
      summaryState.weekOffset = direction === 'today' ? 0 : summaryState.weekOffset + Number(direction);
      summaryState.selectedDate = null;
      renderSummary(doc, today);
      container.querySelector(`[data-summary-nav="${direction}"]`).focus();
    });
  });
  const allDays = weeks.flatMap((week) => week.days);
  const buttons = container.querySelectorAll('[data-summary-day]');
  const close = () => {
    const date = summaryState.selectedDate;
    summaryState.selectedDate = null;
    container.querySelector('.summary-detail-slot').replaceChildren();
    buttons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
    container.querySelector(`[data-summary-date="${date}"]`)?.focus();
  };
  const display = (day) => {
    summaryState.selectedDate = day.date;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.summaryDate === day.date)));
    container.querySelector('.summary-detail-slot').innerHTML = `<section id="summary-detail" class="summary-detail" role="region" aria-label="Selected day details" aria-live="polite">
      <button type="button" class="summary-detail-close" aria-label="Close day details">Close</button>
      <div>${summaryEscape(summaryDayDetails(day))}</div>${day.races.map(summaryRaceDetails).join('')}</section>`;
    container.querySelector('.summary-detail-close').addEventListener('click', close);
    container.querySelector('#summary-detail').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  };
  buttons.forEach((button) => {
    const day = allDays[Number(button.dataset.summaryDay)];
    button.addEventListener('click', () => {
      if (summaryState.selectedDate === day.date) close();
      else {
        display(day);
        container.querySelector('#summary-detail').scrollIntoView({ block: 'nearest' });
      }
    });
    button.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  });
  const selected = allDays.find((day) => day.date === summaryState.selectedDate);
  if (selected) display(selected);
}
if (typeof module !== 'undefined') module.exports = {
  buildSummary, summaryToday, summaryDotDiameter, summaryDayDetails, summaryTime,
  summaryRangeLabel, summaryRaceDetails, renderSummary,
};
