import test from 'node:test';
import assert from 'node:assert/strict';

import { createWebhookHandler } from './webhook.ts';
import type { TelegramUpdate } from './types.ts';

const validUpdate: TelegramUpdate = {
  message: {
    message_id: 1,
    chat: { id: 100, type: 'private' },
    from: { id: 200 },
    text: '/start',
  },
};

function request(body: string, secret = 'expected-secret', method = 'POST'): Request {
  return new Request('https://example.com/telegram-bot', {
    method,
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: method === 'POST' ? body : undefined,
  });
}

test('webhook rejects methods other than POST', async () => {
  const handler = createWebhookHandler({
    webhookSecret: 'expected-secret',
    bot: { async handleUpdate() {} },
  });
  const response = await handler(request('', 'expected-secret', 'GET'));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
});

test('webhook rejects missing or incorrect Telegram secrets', async () => {
  const handler = createWebhookHandler({
    webhookSecret: 'expected-secret',
    bot: { async handleUpdate() {} },
  });

  const missing = new Request('https://example.com/telegram-bot', { method: 'POST', body: '{}' });
  assert.equal((await handler(missing)).status, 401);
  assert.equal((await handler(request('{}', 'wrong-secret'))).status, 401);
});

test('webhook rejects malformed JSON', async () => {
  const handler = createWebhookHandler({
    webhookSecret: 'expected-secret',
    bot: { async handleUpdate() {} },
  });
  assert.equal((await handler(request('{invalid'))).status, 400);
});

test('webhook passes a valid update to the bot', async () => {
  const updates: TelegramUpdate[] = [];
  const handler = createWebhookHandler({
    webhookSecret: 'expected-secret',
    bot: { async handleUpdate(update) { updates.push(update); } },
  });
  const response = await handler(request(JSON.stringify(validUpdate)));
  assert.equal(response.status, 200);
  assert.deepEqual(updates, [validUpdate]);
  assert.deepEqual(await response.json(), { ok: true });
});

test('webhook returns a redacted server error when the bot throws', async () => {
  const errors: string[] = [];
  const handler = createWebhookHandler({
    webhookSecret: 'expected-secret',
    bot: { async handleUpdate() { throw new Error('private failure'); } },
    logError: (operation) => errors.push(operation),
  });
  const response = await handler(request(JSON.stringify(validUpdate)));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, error: 'Internal error' });
  assert.deepEqual(errors, ['webhook_handler']);
});
