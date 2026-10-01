const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tbody = { innerHTML: '' };
const context = vm.createContext({
  document: {
    addEventListener() {},
    getElementById() { return null; },
    querySelector(selector) { return selector === '#race-history-table tbody' ? tbody : null; },
    createElement() {
      return {
        innerHTML: '',
        set textContent(value) {
          this.innerHTML = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        },
      };
    },
  },
  window: {}, console,
});
vm.runInContext(fs.readFileSync('js/dashboard.js', 'utf8'), context);
const keys = ['pre_race_ctl', 'race_day_tsb', 'pre_race_load_ratio',
  'pre_race_ramp_rate', 'race_tss', 'day_tss', 'delta_atl'];
function render(fields) {
  context.fixture = [{ date: '2026-09-12', activity_name: 'Race', category: '5K',
    duration_seconds: 1200, age_grade_percent: 83.74, ...fields }];
  vm.runInContext("completedRacesData = fixture; historyYear = 'all'; renderRaceHistoryTable()", context);
  return tbody.innerHTML;
}
// Missing, null, blank and invalid fields never create an empty Load control.
for (const value of [undefined, null, '', '  ', 'invalid', NaN, Infinity]) {
  const html = render(Object.fromEntries(keys.map(key => [key, value])));
  assert(!html.includes('completed-race-load'));
  assert(html.includes('20:00<div class="race-history-age-grade">Age Grade 83.7%</div>'));
}
// Each individual field (including zero) is sufficient; missing display stays unchanged.
for (const key of keys) {
  for (const value of [0, 12.3]) {
    const html = render({ [key]: value });
    assert(html.includes('<details class="race-plan completed-race-load"><summary>Load</summary>'));
    assert.equal((html.match(/<dt /g) || []).length, 7);
    assert(html.includes('<dd>—</dd>'));
    assert(!html.includes('<details open'));
    assert(!html.includes('<summary>Notes</summary>'));
  }
}
const html = render({
  pre_race_ctl: 90.2, race_day_tsb: 17.6, pre_race_load_ratio: 0.8,
  pre_race_ramp_rate: -6.4, race_tss: 365.8, day_tss: 365.8, delta_atl: 39,
  pre_race_notes: 'Plan <script> & water', post_race_notes: 'Review',
});
assert.deepEqual([...html.matchAll(/<dd>(.*?)<\/dd>/g)].map(match => match[1]),
  ['90.2', '+17.6', '0.80', '-6.4', '365.8', '365.8', '+39.0']);
assert(html.includes('</details><details class="race-plan completed-race-notes"><summary>Notes</summary>'));
assert(!/<details[^>]*\b(open|name)=?/.test(html));
assert(html.includes('Plan &lt;script&gt; &amp; water'));
const resultRow = html.split('</tr>')[0];
assert(resultRow.includes('Age Grade 83.7%'));
assert(!resultRow.includes('<details'));
// Preserve the existing partial-data behavior for null (zero) versus absent (dash).
const partial = render({ pre_race_ctl: 90.2, race_day_tsb: null });
assert(partial.includes('<dd>0.0</dd>'));
assert(partial.includes('<dd>—</dd>'));
console.log('Race History render tests passed: Load presence, defaults, values, missing data, independent Notes and result placement.');
