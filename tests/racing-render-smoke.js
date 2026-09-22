const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('css/dashboard.css', 'utf8');
const js = fs.readFileSync('js/dashboard.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert(css.includes('@media (min-width: 900px)'));
assert(css.includes('grid-template-columns: auto minmax(0, 1fr) auto'));
assert(css.includes('overflow-wrap: anywhere'));
assert(css.includes('.races-detail-row'));
assert(html.includes('data-subtab="prsb"'));
assert(html.includes('css/dashboard.css?v=20260922-1'));
assert(html.includes('js/dashboard.js?v=20260922-1'));
assert(js.includes("const BASE_PR_SB_URL = 'data/pr_sb.json'"));
assert(js.includes("record.type === 'PR' || prSbSeason === 'all'"));

console.log('Racing/PR-SB static smoke checks passed.');
