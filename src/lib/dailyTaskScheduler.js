const MINUTE_MS = 60 * 1000;
const MAX_SEARCH_MINUTES = 48 * 60;
const formattersByTimeZone = new Map();

export class DailyTaskScheduler {
  constructor({
    enabled = true,
    hour = 22,
    minute = 0,
    timeZone = "Europe/Warsaw",
    catchUpDelayMs = 5000,
    task,
    onEvent = () => undefined,
    now = () => new Date(),
    setTimer = setTimeout,
    clearTimer = clearTimeout
  }) {
    if (typeof task !== "function") {
      throw new TypeError("DailyTaskScheduler wymaga funkcji task");
    }

    validateSchedule({ hour, minute, timeZone });
    this.enabled = Boolean(enabled);
    this.hour = hour;
    this.minute = minute;
    this.timeZone = timeZone;
    this.catchUpDelayMs = Math.max(0, Number(catchUpDelayMs) || 0);
    this.task = task;
    this.onEvent = onEvent;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.started = false;
    this.timer = null;
    this.nextRunAt = null;
    this.nextTrigger = null;
  }

  async start({ lastAttemptAt = null } = {}) {
    if (this.started) return this.getStatus();
    this.started = true;

    if (!this.enabled) {
      this.emit("disabled", {});
      return this.getStatus();
    }

    this.scheduleNext({
      allowCatchUp: true,
      lastAttemptAt
    });
    return this.getStatus();
  }

  stop() {
    this.started = false;
    if (this.timer) this.clearTimer(this.timer);
    this.timer = null;
    this.nextRunAt = null;
    this.nextTrigger = null;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      hour: this.hour,
      minute: this.minute,
      timeZone: this.timeZone,
      nextRunAt: this.nextRunAt
    };
  }

  scheduleNext({ allowCatchUp = false, lastAttemptAt = null } = {}) {
    if (!this.started || !this.enabled) return;

    const current = asDate(this.now());
    const catchUp = allowCatchUp && shouldRunDailyCatchUp({
      now: current,
      lastAttemptAt,
      hour: this.hour,
      minute: this.minute,
      timeZone: this.timeZone
    });
    const runAt = catchUp
      ? new Date(current.getTime() + this.catchUpDelayMs)
      : nextDailyOccurrence({
          now: current,
          hour: this.hour,
          minute: this.minute,
          timeZone: this.timeZone
        });
    const trigger = catchUp ? "catch-up" : "scheduled";

    this.nextRunAt = runAt.toISOString();
    this.nextTrigger = trigger;
    const delayMs = Math.max(0, runAt.getTime() - current.getTime());
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.nextRunAt = null;
      this.nextTrigger = null;
      void this.runTask({ trigger, scheduledFor: runAt.toISOString() });
    }, delayMs);
    this.timer?.unref?.();

    this.emit("scheduled", {
      trigger,
      nextRunAt: runAt.toISOString()
    });
  }

  async runTask({ trigger, scheduledFor }) {
    this.emit("started", { trigger, scheduledFor });
    try {
      const result = await this.task({ trigger, scheduledFor });
      this.emit("completed", { trigger, scheduledFor, result });
    } catch (error) {
      this.emit("failed", {
        trigger,
        scheduledFor,
        error: error?.message || String(error)
      });
    } finally {
      this.scheduleNext();
    }
  }

  emit(event, details) {
    try {
      this.onEvent(event, details);
    } catch {
      // Obserwowalnosc nie moze zatrzymac zadania ani kolejnego harmonogramu.
    }
  }
}

export function nextDailyOccurrence({ now, hour, minute, timeZone }) {
  validateSchedule({ hour, minute, timeZone });
  const current = asDate(now);
  let candidateMs = Math.ceil((current.getTime() + 1) / MINUTE_MS) * MINUTE_MS;

  for (let offset = 0; offset <= MAX_SEARCH_MINUTES; offset += 1) {
    const candidate = new Date(candidateMs + offset * MINUTE_MS);
    const parts = zonedDateParts(candidate, timeZone);
    if (parts.hour === hour && parts.minute === minute) return candidate;
  }

  throw new Error(`Nie znaleziono nastepnego terminu ${scheduleLabel(hour, minute, timeZone)}`);
}

export function shouldRunDailyCatchUp({ now, lastAttemptAt, hour, minute, timeZone }) {
  validateSchedule({ hour, minute, timeZone });
  const current = asDate(now);
  const currentParts = zonedDateParts(current, timeZone);
  const targetAlreadyPassed = currentParts.hour > hour ||
    (currentParts.hour === hour && currentParts.minute >= minute);
  if (!targetAlreadyPassed) return false;

  if (!lastAttemptAt) return true;
  const lastAttempt = new Date(lastAttemptAt);
  if (!Number.isFinite(lastAttempt.getTime())) return true;
  return dateKey(zonedDateParts(lastAttempt, timeZone)) !== dateKey(currentParts);
}

function validateSchedule({ hour, minute, timeZone }) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("Godzina harmonogramu musi byc liczba od 0 do 23");
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError("Minuta harmonogramu musi byc liczba od 0 do 59");
  }
  zonedDateParts(new Date(), timeZone);
}

function zonedDateParts(date, timeZone) {
  let formatter = formattersByTimeZone.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    formattersByTimeZone.set(timeZone, formatter);
  }
  const values = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function asDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError("Nieprawidlowa data harmonogramu");
  return date;
}

function dateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function scheduleLabel(hour, minute, timeZone) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${timeZone}`;
}
