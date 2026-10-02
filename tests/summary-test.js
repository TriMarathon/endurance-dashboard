const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { buildSummary, summaryToday, summaryDotDiameter, summaryDayDetails } = require('../js/summary');
const sports = Object.fromEntries(['running','cycling','swimming','strength','elliptical','other'].map(key => [key, { activities: [] }]));
sports.running.activities = [
  {date:'2026-09-28', tss: 40, duration_seconds:1800},
  {date:'2026-09-28', tss: 30, duration_seconds:1200},
  {date:'2026-09-27', tss: 25, duration_seconds:1000},
  {date:'2026-10-01', tss: 999, duration_seconds:999},
];
sports.cycling.activities = [{date:'2026-09-28', tss:60, duration_seconds:3600}];
sports.strength.activities = [{date:'2026-09-30', tss:15, duration_seconds:900}];
sports.elliptical.activities = [{date:'2026-09-30', tss:10, duration_seconds:600}];
const doc = {end_date:'2026-09-30', sports};
const empty = buildSummary({end_date:'2026-09-30',sports:{}},'2026-09-30');
assert(empty.every(week=>week.tss===0 && week.seconds===0));
const weeks = buildSummary(doc, '2026-09-30');
assert.equal(weeks.length,4);
assert.deepEqual(weeks.map(w=>w.start), ['2026-09-07','2026-09-14','2026-09-21','2026-09-28']);
assert(weeks.every(w=>w.days.length===7 && new Date(w.start).getUTCDay()===1 && new Date(w.end).getUTCDay()===0));
const current = weeks[3];
assert.equal(current.days[0].tss,130);
assert.equal(current.days[0].seconds,6600);
assert.equal(current.days[1].tss,0);
assert.equal(current.days[1].future,false);
assert.equal(current.days[3].future,true);
assert.equal(current.days[3].tss,0);
assert.equal(current.sports.running.seconds,3000);
assert.equal(current.sports.running.tss,70);
assert.equal(current.sports.cycling.seconds,3600);
assert.equal(current.sports.cycling.tss,60);
assert.equal(current.seconds,8100);
assert.equal(current.tss,155);
assert.equal(weeks[2].days[6].tss,25);
for (const w of weeks) for (const key of ['seconds','tss']) {
  assert.equal(w[key],w.days.reduce((s,d)=>s+d[key],0));
  assert.equal(w[key],Object.values(w.sports).reduce((s,d)=>s+d[key],0));
}
assert.equal(buildSummary(doc,'2026-09-27')[3].start,'2026-09-21');
assert.equal(buildSummary(doc,'2026-09-28')[3].start,'2026-09-28');
assert.equal(buildSummary(doc,'2027-01-01')[3].start,'2026-12-28');
assert.equal(buildSummary({...doc,end_date:'2026-09-27'},'2026-09-30')[3].days[0].unavailable,true);
assert.equal(summaryToday(new Date('2026-09-28T04:59:59Z')),'2026-09-27');
assert.equal(summaryToday(new Date('2026-09-28T05:00:00Z')),'2026-09-28');
assert.equal(summaryToday(new Date('2026-11-02T05:59:59Z')),'2026-11-01');
assert.equal(summaryToday(new Date('2026-11-02T06:00:00Z')),'2026-11-02');
assert.equal(summaryDotDiameter(0),4);
assert.equal(summaryDotDiameter(1),8);
assert.equal(summaryDotDiameter(100),24);
assert.equal(summaryDotDiameter(1e6),36);
assert.match(summaryDayDetails(current.days[0]), /Mon, Sep 28, 2026 · 130 TSS · 1h 50m.*Run: 70 TSS.*Bike: 60 TSS/);
assert.match(summaryDayDetails(current.days[1]), /Rest day/);
assert.match(summaryDayDetails(current.days[3]), /Future day/);
const context = { document:{addEventListener(){}}, window:{location:{hash:''}}, Intl, Date };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'js/dashboard.js'),'utf8'),context);
assert.equal(context.currentTab(),'summary');
for (const route of ['overview','training','sports','health','racing','gear','summary']) {
  context.window.location.hash='#'+route;
  assert.equal(context.currentTab(),route);
}
context.window.location.hash='#load'; assert.equal(context.currentTab(),'training');
context.window.location.hash='#unknown'; assert.equal(context.currentTab(),'summary');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.deepEqual([...html.matchAll(/data-tab="[^"]+"[^>]*>([^<]+)/g)].map(m=>m[1]),['Summary','Overview','Training','Load','Health','Racing','Gear']);
assert.match(html,/id="tab-summary" class="tab-panel active"/);
console.log('Summary aggregation, dates, scaling, details and routing passed.');

const {summaryRangeLabel, summaryRaceDetails} = require('../js/summary');
const races = [
  {date:'2026-10-04',name:'Sunday race'},
  {date:'2026-10-05',name:'Next Monday'},
  {date:'2026-10-25',name:'Later race'},
  {date:'2026-09-30',name:'Race today'},
  {date:'2026-09-30',name:'Second today'},
];
for (const offset of [-8,-1,0,1,2,5,20]) {
  const window = buildSummary(doc,'2026-09-30',offset,races);
  assert.equal(window.length,4);
  assert.equal(Date.parse(window[0].start)-Date.parse(weeks[0].start),offset*7*86400000);
  assert.equal(window[3].end, new Date(Date.parse(window[0].start)+27*86400000).toISOString().slice(0,10));
}
assert.equal(summaryRangeLabel(buildSummary(doc,'2026-09-30',1)), 'Sep 14, 2026 – Oct 11, 2026');
assert.equal(summaryRangeLabel(buildSummary(doc,'2027-01-01')), 'Dec 7, 2026 – Jan 3, 2027');
assert.equal(buildSummary(doc,'2026-09-30',0,races)[3].days[6].races[0].name,'Sunday race');
assert.equal(buildSummary(doc,'2026-09-30',1,races)[3].days[0].races[0].name,'Next Monday');
assert.equal(buildSummary(doc,'2026-09-30',3,races)[3].days[6].races[0].name,'Later race');
const todayRace = buildSummary(doc,'2026-09-30',0,races)[3].days[2];
assert.equal(todayRace.races.length,2);
assert.equal(todayRace.tss,25);
assert.equal(buildSummary(doc,'2026-10-01',0,races)[3].days[2].races.length,0);
assert(buildSummary(doc,'2026-09-30',4).every(w=>w.future));
assert(buildSummary({...doc,start_date:'2026-09-01'},'2026-09-30',-10).every(w=>w.days.every(d=>d.unavailable)));
const safe = summaryRaceDetails({name:'<img src=x>', date:'2026-10-04',race_type:'Run',registration_status:'planning',pre_race_notes:'Line 1\n<script>x</script>',internal_secret:'NEVER DISPLAY'});
assert(safe.includes('&lt;script&gt;x&lt;/script&gt;'));
assert(safe.includes('Line 1\n'));
assert(!safe.includes('NEVER DISPLAY'));
assert(!safe.includes('<img'));
console.log('Calendar offsets, ranges, future races, publication fields, and history boundaries passed.');
