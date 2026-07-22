/**
 * Single source of truth for e2e fixture dates.
 *
 * The org fixtures in e2e/test-data/ are generated from *.org.tmpl templates
 * by e2e/generate-test-data.js so that all dates are relative to "today"
 * instead of being hand-rolled forward whenever they go stale. Both the
 * generator and the e2e tests use the helpers in this module, so date math is
 * always consistent between the fixtures and the assertions.
 *
 * Plain CommonJS on purpose: it is require()d both by plain-node scripts
 * (generate-test-data.js) and by ts-jest e2e tests.
 */
"use strict";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * A Date at local noon, `days` days from today. Noon avoids off-by-one
 * surprises around DST transitions when adding day offsets.
 * @param {number} days signed offset in days relative to today
 * @returns {Date}
 */
function dateAtOffset(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Local-timezone ISO date (YYYY-MM-DD) `days` days from today.
 * Note: deliberately NOT Date#toISOString(), which is UTC and can be
 * off-by-one relative to the local calendar date.
 * @param {number} days
 * @returns {string}
 */
function isoDate(days) {
  const d = dateAtOffset(days);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Org-mode timestamp body (without the surrounding <> or [] brackets),
 * e.g. "2026-07-23 Thu" or "2026-07-23 Thu 10:00".
 * @param {number} days signed offset in days relative to today
 * @param {string} [time] optional "HH:MM"
 * @returns {string}
 */
function orgDate(days, time) {
  const d = dateAtOffset(days);
  const base = `${isoDate(days)} ${WEEKDAYS[d.getDay()]}`;
  return time ? `${base} ${time}` : base;
}

/**
 * Day of month (1-31) `days` days from today. Useful for tapping a day
 * number in the native Android date picker.
 * @param {number} days
 * @returns {number}
 */
function dayOfMonth(days) {
  return dateAtOffset(days).getDate();
}

module.exports = { dateAtOffset, isoDate, orgDate, dayOfMonth };
