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
    browser=await chromium.launch({headless:true, ...(process.env.SUMMARY_BROWSER_CHANNEL ? {channel:process.env.SUMMARY_BROWSER_CHANNEL} : {})});
    const page=await browser.newPage({viewport:{width:1280,height:900},timezoneId:'Asia/Tokyo'});
    // Freeze the clock; dates must still follow the dashboard's Chicago convention.
    await page.clock.install({time:new Date('2026-09-30T17:00:00Z')});
    const doc=JSON.parse(fs.readFileSync(path.join(root,'data/sport_analysis.json'),'utf8'));
    doc.end_date='2026-09-30';
    doc.sports.running.activities.push({date:'2026-09-28',tss:72,duration_seconds:3600});
    doc.sports.cycling.activities.push({date:'2026-09-28',tss:74,duration_seconds:4680});
    await page.route('**/data/sport_analysis.json*',route=>route.fulfill({json:doc}));
    const url=`http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);
    await page.waitForSelector('.summary-week');
    assert.equal(await page.locator('.tab-panel.active').getAttribute('id'),'tab-summary');
    assert.equal(await page.locator('.summary-week').count(),4);
    assert.equal(await page.locator('.summary-day-button').count(),28);
    assert.equal(await page.locator('.summary-day-button.future').count(),4);
    assert.equal(await page.locator('.summary-metric').count(),8);
    assert.match(await page.locator('.summary-week').last().innerText(),/2h 18m[\s\S]*146 TSS/);
    await page.locator('.tab-link[data-tab="summary"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>location.hash==='#overview');
    await page.keyboard.press('Home');
    await page.waitForFunction(()=>location.hash==='#summary');
    const monday=page.locator('[data-summary-day="21"]');
    await monday.click();
    assert.match(await page.locator('#summary-detail').innerText(),/146 TSS · 2h 18m.*Run: 72 TSS.*Bike: 74 TSS/);
    await page.mouse.move(0,0);
    assert.match(await page.locator('#summary-detail').innerText(),/146 TSS/);
    await monday.press('Escape');
    assert.equal(await monday.getAttribute('aria-pressed'),'false');
    await monday.focus(); await monday.press('Enter');
    assert.equal(await monday.getAttribute('aria-pressed'),'true');
    await page.screenshot({path:process.env.SUMMARY_SCREENSHOT_DIR ? path.join(process.env.SUMMARY_SCREENSHOT_DIR,'summary-desktop.png') : '/tmp/summary-desktop.png'});
    for (const width of [320,375,390,768,1280]) {
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`Overflow at ${width}`);
      if (width<=390) {
        const days=await page.locator('.summary-days').first().boundingBox();
        const bars=await page.locator('.summary-bars').first().boundingBox();
        assert(bars.y>=days.y+days.height, 'Mobile bars stack below days');
      }
    }
    for (const route of ['overview','training','load','sports','health','racing','gear']) {
      await page.evaluate(route=>{location.hash=route;},route);
      await page.waitForFunction(id=>document.querySelector('.tab-panel.active')?.id==='tab-'+id,route==='load'?'training':route);
    }
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const phone=await mobile.newPage();
    await phone.clock.install({time:new Date('2026-09-30T17:00:00Z')});
    await phone.route('**/data/sport_analysis.json*',route=>route.fulfill({json:doc}));
    await phone.goto(url);await phone.waitForSelector('.summary-week');
    await phone.locator('[data-summary-day="0"]').tap();
    const detailBox = await phone.locator('#summary-detail').boundingBox();
    assert(detailBox.y >= 0 && detailBox.y + detailBox.height <= 844, 'Tapped details visible without scrolling');
    await phone.locator('[data-summary-day="21"]').tap();
    assert.match(await phone.locator('#summary-detail').innerText(),/146 TSS/);
    await phone.screenshot({path:process.env.SUMMARY_SCREENSHOT_DIR ? path.join(process.env.SUMMARY_SCREENSHOT_DIR,'summary-mobile.png') : '/tmp/summary-mobile.png',fullPage:true});
    await page.route('**/data/sport_analysis.json*',route=>route.fulfill({status:503,body:'Unavailable'}));
    await page.goto(url);await page.waitForSelector('#summary-content .error');
    console.log('Summary browser checks passed: desktop, mobile tap, keyboard, routing, totals, responsive widths, failure state.');
  } finally {if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
