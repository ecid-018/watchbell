/* ------------------------------------------------------------------
   The admin cadence engine.

   A task's only stored state is the date it was last done, and — while
   it is being put off — the date it is deferred until. Everything else
   (is it due today, is it overdue, has it been carried) is worked out
   fresh from those two dates plus the calendar, the same way the rest
   of the app treats a job or a habit: nothing to migrate, nothing that
   can go stale, back-dating a completion just recomputes the truth.

   "Due" and "done" are independent: a done task still reports due, so
   it keeps its row and its tick rather than vanishing from the list.
------------------------------------------------------------------ */

import { addDays, daysBetween, dateKey, parseKey } from "./voyage.js";
import { eventOn } from "./events.js";

const WEEKDAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MONTHLY_DAYS = 30;
const QUARTERLY_DAYS = 90;
const COMING_UP_WINDOW = 3;

const lastDone = (task, completions) => completions[task.key] || null;

const daysSince = (dateStr, today) => (dateStr ? daysBetween(parseKey(dateStr), today) : Infinity);

/** The most recent date on or before `today` that falls on the task's weekday. */
const weeklyCycleStart = (task, today) => {
  const target = WEEKDAY[task.day] ?? WEEKDAY.mon;
  const diff = (today.getDay() - target + 7) % 7;
  return addDays(today, -diff);
};

/** Due today on cadence alone — before deferral is applied. */
function cadenceStatus(task, today, todayKey, completions, events) {
  const last = lastDone(task, completions);
  if (last === todayKey) return { due: true, overdue: false, comingUp: false, sinceDays: 0 };

  switch (task.cadence) {
    case "daily":
      return { due: true, overdue: false, comingUp: false, sinceDays: null };

    case "3day": {
      const since = daysSince(last, today);
      return { due: since >= 3, overdue: since > 3, comingUp: false, sinceDays: since };
    }

    case "weekly": {
      const cycleStart = dateKey(weeklyCycleStart(task, today));
      const due = !last || last < cycleStart;
      return { due, overdue: due && todayKey > cycleStart, comingUp: false, sinceDays: null };
    }

    case "monthly":
    case "quarterly": {
      const interval = task.cadence === "monthly" ? MONTHLY_DAYS : QUARTERLY_DAYS;
      const since = daysSince(last, today);
      const due = since >= interval;
      return { due, overdue: since > interval, comingUp: !due && since >= interval - COMING_UP_WINDOW, sinceDays: since };
    }

    case "trigger": {
      const ev = eventOn(events, todayKey);
      return { due: !!ev && ev.type === task.trigger, overdue: false, comingUp: false, sinceDays: null };
    }

    default:
      return { due: false, overdue: false, comingUp: false, sinceDays: null };
  }
}

const isDeferredToday = (task, todayKey, deferrals) => {
  const until = deferrals[task.key];
  return !!until && todayKey < until;
};

/**
 * Full status for one task today: whether it shows, whether it is done,
 * whether it can still be put off. A deferral is "used up" for the current
 * occurrence until the task is completed again — completing a task should
 * clear its deferral, which is what makes `hasBeenDeferred` mean "already
 * deferred this time" rather than "deferred once, ever".
 */
export function taskStatus(task, ctx) {
  const { today, todayKey, completions, deferrals, events } = ctx;
  const doneToday = completions[task.key] === todayKey;
  const cadence = cadenceStatus(task, today, todayKey, completions, events);
  const deferredToday = !doneToday && isDeferredToday(task, todayKey, deferrals);
  const hasBeenDeferred = !!deferrals[task.key];
  const due = cadence.due && !deferredToday;
  const carried = due && !doneToday && (cadence.overdue || hasBeenDeferred);

  return {
    ...task,
    doneToday,
    due,
    deferredToday,
    comingUp: !due && !doneToday && cadence.comingUp,
    overdue: cadence.overdue,
    carried,
    canDefer: due && !doneToday && (!task.critical || !hasBeenDeferred),
    counter: due && cadence.overdue && cadence.sinceDays != null ? `day ${cadence.sinceDays + 1}` : null,
  };
}

const inSlot = (tasks, slot) => tasks.filter((t) => t.slot === slot && t.cadence !== "trigger");

export const dueTasksForSlot = (tasks, slot, ctx) =>
  inSlot(tasks, slot).map((t) => taskStatus(t, ctx)).filter((t) => t.due);

export const comingUpForSlot = (tasks, slot, ctx) =>
  inSlot(tasks, slot).map((t) => taskStatus(t, ctx)).filter((t) => t.comingUp);

export const dueTriggers = (tasks, ctx) =>
  tasks.filter((t) => t.cadence === "trigger").map((t) => taskStatus(t, ctx)).filter((t) => t.due);

/** Everything a slot's header needs: what's due, what's coming, the load. */
export function slotSummary(tasks, slot, ctx, windowMinutes) {
  const due = dueTasksForSlot(tasks, slot, ctx);
  const comingUp = comingUpForSlot(tasks, slot, ctx);
  const minutes = due.reduce((sum, t) => sum + (t.est || 0), 0);
  return {
    due,
    comingUp,
    minutes,
    total: due.length,
    doneCount: due.filter((t) => t.doneToday).length,
    allDone: due.length === 0 || due.every((t) => t.doneToday),
    overWindow: minutes > windowMinutes,
  };
}

/** Today's admin figure for the Standing tab — a count, not a percentage,
    for the same reason jobs are counted rather than averaged in: due and
    done are different units on different tasks, and only a count survives
    that honestly. */
export function adminToday(tasks, ctx) {
  const due = tasks.map((t) => taskStatus(t, ctx)).filter((t) => t.due);
  return {
    done: due.filter((t) => t.doneToday).length,
    total: due.length,
    carried: due.filter((t) => t.critical && t.carried).length,
  };
}

/**
 * Which critical tasks carried at some point in [from, to]. Read off each
 * day's own stored record rather than recomputed from today's completions,
 * so a task finished since still shows as having carried on the day it
 * actually did — the same reason the daily log is never rewritten.
 */
export function criticalCarriedInWeek(tasks, from, to, readLog) {
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const firstSeen = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dk = dateKey(d);
    for (const key of readLog(dk).adminCarriedCritical || []) {
      if (!firstSeen.has(key)) firstSeen.set(key, dk);
    }
  }
  return [...firstSeen.entries()]
    .map(([key, date]) => ({ key, date, title: byKey.get(key)?.title || key }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
