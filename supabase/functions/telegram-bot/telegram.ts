import type { Group, ReplyMarkup, TelegramClient } from './types.ts';

export function mainMenuKeyboard(): ReplyMarkup {
  return {
    keyboard: [[{ text: 'Сегодня' }, { text: 'Сейчас' }], [{ text: 'Изменить группу' }]],
    resize_keyboard: true,
  };
}

export function groupInlineKeyboard(groups: Group[]): ReplyMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let index = 0; index < groups.length; index += 2) {
    rows.push(
      groups.slice(index, index + 2).map((group) => ({
        text: group.name,
        callback_data: `group:${group.id}`,
      })),
    );
  }
  return { inline_keyboard: rows };
}

export function createTelegramClient(token: string, fetchImpl: typeof fetch = fetch): TelegramClient {
  async function call(method: string, body: Record<string, unknown>): Promise<void> {
    let response: Response;
    try {
      response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { ok?: boolean };
      if (!response.ok || result.ok !== true) throw new Error('request rejected');
    } catch {
      throw new Error(`Telegram API request failed: ${method}`);
    }
  }

  return {
    async sendMessage(chatId, text, replyMarkup) {
      const body: Record<string, unknown> = { chat_id: chatId, text };
      if (replyMarkup) body.reply_markup = replyMarkup;
      await call('sendMessage', body);
    },

    async answerCallbackQuery(callbackQueryId, text) {
      const body: Record<string, unknown> = { callback_query_id: callbackQueryId };
      if (text) body.text = text;
      await call('answerCallbackQuery', body);
    },

    async setWebhook(url, secretToken) {
      await call('setWebhook', {
        url,
        secret_token: secretToken,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      });
    },
  };
}
