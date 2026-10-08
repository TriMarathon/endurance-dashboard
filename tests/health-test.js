const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const elements = new Map();
function el(id) {
  if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', textContent: '', disabled: false,
    classList: { toggle() {} }, addEventListener() {}, getContext() { return {}; } });
  return elements.get(id);
}
const context = vm.createContext({ console, Date, Map, getComputedStyle() { return { getPropertyValue() { return '#abcdef'; } }; }, document: {
  createElement() { return { textContent: '', get innerHTML() { return this.textContent; } }; },
  addEventListener() {}, querySelectorAll() { return []; },
  getElementById(id) { return el(id); },
}, window: { innerWidth: 390, matchMedia() { return { matches: true }; } },
Chart: class { constructor(_canvas, config) { this.config = config; } destroy() {} },
});
vm.runInContext(fs.readFileSync(path.join(root, 'js/dashboard.js'), 'utf8'), context);
const run = (code) => vm.runInContext(code, context);
const json = (code) => JSON.parse(JSON.stringify(run(code)));
assert.deepStrictEqual(json('healthDefaultRange([], new Date(2026, 9, 7))'), { start: '2026-07-10', end: '2026-10-07' });
assert.deepStrictEqual(json('healthDefaultRange([], new Date(2026, 2, 9))'), { start: '2025-12-10', end: '2026-03-09' });
assert.equal(run("validHealthDate('2026-02-30')"), false);
run(`healthRange = {start:'2026-10-01', end:'2026-10-28'};`);
const reading = (date, s, d, p, time = '07:00:00') => ({ date, systolic_mmhg:s, diastolic_mmhg:d, cuff_pulse_bpm:p,
  measured_at_local:date+'T'+time, measured_at_utc:date+'T12:00:00Z' });
context.readings = [reading('2026-10-01',120,80,60), reading('2026-10-03',111,76,57),
  reading('2026-10-03',112,75,56), reading('2026-10-28',110,77,58,'19:06:00')];
context.readings.forEach(row => { row.notes = 'private notes'; });
const days = json('aggregateBloodPressure(readings, healthRange)');
assert.equal(days.length, 3);
assert.deepStrictEqual(days[1], {date:'2026-10-03', systolic_mmhg:111.5, diastolic_mmhg:75.5, cuff_pulse_bpm:56.5, count:2});
assert.equal(run('readingCount(1)'), '1 reading');
assert.equal(run('readingCount(4)'), '4 readings');
assert.equal(run('readingCount(0)'), '0 readings');
assert.equal(json('bpPointDetail(aggregateBloodPressure(readings, healthRange)[1])').pop(), '2 readings');
assert.equal(json("aggregateBloodPressure(readings, {start:'2026-10-03',end:'2026-10-03'})").length, 1);
assert.equal(json('aggregateBloodPressure([], healthRange)').length, 0);
assert.equal(json("aggregateBloodPressure(readings, {start:'2020-01-01',end:'2020-12-31'})").length, 0);
run(`fullHealth = {data:[{date:'2026-10-07',sleep_hours:7.7,sleep_score:82,weight_lbs:155.4,resting_heart_rate_bpm:44,hrv_ms:71}],blood_pressure:readings};
activeHealth='blood-pressure'; renderHealth();`);
assert(el('health-summary').innerHTML.includes('110 / 77 mmHg'));
assert(!el('health-summary').innerHTML.includes('private notes'));
assert(el('health-summary').innerHTML.includes('7:06 PM'));
assert.equal(el('health-range-summary').textContent,'4 readings');
const chart = run('healthCharts[0].config');
assert.equal(chart.type,'scatter');
assert.equal(chart.options.scales.x.type,'linear');
assert.equal(chart.data.datasets.length,2);
assert.equal(chart.data.datasets[0].showLine,false);
const xs = chart.data.datasets[0].data.map(p => p.x);
assert.equal((xs[2]-xs[1])/(xs[1]-xs[0]),12.5);
assert.equal(chart.options.plugins.tooltip.callbacks.afterBody([{dataIndex:1}]).pop(),'2 readings');
chart.options.onClick({},[{index:1}]);
assert(el('health-bp-detail').textContent.includes('Cuff pulse: 57 bpm'));
assert(el('health-bp-detail').textContent.includes('2 readings'));
run("healthRange={start:'2020-01-01',end:'2020-12-31'}; renderHealth()");
assert(el('health-summary').innerHTML.includes('110 / 77 mmHg'));
assert.equal(el('health-range-summary').textContent,'0 readings');
assert(el('health-charts').innerHTML.includes('No measurements in this date range.'));
for (const [section, text] of [['sleep','7h 42m'], ['weight','155.4'], ['heart-rate','44 bpm']]) {
  run(`activeHealth='${section}'; renderHealth();`);
  assert(el('health-summary').innerHTML.includes(text));
  assert(el('health-summary').innerHTML.includes('2026'));
}
run("healthRange={start:'2026-10-01',end:'2026-10-28'};activeHealth='heart-rate';renderHealth()");
assert.equal(run('healthCharts[0].config.data.datasets[0].data[0]'),44);
assert.equal(run('healthCharts[1].config.data.datasets[0].data[0]'),71);
el('health-start').value='2026-10-03';el('health-end').value='2026-10-03'; run('onHealthChange()');
assert.deepStrictEqual(json('healthRange'),{start:'2026-10-03',end:'2026-10-03'});
el('health-start').value='2026-10-28';el('health-end').value='2026-10-01'; run('onHealthChange()');
assert.equal(el('health-start').value,'2026-10-03');
assert(el('health-validation').textContent.includes('Start date'));
run("fullHealth.blood_pressure=[]; activeHealth='blood-pressure'; renderHealth()");
assert(el('health-summary').innerHTML.includes('No measurements'));
run("fullHealth.blood_pressure=[readings[1]];renderHealth()");
assert.equal(el('health-range-summary').textContent,'1 reading');
assert.equal(run('healthCharts[0].config.data.datasets[0].data.length'),1);
// Durable latest-value scenarios: newer duration/RHR, older score/HRV.
run(`fullHealth = {data:[
  {date:'2020-01-02',sleep_hours:6,sleep_score:60,resting_heart_rate_bpm:55,hrv_ms:35},
  {date:'2026-10-06',sleep_hours:null,sleep_score:82,resting_heart_rate_bpm:null,hrv_ms:71},
  {date:'2026-10-07',sleep_hours:7.7,sleep_score:null,resting_heart_rate_bpm:44,hrv_ms:null}
],blood_pressure:[]};healthRange={start:'2026-10-01',end:'2026-10-28'};`);
function statValues() {
  return [...el('health-summary').innerHTML.matchAll(/<span class="health-stat-value">([\s\S]*?)<\/span>/g)].map(match => match[1]);
}
for (const [section, value, olderValue, historicalValue] of [
  ['sleep','7h 42m','82',6], ['heart-rate','44 bpm','71.0 ms',55],
]) {
  run(`activeHealth='${section}';healthRange={start:'2026-10-01',end:'2026-10-28'};renderHealth();`);
  const values = statValues();
  assert.equal(values[0], run("fmtDate('2026-10-07')"));
  assert.equal(values[1], value); // Its own date is the section's newer date.
  assert(values[2].startsWith(olderValue));
  assert(values[2].includes(run("fmtDate('2026-10-06')")));
  const latestHtml = el('health-summary').innerHTML;
  run("healthRange={start:'2020-01-01',end:'2020-12-31'};renderHealth()");
  assert.equal(el('health-summary').innerHTML, latestHtml);
  assert.equal(run('healthCharts[0].config.data.datasets[0].data[0]'), historicalValue);
}
// Two latest-day observations deliberately distinguish raw latest from every mean.
context.latestDayReadings = [reading('2026-10-01',120,80,60),
  reading('2026-10-28',120,86,70), reading('2026-10-28',100,66,50,'19:06:00')];
