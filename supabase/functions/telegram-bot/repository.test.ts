import test from 'node:test';
import assert from 'node:assert/strict';

import { createScheduleRepository } from './repository.ts';

function createFakeSupabase() {
  const calls: Array<{ table: string; operation: string; args: unknown[] }> = [];
  const responses: Record<string, unknown> = {
    groups: [{ id: 1, name: 'ПО-41' }],
    schedule: [{ id: 5, lesson_number: 1, subject_name: 'Сети', time_start: '08:30:00', time_end: '09:50:00' }],
    telegram_users: {
      telegram_user_id: 200,
      chat_id: 100,
      group: { id: 1, name: 'ПО-41' },
    },
  };

  function from(table: string) {
    const chain = {
      select(...args: unknown[]) {
        calls.push({ table, operation: 'select', args });
        return chain;
      },
      eq(...args: unknown[]) {
        calls.push({ table, operation: 'eq', args });
        return chain;
      },
      order(...args: unknown[]) {
        calls.push({ table, operation: 'order', args });
        return Promise.resolve({ data: responses[table], error: null });
      },
      maybeSingle() {
        calls.push({ table, operation: 'maybeSingle', args: [] });
        return Promise.resolve({ data: responses[table], error: null });
      },
      upsert(...args: unknown[]) {
        calls.push({ table, operation: 'upsert', args });
        return Promise.resolve({ data: null, error: null });
      },
    };
    return chain;
  }

  return { client: { from }, calls, responses };
}

test('repository loads groups ordered by name', async () => {
  const fake = createFakeSupabase();
  const repository = createScheduleRepository(fake.client);
  assert.deepEqual(await repository.listGroups(), [{ id: 1, name: 'ПО-41' }]);
  assert.deepEqual(fake.calls.at(-1), {
    table: 'groups',
    operation: 'order',
    args: ['name', { ascending: true }],
  });
});

test('repository maps a saved Telegram group and handles no row', async () => {
  const fake = createFakeSupabase();
  const repository = createScheduleRepository(fake.client);
  assert.deepEqual(await repository.getUserGroup(200), {
    telegramUserId: 200,
    chatId: 100,
    group: { id: 1, name: 'ПО-41' },
  });

  fake.responses.telegram_users = null;
  assert.equal(await repository.getUserGroup(999), null);
});

test('repository upserts a user group with updated timestamp', async () => {
  const fake = createFakeSupabase();
  const repository = createScheduleRepository(fake.client, () => '2026-09-24T12:00:00.000Z');
  await repository.saveUserGroup(200, 100, 2);
  assert.deepEqual(fake.calls.at(-1), {
    table: 'telegram_users',
    operation: 'upsert',
    args: [{
      telegram_user_id: 200,
      chat_id: 100,
      group_id: 2,
      updated_at: '2026-09-24T12:00:00.000Z',
    }, { onConflict: 'telegram_user_id' }],
  });
});

test('repository filters and orders the daily schedule', async () => {
  const fake = createFakeSupabase();
  const repository = createScheduleRepository(fake.client);
  const result = await repository.getSchedule(1, 4);
  assert.equal(result[0].subject_name, 'Сети');
  assert.deepEqual(
    fake.calls.filter((call) => call.table === 'schedule').map((call) => [call.operation, call.args]),
    [
      ['select', ['id, lesson_number, subject_name, time_start, time_end']],
      ['eq', ['group_id', 1]],
      ['eq', ['day_of_week', 4]],
      ['order', ['lesson_number', { ascending: true }]],
    ],
  );
});

test('repository converts database errors to operation-only messages', async () => {
  const client = {
    from() {
      return {
        select() { return this; },
        order() { return Promise.resolve({ data: null, error: { message: 'private SQL details' } }); },
      };
    },
  };
  const repository = createScheduleRepository(client);
  await assert.rejects(repository.listGroups(), { message: 'Supabase operation failed: list_groups' });
});
