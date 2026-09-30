# Summary dashboard

Summary is the default landing page and installed-app start URL. The visible navigation is Summary, Overview, Training, Load, Health, Racing, Gear. Existing bookmarks retain their original content: `#training` still opens load charts; `#sports` opens sport training analysis. The Load navigation link uses the new `#load` alias. Gear remains available. Arrow keys, Home, and End navigate the tabs.

## Data contract

Summary reuses the existing, versioned `data/sport_analysis.json` fetch. No producer changes or additional data exports are required. Inputs are `end_date` and `sports[category].activities[]` containing producer-local `date` (`YYYY-MM-DD`), `duration_seconds`, and preferred `tss`. Duration uses the existing sport export semantics (swimming moving time; other sports' session/parent duration precedence). Null/nonfinite/negative measures contribute zero. Values and sport totals are summed before rounding for display.

`buildSummary` creates exactly four Monday–Sunday weeks: three previous weeks and the current week in America/Chicago, the dashboard's established timezone. Calendar arithmetic uses UTC only as a date-only arithmetic mechanism; activity date strings are never converted across timezones. All six existing sport categories are retained independently: Run, Bike, Swim, Strength, Elliptical, Other. Export dates after today are excluded. Days after the export end date and through today are marked as awaiting synced data rather than rest days.

Each week has start/end dates, a current flag, seven daily totals and sport breakdowns, and weekly TSS/time totals and breakdowns. There is one activity scan and only 28 retained day buckets; no additional request, raw FIT processing, or duplicated payload.

## Visual behavior

For positive daily TSS, diameter in pixels is `min(36, max(8, 2.4 * sqrt(TSS)))`. Within the caps, circle area is proportional to TSS. Zero TSS uses a 4px filled neutral dot. Future days use 8px faint hollow circles; unsynced past/current days use dashed hollow circles. Hover, keyboard focus, and tap show date, TSS, time, and named sport breakdowns. Clicking pins details; clicking again or Escape clears them. The details panel stays visible while scrolling the card.

Both weekly bars use the same sport order and existing CSS palette: Run blue, Bike red, Swim orange; Strength, Elliptical, and Other reuse neutral gray. Strength has diagonal hatching and Elliptical stippling to distinguish the neutral categories without inventing colors. Bars also have named accessible breakdowns. Each metric scales independently against its largest weekly total across the four weeks. Totals stay outside the tracks.

Desktop puts days and bars on one row; intermediate widths put bars below days; phones stack the label, seven day positions, and bars. Controls are 44px tall with flexible day widths. The existing tab strip may scroll within itself; the page does not scroll horizontally.

## Validation

- `node tests/summary-test.js`: aggregation, Monday/Sunday and year boundaries, Chicago midnight/DST, rest/future/unsynced days, totals, scaling, details, default and legacy routes.
- `node tests/summary-browser.js`: requires Playwright and Chromium. Set `SUMMARY_BROWSER_CHANNEL=chrome` to use installed Chrome. Covers four rows, 28 positions, bars/totals, taps, keyboard, visible details, existing routes, failed fetch, and widths 320/375/390/768/1280. Screenshots go to `/tmp`, or `SUMMARY_SCREENSHOT_DIR`.
- Existing checks: `node tests/*smoke.js` individually, and each `tests/*.jxa` with `DASHBOARD_JS=js/dashboard.js DASHBOARD_CSS=css/dashboard.css DASHBOARD_HTML=index.html osascript -l JavaScript`.
- This static project has no package manifest, configured lint command, or build step. Use `node --check` for both JavaScript files and `git diff --check`.

Browser validation uses fixture activities to exercise a current week with future days. No generated production data is modified. Existing historical data still loads through the unchanged sport export. Actual-device Safari testing is not included.
