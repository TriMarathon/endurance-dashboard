const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const container = { innerHTML: '' };
const context = vm.createContext({console, document: {
  addEventListener() {},
  getElementById(id) { return id === 'workout-history-content' ? container : null; },
  createElement() { return {innerHTML:'', set textContent(v) { this.innerHTML = String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }}; },
}, window: {}});
const source = fs.readFileSync('js/dashboard.js','utf8');
vm.runInContext(source, context);
context.fixture = [
  {garmin_activity_id:1,sport:'running',start_time:'2026-10-14 17:09:00',activity_name:'Older',distance_meters:1609.344,duration_seconds:3627,tss:null},
  {garmin_activity_id:2,sport:'running',start_time:'2026-10-15T05:26:00-05:00',activity_name:'Form <script>',distance_meters:null,duration_seconds:null,tss:0},
  {garmin_activity_id:2,sport:'running',start_time:'2026-10-15T05:26:00-05:00',activity_name:'Duplicate'},
  {garmin_activity_id:3,sport:'swimming',start_time:'2026-10-15 06:00:00',activity_name:'Swim',distance_meters:1920.24,duration_seconds:3627,tss:42},
  {garmin_activity_id:4,sport:'cycling',start_time:'2026-10-15 06:00:00',activity_name:'Ride',distance_meters:16093.44},
  {garmin_activity_id:7,sport:'other',start_time:'2026-10-15 08:00:00',activity_name:'Strength Zero',distance_meters:0,duration_seconds:0,tss:12},
  {garmin_activity_id:5,sport:'other',start_time:'2026-10-15 07:00:00',activity_name:'Multisport',tss:100},
  {garmin_activity_id:6,sport:'running',start_time:'2025-10-15 06:00:00',activity_name:'Outside range'},
];
function evaluate(code) { return vm.runInContext(code,context); }
evaluate("workoutHistory = fixture; runningRange = {start:'2026-10-14',end:'2026-10-15'}; renderWorkoutHistory()");
let html = container.innerHTML;
assert.equal(evaluate('selectedWorkoutHistory().length'),2);
assert.equal(evaluate('selectedWorkoutHistory()[0].garmin_activity_id'),2);
assert(html.includes('05:26') && html.includes('17:09'));
assert(!/AM|PM/.test(html));
assert(html.indexOf('Form &lt;script&gt;') < html.indexOf('Older'));
assert(html.includes('Oct 15, 2026'));
assert(html.includes('1.0 mi'));
assert(html.includes('1:00:27'));
assert(html.includes('<td>—</td>'));
assert(html.includes('TSS 0.0') && html.includes('TSS —'));
assert(!html.includes('Duplicate') && !html.includes('Outside range') && !html.includes('Swim'));
assert(!html.includes('>Type<'));
assert(html.includes('wh-activity'));
assert(html.includes('workout-history-mobile'));
assert(html.includes('wh-mobile-meta') && html.includes('wh-mobile-detail'));
evaluate("activeSport = 'swimming'; renderWorkoutHistory()");
assert(container.innerHTML.includes('2,100 yd'));
assert(!container.innerHTML.includes('Older'));
evaluate("activeSport = 'cycling'; renderWorkoutHistory()");
assert(container.innerHTML.includes('10.0 mi'));
evaluate("activeSport = 'other'; renderWorkoutHistory()");
assert(container.innerHTML.includes('Strength Zero'));
assert(container.innerHTML.includes('<td>—</td>'));
assert(!container.innerHTML.includes('0.0 mi'));
assert(!container.innerHTML.includes('0:00'));
evaluate("activeSport = 'running'; runningRange = {start:'2026-10-15',end:'2026-10-15'}; renderWorkoutHistory()");
assert(!container.innerHTML.includes('Older'));
evaluate("runningRange = {start:'2027-01-01',end:'2027-01-02'}; renderWorkoutHistory()");
assert(container.innerHTML.includes('No workouts'));
evaluate('workoutHistoryFailed = true; renderWorkoutHistory()');
assert(container.innerHTML.includes('Workout history unavailable'));
// Existing date/sport render path updates history, with no extra controls.
assert(source.includes('function renderRunning() {\n  renderWorkoutHistory();'));
assert(source.includes('ACTIVITIES_URL = BASE_ACTIVITIES_URL + qs;'));
const css=fs.readFileSync('css/dashboard.css','utf8');
assert(/\.workout-history-scroll \{ max-height: 420px; overflow: auto;/.test(css));
assert(css.includes('table-layout: fixed'));
assert(!/\.wh-activity\s*\{\s*width:/.test(css));
assert(css.includes('@media (max-width: 767px)'));
assert(css.includes('.workout-history-table { display: none; }'));
assert(css.includes('.workout-history-mobile { display: block; }'));
const index=fs.readFileSync('index.html','utf8');
assert(index.indexOf('id="workout-history-title"') > index.indexOf('id="tab-sports"'));
assert(index.indexOf('id="workout-history-title"') < index.indexOf('id="tab-racing"'));
assert(!index.includes('data-tab="activities"'));
console.log('Workout History tests passed: rows, order, local 24-hour time, units, nulls, escaping, deduplication, sport/date filters, states and responsive layout.');
