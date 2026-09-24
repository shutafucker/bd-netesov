const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatTime,
  getCurrentLessonState,
  getTodayDayOfWeek,
  timeToMinutes,
} = require('../app.js');

const lessons = [
  {
    lesson_number: 1,
    subject_name: 'Компьютерные сети',
    time_start: '08:30:00',
    time_end: '09:50:00',
  },
  {
    lesson_number: 2,
    subject_name: 'Web-разработка',
    time_start: '09:55:00',
    time_end: '11:15:00',
  },
  {
    lesson_number: 3,
    subject_name: 'Базы данных',
    time_start: '11:25:00',
    time_end: '12:45:00',
  },
];

test('timeToMinutes converts Supabase time values', () => {
  assert.equal(timeToMinutes('08:30:00'), 510);
  assert.equal(timeToMinutes('23:59'), 1439);
  assert.equal(timeToMinutes('00:00:59'), 0);
});

test('timeToMinutes rejects invalid time values', () => {
  assert.equal(Number.isNaN(timeToMinutes('24:00:00')), true);
  assert.equal(Number.isNaN(timeToMinutes('09:60')), true);
  assert.equal(Number.isNaN(timeToMinutes('not-a-time')), true);
  assert.equal(Number.isNaN(timeToMinutes(null)), true);
});

test('formatTime returns hours and minutes only', () => {
  assert.equal(formatTime('08:30:00'), '08:30');
  assert.equal(formatTime('9:05'), '09:05');
  assert.equal(formatTime('invalid'), '—');
});

test('getTodayDayOfWeek maps Monday through Sunday to 1 through 7', () => {
  assert.equal(getTodayDayOfWeek(new Date(2026, 8, 21)), 1);
  assert.equal(getTodayDayOfWeek(new Date(2026, 8, 26)), 6);
  assert.equal(getTodayDayOfWeek(new Date(2026, 8, 27)), 7);
});

test('getCurrentLessonState reports an empty day', () => {
  assert.deepEqual(getCurrentLessonState([], 600), { type: 'empty' });
});

test('getCurrentLessonState reports time before the first lesson', () => {
  const state = getCurrentLessonState(lessons, 480);
  assert.equal(state.type, 'before');
  assert.equal(state.lesson.lesson_number, 1);
});

test('getCurrentLessonState treats both lesson boundaries as current', () => {
  assert.equal(getCurrentLessonState(lessons, 510).type, 'current');
  assert.equal(getCurrentLessonState(lessons, 590).type, 'current');
});

test('getCurrentLessonState reports a break and the next lesson', () => {
  const state = getCurrentLessonState(lessons, 592);
  assert.equal(state.type, 'break');
  assert.equal(state.lesson.lesson_number, 2);
});

test('getCurrentLessonState reports time after the last lesson', () => {
  const state = getCurrentLessonState(lessons.slice(0, 2), 676);
  assert.deepEqual(state, { type: 'after' });
});

test('getCurrentLessonState sorts a copy without mutating its input', () => {
  const reversed = [...lessons].reverse();
  const state = getCurrentLessonState(reversed, 500);
  assert.equal(state.type, 'before');
  assert.equal(state.lesson.lesson_number, 1);
  assert.equal(reversed[0].lesson_number, 3);
});
