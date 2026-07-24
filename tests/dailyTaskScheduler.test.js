import assert from "node:assert/strict";
import test from "node:test";
import {
  DailyTaskScheduler,
  nextDailyOccurrence,
  shouldRunDailyCatchUp
} from "../src/lib/dailyTaskScheduler.js";

test("next daily occurrence follows Europe/Warsaw daylight saving time", () => {
  assert.equal(
    nextDailyOccurrence({
      now: new Date("2026-03-28T21:30:00.000Z"),
      hour: 22,
      minute: 0,
      timeZone: "Europe/Warsaw"
    }).toISOString(),
    "2026-03-29T20:00:00.000Z"
  );
  assert.equal(
    nextDailyOccurrence({
      now: new Date("2026-10-24T20:30:00.000Z"),
      hour: 22,
      minute: 0,
      timeZone: "Europe/Warsaw"
    }).toISOString(),
    "2026-10-25T21:00:00.000Z"
  );
});

test("catch-up runs only after the target time and once per Polish calendar day", () => {
  const input = {
    now: new Date("2026-07-24T20:30:00.000Z"),
    hour: 22,
    minute: 0,
    timeZone: "Europe/Warsaw"
  };

  assert.equal(shouldRunDailyCatchUp({ ...input, lastAttemptAt: null }), true);
  assert.equal(
    shouldRunDailyCatchUp({ ...input, lastAttemptAt: "2026-07-24T20:05:00.000Z" }),
    false
  );
  assert.equal(
    shouldRunDailyCatchUp({ ...input, lastAttemptAt: "2026-07-23T20:05:00.000Z" }),
    true
  );
  assert.equal(
    shouldRunDailyCatchUp({
      ...input,
      now: new Date("2026-07-24T19:30:00.000Z"),
      lastAttemptAt: null
    }),
    false
  );
});

test("scheduler executes the task, records events and arms the next day", async () => {
  let current = new Date("2026-07-24T19:59:00.000Z");
  const timers = [];
  const events = [];
  const calls = [];
  const scheduler = new DailyTaskScheduler({
    hour: 22,
    minute: 0,
    timeZone: "Europe/Warsaw",
    now: () => current,
    setTimer: (callback, delayMs) => {
      const timer = { callback, delayMs, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearTimer: () => undefined,
    task: async (context) => {
      calls.push(context);
      current = new Date("2026-07-24T20:01:00.000Z");
      return { addedCount: 3, activeProductCount: 100 };
    },
    onEvent: (event, details) => events.push({ event, details })
  });

  await scheduler.start({ lastAttemptAt: "2026-07-23T20:00:00.000Z" });
  assert.equal(scheduler.getStatus().nextRunAt, "2026-07-24T20:00:00.000Z");
  assert.equal(timers[0].delayMs, 60_000);

  timers[0].callback();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].trigger, "scheduled");
  assert.deepEqual(
    events.map((entry) => entry.event),
    ["scheduled", "started", "completed", "scheduled"]
  );
  assert.equal(scheduler.getStatus().nextRunAt, "2026-07-25T20:00:00.000Z");
  scheduler.stop();
});

test("scheduler arms a short catch-up after a missed daily run", async () => {
  const timers = [];
  const scheduler = new DailyTaskScheduler({
    hour: 22,
    minute: 0,
    timeZone: "Europe/Warsaw",
    catchUpDelayMs: 5000,
    now: () => new Date("2026-07-24T20:30:00.000Z"),
    setTimer: (callback, delayMs) => {
      const timer = { callback, delayMs, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearTimer: () => undefined,
    task: async () => undefined
  });

  await scheduler.start({ lastAttemptAt: "2026-07-23T20:00:00.000Z" });
  assert.equal(timers[0].delayMs, 5000);
  assert.equal(scheduler.getStatus().nextRunAt, "2026-07-24T20:30:05.000Z");
  scheduler.stop();
});