run("fullHealth.blood_pressure=latestDayReadings;activeHealth='blood-pressure';healthRange={start:'2026-10-01',end:'2026-10-28'};renderHealth()");
const latestBpHtml = el('health-summary').innerHTML;
assert(latestBpHtml.includes('100 / 66 mmHg'));
assert(latestBpHtml.includes('50 bpm'));
assert(latestBpHtml.includes('7:06 PM'));
assert(!latestBpHtml.includes('110 / 76 mmHg'));
assert.equal(run('healthCharts[0].config.data.datasets[0].data[1].y'),110);
assert.equal(run('healthCharts[0].config.data.datasets[1].data[1].y'),76);
assert.equal(run('healthCharts[1].config.data.datasets[0].data[1].y'),60);
assert.equal(run('healthCharts[0].config.options.plugins.tooltip.callbacks.afterBody([{dataIndex:1}]).pop()'),'2 readings');
run('healthCharts[1].config.options.onClick({},[{index:1}])');
assert(el('health-bp-detail').textContent.includes('2 readings'));
run("healthRange={start:'2026-10-01',end:'2026-10-01'};renderHealth()");
assert.equal(el('health-summary').innerHTML,latestBpHtml);
assert.equal(el('health-range-summary').textContent,'1 reading');
assert.deepStrictEqual(json('healthCharts[0].config.data.datasets[0].data'),[{x:run("dateToUtcMs('2026-10-01')"),y:120}]);
// Tick generation never uses padded/fractional days as label positions.
for (const [start, end, count] of [['2026-10-01','2026-10-01',1],['2026-10-01','2026-10-02',2]]) {
  run(`healthRange={start:'${start}',end:'${end}'};renderHealth()`);
  const axis = run('healthCharts[0].config.options.scales.x');
  const scale = {};
  axis.afterBuildTicks(scale);
  assert.equal(scale.ticks.length,count);
  const values = scale.ticks.map(tick=>tick.value);
  assert.equal(new Set(values).size,count);
  assert(values.every(value=>value % 86400000 === 0));
  assert(values.every(value=>value>=run(`dateToUtcMs('${start}')`) && value<=run(`dateToUtcMs('${end}')`)));
  if (count===1) assert(axis.min < values[0] && axis.max > values[0]);
}
// Old export compatibility, including no daily rows.
context.fetch = async () => ({ok:true,json:async()=>({data:[]})});
(async () => {
  await run('loadHealth()');
  assert.deepStrictEqual(json('fullHealth.blood_pressure'),[]);
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  for (const section of ['sleep','weight','heart-rate','blood-pressure']) assert(html.includes(`data-health="${section}"`));
  assert(html.indexOf('id="health-summary"') < html.indexOf('id="health-start"'));
  console.log('Health structure, ranges, latest tiles, BP aggregation, sparse charts and compatibility passed.');
})().catch(error => { console.error(error); process.exitCode=1; });
