import { createClient } from 'npm:@supabase/supabase-js@2';

import { createBotService } from './bot.ts';
import { createScheduleRepository } from './repository.ts';
import { createTelegramClient } from './telegram.ts';
import { createWebhookHandler } from './webhook.ts';

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Required environment is missing: ${name}`);
  return value;
}

const supabaseUrl = requiredEnvironment('SUPABASE_URL');
const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
const telegramToken = requiredEnvironment('TELEGRAM_BOT_TOKEN');
const webhookSecret = requiredEnvironment('TELEGRAM_WEBHOOK_SECRET');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const repository = createScheduleRepository(supabase);
const telegram = createTelegramClient(telegramToken);
const bot = createBotService({ repository, telegram });
const handler = createWebhookHandler({ webhookSecret, bot });

Deno.serve(handler);
