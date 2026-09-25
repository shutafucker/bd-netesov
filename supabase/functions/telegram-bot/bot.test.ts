import test from 'node:test';
import assert from 'node:assert/strict';

import { createBotService, type ScheduleRepository } from './bot.ts';
import type { Group, Lesson, ReplyMarkup, TelegramClient, TelegramUpdate, UserGroup } from './types.ts';

const groups: Group[] = [
  { id: 1, name: 'ПО-41' },
  { id: 2, name: 'ИС-22' },
];

const lessons: Lesson[] = [
  {
    id: 1,
    lesson_number: 1,
    subject_name: 'Компьютерные сети',
    teacher_name: null,
    room: null,
    time_start: '08:30:00',
    time_end: '09:50:00',
  },
];

function createHarness(savedGroup: UserGroup | null = null) {
  const sent: Array<{ chatId: number; text: string; markup?: ReplyMarkup }> = [];
  const answered: Array<{ id: string; text?: string }> = [];
  const saves: Array<{ telegramUserId: number; chatId: number; groupId: number }> = [];
  const scheduleRequests: Array<{ groupId: number; day: number }> = [];

  const telegram: TelegramClient = {
    async sendMessage(chatId, text, markup) {
      sent.push({ chatId, text, markup });
    },
    async answerCallbackQuery(id, text) {
      answered.push({ id, text });
    },
    async setWebhook() {},
  };

  const repository: ScheduleRepository = {
    async listGroups() {
      return groups;
    },
    async getUserGroup() {
      return savedGroup;
    },
    async saveUserGroup(telegramUserId, chatId, groupId) {
      saves.push({ telegramUserId, chatId, groupId });
    },
    async getSchedule(groupId, day) {
      scheduleRequests.push({ groupId, day });
      return lessons;
    },
  };

  const errors: string[] = [];
  const bot = createBotService({
    repository,
    telegram,
    now: () => new Date('2026-09-24T04:00:00.000Z'),
    logError: (operation) => errors.push(operation),
  });
  return { bot, repository, sent, answered, saves, scheduleRequests, errors };
}

function message(text: string, chatType = 'private'): TelegramUpdate {
  return {
    message: {
      message_id: 1,
      chat: { id: 100, type: chatType },
      from: { id: 200 },
      text,
    },
  };
}

function callback(data: string): TelegramUpdate {
  return {
    callback_query: {
      id: 'callback-1',
      from: { id: 200 },
      message: {
        message_id: 2,
        chat: { id: 100, type: 'private' },
      },
      data,
    },
  };
}

test('/start asks a new user to choose a group', async () => {
  const harness = createHarness();
  await harness.bot.handleUpdate(message('/start'));
  assert.equal(harness.sent[0].text, 'Выберите учебную группу:');
  assert.deepEqual(harness.sent[0].markup, {
    inline_keyboard: [[
      { text: 'ПО-41', callback_data: 'group:1' },
      { text: 'ИС-22', callback_data: 'group:2' },
    ]],
  });
});

test('/start shows the saved group and main menu', async () => {
  const harness = createHarness({ telegramUserId: 200, chatId: 100, group: groups[0] });
  await harness.bot.handleUpdate(message('/start@parashnil133709_bot'));
  assert.match(harness.sent[0].text, /Ваша группа: ПО-41/);
  assert.ok(harness.sent[0].markup && 'keyboard' in harness.sent[0].markup);
});

test('/today loads the Almaty weekday and formats the daily schedule', async () => {
  const harness = createHarness({ telegramUserId: 200, chatId: 100, group: groups[0] });
  await harness.bot.handleUpdate(message('/today'));
  assert.deepEqual(harness.scheduleRequests, [{ groupId: 1, day: 4 }]);
  assert.match(harness.sent[0].text, /Расписание · ПО-41/);
  assert.match(harness.sent[0].text, /Компьютерные сети/);
});

test('/now and Russian menu button render the current state', async () => {
  for (const text of ['/now', 'Сейчас']) {
    const harness = createHarness({ telegramUserId: 200, chatId: 100, group: groups[0] });
    await harness.bot.handleUpdate(message(text));
    assert.match(harness.sent[0].text, /Идёт 1 пара/);
  }
});

test('/group and change button reopen group selection', async () => {
  for (const text of ['/group', 'Изменить группу']) {
    const harness = createHarness({ telegramUserId: 200, chatId: 100, group: groups[0] });
    await harness.bot.handleUpdate(message(text));
    assert.equal(harness.sent[0].text, 'Выберите учебную группу:');
  }
});

test('/help and unknown text return useful menus', async () => {
  const help = createHarness();
  await help.bot.handleUpdate(message('/help'));
  assert.match(help.sent[0].text, /\/today/);
  assert.match(help.sent[0].text, /\/group/);

  const unknown = createHarness();
  await unknown.bot.handleUpdate(message('что-то ещё'));
  assert.match(unknown.sent[0].text, /Используйте кнопки меню/);
  assert.ok(unknown.sent[0].markup && 'keyboard' in unknown.sent[0].markup);
});

test('schedule actions request a group when preference is missing', async () => {
  const harness = createHarness();
  await harness.bot.handleUpdate(message('Сегодня'));
  assert.equal(harness.scheduleRequests.length, 0);
  assert.equal(harness.sent[0].text, 'Сначала выберите учебную группу:');
});

test('valid group callback saves preference and always acknowledges it', async () => {
  const harness = createHarness();
  await harness.bot.handleUpdate(callback('group:2'));
  assert.deepEqual(harness.saves, [{ telegramUserId: 200, chatId: 100, groupId: 2 }]);
  assert.deepEqual(harness.answered, [{ id: 'callback-1', text: 'Группа выбрана' }]);
  assert.match(harness.sent[0].text, /ИС-22/);
});

test('invalid and missing group callbacks do not save preferences', async () => {
  for (const data of ['group:0', 'group:-1', 'group:abc', 'other:2', 'group:999']) {
    const harness = createHarness();
    await harness.bot.handleUpdate(callback(data));
    assert.equal(harness.saves.length, 0);
    assert.equal(harness.answered.length, 1);
    assert.match(harness.answered[0].text ?? '', /Некорректный выбор|Группа не найдена/);
  }
});

test('bot ignores non-private chats', async () => {
  const harness = createHarness();
  await harness.bot.handleUpdate(message('/start', 'group'));
  assert.equal(harness.sent.length, 0);
});

test('repository failure sends a generic error and logs operation only', async () => {
  const harness = createHarness();
  harness.repository.listGroups = async () => {
    throw new Error('sensitive database details');
  };
  await harness.bot.handleUpdate(message('/start'));
  assert.equal(harness.sent[0].text, 'Не удалось загрузить расписание. Попробуйте позже.');
  assert.deepEqual(harness.errors, ['handle_update']);
});

test('callback failure still closes the loading indicator', async () => {
  const harness = createHarness();
  harness.repository.saveUserGroup = async () => {
    throw new Error('database unavailable');
  };
  await harness.bot.handleUpdate(callback('group:1'));
  assert.equal(harness.answered.length, 1);
  assert.equal(harness.answered[0].id, 'callback-1');
  assert.equal(harness.sent.at(-1)?.text, 'Не удалось загрузить расписание. Попробуйте позже.');
});
