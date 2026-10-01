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
        { date: '2026-09-01', activity_name: 'With review', category: '5K', duration_seconds: 1200, age_grade_percent: 83.74, pre_race_ctl: 90.2, race_day_tsb: 17.6, pre_race_load_ratio: 0.8, pre_race_ramp_rate: -6.4, race_tss: 365.8, day_tss: 365.8, delta_atl: 39, post_race_notes: sectionMode !== 'plan' ? note : null, pre_race_notes: sectionMode !== 'post' ? note : null },
        { date: '2026-09-02', activity_name: 'No review', post_race_notes: null },
        { date: '2026-09-03', activity_name: 'Empty review', post_race_notes: '', pre_race_ctl: null, race_day_tsb: null, pre_race_load_ratio: null, pre_race_ramp_rate: null, race_tss: null, day_tss: null, delta_atl: null },
        { date: '2026-09-04', activity_name: 'Legacy review' },
        { date: '2026-09-05', activity_name: 'Blank review', post_race_notes: '  \n', race_tss: 0 },
      ] } }));
      await page.route('**/data/usat_results.json*', route => route.fulfill({ json: { data: [{ source_result_id: 'test', event_date: '2026-09-12', event_name: 'IRONMAN 70.3 Wisconsin', race_label: '70.3', finish_time_seconds: 17561, usat_score: 97.079 }] } }));
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
      const detail = page.locator('#race-history-table .race-history-detail-row').filter({ has: page.locator('.completed-race-notes') });
      const load = detail.locator('.completed-race-load');
      const loadControl = load.locator('summary');
      assert.equal(await page.locator('#race-history-table .completed-race-load').count(), 2);
      assert.equal(await load.count(), 1);
      assert.equal(await load.getAttribute('open'), null);
      assert.equal(await historyNote.getAttribute('open'), null);
      assert.equal(await load.locator('dl').isVisible(), false);
      assert.equal(await loadControl.textContent(), 'Load');
      assert(await loadControl.evaluate(el => el.getBoundingClientRect().height >= 44));
      const checkOverflow = async () => {
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (await load.locator('dl').isVisible()) {
          assert(await load.evaluate(el => el.scrollWidth <= el.clientWidth));
          for (const metric of await load.locator('dt, dd').all()) {
            assert(await metric.evaluate(el => el.scrollWidth <= el.clientWidth), await metric.textContent());
          }
        }
      };
      await checkOverflow();
      // Native click/tap opens Load only, without changing Notes or the result row.
      if (width < 640) await loadControl.tap(); else await loadControl.click();
      assert.notEqual(await load.getAttribute('open'), null);
      assert.equal(await historyNote.getAttribute('open'), null);
      assert.equal(await load.locator('dl').isVisible(), true);
      assert.deepEqual(await load.locator('dt').allTextContents(), ['CTL', 'TSB', 'Load Ratio', 'Ramp', 'Race TSS', 'Day TSS', 'ΔATL']);
      assert.deepEqual(await load.locator('dd').allTextContents(), ['90.2', '+17.6', '0.80', '-6.4', '365.8', '365.8', '+39.0']);
      const result = detail.locator('xpath=preceding-sibling::tr[1]');
      assert.equal(await result.locator('.race-history-col-time').textContent(), '20:00Age Grade 83.7%');
      assert.equal(await load.locator('.race-history-age-grade').count(), 0);
      await checkOverflow();
      // Enter keyboard modality before checking :focus-visible styling.
      await page.keyboard.press('Tab');
      await loadControl.focus();
      assert.equal(await loadControl.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
      await page.keyboard.press('Enter');
      assert.equal(await load.getAttribute('open'), null);
      await page.keyboard.press('Space');
      assert.notEqual(await load.getAttribute('open'), null);
      await checkOverflow();
      assert.equal(await historyNote.count(), 1);
      const titles = sectionMode === 'both' ? ['RACE PLAN', 'POST-RACE NOTES'] : [sectionMode === 'plan' ? 'RACE PLAN' : 'POST-RACE NOTES'];
      assert.deepEqual(await historyNote.locator('h4').allTextContents(), titles);
      const historyControl = historyNote.locator('summary');
      if (width < 640) await historyControl.tap(); else await historyControl.click();
      assert.notEqual(await historyNote.getAttribute('open'), null);
      assert.notEqual(await load.getAttribute('open'), null);
      await checkOverflow();
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
      // Notes only, neither, then both: the disclosures never act as an accordion.
      await loadControl.click();
      assert.equal(await load.getAttribute('open'), null);
      assert.notEqual(await historyNote.getAttribute('open'), null);
      await historyControl.click();
      assert.equal(await historyNote.getAttribute('open'), null);
      assert.equal(await load.getAttribute('open'), null);
      await historyControl.click();
      await loadControl.click();
      assert.notEqual(await historyNote.getAttribute('open'), null);
      assert.notEqual(await load.getAttribute('open'), null);
      await checkOverflow();
      // USAT scores remain in their existing race-result cells, outside Load.
      await page.locator('[data-subtab="usat"]').click();
      await page.waitForSelector('#usat-results-table .usat-score');
      assert.equal(await page.locator('#usat-results-table .completed-race-load').count(), 0);
      assert.equal(await page.locator('#usat-results-table .usat-score').textContent(), '97.079');
      assert((await page.locator('#usat-results-table tbody tr').textContent()).includes('4:52:41'));
      assert.deepEqual(errors, []);
      await page.close();
     }
    }
    console.log('Race Load/Notes browser tests passed: desktop, 390px and 320px touch, keyboard, independent disclosures, unchanged values/results, plain text and wrapping.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
