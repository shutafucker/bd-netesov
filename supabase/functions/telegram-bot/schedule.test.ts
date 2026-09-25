import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatCurrentMessage,
  formatTodayMessage,
  getAlmatyClock,
  getCurrentScheduleState,
  timeToMinutes,
} from './schedule.ts';

const lessons = [
  {
    id: 1,
    lesson_number: 1,
    subject_name: 'Компьютерные сети',
    teacher_name: null,
    room: null,
    time_start: '08:30:00',
    time_end: '09:50:00',
  },
  {
    id: 2,
    lesson_number: 2,
    subject_name: 'Web-разработка',
    teacher_name: 'Селиверстов К.О.',
    room: '105',
    time_start: '09:55:00',
    time_end: '11:15:00',
  },
  {
    id: 3,
    lesson_number: 3,
    subject_name: 'Базы данных',
    teacher_name: null,
    room: null,
    time_start: '11:25:00',
    time_end: '12:45:00',
  },
];

test('getAlmatyClock crosses the UTC date boundary correctly', () => {
  const clock = getAlmatyClock(new Date('2026-09-23T20:30:00.000Z'));
  assert.equal(clock.dayOfWeek, 4);
  assert.equal(clock.minutes, 90);
  assert.match(clock.dateLabel, /четверг, 24 сентября/i);
});

test('getAlmatyClock maps Sunday to seven', () => {
  const clock = getAlmatyClock(new Date('2026-09-27T07:00:00.000Z'));
  assert.equal(clock.dayOfWeek, 7);
});

test('timeToMinutes validates Supabase time values', () => {
  assert.equal(timeToMinutes('08:30:00'), 510);
  assert.equal(timeToMinutes('9:05'), 545);
  assert.equal(Number.isNaN(timeToMinutes('24:00')), true);
  assert.equal(Number.isNaN(timeToMinutes('invalid')), true);
});

test('getCurrentScheduleState covers empty, before, current, break, and after', () => {
  assert.deepEqual(getCurrentScheduleState([], 600), { type: 'empty' });
  assert.equal(getCurrentScheduleState(lessons, 500).type, 'before');
  assert.equal(getCurrentScheduleState(lessons, 510).type, 'current');
  assert.equal(getCurrentScheduleState(lessons, 590).type, 'current');
  assert.equal(getCurrentScheduleState(lessons, 592).type, 'break');
  assert.equal(getCurrentScheduleState(lessons, 766).type, 'after');
});

test('getCurrentScheduleState returns the relevant lesson without mutating input', () => {
  const reversed = [...lessons].reverse();
  assert.equal(getCurrentScheduleState(reversed, 500).lesson?.lesson_number, 1);
  assert.equal(getCurrentScheduleState(reversed, 592).lesson?.lesson_number, 2);
  assert.equal(reversed[0].lesson_number, 3);
});

test('formatTodayMessage produces ordered plain Russian text', () => {
  const message = formatTodayMessage('ПО-41', [...lessons].reverse(), 'четверг, 24 сентября');
  assert.equal(
    message,
    'Расписание · ПО-41\nЧетверг, 24 сентября\n\n01 · Компьютерные сети\n08:30 — 09:50\n\n02 · Web-разработка\n09:55 — 11:15\nПреподаватель: Селиверстов К.О.\nКабинет: 105\n\n03 · Базы данных\n11:25 — 12:45',
  );
});

test('formatTodayMessage handles an empty day', () => {
  assert.equal(
    formatTodayMessage('ИС-22', [], 'воскресенье, 27 сентября'),
    'Расписание · ИС-22\nВоскресенье, 27 сентября\n\nНа сегодня занятий нет.',
  );
});

test('formatCurrentMessage covers every schedule state', () => {
  assert.equal(
    formatCurrentMessage('ПО-41', { type: 'current', lesson: lessons[1] }),
    'Сейчас · ПО-41\n\nИдёт 2 пара\nWeb-разработка\n09:55 — 11:15\nПреподаватель: Селиверстов К.О.\nКабинет: 105',
  );
  assert.equal(
    formatCurrentMessage('ПО-41', { type: 'break', lesson: lessons[2] }),
    'Сейчас перемена · ПО-41\n\nСледующая пара: Базы данных\nНачало в 11:25',
  );
  assert.equal(
    formatCurrentMessage('ПО-41', { type: 'before', lesson: lessons[0] }),
    'Занятия ещё не начались · ПО-41\n\nПервая пара: Компьютерные сети\nНачало в 08:30',
  );
  assert.equal(
    formatCurrentMessage('ПО-41', { type: 'after' }),
    'На сегодня всё · ПО-41\n\nВсе занятия закончились.',
  );
  assert.equal(
    formatCurrentMessage('ПО-41', { type: 'empty' }),
    'Расписание · ПО-41\n\nНа сегодня занятий нет.',
  );
});
