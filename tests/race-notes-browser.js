// Run with Playwright installed: node tests/race-notes-browser.js
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html');
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.SUMMARY_BROWSER_CHANNEL ? { channel: process.env.SUMMARY_BROWSER_CHANNEL } : {}) });
    const note = '\nBreakfast & water\n<script>window.noteExecuted=true</script>\n<img src=x onerror="window.noteExecuted=true">\n' + 'longword'.repeat(1000);
    for (const width of [1280, 390, 320]) {
     for (const sectionMode of ["plan", "post", "both"]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 640 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/data/races.json*', route => route.fulfill({ json: { data: [
        { date: '2099-01-01', name: 'With plan', pre_race_notes: note, notes: 'Retired legacy text' },
        { date: '2099-02-01', name: 'No plan', pre_race_notes: null },
        { date: '2099-03-01', name: 'Empty plan', pre_race_notes: '' },
        { date: '2099-04-01', name: 'Legacy race' },
      ] } }));
      await page.route('**/data/completed_races.json*', route => route.fulfill({ json: { data: [
        { date: '2026-09-01', activity_name: 'With review', category: '5K', duration_seconds: 1200, post_race_notes: sectionMode !== 'plan' ? note : null, pre_race_notes: sectionMode !== 'post' ? note : null },
        { date: '2026-09-02', activity_name: 'No review', post_race_notes: null },
        { date: '2026-09-03', activity_name: 'Empty review', post_race_notes: '' },
        { date: '2026-09-04', activity_name: 'Legacy review' },
        { date: '2026-09-05', activity_name: 'Blank review', post_race_notes: '  \n' },
      ] } }));
      await page.goto(`http://127.0.0.1:${server.address().port}/#racing`);
      await page.waitForSelector('#races-container .race-plan');
      const panel = page.locator('#races-container .race-plan');
      const control = panel.locator('summary');
      assert.equal(await panel.count(), 1);
      assert.equal(await panel.getAttribute('open'), null);
      if (width < 640) await control.tap(); else await control.click();
      assert.notEqual(await panel.getAttribute('open'), null);
      assert.equal(await panel.locator('.race-plan-text').textContent(), note);
      assert.equal(await panel.locator('script, img').count(), 0);
      assert.equal(await page.evaluate(() => window.noteExecuted), undefined);
      assert.equal(await panel.locator('.race-plan-text').evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
      assert(await panel.locator('.race-plan-text').evaluate(el => el.scrollWidth <= el.clientWidth));
      if (width < 640) assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await control.evaluate(el => el.getBoundingClientRect().height >= 44));
      await control.focus();
      await page.keyboard.press('Enter');
      assert.equal(await panel.getAttribute('open'), null);
      await page.keyboard.press('Space');
      assert.notEqual(await panel.getAttribute('open'), null);
      // Disclosure interactions must not trigger the surrounding race detail view.
      assert.equal(await page.locator('#race-back').count(), 0);
      await page.locator(width < 640 ? '.race-card-name' : '.races-col-date').first().click();
      await page.waitForSelector('#race-back');
      assert.equal(await page.locator('#races-container .race-plan').count(), 1);
      assert.equal(await page.locator('#races-container .race-plan-text').textContent(), note);
      assert.equal(await page.locator('#race-notes').count(), 0);
      assert(!(await page.locator('#races-container').textContent()).includes('Retired legacy text'));
      await page.locator('#race-back').click();
      assert.equal(await page.locator('#races-container .race-plan').count(), 1);
      await page.locator('[data-subtab="history"]').click();
      const historyNote = page.locator('#race-history-table .completed-race-notes');
      assert.equal(await historyNote.count(), 1);
      const titles = sectionMode === 'both' ? ['RACE PLAN', 'POST-RACE NOTES'] : [sectionMode === 'plan' ? 'RACE PLAN' : 'POST-RACE NOTES'];
      assert.deepEqual(await historyNote.locator('h4').allTextContents(), titles);
      const historyControl = historyNote.locator('summary');
      if (width < 640) await historyControl.tap(); else await historyControl.click();
      assert.notEqual(await historyNote.getAttribute('open'), null);
      assert.deepEqual(await historyNote.locator('.race-plan-text').allTextContents(), titles.map(() => note));
      assert.equal(await historyNote.locator('script, img').count(), 0);
      assert.equal(await page.evaluate(() => window.noteExecuted), undefined);
      assert.equal(await historyNote.locator('.race-plan-text').first().evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
      assert(await historyNote.locator('.race-plan-text').first().evaluate(el => el.scrollWidth <= el.clientWidth));
      assert(await historyNote.evaluate(el => el.getBoundingClientRect().width <= innerWidth));
      if (width < 640) assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await historyControl.focus();
      await page.keyboard.press('Enter');
      assert.equal(await historyNote.getAttribute('open'), null);
      await page.keyboard.press('Space');
      assert.notEqual(await historyNote.getAttribute('open'), null);
      assert.deepEqual(errors, []);
      await page.close();
     }
    }
    console.log('Race notes browser tests passed: desktop, 390px and 320px touch, keyboard, plain text, wrapping, existing details.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
