const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const server = http.createServer((req,res) => {
    const name = new URL(req.url,'http://localhost').pathname;
    const file=path.join(root,name==='/'?'index.html':name);
    if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    try {res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));}
    catch {res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.HISTORY_BROWSER_CHANNEL ? {channel:process.env.HISTORY_BROWSER_CHANNEL} : {})});
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const rows = Array.from({length:20},(_,i)=>({garmin_activity_id:i===1?0:i,session_id:i+1,sport:'running',start_time:`2026-10-${String(i%2+14).padStart(2,'0')} 05:26:00`,activity_name:`Bring Your Form Together Workout ${i}`,distance_meters:5000,duration_seconds:3627,tss:i===0?null:42}));
    rows.push({garmin_activity_id:0,session_id:101,sport:'swimming',start_time:'2026-10-15 06:00:00',activity_name:'Swim workout',distance_meters:1920.24,duration_seconds:3627,tss:null});
    await page.route('**/data/activities.json*', route => route.fulfill({json:{data:rows}}));
    const sports=Object.fromEntries(['running','cycling','swimming','strength','elliptical','other'].map(sport=>[sport,{activities:[],daily:[{date:'2026-01-01',tss:0},{date:'2026-10-15',tss:0}]}]));
    await page.route('**/data/sport_analysis.json*', route=>route.fulfill({json:{sports,end_date:'2026-10-15'}}));
    // Use an offline chart stub: these checks exercise real DOM/CSS and controls.
    await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:'window.Chart = class { constructor(canvas){this.options={};canvas.canvas.style.width="100%";} destroy(){} resize(){} update(){} };'}));
    await page.goto(`http://127.0.0.1:${server.address().port}/#sports`);
    await page.locator('.workout-history-table tbody tr').first().waitFor();
    assert.equal(await page.locator('.workout-history-table tbody tr').count(),20);
    assert.deepEqual(await page.locator('.workout-history-table th').allTextContents(),['Date','Time','Activity','Distance','Duration','TSS']);
    const widths=await page.locator('.workout-history-table tbody tr').first().locator('td').evaluateAll(cells=>cells.map(c=>c.getBoundingClientRect().width));
    assert(widths[2]>Math.max(...widths.filter((_,i)=>i!==2)));
    const scroll=await page.locator('.workout-history-scroll').evaluate(el=>({h:el.clientHeight,scroll:el.scrollHeight}));
    assert(scroll.h<=420 && scroll.scroll>scroll.h);
    await page.locator('#running-start').fill('2026-10-15');
    await page.locator('#running-start').dispatchEvent('change');
    assert.equal(await page.locator('.workout-history-table tbody tr').count(),10);
    await page.locator('[data-sport="swimming"]').click();
    assert.equal(await page.locator('.workout-history-table tbody tr').count(),1);
    assert((await page.locator('.workout-history-table').innerText()).includes('2,100 yd'));
    assert.equal(await page.locator('#running-start').inputValue(),'2026-10-15');
    for(const width of [320,375,390,430,767]) {
      await page.setViewportSize({width,height:844});
      assert(await page.locator('.workout-history-mobile').isVisible());
      assert(!(await page.locator('.workout-history-table').isVisible()));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Page overflow at ${width}`);
      const text=await page.locator('.workout-history-mobile').innerText();
      assert(text.includes('06:00') && text.includes('Swim workout') && text.includes('TSS —'));
      if(width===390 && process.env.HISTORY_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.HISTORY_SCREENSHOT_DIR,'history-mobile.png'),fullPage:true});
    }
    await page.locator('[data-sport="running"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1280,height:900});
    if(process.env.HISTORY_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.HISTORY_SCREENSHOT_DIR,'history-desktop.png'),fullPage:true});
    await page.locator('#running-reset').click();
    assert.equal(await page.locator('.workout-history-table tbody tr').count(),20);
    console.log('Workout History browser checks passed: desktop column widths, scroll, date controls, reset, sport switching, mobile 320–767px and no page overflow.');
  } finally { if(browser) await browser.close(); server.close(); }
})().catch(err=>{console.error(err);process.exitCode=1;});
