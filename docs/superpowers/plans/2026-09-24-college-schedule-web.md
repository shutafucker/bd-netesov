# College Schedule Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready static college schedule viewer backed by public read-only Supabase data.

**Architecture:** A semantic single-page HTML document loads the official Supabase browser SDK, public configuration, and one framework-free application script. Pure time/state functions remain callable from Node tests, while DOM and Supabase initialization run only in a browser. PostgreSQL schema, RLS policies, indexes, and seed data live in one repeatable SQL script.

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript, Supabase JavaScript CDN, PostgreSQL, Node built-in test runner, Vercel Static Site

## Global Constraints

- No React, Vue, Next.js, frontend framework, build step, or custom backend.
- Use `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Use only the public Supabase anon key; never use `service_role`.
- Store weekdays as integers 1–6 for Monday–Saturday and use the user's local date and time.
- Support light mode, dark mode, `prefers-reduced-motion`, `100dvh`, and safe-area insets.
- Keep interactive controls at least 44 CSS pixels high and provide keyboard-visible focus.
- Render all remote values as text, never as interpreted HTML.
- Keep the database usable by a future Telegram bot without a web-specific schema.

---

### Task 1: Pure schedule-state logic

**Files:**
- Create: `app.js`
- Create: `tests/schedule.test.js`

**Interfaces:**
- Produces: `timeToMinutes(value: string): number`, `getTodayDayOfWeek(date?: Date): number`, `getCurrentLessonState(lessons: Lesson[], currentMinutes: number): ScheduleState`, and `formatTime(value: string): string`.
- `ScheduleState.type` is one of `empty`, `current`, `break`, `before`, or `after`.

- [ ] **Step 1: Write failing tests for time conversion and weekday mapping**

Use `node:test` and `node:assert/strict` to require `../app.js`. Assert `timeToMinutes('08:30:00') === 510`, `timeToMinutes('23:59') === 1439`, invalid inputs produce `NaN`, Monday maps to 1, Saturday to 6, and Sunday to 7.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/schedule.test.js`
Expected: FAIL because `app.js` or its exports do not exist.

- [ ] **Step 3: Implement the pure conversion functions and CommonJS exports**

Implement strict `HH:MM[:SS]` parsing with range checks, local `Date#getDay()` conversion where Sunday becomes 7, and `HH:MM` display formatting. Export functions only when `module.exports` exists.

- [ ] **Step 4: Add failing tests for every current-state boundary**

Use three ordered lessons and assert: empty input returns `empty`; 08:00 returns `before`; 08:30 and 09:50 return `current`; 09:52 returns `break` with lesson 2; 11:16 returns `after` for a two-lesson fixture.

- [ ] **Step 5: Implement and verify schedule-state logic**

Sort a copy of lessons by `lesson_number`, locate an inclusive active interval, otherwise compare against the first lesson, locate the first future lesson, and finally return `after`. Run `node --test tests/schedule.test.js`; expected: all tests pass.

### Task 2: Semantic shell and Apple-inspired responsive presentation

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `tests/static.test.js`

**Interfaces:**
- Produces DOM IDs `current-date`, `group-select`, `today-button`, `now-button`, `status-region`, and `results`; template IDs `lesson-template` and `skeleton-template`.
- Consumes `config.js`, Supabase CDN global `supabase`, and `app.js` in that order.

- [ ] **Step 1: Write a failing static contract test**

Read HTML and CSS with `node:fs`. Assert language `ru`, viewport metadata including `viewport-fit=cover`, all required IDs, Supabase CDN before local scripts, system font stack, `100dvh`, safe-area variables, dark color-scheme media query, reduced-motion media query, `:focus-visible`, and a minimum control height of 44px.

- [ ] **Step 2: Run the static test and verify RED**

Run: `node --test tests/static.test.js`
Expected: FAIL because `index.html` and `style.css` do not exist.

- [ ] **Step 3: Build the accessible HTML shell**

Add a decorative ambient background, header/date block, labelled native select, two text buttons, polite live status, results region, lesson and skeleton templates, and a no-JavaScript notice. Keep page actions inside a centered `main` landmark.

- [ ] **Step 4: Build the responsive design system**

Define semantic CSS custom properties for both appearances; glass only on the group panel; 16–24px radii; restrained shadows; responsive two-column lesson cards; mobile single-column results; safe-area padding; skeleton shimmer; state cards; hover/active/disabled/focus states; and reduced-motion overrides.

- [ ] **Step 5: Verify the static contract**

Run: `node --test tests/static.test.js`
Expected: all static checks pass.

### Task 3: Supabase integration and UI states

**Files:**
- Create: `config.js`
- Modify: `app.js`
- Modify: `tests/schedule.test.js`
- Modify: `tests/static.test.js`

