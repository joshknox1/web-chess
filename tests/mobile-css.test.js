const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('page opts into safe-area aware mobile viewport sizing', () => {
  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /env\(safe-area-inset-bottom/);
});

test('phone layout keeps the chess board first, large, and viewport-bound', () => {
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /--mobile-board-size:\s*min\(calc\(100vw - 28px\), calc\(100dvh - 250px\), 520px\)/);
  assert.match(css, /\.board-layout\s*{[^}]*width:\s*var\(--mobile-board-size\)/s);
  assert.match(css, /\.board-layout\s*{[^}]*height:\s*var\(--mobile-board-size\)/s);
  assert.match(css, /\.chess-board-area\s*{[^}]*position:\s*sticky/s);
});

test('touch targets and dashboard controls are thumb-friendly on phones', () => {
  assert.match(css, /\.square\s*{[^}]*min-width:\s*0/s);
  assert.match(css, /\.btn\s*,\s*\.tab-link\s*,\s*\.radio-btn\s*,\s*\.icon-btn\s*{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.dashboard-tabs\s*{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.board-actions\s*{[^}]*display:\s*grid/s);
  assert.match(css, /\.tooltip::before\s*{[^}]*display:\s*none/s);
});
