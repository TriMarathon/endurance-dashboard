# Health views and Blood Pressure

Health navigation is Sleep → Weight → Heart Rate → Blood Pressure. Each view
shows its heading, latest tiles, Start/End controls, and history charts. The
shared range stays in page memory, matching Load/Training; reload resets it to
today and the preceding 89 calendar days. Invalid input restores the last valid
range. Inclusive filtering and date arithmetic use the existing date helpers.
Latest tiles always use the full history. A lagging daily-health metric shows its
own date when it differs from the section's latest date.

GarminTraining adds a `blood_pressure` array to `health.json`. Each raw canonical
observation contains only `measured_at_utc`, `measured_at_local`, `date`,
`systolic_mmhg`, `diastolic_mmhg`, and `cuff_pulse_bpm`. The exporter sorts by the
actual measurement instant and preserves Garmin's local calendar date and wall
clock. The last observation supplies the latest tile. Older exports without the
array show the clean empty state.

Exporting raw readings keeps the canonical source fields in GarminTraining and
allows presentation-only aggregation without duplicating daily aggregates or
latest snapshots in the payload. The dashboard groups only observed calendar
days, averages each metric independently at full precision, and rounds only for
display. Counts represent raw readings. BP and Cuff Pulse use separate Chart.js
scatter plots on the same numeric calendar-time domain, without filler rows or
connecting/interpolating lines. Tooltips and persistent tap details contain all
three averages and the contributing reading count. There is no diagnostic
coloring or notes display.

The Health controls and navigation reuse existing responsive styles. On small
screens, the latest BP timestamp spans the tile grid, date fields reflow, and the
BP charts stack at every width.

## Verification

Run the dependency-free checks with `node tests/health-test.js` and the existing
`tests/*test.js` and `tests/*smoke.js` scripts. To run real touch/layout checks,
serve this directory locally (`python3 -m http.server 8765 --bind 127.0.0.1`) and
run `node tests/health-browser.js` with Playwright installed or available through
`NODE_PATH`. Set `CHROME_PATH` to a Chrome executable on other platforms,
`HEALTH_DASHBOARD_URL` to use another local server URL, and optionally
`HEALTH_SCREENSHOT_DIR` for screenshots. The browser test uses fixture data,
checks all four views at 320/375/390/430/1280 px, validates actual pixel spacing,
and exercises touch details and historical-range latest tiles.
