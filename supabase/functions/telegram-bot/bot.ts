import {
  formatCurrentMessage,
  formatTodayMessage,
  getAlmatyClock,
  getCurrentScheduleState,
} from './schedule.ts';
import { groupInlineKeyboard, mainMenuKeyboard } from './telegram.ts';
import type {
  Group,
  Lesson,
  TelegramCallbackQuery,
  TelegramClient,
  TelegramMessage,
  TelegramUpdate,
  UserGroup,
} from './types.ts';

export interface ScheduleRepository {
  listGroups(): Promise<Group[]>;
  getUserGroup(telegramUserId: number): Promise<UserGroup | null>;
  saveUserGroup(telegramUserId: number, chatId: number, groupId: number): Promise<void>;
  getSchedule(groupId: number, dayOfWeek: number): Promise<Lesson[]>;
}

interface BotDependencies {
  repository: ScheduleRepository;
  telegram: TelegramClient;
  now?: () => Date;
  logError?: (operation: string) => void;
}

const GENERIC_ERROR = 'Не удалось загрузить расписание. Попробуйте позже.';

function normalizedCommand(text: string): string {
  return text.trim().toLocaleLowerCase('ru-RU').replace(/^\/(start|today|now|group|help)@[a-z0-9_]+$/, '/$1');
}

export function createBotService({
  repository,
  telegram,
  now = () => new Date(),
  logError = (operation) => console.error(`Telegram bot error: ${operation}`),
}: BotDependencies): { handleUpdate(update: TelegramUpdate): Promise<void> } {
  async function showGroupSelection(chatId: number, prefix = 'Выберите учебную группу:'): Promise<void> {
    const groups = await repository.listGroups();
    if (groups.length === 0) {
      await telegram.sendMessage(chatId, 'Учебные группы пока не добавлены.');
      return;
    }
    await telegram.sendMessage(chatId, prefix, groupInlineKeyboard(groups));
  }

  async function requireGroup(telegramUserId: number, chatId: number): Promise<UserGroup | null> {
    const userGroup = await repository.getUserGroup(telegramUserId);
    if (userGroup) return userGroup;
    await showGroupSelection(chatId, 'Сначала выберите учебную группу:');
    return null;
  }

  async function showToday(telegramUserId: number, chatId: number): Promise<void> {
    const userGroup = await requireGroup(telegramUserId, chatId);
    if (!userGroup) return;

    const clock = getAlmatyClock(now());
    const lessons = clock.dayOfWeek === 7
      ? []
      : await repository.getSchedule(userGroup.group.id, clock.dayOfWeek);
    await telegram.sendMessage(
      chatId,
      formatTodayMessage(userGroup.group.name, lessons, clock.dateLabel),
      mainMenuKeyboard(),
    );
  }

  async function showNow(telegramUserId: number, chatId: number): Promise<void> {
    const userGroup = await requireGroup(telegramUserId, chatId);
    if (!userGroup) return;

    const clock = getAlmatyClock(now());
    const lessons = clock.dayOfWeek === 7
      ? []
      : await repository.getSchedule(userGroup.group.id, clock.dayOfWeek);
    const state = getCurrentScheduleState(lessons, clock.minutes);
    await telegram.sendMessage(
      chatId,
      formatCurrentMessage(userGroup.group.name, state),
      mainMenuKeyboard(),
    );
  }

  async function handleMessage(message: TelegramMessage): Promise<void> {
    if (message.chat.type !== 'private' || !message.from || typeof message.text !== 'string') return;

    const command = normalizedCommand(message.text);
    if (command === '/start') {
      const userGroup = await repository.getUserGroup(message.from.id);
      if (!userGroup) {
        await showGroupSelection(message.chat.id);
        return;
      }
      await telegram.sendMessage(
        message.chat.id,
        `Расписание колледжа\n\nВаша группа: ${userGroup.group.name}\nВыберите действие:`,
        mainMenuKeyboard(),
      );
      return;
    }

    if (command === '/today' || command === 'сегодня') {
      await showToday(message.from.id, message.chat.id);
      return;
    }
    if (command === '/now' || command === 'сейчас') {
      await showNow(message.from.id, message.chat.id);
      return;
    }
    if (command === '/group' || command === 'изменить группу') {
      await showGroupSelection(message.chat.id);
      return;
    }
    if (command === '/help') {
      await telegram.sendMessage(
        message.chat.id,
        'Команды бота:\n/start — главное меню\n/today — расписание на сегодня\n/now — текущая пара\n/group — изменить группу\n/help — помощь',
        mainMenuKeyboard(),
      );
      return;
    }

    await telegram.sendMessage(
      message.chat.id,
      'Используйте кнопки меню или команду /help.',
      mainMenuKeyboard(),
    );
  }

  async function handleCallback(callback: TelegramCallbackQuery): Promise<boolean> {
    const message = callback.message;
    if (!message || message.chat.type !== 'private') return false;

    const match = /^group:([1-9]\d*)$/.exec(callback.data ?? '');
    if (!match) {
      await telegram.answerCallbackQuery(callback.id, 'Некорректный выбор');
      return true;
    }

    const groupId = Number(match[1]);
    const groups = await repository.listGroups();
    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      await telegram.answerCallbackQuery(callback.id, 'Группа не найдена');
      return true;
    }

    await repository.saveUserGroup(callback.from.id, message.chat.id, group.id);
    await telegram.answerCallbackQuery(callback.id, 'Группа выбрана');
    await telegram.sendMessage(
      message.chat.id,
      `Группа ${group.name} сохранена.\n\nВыберите действие:`,
      mainMenuKeyboard(),
    );
    return true;
  }

  return {
    async handleUpdate(update) {
      const message = update.message;
      const callback = update.callback_query;
      const chat = message?.chat ?? callback?.message?.chat;
      if (!chat || chat.type !== 'private') return;

      let callbackAnswered = false;
      try {
        if (callback) {
          callbackAnswered = await handleCallback(callback);
        } else if (message) {
          await handleMessage(message);
        }
      } catch {
        logError('handle_update');
        if (callback && !callbackAnswered) {
          try {
            await telegram.answerCallbackQuery(callback.id, 'Ошибка');
          } catch {
            logError('answer_callback');
          }
        }
        try {
          await telegram.sendMessage(chat.id, GENERIC_ERROR);
        } catch {
          logError('send_error_message');
        }
      }
    },
  };
}