**Interfaces:**
- Produces browser functions `loadGroups()`, `loadTodaySchedule()`, `loadCurrentLesson()`, `renderSchedule()`, `renderCurrentLesson()`, `showLoading()`, `showMessage()`, and `showError()`.
- Consumes Supabase query chain `.from(table).select(columns).eq(column, value).order(column)`.

- [ ] **Step 1: Add failing tests for configuration and browser guards**

Assert `config.js` contains `SUPABASE_URL`, `SUPABASE_ANON_KEY`, placeholder values, and comments locating Project URL and anon/public key. Requiring `app.js` in Node must not access `document`, `window`, or Supabase.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/*.test.js`
Expected: configuration assertions fail.

- [ ] **Step 3: Add public configuration**

Define the two requested constants with safe placeholders and comments explaining Supabase Dashboard → Project Settings/API. Do not add secrets or environment-specific credentials.

- [ ] **Step 4: Implement browser initialization and group loading**

On `DOMContentLoaded`, render the Russian local date, validate configuration, create the Supabase client, attach events, and call `loadGroups()`. Query groups ordered by name, populate options with DOM APIs, restore a still-valid saved group, and represent loading, empty, retryable error, and ready states.

- [ ] **Step 5: Implement schedule fetching and race protection**

Validate selection, focus the select when missing, skip Supabase schedule queries on Sunday, fetch the current day's rows by group and weekday ordered by lesson number, increment a request token per action, and ignore stale completions. Disable actions only during an active request.

- [ ] **Step 6: Implement safe renderers**

Create lesson cards and all five `Сейчас` views with `document.createElement`, cloned templates, and `textContent`. Include a retry button in connection errors and keep technical exceptions in `console.error`.

- [ ] **Step 7: Run the complete JavaScript suite**

Run: `node --test tests/*.test.js && node --check app.js && node --check config.js`
Expected: all tests pass and both syntax checks exit 0.

### Task 4: Database schema, RLS, and representative seed data

**Files:**
- Create: `database.sql`
- Create: `tests/database.test.js`

**Interfaces:**
- Produces `public.groups(id bigint, name text)` and `public.schedule(id bigint, group_id bigint, day_of_week smallint, lesson_number smallint, subject_name text, time_start time, time_end time)`.
- Grants public read access through RLS policies to `anon` and `authenticated`; produces no public write policy.

- [ ] **Step 1: Write the failing SQL contract test**

Read `database.sql` and assert both table definitions, primary keys, foreign key with cascade behavior, weekday/lesson/time constraints, indexes, enabled RLS on both tables, two public SELECT policies, no permissive write policy, both required group names, and schedule rows covering multiple weekdays.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/database.test.js`
Expected: FAIL because `database.sql` does not exist.

- [ ] **Step 3: Implement the repeatable SQL script**

Create tables with `if not exists`, constraints, relationship and indexes; enable RLS; drop/recreate named read policies; upsert groups by unique name; and insert/update a stable set of lessons for both groups using a composite uniqueness constraint.

- [ ] **Step 4: Verify the SQL contract**

Run: `node --test tests/database.test.js`
Expected: all SQL assertions pass.

### Task 5: Documentation and release verification

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Modify: `tests/static.test.js`

**Interfaces:**
- Documents the exact installation flow from a new Supabase project to local serving and Vercel deployment.

- [ ] **Step 1: Add failing documentation assertions**

Assert README sections cover Supabase project creation, SQL Editor, `database.sql`, Project URL, anon/public key, `config.js`, local HTTP server commands, Vercel static deployment, security warning, and troubleshooting.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/static.test.js`
Expected: README assertions fail.

- [ ] **Step 3: Write README and ignore rules**

Document numbered setup instructions, `python3 -m http.server 8000`, an alternative `npx serve`, Vercel import with no framework preset/build command, how to edit data in Supabase, future Telegram-bot compatibility, and common configuration/RLS errors. Ignore OS/editor artifacts and local Supabase overrides without ignoring `config.js`.

- [ ] **Step 4: Run fresh full verification**

Run: `node --test tests/*.test.js && node --check app.js && node --check config.js && git diff --check`
Expected: all tests pass, syntax is valid, and no whitespace errors are reported.

- [ ] **Step 5: Serve and inspect the site**

Run: `python3 -m http.server 8000`
Open `http://127.0.0.1:8000/`; verify the configured-error state is readable at 390px and desktop widths, controls retain visible keyboard focus, dark mode remains legible, and reduced motion removes shimmer and transitions.

- [ ] **Step 6: Review the original requirements line by line**

Confirm every requested file, state, function, database field, mobile constraint, theme, deployment instruction, and Supabase security requirement has an implementation or an explicit verification result.
