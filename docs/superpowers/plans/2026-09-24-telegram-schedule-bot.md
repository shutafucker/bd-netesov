# Telegram Schedule Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and prepare deployment of a private-chat Telegram bot that remembers a user's group and reads today's/current schedule from the existing Supabase project.

**Architecture:** Telegram sends `message` and `callback_query` updates to a public Supabase Edge Function. A small testable webhook layer validates Telegram's secret header, a bot service routes commands through injected database and Telegram ports, and pure schedule helpers compute `Asia/Almaty` day/time state. Secrets stay in Supabase Edge Function Secrets and the static website remains unchanged.

**Tech Stack:** Supabase Edge Functions, Deno-compatible TypeScript, Telegram Bot API webhook, PostgreSQL/RLS, Node 26 built-in TypeScript test runner for dependency-free tests

## Global Constraints

- The bot works only in private Telegram chats.
- First-version actions are group selection, `Сегодня`, `Сейчас`, group change, and help.
- College date and time always use `Asia/Almaty`.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` never appear in tracked files, commands captured in documentation, logs, or tests.
- The public webhook disables Supabase JWT verification and instead requires `X-Telegram-Bot-Api-Secret-Token`.
- `telegram_users` has RLS enabled and no public policy.
- The existing static site and public schedule RLS behavior must remain unchanged.
- Remote values are rendered as plain Telegram text without `parse_mode`.

---

### Task 1: Private Telegram user preference schema

**Files:**
- Modify: `database.sql`
- Modify: `tests/database.test.js`

**Interfaces:**
- Produces `public.telegram_users(telegram_user_id bigint primary key, chat_id bigint, group_id bigint, created_at timestamptz, updated_at timestamptz)`.
- Preserves the existing `groups` and `schedule` contracts.

- [ ] **Step 1: Add a failing database contract test**

Assert the table, primary key, `groups(id) on delete cascade` foreign key, timestamps, group index, enabled RLS, and absence of any policy targeting `telegram_users`. Retain all existing schema assertions.

- [ ] **Step 2: Run RED**

Run: `node --test tests/database.test.js`
Expected: FAIL because `telegram_users` is missing.

- [ ] **Step 3: Add the table and index**

Append an idempotent `create table if not exists public.telegram_users`, `create index if not exists telegram_users_group_idx`, and `alter table ... enable row level security`. Do not grant access or create policies for this table.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/database.test.js`
Expected: all database tests pass.

### Task 2: Pure Almaty schedule logic

**Files:**
- Create: `supabase/functions/telegram-bot/types.ts`
- Create: `supabase/functions/telegram-bot/schedule.ts`
- Create: `supabase/functions/telegram-bot/schedule.test.ts`

**Interfaces:**
- Produces `getAlmatyClock(date: Date): { dayOfWeek: number; minutes: number; dateLabel: string }`.
- Produces `getCurrentScheduleState(lessons: Lesson[], minutes: number): ScheduleState`.
- Produces `formatTodayMessage(groupName: string, lessons: Lesson[], dateLabel: string): string` and `formatCurrentMessage(groupName: string, state: ScheduleState): string`.
- `ScheduleState.type` is `empty | current | break | before | after`.

- [ ] **Step 1: Write failing pure-function tests**

Use `node:test` and `node:assert/strict`. Cover an instant that crosses the UTC/Almaty date boundary, Sunday mapping, `08:30:00 -> 510`, empty lessons, inclusive current boundaries, a break with next lesson, before/after states, ordered Russian schedule text, and every current-state message.

- [ ] **Step 2: Run RED**

Run: `node --test supabase/functions/telegram-bot/schedule.test.ts`
Expected: FAIL because `schedule.ts` is missing.

- [ ] **Step 3: Implement types and pure schedule functions**

Use `Intl.DateTimeFormat(..., { timeZone: 'Asia/Almaty' }).formatToParts()` for clock extraction. Sort lesson copies by `lesson_number`, validate `HH:MM[:SS]`, use inclusive active intervals, and build plain Russian text without Telegram HTML/Markdown.

