const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('css/dashboard.css', 'utf8');
const js = fs.readFileSync('js/dashboard.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert(css.includes('@media (min-width: 900px)'));
assert(css.includes('grid-template-columns: auto minmax(0, 1fr) auto'));
assert(css.includes('overflow-wrap: anywhere'));
assert(css.includes('.races-detail-row'));
assert(html.includes('data-subtab="prsb"'));
assert(html.includes('css/dashboard.css?v=20260923-2'));
assert(html.includes('js/dashboard.js?v=20260923-2'));
assert(html.includes('data-tab="sports"'));
assert(html.includes('id="running-summary"'));
assert(html.includes('id="running-load"'));
assert(html.includes('id="running-distance"'));
assert(html.includes('id="running-long"'));
assert(html.includes('data-sport="running"'));
assert(html.includes('data-sport="cycling"'));
assert(js.includes("const BASE_SPORT_ANALYSIS_URL = 'data/sport_analysis.json'"));
assert(js.includes('selectedDays / 7'));
assert(js.includes('seconds / distance'));
assert(js.includes('row.is_race === true'));
assert(js.includes("activeSport = 'running'"));
assert(js.includes("requested !== 'running' && requested !== 'cycling'"));
assert(js.includes("cycling ? 'Cycling Load' : 'Running Load'"));
assert(css.includes('.running-summary'));
assert(js.includes("const BASE_PR_SB_URL = 'data/pr_sb.json'"));
assert(!html.includes('<option value="all">All</option>'));
assert(html.includes('<option value="PR" selected>PR</option>'));
assert(html.includes('id="prsb-season-control" hidden'));
assert(css.includes('.prsb-controls label[hidden] { display: none; }'));
assert(js.includes("let prSbType = 'PR'"));
assert(js.includes("seasonControl.hidden = prSbType !== 'SB'"));
assert(js.includes('function updatePrSbControls()'));
assert(js.includes("record.type !== prSbType"));
assert(js.includes("String(record.seasonYear) === prSbSeason"));
assert(js.includes(']).sort(comparePrSbEvents)'));
assert.deepStrictEqual(
  [...js.matchAll(/'([^']+)'/g)].map((match) => match[1]).filter((value) => [
    '1 Mile', '5K', '4 Mile', '5 Mile', '8K', '10K', '10 Mile',
    'Half Marathon', 'Marathon', 'Sprint', 'Olympic', '70.3', '140.6',
  ].includes(value)).slice(-13),
  ['1 Mile', '5K', '4 Mile', '5 Mile', '8K', '10K', '10 Mile',
    'Half Marathon', 'Marathon', 'Sprint', 'Olympic', '70.3', '140.6'],
);

console.log('Racing/PR-SB static smoke checks passed.');
