// Serve the repository locally, then run with Playwright available through NODE_PATH.
const {chromium} = require('playwright');
const assert = require('assert');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({hasTouch:true,timezoneId:process.env.HEALTH_TIMEZONE || 'America/Chicago'});
try {
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const fixture={data:[
{date:'2020-01-02',sleep_hours:6,sleep_score:60,weight_lbs:150,resting_heart_rate_bpm:55,hrv_ms:35},
{date:'2026-10-06',sleep_hours:null,sleep_score:82,weight_lbs:null,resting_heart_rate_bpm:null,hrv_ms:71},
{date:'2026-10-07',sleep_hours:7.7,sleep_score:null,weight_lbs:155.4,resting_heart_rate_bpm:44,hrv_ms:null}], blood_pressure:[
{date:'2026-10-01',measured_at_local:'2026-10-01T07:00:00',systolic_mmhg:120,diastolic_mmhg:80,cuff_pulse_bpm:60},
{date:'2026-10-03',measured_at_local:'2026-10-03T07:00:00',systolic_mmhg:111,diastolic_mmhg:76,cuff_pulse_bpm:57},
{date:'2026-10-03',measured_at_local:'2026-10-03T19:00:00',systolic_mmhg:112,diastolic_mmhg:75,cuff_pulse_bpm:56},
{date:'2026-10-28',measured_at_local:'2026-10-28T07:00:00',systolic_mmhg:120,diastolic_mmhg:86,cuff_pulse_bpm:70},
{date:'2026-10-28',measured_at_local:'2026-10-28T19:06:00',systolic_mmhg:100,diastolic_mmhg:66,cuff_pulse_bpm:50}]};
await page.route('**/data/health.json*',r=>r.fulfill({json:fixture}));
await page.goto((process.env.HEALTH_DASHBOARD_URL || 'http://127.0.0.1:8765/') + '#health');
await page.waitForFunction(()=>typeof Chart==='function' && document.querySelector('#health-summary').textContent.includes('7h 42m'));
async function selectRange(start, end) {
 // Setting both fields together avoids an invalid intermediate range.
 await page.evaluate(({start,end})=>{
  document.getElementById('health-start').value=start;
  document.getElementById('health-end').value=end;
 },{start,end});
 await page.locator('#health-end').dispatchEvent('change');
}
async function chartState(id) {
 return page.evaluate((id) => {
  const chart = Chart.getChart(id);
  const guides=[], labels=[];
  const ctx=chart.ctx, stroke=ctx.stroke, fillText=ctx.fillText;
  // Capture real canvas drawing, not just plugin configuration.
  ctx.stroke=function(...args) {
   if (this.getLineDash().join(',')==='4,4') guides.push({width:this.lineWidth});
   return stroke.apply(this,args);
  };
  ctx.fillText=function(text,x,y,...args) {
   if (text==='120 SYS' || text==='80 DIA') labels.push({text,x,y});
   return fillText.call(this,text,x,y,...args);
  };
  try { chart.draw(); } finally { ctx.stroke=stroke;ctx.fillText=fillText; }
  return {area:chart.chartArea, width:chart.width, height:chart.height,
   guides, labels, yMin:chart.scales.y.min, yMax:chart.scales.y.max,
   ticks:chart.scales.x.ticks.map(tick=>({value:tick.value,label:tick.label})),
   points:chart.getDatasetMeta(0).data.map(point=>({x:point.x,y:point.y,radius:point.options.radius})),
   datasets:chart.data.datasets.map(dataset=>dataset.data), axisType:chart.scales.x.type};
 },id);
}
function assertGuides(state) {
 assert(state.yMin<=80 && state.yMax>=120);
 assert.deepStrictEqual(state.guides,[{width:1},{width:1}]);
 assert.deepStrictEqual(state.labels.map(label=>label.text),['120 SYS','80 DIA']);
 assert(state.labels.every(label=>label.x===state.area.right-4 && label.y>=state.area.top && label.y+10<=state.area.bottom));
 assert.equal(state.datasets.length,2);
}
function assertCalendarTicks(state, start, end, expectedCount) {
 const startMs=Date.parse(start+'T00:00:00Z'), endMs=Date.parse(end+'T00:00:00Z');
 const ticks=state.ticks.filter(tick=>tick.label != null && tick.label !== '');
 assert.equal(state.axisType,'linear');
 assert.equal(ticks.length,expectedCount);
 assert.equal(new Set(ticks.map(tick=>tick.label)).size,expectedCount);
 assert(ticks.every(tick=>tick.value%86400000===0 && tick.value>=startMs && tick.value<=endMs));
 return ticks;
}
for (const width of [320,375,390,430,1280]) {
 await page.setViewportSize({width,height:900});
 for (const section of ['sleep','weight','heart-rate','blood-pressure']) {
  await page.locator(`[data-health="${section}"]`).click();
  await page.waitForTimeout(100);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width} ${section}`);
  const boxes=await page.locator('#tab-health .health-stat').evaluateAll(es=>es.map(e=>({w:e.clientWidth,scroll:e.scrollWidth})));
  assert(boxes.every(b=>b.scroll<=b.w),`tile overflow ${width} ${section}`);
 }
 await selectRange('2026-10-01','2026-10-28');
 assert.equal(await page.locator('#health-range-summary').textContent(),'5 readings');
 assertGuides(await chartState('health-bp'));
 const locations=await page.evaluate(()=>{ const c=Chart.getChart('health-bp');return c.getDatasetMeta(0).data.map(p=>({x:p.x,y:p.y}));});
 assert(Math.abs((locations[2].x-locations[1].x)/(locations[1].x-locations[0].x)-12.5)<0.01);
 await page.locator('#health-bp').scrollIntoViewIfNeeded();
 const box=await page.locator('#health-bp').boundingBox();
 await page.touchscreen.tap(box.x+locations[1].x,box.y+locations[1].y);
 await page.waitForFunction(()=>document.querySelector('#health-bp-detail').textContent.includes('2 readings'));
 // Calendar-aligned labels and visible point for a single-day range.
 await selectRange('2026-10-03','2026-10-03');
 for (const id of ['health-bp','health-cuff-pulse']) {
  const state=await chartState(id);
  if (id==='health-bp') assertGuides(state);
  else { assert.deepStrictEqual(state.guides,[]);assert.deepStrictEqual(state.labels,[]); }
  assert.equal(assertCalendarTicks(state,'2026-10-03','2026-10-03',1)[0].label,'Oct 3');
  assert.equal(state.points.length,1);
  const point=state.points[0];
  assert(Math.abs(point.x-(state.area.left+state.area.right)/2)<0.01);
  assert(point.x-point.radius>=0 && point.x+point.radius<=state.width);
  assert(point.y-point.radius>=0 && point.y+point.radius<=state.height);
 }
 // The only observed point is on Oct 3: the right boundary of a two-day range.
 await selectRange('2026-10-02','2026-10-03');
 for (const id of ['health-bp','health-cuff-pulse']) {
  const state=await chartState(id);
  if (id==='health-bp') assertGuides(state);
  else { assert.deepStrictEqual(state.guides,[]);assert.deepStrictEqual(state.labels,[]); }
  assert.deepStrictEqual(assertCalendarTicks(state,'2026-10-02','2026-10-03',2).map(t=>t.label),['Oct 2','Oct 3']);
  assert.equal(state.points.length,1);
  assert(Math.abs(state.points[0].x-state.area.right)<0.01);
  assert.equal(state.datasets[0][0].x,Date.parse('2026-10-03T00:00:00Z'));
 }
 // Latest raw BP differs visibly from the latest day's arithmetic means.
 await selectRange('2026-10-28','2026-10-28');
 const latestBp=await page.locator('#health-summary').innerText();
 assert(latestBp.includes('100 / 66 mmHg') && latestBp.includes('50 bpm') && latestBp.includes('7:06 PM'));
 assert(!latestBp.includes('110 / 76 mmHg'));
 const pressure=await chartState('health-bp'), pulse=await chartState('health-cuff-pulse');
 assertGuides(pressure);
 assert.equal(pressure.datasets[0][0].y,110);
 assert.equal(pressure.datasets[1][0].y,76);
 assert.equal(pulse.datasets[0][0].y,60);
 assert.deepStrictEqual(await page.evaluate(()=>Chart.getChart('health-bp').options.plugins.tooltip.callbacks.afterBody([{dataIndex:0}])),
  ['Systolic: 110 mmHg','Diastolic: 76 mmHg','Cuff pulse: 60 bpm','2 readings']);
 await page.locator('#health-bp').scrollIntoViewIfNeeded();
 const latestBox=await page.locator('#health-bp').boundingBox();
 await page.touchscreen.tap(latestBox.x+pressure.points[0].x,latestBox.y+pressure.points[0].y);
 await page.waitForFunction(()=>document.querySelector('#health-bp-detail').textContent.includes('2 readings'));
 assert((await page.locator('#health-bp-detail').innerText()).includes('Cuff pulse: 60 bpm'));
 await selectRange('2026-10-01','2026-10-03');
 assert.equal(await page.locator('#health-summary').innerText(),latestBp);
 assert.equal(await page.locator('#health-range-summary').textContent(),'3 readings');
 const historical=await chartState('health-bp');
 assert.deepStrictEqual(historical.datasets[0].map(point=>point.y),[120,111.5]);
 assert.deepStrictEqual(historical.datasets[1].map(point=>point.y),[80,75.5]);
 assert.deepStrictEqual((await chartState('health-cuff-pulse')).datasets[0].map(point=>point.y),[60,56.5]);
 // Preserve each daily metric's date across a historical chart range.
 for (const [section,value,olderValue,historicalValue] of [
  ['sleep','7h 42m','82',6],['heart-rate','44 bpm','71.0 ms',55],
 ]) {
  await selectRange('2026-10-01','2026-10-28');
  await page.locator(`[data-health="${section}"]`).click();
  const tiles=await page.locator('#health-summary .health-stat-value').allTextContents();
  assert.equal(tiles[0],'Oct 7, 2026');
  assert.equal(tiles[1],value); // Newer metric uses the section's latest date.
  assert(tiles[2].startsWith(olderValue) && tiles[2].includes('Oct 6, 2026'));
  const latest=await page.locator('#health-summary').innerText();
  await selectRange('2020-01-01','2020-12-31');
  assert.equal(await page.locator('#health-summary').innerText(),latest);
  const chartId=section==='sleep'?'health-sleep':'health-rhr';
  assert.deepStrictEqual(await page.evaluate(id=>Chart.getChart(id).data.datasets[0].data,chartId),[historicalValue]);
 }
 await page.locator('[data-health="blood-pressure"]').click();
 await selectRange('2026-10-01','2026-10-28');
 if (process.env.HEALTH_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.HEALTH_SCREENSHOT_DIR}/health-bp-${width}.png`,fullPage:true});
 console.log(`Health ticks, metric dates, raw latest BP, means, touch detail and sparse spacing passed at ${width}px (${process.env.HEALTH_TIMEZONE || 'America/Chicago'})`);
}
// Rendering and interactions have not changed the source observations.
assert.deepStrictEqual(await page.evaluate(()=>fullHealth.blood_pressure),fixture.blood_pressure);
// Single observations entirely above/below the guides, plus both outer extremes.
for (const [systolic,diastolic] of [[100,90],[150,130],[70,50],[170,45]]) {
 await page.evaluate(({systolic,diastolic})=>{
  fullHealth.blood_pressure=[{date:'2026-10-03',measured_at_local:'2026-10-03T07:00:00',
   systolic_mmhg:systolic,diastolic_mmhg:diastolic,cuff_pulse_bpm:60}];
  healthRange={start:'2026-10-03',end:'2026-10-03'};
  renderHealth();
 },{systolic,diastolic});
 const state=await chartState('health-bp');
 assertGuides(state);
 assert(state.yMin<=Math.min(80,diastolic) && state.yMax>=Math.max(120,systolic));
 assert.equal(state.points.length,1);
 assert.equal(assertCalendarTicks(state,'2026-10-03','2026-10-03',1)[0].label,'Oct 3');
}
await page.evaluate(observations=>{fullHealth.blood_pressure=observations;renderHealth();},fixture.blood_pressure);
await page.locator('#health-start').fill('2020-01-01'); await page.locator('#health-start').dispatchEvent('change');
await page.locator('#health-end').fill('2020-12-31'); await page.locator('#health-end').dispatchEvent('change');
assert.equal(await page.locator('#health-range-summary').textContent(),'0 readings');
assert((await page.locator('#health-summary').textContent()).includes('100 / 66 mmHg'));
assert.equal(errors.length,0,errors.join('\n'));
} finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
