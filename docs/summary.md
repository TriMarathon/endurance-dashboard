# Summary Training Calendar

Summary is the default landing page and installed-app start URL. The visible navigation is Summary, Overview, Training, Load, Health, Racing, Gear. Existing bookmarks retain their original content: `#training` still opens load charts; `#sports` opens sport training analysis. The Load navigation link uses the new `#load` alias. Gear remains available. Arrow keys, Home, and End navigate the tabs.

## Data contract

Summary reuses the existing, versioned `data/sport_analysis.json` fetch. No producer changes or additional data exports are required. Inputs are `start_date`, `end_date` and `sports[category].activities[]` containing producer-local `date` (`YYYY-MM-DD`), `duration_seconds`, and preferred `tss`. Duration uses the existing sport export semantics (swimming moving time; other sports' session/parent duration precedence). Null/nonfinite/negative measures contribute zero. Values and sport totals are summed before rounding for display.

`buildSummary` creates exactly four Monday–Sunday weeks: three previous weeks and the current week in America/Chicago, the dashboard's established timezone. Calendar arithmetic uses UTC only as a date-only arithmetic mechanism; activity date strings are never converted across timezones. All six existing sport categories are retained independently: Run, Bike, Swim, Strength, Elliptical, Other. Export dates after today are excluded. Days after the export end date and through today are marked as awaiting synced data rather than rest days. Dates before `start_date` are shown as outside the exported activity range, never invented rest days. The inspected dataset spans 2015-01-01 through 2026-10-01; navigation can show earlier windows, but no training history exists there.

Each week has start/end dates, a current flag, seven daily totals and sport breakdowns, and weekly TSS/time totals and breakdowns. Each render uses one activity scan and only 28 retained day buckets; no additional request, raw FIT processing, or duplicated payload.

## Visual behavior

For positive daily TSS, diameter in pixels is `min(36, max(8, 2.4 * sqrt(TSS)))`. Within the caps, circle area is proportional to TSS. Positive-TSS completed days use inline SVG pies: each slice represents its sport’s daily TSS share, starting at 12 o’clock and proceeding clockwise in legend order (Run, Bike, Swim, Strength, Elliptical, Other). Single-sport days use a full-color SVG circle. Even tiny positive sport contributions remain separate slices. Thin outer outlines and subtle radial separators keep dots legible against the dark background. Pies reuse the legend palette, with SVG hatching for Strength and stippling for Elliptical. Race flags remain separate sibling badges. Zero TSS uses a 4px filled neutral dot. Future days use 8px faint hollow circles; unsynced past/current days use dashed hollow circles. Click, tap, Enter, or Space selects a day and shows date, TSS, time, and named sport breakdowns. Details occupy no space before selection. Clicking the selected day again, Close, or Escape dismisses the panel; Close returns focus to that day. Long details scroll within a bounded panel.

Both weekly bars use the same sport order and existing CSS palette: Run blue, Bike red, Swim orange; Strength, Elliptical, and Other reuse neutral gray. Strength has diagonal hatching and Elliptical stippling to distinguish the neutral categories without inventing colors. Bars also have named accessible breakdowns. Each metric scales independently against its largest weekly total across the four weeks. Totals stay outside the tracks.

Desktop puts days and bars on one row; intermediate widths put bars below days; phones stack the label, seven day positions, and bars. Controls are 44px tall with flexible day widths. The existing tab strip may scroll within itself; the page does not scroll horizontally.

## Validation

- `node tests/summary-test.js`: aggregation, Monday/Sunday and year boundaries, Chicago midnight/DST, rest/future/unsynced days, totals, scaling, details, default and legacy routes.
- `node tests/summary-browser.js`: requires Playwright and Chromium. Set `SUMMARY_BROWSER_CHANNEL=chrome` to use installed Chrome. Covers four rows, 28 positions, bars/totals, taps, keyboard, visible details, existing routes, failed fetch, and widths 320/375/390/768/1280. Screenshots go to `/tmp`, or `SUMMARY_SCREENSHOT_DIR`.
- Existing checks: `node tests/*smoke.js` individually, and each `tests/*.jxa` with `DASHBOARD_JS=js/dashboard.js DASHBOARD_CSS=css/dashboard.css DASHBOARD_HTML=index.html osascript -l JavaScript`.
- This static project has no package manifest, configured lint command, or build step. Use `node --check` for both JavaScript files and `git diff --check`.

Browser validation uses fixture activities to exercise a current week with future days. No generated production data is modified. Existing historical data still loads through the unchanged sport export. Actual-device Safari testing is not included.

## Calendar navigation and races

The visualization is titled Training Calendar; Summary remains the default tab.
Previous week and Next week move the four-week window by exactly seven days.
Today resets to the previous three complete weeks plus the current week.
The range label includes years, including windows crossing a year boundary.
Navigation is in memory and does not refetch data or persist across sessions.
Wholly future weeks show em dashes for Time and TSS. Partial current-week totals
still include only exported activity data accumulated through today.

Summary also consumes the existing validated Future Race JSON fetch. Either
fetch may complete first; race arrival refreshes the current window without
resetting navigation or the selected day. A neutral flag sits separately from
the TSS dot, with a count when multiple races share a date. Day button labels
name every race. Flags appear immediately for future dates in the current week,
and remain on race day while the Future Race export includes them. Older race
entries are not linked to completed activities.

Selected race days show each race separately: name, date, type, registration
status, and an optional Race Plan / Notes disclosure. Text is escaped, multiline
notes use the existing pre-wrap style, and internal fields are never rendered.
Race editing remains in Admin. No producer/export changes were made.

The hint, duplicate Summary heading, and idle details panel were removed.
Heading, legend, row, and bar spacing were reduced. TSS dot scaling is unchanged.
Day and navigation controls retain 44px height; seven columns remain visible on
phones while Time and TSS bars stack beneath them. The overall tab navigation
is unchanged.

Tests use isolated activity/race fixtures, including HTML-like notes, current-day
races, later-current-week races, multiple races, and races several weeks ahead.
Browser coverage at 1280px, 390px, and 320px verifies both fetch completion orders,
keyboard/touch navigation, literal notes, no horizontal overflow, compactness,
and existing dashboard routes. Screenshots are written to `/tmp/calendar-*.png`.

## Completed race badges

Summary reuses `loadCompletedRaces()` and its existing `data/completed_races.json`
records, independently of the Racing filters. No new fetch or export is introduced.
The producer's `get_completed_races()` uses the persisted activity local calendar
`date` and its serializer preserves it. Matching uses exact `race.date === day.date`
strings, with no timestamp parsing or timezone conversion. Only dates in the visible
28 buckets appear; race information remains available even without training data.

Completed races use the outlined ⚐ counterpart to scheduled ⚑, muted and anchored
to the upper-right of the dot wrapper. The SVG, size formula, colors, and weekly
bars are unchanged. One badge per day carries the total count when greater than
one. Mixed completed/scheduled dates use an underlined outlined flag; the accessible
label and details identify both states. Day buttons retain selection and keyboard
behavior. Completed details expose name, date, category, exact elapsed time, exported
Age Grade and USAT Score, plus separate escaped, multiline Race Plan and Post-race
Notes disclosures. Internal fields are never rendered.

Future exports retain records on/after their reference date, including race day.
They expose no shared identity with completed records. Summary conservatively pairs
same-date records one-to-one only when nonempty trimmed names and nonempty trimmed
categories match exactly (future `name`/`race_type`, completed
`activity_name`/`category`). The completed entry wins. Different names/categories
and missing keys remain distinct; there is no fuzzy matching or activity linking.
Renamed versions cannot be safely deduplicated with this public contract. Existing
past-future filtering stays unchanged. Either fetch can finish first without losing
navigation or selected-day details.
