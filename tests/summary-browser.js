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
    doc.start_date='2026-09-07'; doc.end_date='2026-10-01';
    Object.values(doc.sports).forEach(sport=>{sport.activities=[];});
    doc.sports.running.activities=[{date:'2026-09-28',tss:60,duration_seconds:3600}];
    doc.sports.cycling.activities=[{date:'2026-09-28',tss:40,duration_seconds:4680}, {date:'2026-10-01',tss:10,duration_seconds:600}];
    // Deliberately different duration shares: pies must use TSS, including tiny loads.
    for (const [sport, tss] of Object.entries({running:60,cycling:39.9996,swimming:.0001,strength:.0001,elliptical:.0001,other:.0001})) {
      doc.sports[sport].activities.push({date:'2026-09-29',tss,duration_seconds:0});
    }
    doc.sports.running.activities.push({date:'2026-09-30',tss:0,duration_seconds:600});
    doc.sports.running.activities.push({date:'2026-10-01',tss:20,duration_seconds:0}, {date:'2026-09-21',tss:1,duration_seconds:0});
    doc.sports.swimming.activities.push({date:'2026-09-22',tss:225,duration_seconds:0});
    for(const sport of Object.values(doc.sports)) sport.activities.push({date:'2026-09-23',tss:10,duration_seconds:0});

    const note = 'Breakfast & water\n<script>window.calendarExecuted=true</script>\n' + 'longword'.repeat(500);
    const races = {data:[
      {date:'2026-10-01',name:'Today race',race_type:'5K',registration_status:'registered'},
      {date:'2026-10-04',name:'Sunday race',race_type:'Marathon',registration_status:'planning',pre_race_notes:note,internal_secret:'NEVER DISPLAY'},
      {date:'2026-10-04',name:'Second race',race_type:'Run'},
      {date:'2026-10-05',name:'Next week race'},
      {date:'2026-10-25',name:'Later race'},
    ]};
    const completed={data:[
      {date:'2026-09-21',activity_name:'Small race',category:'5K'},
      {date:'2026-09-22',activity_name:'Big race',category:'70.3'},
      {date:'2026-09-28',activity_name:'Mixed race',category:'5K',duration_seconds:3601,age_grade_percent:75,usat_score:88.2,pre_race_notes:note,post_race_notes:note,garmin_activity_id:'NEVER DISPLAY'},
      {date:'2026-09-28',activity_name:'Second completed race',category:'10K'},
      {date:'2026-08-01',activity_name:'Outside completed race'},
      {date:'2026-10-01',activity_name:'Today race',category:'5K'},
    ]};
    // Keep the established future-only assertions; overlap is exercised separately below.
    const visibleCompleted={data:completed.data.filter(r=>r.date!=='2026-10-01')};
    const url=`http://127.0.0.1:${server.address().port}/`;
    for (const width of [1280,390,320]) {
      const page=await browser.newPage({viewport:{width,height:844},timezoneId:width===320?'Pacific/Honolulu':'Asia/Tokyo',hasTouch:width<640});
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.clock.install({time:new Date('2026-10-01T17:00:00Z')});
      await page.route('**/data/sport_analysis.json*',async route=>{if(width===390) await new Promise(resolve=>setTimeout(resolve,200));await route.fulfill({json:doc});});
      await page.route('**/data/races.json*',async route=>{if(width!==390) await new Promise(resolve=>setTimeout(resolve,200));await route.fulfill({json:races});});
      await page.route('**/data/completed_races.json*',async route=>{if(width===320) await new Promise(resolve=>setTimeout(resolve,300));await route.fulfill({json:visibleCompleted});});
      await page.goto(url); await page.waitForSelector('.summary-race-completed');
      await page.waitForSelector('[data-summary-date="2026-10-04"] .summary-race-flag');
      assert.equal(await page.locator('.tab-panel.active').getAttribute('id'),'tab-summary');
      assert.equal(await page.locator('.summary-week').count(),4);
      assert.equal(await page.locator('.summary-day-button').count(),28);
      assert.match(await page.locator('.summary-range').innerText(), /Sep 7, 2026 – Oct 4, 2026/);
      assert.equal(await page.locator('#summary-detail').count(),0);
      assert.equal(await page.getByText('Dot area represents',{exact:false}).count(),0);
      assert.equal(await page.getByText('Select a day',{exact:false}).count(),0);
      assert.match(await page.locator('.summary-week').last().innerText(), /2h 38m[\s\S]*230 TSS/);
      // Native date disclosure: keyboard, cancellation, validation and jumps at every width.
      const range = page.getByRole('button', {name:'Jump to week', exact:true});
      const input = page.getByLabel('Select a date', {exact:true});
      const initialRange = await range.innerText();
      await range.focus(); await page.keyboard.press('Enter');
      assert(await input.evaluate(el => el === document.activeElement));
      assert.equal(await input.getAttribute('min'), doc.start_date);
      assert.equal(await input.getAttribute('max'), null);
      await input.fill('2026-08-01');
      await page.getByRole('button',{name:'Go',exact:true}).click();
      assert.equal(await range.innerText(), initialRange);
      assert.equal(await input.evaluate(el=>el.validity.rangeUnderflow),true);
      await page.getByRole('button',{name:'Cancel',exact:true}).click();
      assert(await range.evaluate(el=>el===document.activeElement));
      await range.click(); await input.fill('2030-06-19');
      await page.keyboard.press('Escape');
      assert.equal(await input.isVisible(),false);
      assert.equal(await range.innerText(), initialRange);
      // Expose real historical lower bound for direct historical jump fixtures.
      await page.evaluate(() => { summaryState.doc.start_date='2015-01-01'; renderSummary(summaryState.doc, summaryState.today); });
      for (const [date, first, last] of [
        ['2022-06-19','2022-05-23','2022-06-19'],
        ['2022-06-13','2022-05-23','2022-06-19'],
        ['2022-07-01','2022-06-06','2022-07-03'],
        ['2023-01-01','2022-12-05','2023-01-01'],
        ['2026-03-08','2026-02-09','2026-03-08'],
        ['2026-10-25','2026-09-28','2026-10-25'],
      ]) {
        await range.click(); await input.fill(date);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert(await input.evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
        await page.screenshot({path:`/tmp/calendar-jump-${width}.png`,fullPage:true});
        await page.getByRole('button',{name:'Go',exact:true}).click();
        assert.equal(await page.locator('.summary-day-button').first().getAttribute('data-summary-date'),first);
        assert.equal(await page.locator('.summary-day-button').last().getAttribute('data-summary-date'),last);
        assert.equal(await page.locator('.summary-week').count(),4);
        assert(await range.evaluate(el=>el===document.activeElement));
      }
      assert.equal(await page.locator('[data-summary-date="2026-10-25"] .summary-race-flag').count(),1);
      await range.click(); await input.fill('2022-06-19');
      await page.getByRole('button',{name:'Go',exact:true}).click();
      await page.getByRole('button',{name:'Next week',exact:true}).click();
      assert.equal(await page.locator('.summary-day-button').last().getAttribute('data-summary-date'),'2022-06-26');
      await page.getByRole('button',{name:'Previous week',exact:true}).click();
      assert.equal(await page.locator('.summary-day-button').last().getAttribute('data-summary-date'),'2022-06-19');
      await page.getByRole('button',{name:'Return to current week',exact:true}).click();
      assert.equal(await range.innerText(),initialRange);
      await page.evaluate(start => { summaryState.doc.start_date=start; renderSummary(summaryState.doc, summaryState.today); },doc.start_date);
      const monday=page.locator('[data-summary-date="2026-09-28"]');
      const small=page.locator('[data-summary-date="2026-09-21"] svg');
      const large=page.locator('[data-summary-date="2026-09-22"] svg');
      assert.equal(await small.getAttribute('width'),'8');
      assert.equal(await large.getAttribute('width'),'36');
      for(const single of [small,large]) {
        assert.equal(await single.locator('circle.summary-pie-slice').count(),1);
        assert.equal(await single.locator('.summary-pie-separator').count(),0);
      }
      const allSports=page.locator('[data-summary-date="2026-09-23"] svg');
      assert.equal(await allSports.locator('.summary-pie-slice').count(),6);
      assert(await allSports.locator('.summary-pie-slice').evaluateAll(nodes=>nodes.every(node=>Math.abs(Number(node.dataset.share)-1/6)<1e-12)));
      assert.equal(await monday.locator('svg').getAttribute('width'),'24');
      assert.deepEqual(await monday.locator('.summary-pie-slice').evaluateAll(nodes=>nodes.map(node=>[node.dataset.sport,Number(node.dataset.share)])),[['running',.6],['cycling',.4]]);
      assert.match(await monday.locator('.summary-pie-slice').first().getAttribute('d'), / 0 1 1 /);
      assert.equal(await monday.locator('.summary-pie-separator').count(),2);
      const tiny=page.locator('[data-summary-date="2026-09-29"]');
      assert.deepEqual(await tiny.locator('.summary-pie-slice').evaluateAll(nodes=>nodes.map(node=>node.dataset.sport)),['running','cycling','swimming','strength','elliptical','other']);
      assert(await tiny.locator('.summary-pie-slice').evaluateAll(nodes=>nodes.every(node=>Number(node.dataset.share)>0)));
      assert.equal(await tiny.locator('pattern').count(),2);
      const rest=page.locator('[data-summary-date="2026-09-30"]');
      assert((await rest.getAttribute('class')).includes(' rest'));
      assert.equal(await rest.locator('svg').count(),0);
      assert.equal(await rest.locator('i').evaluate(el=>el.getBoundingClientRect().width),4);
      assert.equal(await rest.locator('i').evaluate(el=>getComputedStyle(el).opacity),'0.6');
      for(const pie of await page.locator('.summary-pie-dot').all()) {
        assert.equal(await pie.getAttribute('aria-hidden'),'true');
        assert.equal(await pie.getAttribute('focusable'),'false');
        assert.equal(await pie.locator('.summary-pie-outline').evaluate(el=>getComputedStyle(el).strokeWidth),'0.6px');
        for(const slice of await pie.locator('.summary-pie-slice').all()) {
          const sport=await slice.getAttribute('data-sport');
          if(!['strength','elliptical'].includes(sport)) {
            assert.equal(await slice.evaluate(el=>getComputedStyle(el).fill),await page.locator(`.summary-legend .summary-sport-${sport}`).evaluate(el=>getComputedStyle(el).backgroundColor));
          }
        }
      }
      for(const button of await page.locator('.summary-day-button').all()) assert(await button.evaluate(el=>el.getBoundingClientRect().height>=44));
      await page.screenshot({path:`/tmp/calendar-pies-${width}.png`,fullPage:true});
      assert.equal(await monday.locator('.summary-race-flag').count(),1);
      assert.equal(await monday.locator('.summary-race-flag b').innerText(),'2');
      assert.match(await monday.getAttribute('aria-label'),/2 completed races/);
      for(const date of ['2026-09-21','2026-09-22','2026-09-28']) {
        const day=page.locator(`[data-summary-date="${date}"]`);
        const flag=await day.locator('.summary-race-flag').boundingBox();
        const pie=await day.locator('svg').boundingBox();
        const overlapWidth=Math.max(0,Math.min(flag.x+flag.width,pie.x+pie.width)-Math.max(flag.x,pie.x));
        const overlapHeight=Math.max(0,Math.min(flag.y+flag.height,pie.y+pie.height)-Math.max(flag.y,pie.y));
        assert(overlapWidth*overlapHeight/(pie.width*pie.height)<.2,'Flag obscures pie');
        assert.match(await day.locator('.summary-race-flag').getAttribute('aria-label'),/completed race/i);
        assert.equal(await day.locator('.summary-race-flag').evaluate(el=>getComputedStyle(el).position),'absolute');
      }
      assert.equal(await page.getByText('Outside completed race',{exact:true}).count(),0);
      if(width<640) await monday.tap(); else await monday.press('Enter');
      assert.equal(await page.locator('.summary-completed-race').count(),2);
      assert.match(await page.locator('#summary-detail').innerText(),/Mixed race.*5K.*1:00:01.*Age Grade 75.0%.*USAT Score 88.2/s);
      for(const disclosure of await page.locator('.summary-completed-race .race-plan').all()) {
        await disclosure.locator('summary').click();
        assert.equal(await disclosure.locator('.race-plan-text').textContent(),note);
        assert(await disclosure.locator('.race-plan-text').evaluate(el=>el.scrollWidth<=el.clientWidth));
      }
      assert.equal(await page.locator('#summary-detail script').count(),0);
      assert.equal(await page.evaluate(()=>window.calendarExecuted),undefined);
      assert(!(await page.locator('#summary-detail').innerText()).includes('NEVER DISPLAY'));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`/tmp/calendar-completed-details-${width}.png`,fullPage:true});
      assert.match(await page.locator('#summary-detail').innerText(), /100 TSS · 2h 18m.*Run: 60 TSS.*Bike: 40 TSS/);
      await page.getByRole('button',{name:'Close day details'}).click();
      assert.equal(await page.locator('#summary-detail').count(),0);
      assert.equal(await monday.getAttribute('aria-pressed'),'false');
      await monday.press('Enter'); await monday.press('Escape');
      assert.equal(await page.locator('#summary-detail').count(),0);
      const today=page.locator('[data-summary-date="2026-10-01"]');
      assert.equal(await today.locator('.summary-race-flag').count(),1);
      assert.equal(await today.locator('svg.summary-pie-dot').count(),1);
      assert.equal(await today.locator('path.summary-pie-slice').count(),2);
      assert.equal(await today.locator('.summary-pie-separator').count(),2);
      await today.click();
      assert.match(await page.locator('#summary-detail').innerText(),/30 TSS.*Run: 20 TSS.*Bike: 10 TSS.*Today race.*5K.*registered/s);
      await page.getByRole('button',{name:'Close day details'}).click();
      const sunday=page.locator('[data-summary-date="2026-10-04"]');
      assert((await sunday.getAttribute('class')).includes('future'));
      assert(!(await sunday.getAttribute('class')).includes(' rest'));
      assert.equal(await sunday.locator('svg').count(),0);
      assert.equal(await sunday.locator('i').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
      assert.equal(await sunday.locator('i').evaluate(el=>getComputedStyle(el).opacity),'0.4');
      const badge=await today.locator('.summary-race-flag').boundingBox();
      const dot=await today.locator('svg').boundingBox();
      assert(badge.y+badge.height<=dot.y, 'Race badge overlaps the pie');

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
      await previous.click();
      const outside=page.locator('[data-summary-date="2026-08-31"]');
      assert((await outside.getAttribute('class')).includes(' unavailable'));
      assert.equal(await outside.locator('svg').count(),0);
      assert.equal(await outside.locator('i').evaluate(el=>getComputedStyle(el).borderStyle),'dashed');
      await reset.click();
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
    const overlapPage=await browser.newPage();
    await overlapPage.clock.install({time:new Date('2026-10-01T17:00:00Z')});
    await overlapPage.route('**/data/sport_analysis.json*',route=>route.fulfill({json:doc}));
    await overlapPage.route('**/data/completed_races.json*',route=>route.fulfill({json:completed}));
    await overlapPage.route('**/data/races.json*',route=>route.fulfill({json:{data:[...races.data,{date:'2026-10-01',name:'Distinct scheduled',race_type:'10K'}]}}));
    await overlapPage.goto(url);
    const overlapDay=overlapPage.locator('[data-summary-date="2026-10-01"]');
    await overlapDay.locator('.summary-race-mixed').waitFor();
    assert.equal(await overlapDay.locator('.summary-race-flag').count(),1);
    assert.equal(await overlapDay.locator('b').innerText(),'2');
    await overlapDay.click();
    assert.equal(await overlapPage.locator('.summary-race').count(),2);
    assert.equal(await overlapPage.locator('.summary-completed-race').count(),1);
    await overlapPage.close();
    const unsynced = await browser.newPage();
    await unsynced.clock.install({time:new Date('2026-10-01T17:00:00Z')});
    await unsynced.route('**/data/sport_analysis.json*',route=>route.fulfill({json:{...doc,end_date:'2026-09-30'}}));
    await unsynced.goto(url);
    const missing=unsynced.locator('[data-summary-date="2026-10-01"]');
    await missing.waitFor();
    assert((await missing.getAttribute('class')).includes(' unavailable'));
    assert.equal(await missing.locator('svg').count(),0);
    assert.equal(await missing.locator('i').evaluate(el=>getComputedStyle(el).borderStyle),'dashed');
    await unsynced.close();
    const failure = await browser.newPage();
    await failure.route('**/data/sport_analysis.json*',route=>route.fulfill({status:503,body:'Unavailable'}));
    await failure.goto(url);
    await failure.waitForSelector('#summary-content .error');
    await failure.close();
    console.log('Calendar browser tests passed at 1280/390/320: TSS pies, tiny/all sports, legend colors, non-pie states, borders, race badges, both fetch orders, navigation, touch, keyboard, safe notes, totals, compactness, routes, no overflow.');
  } finally {if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
