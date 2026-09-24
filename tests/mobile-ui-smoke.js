const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/dashboard.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/dashboard.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'site.webmanifest'), 'utf8'));

assert.match(html, /viewport-fit=cover/);
assert.match(html, /name="theme-color" content="#0d0f12"/);
assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
assert.match(html, /rel="apple-touch-icon"/);
assert.match(html, /rel="manifest" href="site\.webmanifest"/);

assert.strictEqual(manifest.display, 'standalone');
assert.strictEqual(manifest.start_url, './#overview');
assert.deepStrictEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512']);

assert.match(css, /env\(safe-area-inset-top\)/);
assert.match(css, /\.tab-nav::-webkit-scrollbar/);
assert.match(css, /\.sport-subtabs::-webkit-scrollbar/);
assert.match(css, /\.date-field input\[type="date"\][\s\S]*font-size: 16px/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(js, /function chartDensity\(\)/);
assert.match(js, /link\.setAttribute\('aria-selected', active \? 'true' : 'false'\)/);
assert.match(js, /item\.setAttribute\('tabindex', selected \? '0' : '-1'\)/);
assert.match(js, /function revealActiveTab\(tab\)/);

console.log('Mobile UI smoke checks passed.');
