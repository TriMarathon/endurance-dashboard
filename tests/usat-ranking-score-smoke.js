const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('js/dashboard.js', 'utf8');
const summary = { innerHTML: '' };
const tbody = { innerHTML: '' };
const empty = { hidden: false };
const years = {
  hidden: false,
  innerHTML: '',
  querySelectorAll() { return []; },
};
const documentStub = {
  addEventListener() {},
  createElement() {
    return {
      innerHTML: '',
      set textContent(value) { this.innerHTML = String(value); },
    };
  },
  getElementById(id) {
    if (id === 'usat-summary') return summary;
    if (id === 'usat-results-empty') return empty;
    if (id === 'usat-years') return years;
    return null;
  },
  querySelector(selector) {
    return selector === '#usat-results-table tbody' ? tbody : null;
  },
};
const context = vm.createContext({
  console,
  document: documentStub,
  window: {},
});
vm.runInContext(code, context);

function ranking(scores) {
  context.records = scores.map((score) => ({ score }));
  return vm.runInContext('calculateUsatOverallScore(records)', context);
}

function renderSummary(scores) {
  summary.innerHTML = '';
  context.records = scores.map((score) => ({ score }));
  vm.runInContext('renderUsatSummary(records)', context);
  return summary.innerHTML;
}

function result(id, year, score) {
  return {
    source_result_id: id,
    event_date: `${year}-08-01`,
    event_name: `Race ${id}`,
    race_label: 'Sprint Triathlon',
    placement: 1,
    finish_time_seconds: 3600,
    finish_time_display: '1:00:00.000',
    usat_score: score,
  };
}

function finishTime(finishDisplay, finishSeconds = null) {
  context.record = { finishDisplay, finishSeconds };
  return vm.runInContext('formatUsatTime(record)', context);
}

// Current 2026 regression example and more-than-three behavior.
const currentScores = [97.079, 93.608, 92.707, 91.5, 90.08];
assert.strictEqual(ranking(currentScores).toFixed(3), '94.427');
assert.notStrictEqual(ranking(currentScores).toFixed(3), '94.465');
assert.strictEqual(ranking([100, 90, 80, 70]).toFixed(3), '89.256');

// Exactly three valid scores qualifies; two does not.
let html = renderSummary([90, 80, 70]);
assert(html.includes('Overall Score'));
assert(html.includes('79.162'));
html = renderSummary([90, 80]);
assert(!html.includes('Overall Score'));
assert(!html.includes('N/A'));

// Zero, null, missing, and non-numeric values do not count toward three.
html = renderSummary([100, 90, 0, null, undefined, '80', NaN]);
assert(!html.includes('Overall Score'));
assert.strictEqual(ranking([100, 90, 0, null, undefined, '80', NaN]), null);

// Races counts every displayed result; Best Score uses the highest valid score.
html = renderSummary([97.079, 93.608, 92.707, 0, null, '110']);
assert(html.includes('<span>Races</span><strong>6</strong>'));
assert(html.includes('<span>Best USAT Score</span><strong>97.079</strong>'));

// Exercise the real selected-year rendering path and visibility restoration.
context.fixture = [
  ...currentScores.map((score, index) => result(`2026-${index}`, 2026, score)),
  result('2024-1', 2024, 90),
  result('2024-2', 2024, 90),
  result('2024-3', 2024, 90),
  result('2025-1', 2025, 88),
  result('2025-2', 2025, 77),
];
vm.runInContext('usatResultsData = fixture; usatYear = 2026; renderUsatResults()', context);
assert(summary.innerHTML.includes('Overall Score'));
assert(summary.innerHTML.includes('94.427'));
assert(summary.innerHTML.includes('<span>Races</span><strong>5</strong>'));

vm.runInContext('usatYear = 2025; renderUsatResults()', context);
assert(!summary.innerHTML.includes('Overall Score'));
assert(summary.innerHTML.includes('<span>Races</span><strong>2</strong>'));
assert(summary.innerHTML.includes('<span>Best USAT Score</span><strong>88.000</strong>'));

vm.runInContext('usatYear = 2024; renderUsatResults()', context);
assert(summary.innerHTML.includes('Overall Score'));
assert(summary.innerHTML.includes('90.000'));

vm.runInContext('usatYear = 2026; renderUsatResults()', context);
assert(summary.innerHTML.includes('Overall Score'));
assert(summary.innerHTML.includes('94.427'));

// Finish-time display truncates fractional seconds instead of rounding.
assert.strictEqual(finishTime('1:17:22.500'), '1:17:22');
assert.strictEqual(finishTime('2:34:49.900'), '2:34:49');
assert.strictEqual(finishTime('1:20:44.693'), '1:20:44');
assert.strictEqual(finishTime('4:39:57.000'), '4:39:57');
assert.strictEqual(finishTime('1:20:44'), '1:20:44');
assert.strictEqual(finishTime(null, 4642.9), '1:17:22');
assert.strictEqual(finishTime(null), '—');

console.log('USAT ranking-score behavior checks passed.');
