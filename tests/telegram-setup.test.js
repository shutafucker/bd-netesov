const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('Edge Function bootstrap wires secrets, repository, bot, and webhook', () => {
  const index = fs.readFileSync(
    path.join(root, 'supabase/functions/telegram-bot/index.ts'),
    'utf8',
  );
  const config = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');

  assert.match(index, /Deno\.env\.get\(name\)/);
  for (const name of [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    assert.match(index, new RegExp(`requiredEnvironment\\('${name}'\\)`));
  }
  assert.match(index, /createScheduleRepository\(/);
  assert.match(index, /createBotService\(/);
  assert.match(index, /createWebhookHandler\(/);
  assert.match(index, /Deno\.serve\(/);
  assert.match(config, /\[functions\.telegram-bot\][\s\S]*verify_jwt\s*=\s*false/);
});

test('webhook registration script refuses missing secrets without leaking values', () => {
  const result = spawnSync(process.execPath, ['scripts/register-telegram-webhook.mjs'], {
    cwd: root,
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Required environment variables are missing/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /bot token|webhook secret value/i);
});

test('webhook registration script builds a safe Telegram request', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/register-telegram-webhook.mjs'), 'utf8');
  assert.match(script, /SUPABASE_PROJECT_REF/);
  assert.match(script, /TELEGRAM_BOT_TOKEN/);
  assert.match(script, /TELEGRAM_WEBHOOK_SECRET/);
  assert.match(script, /functions\/v1\/telegram-bot/);
  assert.match(script, /secret_token/);
  assert.match(script, /allowed_updates:\s*\['message', 'callback_query'\]/);
  assert.doesNotMatch(script, /8713416553:AA/);
});

test('README documents secure Telegram bot deployment', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  for (const text of [
    '@BotFather',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'Edge Function Secrets',
    'npx supabase login',
    'npx supabase functions deploy telegram-bot',
    'register-telegram-webhook.mjs',
    'getWebhookInfo',
    'личных чатах',
  ]) {
    assert.ok(readme.includes(text), `README should include: ${text}`);
  }
});

test('local secret files stay ignored', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /supabase\/functions\/\.env/);
});
