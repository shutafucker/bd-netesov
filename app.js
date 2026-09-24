'use strict';

function timeToMinutes(value) {
  if (typeof value !== 'string') return Number.NaN;

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return Number.NaN;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);

  if (hours > 23 || minutes > 59 || seconds > 59) return Number.NaN;
  return hours * 60 + minutes;
}

function formatTime(value) {
  const minutes = timeToMinutes(value);
  if (!Number.isFinite(minutes)) return '—';

  const hoursPart = String(Math.floor(minutes / 60)).padStart(2, '0');
  const minutesPart = String(minutes % 60).padStart(2, '0');
  return `${hoursPart}:${minutesPart}`;
}

function getTodayDayOfWeek(date = new Date()) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getCurrentLessonState(lessons, currentMinutes) {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return { type: 'empty' };
  }

  const orderedLessons = [...lessons].sort(
    (first, second) => first.lesson_number - second.lesson_number,
  );

  const currentLesson = orderedLessons.find((lesson) => {
    const start = timeToMinutes(lesson.time_start);
    const end = timeToMinutes(lesson.time_end);
    return currentMinutes >= start && currentMinutes <= end;
  });

  if (currentLesson) {
    return { type: 'current', lesson: currentLesson };
  }

  const firstLesson = orderedLessons[0];
  if (currentMinutes < timeToMinutes(firstLesson.time_start)) {
    return { type: 'before', lesson: firstLesson };
  }

  const nextLesson = orderedLessons.find(
    (lesson) => currentMinutes < timeToMinutes(lesson.time_start),
  );

  if (nextLesson) {
    return { type: 'break', lesson: nextLesson };
  }

  return { type: 'after' };
}

const applicationState = {
  client: null,
  requestId: 0,
  isReady: false,
  isBusy: false,
  lastAction: null,
};

let elements = {};

function cacheElements() {
  elements = {
    connectionDot: document.querySelector('#connection-dot'),
    currentDate: document.querySelector('#current-date'),
    groupSelect: document.querySelector('#group-select'),
    lessonCount: document.querySelector('#lesson-count'),
    lessonTemplate: document.querySelector('#lesson-template'),
    nowButton: document.querySelector('#now-button'),
    results: document.querySelector('#results'),
    resultsKicker: document.querySelector('#results-kicker'),
    resultsTitle: document.querySelector('#results-title'),
    skeletonTemplate: document.querySelector('#skeleton-template'),
    statusRegion: document.querySelector('#status-region'),
    todayButton: document.querySelector('#today-button'),
  };
}

