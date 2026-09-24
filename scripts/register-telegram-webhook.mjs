const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const projectRef = process.env.SUPABASE_PROJECT_REF || 'gchgtvcklerhlfmwmica';

if (!token || !webhookSecret) {
  console.error('Required environment variables are missing.');
  process.exitCode = 1;
} else {
  const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/telegram-bot`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      }),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error('request rejected');
    console.log(`Webhook registered: ${webhookUrl}`);
  } catch {
    console.error('Telegram webhook registration failed.');
    process.exitCode = 1;
  }
}
