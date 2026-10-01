const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const css = fs.readFileSync('css/dashboard.css', 'utf8');
const js = fs.readFileSync('js/dashboard.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert(css.includes('@media (min-width: 900px)'));
assert(css.includes('grid-template-columns: auto minmax(0, 1fr) auto'));
assert(css.includes('overflow-wrap: anywhere'));
assert(css.includes('.races-detail-row'));
assert(html.includes('data-subtab="prsb"'));
assert(html.includes('data-subtab="usat"'));
const racingTabOrder = ['upcoming', 'history', 'prsb', 'usat']
  .map((tab) => html.indexOf(`data-subtab="${tab}"`));
assert.deepStrictEqual(racingTabOrder, [...racingTabOrder].sort((a, b) => a - b));
assert(html.includes('css/dashboard.css?v=20260930-2'));
assert(html.includes('js/dashboard.js?v=20260930-2'));
assert(html.includes('data-tab="sports"'));
assert(html.includes('id="running-summary"'));
assert(html.includes('id="running-load"'));
assert(html.includes('id="running-distance"'));
assert(html.includes('id="running-long"'));
assert(html.includes('data-sport="running"'));
assert(html.includes('data-sport="cycling"'));
assert(html.includes('data-sport="swimming"'));
assert(html.includes('data-sport="strength"'));
assert(html.includes('data-sport="elliptical"'));
assert(html.includes('data-sport="other"'));
const sportTabOrder = ['running', 'cycling', 'swimming', 'strength', 'elliptical', 'other']
  .map((sport) => html.indexOf(`data-sport="${sport}"`));
assert.deepStrictEqual(sportTabOrder, [...sportTabOrder].sort((a, b) => a - b));
assert(js.includes("const BASE_SPORT_ANALYSIS_URL = 'data/sport_analysis.json'"));
assert(js.includes('selectedDays / 7'));
assert(js.includes('seconds / distance'));
assert(js.includes('row.is_race === true'));
assert(js.includes("activeSport = 'running'"));
assert(js.includes("&& requested !== 'elliptical'"));
assert(js.includes("elliptical ? 'Elliptical Load'"));
assert(css.includes('.running-summary'));
assert(css.includes('flex-wrap: wrap'));
assert(js.includes("const BASE_PR_SB_URL = 'data/pr_sb.json'"));
assert(js.includes("const BASE_USAT_RESULTS_URL = 'data/usat_results.json'"));
assert(js.includes('function renderUsatResults()'));
assert(js.includes('function calculateUsatOverallScore(records)'));
assert(js.includes('const RACE_HISTORY_METRICS = ['));
assert(js.includes("'pre_race_ctl'"));
assert(js.includes("'delta_atl'"));
assert(js.includes('function renderRaceHistoryMetrics(race)'));
assert(js.includes('record.age_grade_percent != null'));
assert(js.includes('function renderRaceAgeGrade(race)'));
assert(js.includes("race.ageGradePercent.toFixed(1) + '%'"));
assert(js.includes("if (!race.ageGradeExpected) return ''"));
assert(css.includes('.race-history-metrics'));
assert(css.includes('.race-history-age-grade'));
assert(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'));
assert(js.includes("items.push(['Overall Score'"));
assert(!js.includes('USAT Ranking Score'));
assert(!js.includes("['Average USAT Score'"));
assert(js.includes("Number(score).toFixed(3)"));
assert(js.includes("record.finishDisplay.replace(/\\.\\d+$/, '')"));
assert(html.includes('id="usat-results-table"'));
assert(html.includes('No imported USAT race scores.'));
assert(css.includes('.racing-subtabs::-webkit-scrollbar'));
assert(css.includes('.usat-table-wrap'));
assert(!html.includes('<option value="all">All</option>'));
assert(html.includes('<option value="PR" selected>PR</option>'));
assert(html.includes('id="prsb-season-control" hidden'));
assert(css.includes('.prsb-controls label[hidden] { display: none; }'));
assert(js.includes("let prSbType = 'PR'"));
assert(js.includes("seasonControl.hidden = prSbType !== 'SB'"));
assert(js.includes('function updatePrSbControls()'));
assert(js.includes("record.type !== prSbType"));
assert(js.includes("String(record.seasonYear) === prSbSeason"));
assert(js.includes('}).sort(comparePrSbEvents)'));
const eventOrderBlock = js.match(/const PR_SB_EVENT_ORDER = \[([\s\S]*?)\];/);
assert(eventOrderBlock);
assert.deepStrictEqual(
  [...eventOrderBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]),
  ['1 Mile', '5K', '4 Mile', '5 Mile', '8K', '10K', '10 Mile',
    'Half Marathon', 'Marathon', 'Sprint', 'Olympic', '70.3', '140.6'],
);

function extractFunction(name) {
  const start = js.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing function ${name}`);
  const bodyStart = js.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < js.length; i += 1) {
    if (js[i] === '{') depth += 1;
    if (js[i] === '}') depth -= 1;
    if (depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

const ageGradeContext = {};
vm.createContext(ageGradeContext);
vm.runInContext(`
  const COMPLETED_RACES_AMBIGUOUS_CATEGORY = '5 Mile / 8K';
  const COMPLETED_RACES_5MILE_CATEGORY = '5 Mile';
  const RUNNING_AGE_GRADE_EVENTS = new Set([
    '1 Mile', '5K', '4 Mile', '5 Mile', '8K', '10K', '10 Mile',
    'Half Marathon', 'Marathon'
  ]);
  ${extractFunction('normalizeCompletedRace')}
  ${extractFunction('renderRaceAgeGrade')}
  this.normalizeCompletedRace = normalizeCompletedRace;
  this.renderRaceAgeGrade = renderRaceAgeGrade;
`, ageGradeContext);

const gradedRun = ageGradeContext.normalizeCompletedRace({
  category: '5K', age_grade_percent: 83.74,
});
assert(ageGradeContext.renderRaceAgeGrade(gradedRun).includes('Age Grade 83.7%'));
const over100 = ageGradeContext.normalizeCompletedRace({
  category: 'Marathon', age_grade_percent: 104.96,
});
assert(ageGradeContext.renderRaceAgeGrade(over100).includes('Age Grade 105.0%'));
const missingGrade = ageGradeContext.normalizeCompletedRace({
  category: '10K', age_grade_percent: null,
});
assert(ageGradeContext.renderRaceAgeGrade(missingGrade).includes('Age Grade —'));
const triathlon = ageGradeContext.normalizeCompletedRace({
  category: 'Sprint', age_grade_percent: 83.7,
});
assert.strictEqual(ageGradeContext.renderRaceAgeGrade(triathlon), '');
const ambiguous = ageGradeContext.normalizeCompletedRace({
  category: '5 Mile / 8K', age_grade_percent: 83.7,
});
assert.strictEqual(ageGradeContext.renderRaceAgeGrade(ambiguous), '');

console.log('Racing/PR-SB static smoke checks passed.');
