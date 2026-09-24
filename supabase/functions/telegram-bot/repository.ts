import type { ScheduleRepository } from './bot.ts';
import type { Group, Lesson } from './types.ts';

interface SupabaseResult<T> {
  data: T | null;
  error: unknown;
}

interface SupabaseLike {
  from(table: string): any;
}

function unwrap<T>(result: SupabaseResult<T>, operation: string): T {
  if (result.error) throw new Error(`Supabase operation failed: ${operation}`);
  return result.data as T;
}

export function createScheduleRepository(
  client: SupabaseLike,
  nowIso: () => string = () => new Date().toISOString(),
): ScheduleRepository {
  return {
    async listGroups(): Promise<Group[]> {
      const result = await client
        .from('groups')
        .select('id, name')
        .order('name', { ascending: true });
      return unwrap<Group[]>(result, 'list_groups') ?? [];
    },

    async getUserGroup(telegramUserId) {
      const result = await client
        .from('telegram_users')
        .select('telegram_user_id, chat_id, group:groups!inner(id, name)')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();
      const row = unwrap<{
        telegram_user_id: number;
        chat_id: number;
        group: Group | Group[];
      } | null>(result, 'get_user_group');
      if (!row) return null;

      const group = Array.isArray(row.group) ? row.group[0] : row.group;
      if (!group) throw new Error('Supabase operation failed: get_user_group');
      return {
        telegramUserId: row.telegram_user_id,
        chatId: row.chat_id,
        group,
      };
    },

    async saveUserGroup(telegramUserId, chatId, groupId) {
      const result = await client.from('telegram_users').upsert({
        telegram_user_id: telegramUserId,
        chat_id: chatId,
        group_id: groupId,
        updated_at: nowIso(),
      }, { onConflict: 'telegram_user_id' });
      unwrap(result, 'save_user_group');
    },

    async getSchedule(groupId, dayOfWeek): Promise<Lesson[]> {
      const result = await client
        .from('schedule')
        .select('id, lesson_number, subject_name, time_start, time_end')
        .eq('group_id', groupId)
        .eq('day_of_week', dayOfWeek)
        .order('lesson_number', { ascending: true });
      return unwrap<Lesson[]>(result, 'get_schedule') ?? [];
    },
  };
}
