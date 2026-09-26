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
  return vm.runInContext('calculateUsatRankingScore(records)', context);
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

// Current 2026 regression example and more-than-three behavior.
const currentScores = [97.079, 93.608, 92.707, 91.5, 90.08];
assert.strictEqual(ranking(currentScores).toFixed(3), '94.465');
assert.strictEqual(ranking([100, 90, 80, 70]).toFixed(3), '90.000');

// Exactly three valid scores qualifies; two does not.
let html = renderSummary([90, 80, 70]);
assert(html.includes('USAT Ranking Score'));
assert(html.includes('80.000'));
html = renderSummary([90, 80]);
assert(!html.includes('USAT Ranking Score'));
assert(!html.includes('N/A'));

// Zero, null, missing, and non-numeric values do not count toward three.
html = renderSummary([100, 90, 0, null, undefined, '80', NaN]);
assert(!html.includes('USAT Ranking Score'));
assert.strictEqual(ranking([100, 90, 0, null, undefined, '80', NaN]), null);

// Races counts every displayed result; Best Score uses the highest valid score.
html = renderSummary([97.079, 93.608, 92.707, 0, null, '110']);
assert(html.includes('<span>Races</span><strong>6</strong>'));
assert(html.includes('<span>Best USAT Score</span><strong>97.079</strong>'));

// Exercise the real selected-year rendering path and visibility restoration.
context.fixture = [
  ...currentScores.map((score, index) => result(`2026-${index}`, 2026, score)),
  result('2025-1', 2025, 88),
  result('2025-2', 2025, 77),
];
vm.runInContext('usatResultsData = fixture; usatYear = 2026; renderUsatResults()', context);
assert(summary.innerHTML.includes('USAT Ranking Score'));
assert(summary.innerHTML.includes('94.465'));
assert(summary.innerHTML.includes('<span>Races</span><strong>5</strong>'));

vm.runInContext('usatYear = 2025; renderUsatResults()', context);
assert(!summary.innerHTML.includes('USAT Ranking Score'));
assert(summary.innerHTML.includes('<span>Races</span><strong>2</strong>'));
assert(summary.innerHTML.includes('<span>Best USAT Score</span><strong>88.000</strong>'));

vm.runInContext('usatYear = 2026; renderUsatResults()', context);
assert(summary.innerHTML.includes('USAT Ranking Score'));
assert(summary.innerHTML.includes('94.465'));

console.log('USAT ranking-score behavior checks passed.');