function renderCurrentDate(date = new Date()) {
  elements.currentDate.textContent = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function isConfigurationReady() {
  return (
    typeof SUPABASE_URL === 'string' &&
    typeof SUPABASE_ANON_KEY === 'string' &&
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
    /^https:\/\/.+\.supabase\.co\/?$/i.test(SUPABASE_URL)
  );
}

function setControlsState() {
  const hasGroups = applicationState.isReady;
  elements.groupSelect.disabled = !hasGroups || applicationState.isBusy;
  elements.todayButton.disabled = !hasGroups || applicationState.isBusy;
  elements.nowButton.disabled = !hasGroups || applicationState.isBusy;
}

function setBusy(isBusy) {
  applicationState.isBusy = isBusy;
  setControlsState();
}

function setResultHeading(kicker, title) {
  elements.resultsKicker.textContent = kicker;
  elements.resultsTitle.textContent = title;
}

function clearResults() {
  elements.results.replaceChildren();
  elements.statusRegion.textContent = '';
  elements.lessonCount.hidden = true;
  elements.lessonCount.textContent = '';
}

function createStateCard({ label, title, subject, detail, kind = 'info', live = false }) {
  const card = document.createElement('article');
  card.className = `state-card state-card--${kind}`;

  const labelElement = document.createElement('p');
  labelElement.className = 'state-label';
  if (live) {
    const dot = document.createElement('span');
    dot.className = 'live-dot';
    dot.setAttribute('aria-hidden', 'true');
    labelElement.append(dot);
  }
  labelElement.append(document.createTextNode(label));

  const titleElement = document.createElement('h3');
  titleElement.className = 'state-title';
  titleElement.textContent = title;

  card.append(labelElement, titleElement);

  if (subject) {
    const subjectElement = document.createElement('p');
    subjectElement.className = 'state-subject';
    subjectElement.textContent = subject;
    card.append(subjectElement);
  }

  if (detail) {
    const detailElement = document.createElement('p');
    detailElement.className = 'state-detail';
    detailElement.textContent = detail;
    card.append(detailElement);
  }

  return card;
}

function showLoading(label = 'Загружаем расписание…') {
  clearResults();
  elements.statusRegion.textContent = label;
  for (let index = 0; index < 3; index += 1) {
    elements.results.append(elements.skeletonTemplate.content.cloneNode(true));
  }
}

function showMessage(title, detail = '', label = 'Расписание') {
  clearResults();
  elements.results.append(createStateCard({ label, title, detail }));
  elements.statusRegion.textContent = `${title}${detail ? `. ${detail}` : ''}`;
}

function showError(title, detail, retryAction) {
  clearResults();
  const card = createStateCard({
    label: 'Не удалось загрузить',
    title,
    detail,
    kind: 'error',
  });

  if (typeof retryAction === 'function') {
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.type = 'button';
    retryButton.textContent = 'Повторить';
    retryButton.addEventListener('click', retryAction, { once: true });
    card.append(retryButton);
  }

  elements.results.append(card);
  elements.statusRegion.textContent = `${title}. ${detail}`;
}

function requireSelectedGroup() {
  const groupId = elements.groupSelect.value;
  if (groupId) return groupId;

  setResultHeading('Нужна группа', 'Выберите группу');
  showMessage(
    'Сначала выберите группу',
    'После этого можно открыть расписание на сегодня или узнать, какая пара идёт сейчас.',
    'Подсказка',
  );
  elements.groupSelect.focus();
  return null;
}

function beginRequest(action) {
  applicationState.lastAction = action;
  applicationState.requestId += 1;
  setBusy(true);
  showLoading();
  return applicationState.requestId;
}

function finishRequest(requestId) {
  if (requestId !== applicationState.requestId) return;
  setBusy(false);
}

async function loadGroups() {
  const requestId = beginRequest(loadGroups);
  setResultHeading('Подключение', 'Загружаем группы');

  try {
    const { data, error } = await applicationState.client
      .from('groups')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    if (requestId !== applicationState.requestId) return;

    const groups = Array.isArray(data) ? data : [];
    elements.groupSelect.replaceChildren();

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Выберите группу';
    elements.groupSelect.append(placeholder);

    for (const group of groups) {
      const option = document.createElement('option');
      option.value = String(group.id);
      option.textContent = group.name;
      elements.groupSelect.append(option);
    }

    if (groups.length === 0) {
      applicationState.isReady = false;
      elements.connectionDot.classList.remove('is-online');
      setResultHeading('Нет данных', 'Группы не добавлены');
      showMessage(
        'Список групп пока пуст',
        'Добавьте группы в таблицу groups через Supabase Dashboard.',
        'Настройка',
      );
      return;
    }

    applicationState.isReady = true;
    elements.connectionDot.classList.add('is-online');

    const savedGroupId = localStorage.getItem('scheduleGroupId');
    const savedGroupExists = groups.some((group) => String(group.id) === savedGroupId);
    if (savedGroupExists) elements.groupSelect.value = savedGroupId;

    setResultHeading('Обзор дня', 'Расписание на сегодня');
    showMessage(
      savedGroupExists ? 'Группа выбрана' : 'Выберите свою группу',
      savedGroupExists
        ? 'Откройте расписание на сегодня или проверьте текущую пару.'
        : 'Мы запомним выбор на этом устройстве.',
      'Готово',
    );
  } catch (error) {
    console.error('Не удалось загрузить группы:', error);
    if (requestId !== applicationState.requestId) return;
    applicationState.isReady = false;
    elements.connectionDot.classList.remove('is-online');
    setResultHeading('Ошибка соединения', 'Расписание недоступно');
    showError(
      'Не удалось подключиться',
      'Проверьте интернет, параметры Supabase и политики публичного чтения.',
      loadGroups,
    );
  } finally {
    finishRequest(requestId);
  }
}

async function fetchTodaySchedule(groupId, requestId) {
  const dayOfWeek = getTodayDayOfWeek();
  if (dayOfWeek === 7) return [];

  const { data, error } = await applicationState.client
    .from('schedule')
    .select('id, lesson_number, subject_name, time_start, time_end')
    .eq('group_id', groupId)
    .eq('day_of_week', dayOfWeek)
    .order('lesson_number', { ascending: true });

  if (error) throw error;
  if (requestId !== applicationState.requestId) return null;
  return Array.isArray(data) ? data : [];
}

function renderSchedule(lessons) {
  clearResults();

  if (lessons.length === 0) {
    showMessage('На сегодня занятий нет', 'Можно отдохнуть или подготовиться к следующему учебному дню.', 'Свободный день');
    return;
  }

  elements.lessonCount.hidden = false;
  elements.lessonCount.textContent = `${lessons.length} ${getLessonWord(lessons.length)}`;
  const fragment = document.createDocumentFragment();

  lessons.forEach((lesson, index) => {
    const card = elements.lessonTemplate.content.cloneNode(true);
    card.querySelector('.lesson-card').style.animationDelay = `${index * 45}ms`;
    card.querySelector('.lesson-number').textContent = String(lesson.lesson_number).padStart(2, '0');
    card.querySelector('.lesson-subject').textContent = lesson.subject_name;
    card.querySelector('.lesson-time').textContent = `${formatTime(lesson.time_start)} — ${formatTime(lesson.time_end)}`;
    fragment.append(card);
  });

  elements.results.append(fragment);
  elements.statusRegion.textContent = `Загружено занятий: ${lessons.length}`;
}

function getLessonWord(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'занятий';
  if (last === 1) return 'занятие';
  if (last >= 2 && last <= 4) return 'занятия';
  return 'занятий';
}

function renderCurrentLesson(state) {
  clearResults();
  let card;

  if (state.type === 'current') {
    const lesson = state.lesson;
    card = createStateCard({
      label: 'Идёт сейчас',
      title: `${lesson.lesson_number} пара`,
      subject: lesson.subject_name,
      detail: `${formatTime(lesson.time_start)} — ${formatTime(lesson.time_end)}`,
      kind: 'current',
      live: true,
    });
  } else if (state.type === 'break') {
    card = createStateCard({
      label: 'Сейчас перемена',
      title: 'Следующая пара',
      subject: state.lesson.subject_name,
      detail: `Начало в ${formatTime(state.lesson.time_start)}`,
    });
  } else if (state.type === 'before') {
    card = createStateCard({
      label: 'Сегодня',
      title: 'Занятия ещё не начались',
      subject: state.lesson.subject_name,
      detail: `Первая пара начинается в ${formatTime(state.lesson.time_start)}`,
    });
  } else if (state.type === 'after') {
    card = createStateCard({
      label: 'Учебный день завершён',
      title: 'На сегодня всё',
      detail: 'Все занятия закончились.',
    });
  } else {
    card = createStateCard({
      label: 'Свободный день',
      title: 'На сегодня занятий нет',
      detail: 'В расписании выбранной группы нет пар.',
    });
  }

  elements.results.append(card);
  elements.statusRegion.textContent = card.textContent.trim();
}

async function loadTodaySchedule() {
  const groupId = requireSelectedGroup();
  if (!groupId) return;

  const requestId = beginRequest(loadTodaySchedule);
  setResultHeading('Сегодня', 'Расписание на сегодня');

  try {
    const lessons = await fetchTodaySchedule(groupId, requestId);
    if (lessons === null) return;
    renderSchedule(lessons);
  } catch (error) {
    console.error('Не удалось загрузить расписание:', error);
    if (requestId !== applicationState.requestId) return;
    showError('Расписание не загрузилось', 'Проверьте соединение и попробуйте ещё раз.', loadTodaySchedule);
  } finally {
    finishRequest(requestId);
  }
}

async function loadCurrentLesson() {
  const groupId = requireSelectedGroup();
  if (!groupId) return;

  const requestId = beginRequest(loadCurrentLesson);
  setResultHeading('Текущий момент', 'Что сейчас');

  try {
    const lessons = await fetchTodaySchedule(groupId, requestId);
    if (lessons === null) return;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    renderCurrentLesson(getCurrentLessonState(lessons, currentMinutes));
  } catch (error) {
    console.error('Не удалось определить текущую пару:', error);
    if (requestId !== applicationState.requestId) return;
    showError('Не удалось проверить текущую пару', 'Проверьте соединение и повторите попытку.', loadCurrentLesson);
  } finally {
    finishRequest(requestId);
  }
}

function handleGroupChange() {
  if (elements.groupSelect.value) {
    localStorage.setItem('scheduleGroupId', elements.groupSelect.value);
  } else {
    localStorage.removeItem('scheduleGroupId');
  }
}

function initializeApplication() {
  cacheElements();
  renderCurrentDate();
  elements.todayButton.addEventListener('click', loadTodaySchedule);
  elements.nowButton.addEventListener('click', loadCurrentLesson);
  elements.groupSelect.addEventListener('change', handleGroupChange);

  if (!isConfigurationReady()) {
    setResultHeading('Требуется настройка', 'Подключите Supabase');
    showError(
      'Добавьте данные проекта',
      'Откройте config.js и вставьте Project URL и anon/public key из Supabase.',
    );
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    setResultHeading('Ошибка подключения', 'SDK не загрузился');
    showError('Не удалось запустить приложение', 'Проверьте подключение к интернету и обновите страницу.');
    return;
  }

  applicationState.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  loadGroups();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initializeApplication);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatTime,
    getCurrentLessonState,
    getTodayDayOfWeek,
    timeToMinutes,
  };
}
