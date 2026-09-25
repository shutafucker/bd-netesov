import type { Lesson, ScheduleState } from './types.ts';

const TIME_ZONE = 'Asia/Almaty';
const WEEKDAYS: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

export function timeToMinutes(value: string): number {
  if (typeof value !== 'string') return Number.NaN;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return Number.NaN;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return Number.NaN;
  return hours * 60 + minutes;
}

function formatTime(value: string): string {
  const minutes = timeToMinutes(value);
  if (!Number.isFinite(minutes)) return '—';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function formatLessonDetails(lesson: Lesson): string {
  const rows: string[] = [];
  if (lesson.teacher_name?.trim()) rows.push(`Преподаватель: ${lesson.teacher_name.trim()}`);
  if (lesson.room?.trim()) rows.push(`Кабинет: ${lesson.room.trim()}`);
  return rows.length === 0 ? '' : `\n${rows.join('\n')}`;
}

export function getAlmatyClock(date = new Date()): {
  dayOfWeek: number;
  minutes: number;
  dateLabel: string;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  const dateLabel = new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  return {
    dayOfWeek: WEEKDAYS[values.weekday],
    minutes: Number(values.hour) * 60 + Number(values.minute),
    dateLabel,
  };
}

export function getCurrentScheduleState(lessons: Lesson[], minutes: number): ScheduleState {
  if (lessons.length === 0) return { type: 'empty' };

  const ordered = [...lessons].sort((first, second) => first.lesson_number - second.lesson_number);
  const current = ordered.find((lesson) => {
    const start = timeToMinutes(lesson.time_start);
    const end = timeToMinutes(lesson.time_end);
    return minutes >= start && minutes <= end;
  });
  if (current) return { type: 'current', lesson: current };

  if (minutes < timeToMinutes(ordered[0].time_start)) {
    return { type: 'before', lesson: ordered[0] };
  }

  const next = ordered.find((lesson) => minutes < timeToMinutes(lesson.time_start));
  if (next) return { type: 'break', lesson: next };
  return { type: 'after' };
}

function capitalize(value: string): string {
  return value ? value[0].toLocaleUpperCase('ru-RU') + value.slice(1) : value;
}

export function formatTodayMessage(groupName: string, lessons: Lesson[], dateLabel: string): string {
  const heading = `Расписание · ${groupName}\n${capitalize(dateLabel)}`;
  if (lessons.length === 0) return `${heading}\n\nНа сегодня занятий нет.`;

  const rows = [...lessons]
    .sort((first, second) => first.lesson_number - second.lesson_number)
    .map(
      (lesson) =>
        `${String(lesson.lesson_number).padStart(2, '0')} · ${lesson.subject_name}\n${formatTime(lesson.time_start)} — ${formatTime(lesson.time_end)}${formatLessonDetails(lesson)}`,
    );
  return `${heading}\n\n${rows.join('\n\n')}`;
}

export function formatCurrentMessage(groupName: string, state: ScheduleState): string {
  if (state.type === 'current') {
    const lesson = state.lesson;
    return `Сейчас · ${groupName}\n\nИдёт ${lesson.lesson_number} пара\n${lesson.subject_name}\n${formatTime(lesson.time_start)} — ${formatTime(lesson.time_end)}${formatLessonDetails(lesson)}`;
  }
  if (state.type === 'break') {
    return `Сейчас перемена · ${groupName}\n\nСледующая пара: ${state.lesson.subject_name}\nНачало в ${formatTime(state.lesson.time_start)}${formatLessonDetails(state.lesson)}`;
  }
  if (state.type === 'before') {
    return `Занятия ещё не начались · ${groupName}\n\nПервая пара: ${state.lesson.subject_name}\nНачало в ${formatTime(state.lesson.time_start)}${formatLessonDetails(state.lesson)}`;
  }
  if (state.type === 'after') {
    return `На сегодня всё · ${groupName}\n\nВсе занятия закончились.`;
  }
  return `Расписание · ${groupName}\n\nНа сегодня занятий нет.`;
}
