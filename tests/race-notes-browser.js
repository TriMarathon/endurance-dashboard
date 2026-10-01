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
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 640 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/data/races.json*', route => route.fulfill({ json: { data: [
        { date: '2099-01-01', name: 'With plan', pre_race_notes: note },
        { date: '2099-02-01', name: 'No plan', pre_race_notes: null },
        { date: '2099-03-01', name: 'Empty plan', pre_race_notes: '' },
        { date: '2099-04-01', name: 'Legacy race' },
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
      await page.locator('#race-back').click();
      assert.equal(await page.locator('#races-container .race-plan').count(), 1);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Race notes browser tests passed: desktop, 390px and 320px touch, keyboard, plain text, wrapping, existing details.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
