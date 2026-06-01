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

test('phone layout keeps the chess board large, centered, and not sticky', () => {
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /--mobile-board-size:\s*min\(calc\(100vw - 24px\), 430px\)/);
  assert.match(css, /\.chess-board-area\s*{[^}]*position:\s*static/s);
  assert.match(css, /\.chess-board-area\s*{[^}]*align-items:\s*center/s);
  assert.match(css, /\.board-layout\s*{[^}]*width:\s*var\(--mobile-board-size\)/s);
  assert.match(css, /\.board-layout\s*{[^}]*margin:\s*0 auto/s);
  assert.match(css, /\.board-wrapper\s*{[^}]*aspect-ratio:\s*1 \/ 1/s);
  assert.match(css, /\.eval-bar-container,\s*\.top-coords,\s*\.right-coords\s*{[^}]*display:\s*none/s);
});

test('phone page prevents horizontal overflow and keeps panels scrollable', () => {
  assert.match(css, /html,\s*body\s*{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.app-main\s*{[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.dashboard-area\s*{[^}]*height:\s*auto/s);
  assert.match(css, /\.tab-pane\s*{[^}]*position:\s*static/s);
});

test('touch targets and dashboard controls are thumb-friendly on phones', () => {
  assert.match(css, /\.square\s*{[^}]*min-width:\s*0/s);
  assert.match(css, /\.board-actions\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.board-actions \.btn\s*{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tab-link\s*{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.dashboard-tabs\s*{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.tooltip::before\s*{[^}]*display:\s*none/s);
});

test('bot level is reachable next to the board on phones', () => {
  assert.match(html, /id="quick-stockfish-level"/);
  assert.match(html, /aria-label="Quick bot level control"/);
  assert.match(css, /\.quick-level-card\s*{[^}]*max-width:\s*var\(--mobile-board-size\)/s);
  assert.match(css, /\.quick-level-card \.form-control\s*{[^}]*min-height:\s*44px/s);
});