- [ ] **Step 4: Verify GREEN**

Run: `node --test supabase/functions/telegram-bot/schedule.test.ts`
Expected: all pure schedule tests pass.

### Task 3: Telegram API client and keyboards

**Files:**
- Create: `supabase/functions/telegram-bot/telegram.ts`
- Create: `supabase/functions/telegram-bot/telegram.test.ts`

**Interfaces:**
- Produces `createTelegramClient(token: string, fetchImpl?: typeof fetch): TelegramClient`.
- `TelegramClient` methods are `sendMessage(chatId, text, replyMarkup?)`, `answerCallbackQuery(callbackQueryId, text?)`, and `setWebhook(url, secretToken)`.
- Produces `mainMenuKeyboard()` and `groupInlineKeyboard(groups)`.

- [ ] **Step 1: Write failing client tests**

Inject a recording `fetch` implementation. Assert endpoint paths, JSON bodies, no `parse_mode`, main menu text, two-column group callback buttons using `group:<id>`, callback acknowledgement, and a `setWebhook` body containing only `message` and `callback_query` allowed updates.

- [ ] **Step 2: Run RED**

Run: `node --test supabase/functions/telegram-bot/telegram.test.ts`
Expected: FAIL because `telegram.ts` is missing.

- [ ] **Step 3: Implement the minimal Telegram client**

POST JSON to `https://api.telegram.org/bot${token}/${method}`. Throw a generic error when HTTP or Telegram's `ok` field indicates failure, without including the token, response body, chat ID, or message text.

- [ ] **Step 4: Verify GREEN**

Run: `node --test supabase/functions/telegram-bot/telegram.test.ts`
Expected: all client and keyboard tests pass.

### Task 4: Bot command and callback service

**Files:**
- Create: `supabase/functions/telegram-bot/bot.ts`
- Create: `supabase/functions/telegram-bot/bot.test.ts`

**Interfaces:**
- Consumes a `ScheduleRepository` port with `listGroups()`, `getUserGroup(telegramUserId)`, `saveUserGroup(telegramUserId, chatId, groupId)`, and `getSchedule(groupId, dayOfWeek)`.
- Consumes `TelegramClient` from Task 3 and schedule helpers from Task 2.
- Produces `createBotService({ repository, telegram, now }): { handleUpdate(update): Promise<void> }`.

- [ ] **Step 1: Write failing behavior tests with in-memory fakes**

Cover `/start` without a group, `/start` with a saved group, `/today`, `/now`, `/group`, `/help`, all three Russian menu buttons, unknown text, strict valid/invalid `group:<positive integer>` callbacks, missing group, group upsert, callback acknowledgement in success and failure paths, and ignoring non-private chats.

- [ ] **Step 2: Run RED**

Run: `node --test supabase/functions/telegram-bot/bot.test.ts`
Expected: FAIL because `bot.ts` is missing.

- [ ] **Step 3: Implement routing and responses**

Normalize Telegram commands by removing an optional `@bot_username` suffix. Ask for group selection before schedule actions when no preference exists. Validate a callback's selected group against `listGroups()` before saving. Use one generic user-visible error and `console.error` only with an operation name.

- [ ] **Step 4: Verify GREEN**

Run: `node --test supabase/functions/telegram-bot/bot.test.ts`
Expected: all routing tests pass.

