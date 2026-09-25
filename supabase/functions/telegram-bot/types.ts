export interface Group {
  id: number;
  name: string;
}

export interface Lesson {
  id: number;
  lesson_number: number;
  subject_name: string;
  teacher_name: string | null;
  room: string | null;
  time_start: string;
  time_end: string;
}

export interface UserGroup {
  telegramUserId: number;
  chatId: number;
  group: Group;
}

export type ScheduleState =
  | { type: 'empty' }
  | { type: 'current'; lesson: Lesson }
  | { type: 'break'; lesson: Lesson }
  | { type: 'before'; lesson: Lesson }
  | { type: 'after' };

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramUser {
  id: number;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export type ReplyMarkup = Record<string, unknown>;

export interface TelegramClient {
  sendMessage(chatId: number, text: string, replyMarkup?: ReplyMarkup): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
  setWebhook(url: string, secretToken: string): Promise<void>;
}
