import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTelegramClient,
  groupInlineKeyboard,
  mainMenuKeyboard,
} from './telegram.ts';

function recordingFetch(response: Record<string, unknown> = { ok: true }) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body)),
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, fetchImpl: fetchImpl as typeof fetch };
}

test('mainMenuKeyboard creates the three Russian actions', () => {
  assert.deepEqual(mainMenuKeyboard(), {
    keyboard: [[{ text: 'Сегодня' }, { text: 'Сейчас' }], [{ text: 'Изменить группу' }]],
    resize_keyboard: true,
  });
});

test('groupInlineKeyboard uses two-column group callbacks', () => {
  assert.deepEqual(
    groupInlineKeyboard([
      { id: 1, name: 'ПО-41' },
      { id: 2, name: 'ИС-22' },
      { id: 3, name: 'ДО-10' },
    ]),
    {
      inline_keyboard: [
        [
          { text: 'ПО-41', callback_data: 'group:1' },
          { text: 'ИС-22', callback_data: 'group:2' },
        ],
        [{ text: 'ДО-10', callback_data: 'group:3' }],
      ],
    },
  );
});

test('sendMessage posts plain text without parse mode', async () => {
  const recorder = recordingFetch();
  const client = createTelegramClient('test-token', recorder.fetchImpl);

  await client.sendMessage(42, 'Привет', mainMenuKeyboard());

  assert.equal(recorder.calls[0].url, 'https://api.telegram.org/bottest-token/sendMessage');
  assert.deepEqual(recorder.calls[0].body, {
    chat_id: 42,
    text: 'Привет',
    reply_markup: mainMenuKeyboard(),
  });
  assert.equal('parse_mode' in recorder.calls[0].body, false);
});

test('answerCallbackQuery closes the Telegram loading indicator', async () => {
  const recorder = recordingFetch();
  const client = createTelegramClient('test-token', recorder.fetchImpl);
  await client.answerCallbackQuery('callback-1', 'Группа выбрана');

  assert.equal(recorder.calls[0].url, 'https://api.telegram.org/bottest-token/answerCallbackQuery');
  assert.deepEqual(recorder.calls[0].body, {
    callback_query_id: 'callback-1',
    text: 'Группа выбрана',
  });
});

test('setWebhook registers the secret and limited update types', async () => {
  const recorder = recordingFetch();
  const client = createTelegramClient('test-token', recorder.fetchImpl);
  await client.setWebhook('https://example.com/telegram-bot', 'webhook-secret');

  assert.equal(recorder.calls[0].url, 'https://api.telegram.org/bottest-token/setWebhook');
  assert.deepEqual(recorder.calls[0].body, {
    url: 'https://example.com/telegram-bot',
    secret_token: 'webhook-secret',
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
});

test('client throws a redacted error for a Telegram API failure', async () => {
  const recorder = recordingFetch({ ok: false, description: 'private response text' });
  const client = createTelegramClient('secret-token', recorder.fetchImpl);

  await assert.rejects(client.sendMessage(42, 'sensitive message'), {
    message: 'Telegram API request failed: sendMessage',
  });
});