### Task 5: Secure webhook and Supabase Edge bootstrap

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/functions/telegram-bot/webhook.ts`
- Create: `supabase/functions/telegram-bot/webhook.test.ts`
- Create: `supabase/functions/telegram-bot/index.ts`

**Interfaces:**
- Produces `createWebhookHandler({ webhookSecret, bot }): (request: Request) => Promise<Response>`.
- `index.ts` validates required environment values, creates a privileged Supabase repository and Telegram client, then calls `Deno.serve(handler)`.
- Configures `[functions.telegram-bot] verify_jwt = false`.

- [ ] **Step 1: Write failing webhook tests**

Assert `405` for non-POST, `401` for absent/wrong secret, `400` for invalid JSON, `200` for valid/ignored updates, exact header comparison, and `500` with a generic body when the bot service throws.

- [ ] **Step 2: Run RED**

Run: `node --test supabase/functions/telegram-bot/webhook.test.ts`
Expected: FAIL because `webhook.ts` is missing.

- [ ] **Step 3: Implement the webhook handler and config**

Validate request method and `X-Telegram-Bot-Api-Secret-Token` before parsing JSON. Return JSON response bodies and never log request contents. Add the function-specific no-JWT setting to `supabase/config.toml`.

- [ ] **Step 4: Implement the Edge bootstrap and repository adapter**

Read built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` plus the two Telegram secrets. Import `createClient` from the pinned Supabase ESM package. Translate Supabase rows into the shared types, use an explicit `onConflict: 'telegram_user_id'` upsert, and throw operation-only errors.

- [ ] **Step 5: Verify unit contracts**

Run: `node --test supabase/functions/telegram-bot/*.test.ts && node --test tests/*.test.js`
Expected: all bot and website tests pass.

### Task 6: Safe setup tooling and documentation

**Files:**
- Create: `scripts/register-telegram-webhook.mjs`
- Create: `tests/telegram-setup.test.js`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- The setup script consumes `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and optional `SUPABASE_PROJECT_REF` from the process environment.
- The script registers `https://<project-ref>.supabase.co/functions/v1/telegram-bot` and never prints secret values.

- [ ] **Step 1: Write failing static/setup tests**

Assert the script refuses missing secrets, builds the expected webhook URL, uses `secret_token`, requests only the two allowed update types, and contains no real token. Assert README documents BotFather, secret storage, database SQL, deploy, webhook registration, `getWebhookInfo`, private-chat scope, and troubleshooting. Assert `.env` patterns remain ignored.

- [ ] **Step 2: Run RED**

Run: `node --test tests/telegram-setup.test.js`
Expected: FAIL because the script and bot README section are missing.

- [ ] **Step 3: Implement safe registration and docs**

Read secrets only from `process.env`, POST JSON to Telegram, redact errors, and print only the registered webhook URL on success. Document local tests, `npx supabase login`, `npx supabase link --project-ref gchgtvcklerhlfmwmica`, secrets entered through the Dashboard, `npx supabase functions deploy telegram-bot`, and environment-based webhook registration.

- [ ] **Step 4: Run complete local verification**

Run: `node --test tests/*.test.js supabase/functions/telegram-bot/*.test.ts && node --check scripts/register-telegram-webhook.mjs && git diff --check`
Expected: every test passes and syntax/whitespace checks exit 0.

### Task 7: Remote deployment handoff

**Files:**
- No tracked secret files.

**Interfaces:**
- Requires the owner to place the regenerated token and a generated webhook secret directly in Supabase Edge Function Secrets.

- [ ] **Step 1: Confirm database readiness without secrets**

Query the public `groups` endpoint with the existing publishable key. If `PGRST205` remains, stop remote deployment and ask the owner to execute `database.sql`; local implementation remains complete.

- [ ] **Step 2: Link and deploy when authenticated**

Run `npx supabase functions deploy telegram-bot --project-ref gchgtvcklerhlfmwmica --use-api`. If CLI authentication is absent, provide the exact `npx supabase login` handoff and do not request an access token in chat.

- [ ] **Step 3: Register and inspect webhook after owner sets secrets**

Run the registration script only in a local terminal where the owner has supplied environment variables without exposing them in command history. Then call Telegram `getWebhookInfo` through an equally secret-safe local mechanism and verify the URL, zero/declining pending updates, and no last error.

- [ ] **Step 4: Commit tracked implementation**

Commit schema, function, tests, setup script, and docs without `.env` or tokens. Verify `git grep` contains neither a Telegram token pattern nor secret values.
