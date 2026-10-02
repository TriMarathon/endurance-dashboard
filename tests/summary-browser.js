// Run with Playwright installed: node tests/summary-browser.js
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const server = http.createServer((req,res) => {
    const pathname = new URL(req.url,'http://localhost').pathname;
    const file=path.join(root,pathname==='/'?'index.html':pathname);
    if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    try {res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));}
    catch {res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.SUMMARY_BROWSER_CHANNEL ? {channel:process.env.SUMMARY_BROWSER_CHANNEL} : {})});
    const doc = JSON.parse(fs.readFileSync(path.join(root,'data/sport_analysis.json'),'utf8'));
    doc.start_date='2015-01-01'; doc.end_date='2026-10-01';
    Object.values(doc.sports).forEach(sport=>{sport.activities=[];});
    doc.sports.running.activities=[{date:'2026-09-28',tss:72,duration_seconds:3600}];
    doc.sports.cycling.activities=[{date:'2026-09-28',tss:74,duration_seconds:4680}, {date:'2026-10-01',tss:10,duration_seconds:600}];
    const note = 'Breakfast & water\n<script>window.calendarExecuted=true</script>\n' + 'longword'.repeat(500);
    const races = {data:[
      {date:'2026-10-01',name:'Today race',race_type:'5K',registration_status:'registered'},
      {date:'2026-10-04',name:'Sunday race',race_type:'Marathon',registration_status:'planning',pre_race_notes:note,internal_secret:'NEVER DISPLAY'},
      {date:'2026-10-04',name:'Second race',race_type:'Run'},
      {date:'2026-10-05',name:'Next week race'},
      {date:'2026-10-25',name:'Later race'},
    ]};
    const url=`http://127.0.0.1:${server.address().port}/`;
    for (const width of [1280,390,320]) {
      const page=await browser.newPage({viewport:{width,height:844},timezoneId:width===320?'Pacific/Honolulu':'Asia/Tokyo',hasTouch:width<640});
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.clock.install({time:new Date('2026-10-01T17:00:00Z')});
      await page.route('**/data/sport_analysis.json*',async route=>{if(width===390) await new Promise(resolve=>setTimeout(resolve,200));await route.fulfill({json:doc});});
      await page.route('**/data/races.json*',async route=>{if(width!==390) await new Promise(resolve=>setTimeout(resolve,200));await route.fulfill({json:races});});
      await page.goto(url); await page.waitForSelector('.summary-race-flag');
      assert.equal(await page.locator('.tab-panel.active').getAttribute('id'),'tab-summary');
      assert.equal(await page.locator('.summary-week').count(),4);
      assert.equal(await page.locator('.summary-day-button').count(),28);
      assert.match(await page.locator('.summary-range').innerText(), /Sep 7, 2026 – Oct 4, 2026/);
      assert.equal(await page.locator('#summary-detail').count(),0);
      assert.equal(await page.getByText('Dot area represents',{exact:false}).count(),0);
      assert.equal(await page.getByText('Select a day',{exact:false}).count(),0);
      assert.match(await page.locator('.summary-week').last().innerText(), /2h 28m[\s\S]*156 TSS/);
      const monday=page.locator('[data-summary-date="2026-09-28"]');
      await monday.click();
      assert.match(await page.locator('#summary-detail').innerText(), /146 TSS · 2h 18m.*Run: 72 TSS.*Bike: 74 TSS/);
      await page.getByRole('button',{name:'Close day details'}).click();
      assert.equal(await page.locator('#summary-detail').count(),0);
      assert.equal(await monday.getAttribute('aria-pressed'),'false');
      await monday.press('Enter'); await monday.press('Escape');
      assert.equal(await page.locator('#summary-detail').count(),0);
      const today=page.locator('[data-summary-date="2026-10-01"]');
      assert.equal(await today.locator('.summary-race-flag').count(),1);
      assert.equal(await today.locator('i').count(),1);
      await today.click();
      assert.match(await page.locator('#summary-detail').innerText(),/10 TSS.*Today race.*5K.*registered/s);
      await page.getByRole('button',{name:'Close day details'}).click();
      const sunday=page.locator('[data-summary-date="2026-10-04"]');
      assert((await sunday.getAttribute('class')).includes('future'));
      assert(!(await sunday.getAttribute('class')).includes(' rest'));
      assert.match(await sunday.getAttribute('aria-label'), /Race: Sunday race.*Race: Second race/);
      assert.equal(await sunday.locator('.summary-race-flag b').innerText(),'2');
      if(width<640) await sunday.tap(); else await sunday.click();
      assert.equal(await page.locator('.summary-race').count(),2);
      assert.match(await page.locator('#summary-detail').innerText(),/Marathon.*planning/s);
      await page.locator('#summary-detail .race-plan summary').click();
      assert.equal(await page.locator('#summary-detail .race-plan-text').textContent(),note);
      assert.equal(await page.locator('#summary-detail script').count(),0);
      assert.equal(await page.evaluate(()=>window.calendarExecuted),undefined);
      assert(!(await page.locator('#summary-detail').innerText()).includes('NEVER DISPLAY'));
      assert(await page.locator('#summary-detail .race-plan-text').evaluate(el=>el.scrollWidth<=el.clientWidth));
      await page.getByRole('button',{name:'Close day details'}).click();
      const next=page.getByRole('button',{name:'Next week',exact:true});
      await next.focus(); await next.press('Enter');
      assert.match(await page.locator('.summary-range').innerText(),/Sep 14, 2026 – Oct 11, 2026/);
      assert.equal(await page.locator('[data-summary-date="2026-10-05"] .summary-race-flag').count(),1);
      assert.deepEqual(await page.locator('.summary-week').last().locator('.summary-metric strong').allTextContents(),['—','—']);
      assert.equal(await page.locator('.summary-week').last().locator('.rest').count(),0);
      await next.press('Space'); await next.click();
      assert.equal(await page.locator('[data-summary-date="2026-10-25"] .summary-race-flag').count(),1);
      const previous=page.getByRole('button',{name:'Previous week',exact:true});
      await previous.focus(); await previous.press('Enter');
      assert.match(await page.locator('.summary-range').innerText(),/Sep 21, 2026 – Oct 18, 2026/);
      const reset=page.getByRole('button',{name:'Return to current week'});
      await reset.focus(); await reset.press('Space');
      assert.match(await page.locator('.summary-range').innerText(),/Sep 7, 2026 – Oct 4, 2026/);
      assert.equal(await page.locator('#summary-detail').count(),0);
      for(const button of await page.locator('.summary-navigation button').all()) assert(await button.evaluate(el=>el.getBoundingClientRect().height>=44));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
      const calendar=await page.locator('.summary-wrap').boundingBox();
      await page.screenshot({path:`/tmp/calendar-${width}.png`,fullPage:true});
      assert(calendar.height<(width<640?780:540),`Calendar not compact at ${width}: ${calendar.height}`);
      for(const route of ['overview','training','load','sports','health','racing','gear']) {
        await page.evaluate(route=>{location.hash=route;},route);
        await page.waitForFunction(id=>document.querySelector('.tab-panel.active')?.id==='tab-'+id,route==='load'?'training':route);
      }
      assert.deepEqual(errors,[]);
      await page.close();
    }
    const failure = await browser.newPage();
    await failure.route('**/data/sport_analysis.json*',route=>route.fulfill({status:503,body:'Unavailable'}));
    await failure.goto(url);
    await failure.waitForSelector('#summary-content .error');
    await failure.close();
    console.log('Calendar browser tests passed at 1280/390/320: both fetch orders, navigation, touch, keyboard, races, safe notes, totals, compactness, routes, no overflow.');
  } finally {if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
