const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('HTML exposes the accessible application contract', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.match(html, /<html\s+lang="ru"/i);
  assert.match(html, /viewport-fit=cover/i);
  for (const id of [
    'current-date',
    'group-select',
    'today-button',
    'now-button',
    'status-region',
    'results',
    'lesson-template',
    'skeleton-template',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /<main[\s>]/i);
  assert.match(html, /aria-live="polite"/i);
  assert.ok(html.indexOf('@supabase/supabase-js') < html.indexOf('config.js'));
  assert.ok(html.indexOf('config.js') < html.indexOf('app.js'));
});

test('CSS includes responsive Apple-inspired accessibility rules', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

  assert.match(css, /-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif/);
  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(prefers-color-scheme:\s*dark\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /backdrop-filter:\s*blur\(/);
  assert.match(css, /\.status-region\s*\{[^}]*position:\s*absolute[^}]*width:\s*1px[^}]*clip:/s);
});

test('public Supabase configuration is documented and safe by default', () => {
  const config = fs.readFileSync(path.join(root, 'config.js'), 'utf8');

  assert.match(config, /const\s+SUPABASE_URL\s*=\s*['"]YOUR_SUPABASE_URL['"]/);
  assert.match(config, /const\s+SUPABASE_ANON_KEY\s*=\s*['"]YOUR_SUPABASE_ANON_KEY['"]/);
  assert.match(config, /Project URL/i);
  assert.match(config, /anon(?:\/public)? key/i);
  assert.doesNotMatch(config, /service_role\s*=/i);
});

test('application exposes the requested browser functions', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

  for (const functionName of [
    'loadGroups',
    'loadTodaySchedule',
    'loadCurrentLesson',
    'renderSchedule',
    'renderCurrentLesson',
    'showLoading',
    'showMessage',
    'showError',
  ]) {
    assert.match(app, new RegExp(`function\\s+${functionName}\\s*\\(`));
  }
});

test('README documents setup, deployment, security, and troubleshooting', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

  for (const requiredText of [
    'Supabase',
    'SQL Editor',
    'database.sql',
    'Project URL',
    'anon/public key',
    'config.js',
    'python3 -m http.server 8000',
    'npx serve',
    'Vercel',
    'service_role',
    'Устранение проблем',
    'Telegram',
  ]) {
    assert.ok(readme.includes(requiredText), `README should include: ${requiredText}`);
  }
});
