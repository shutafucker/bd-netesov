import type { TelegramUpdate } from './types.ts';

interface WebhookDependencies {
  webhookSecret: string;
  bot: { handleUpdate(update: TelegramUpdate): Promise<void> };
  logError?: (operation: string) => void;
}

function jsonResponse(body: Record<string, unknown>, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function createWebhookHandler({
  webhookSecret,
  bot,
  logError = (operation) => console.error(`Telegram webhook error: ${operation}`),
}: WebhookDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405, { allow: 'POST' });
    }

    const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (!suppliedSecret || suppliedSecret !== webhookSecret) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    let update: TelegramUpdate;
    try {
      update = await request.json() as TelegramUpdate;
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400);
    }

    try {
      await bot.handleUpdate(update);
      return jsonResponse({ ok: true }, 200);
    } catch {
      logError('webhook_handler');
      return jsonResponse({ ok: false, error: 'Internal error' }, 500);
    }
  };
}
