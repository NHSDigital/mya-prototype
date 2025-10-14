const { filter } = require("lodash");
const { DateTime } = require("luxon");

const DEFAULT_TZ = "Europe/London";
const DEFAULT_FORMAT = "d LLLL yyyy"; // e.g. 05 October 2025 (NHS style)

function toDateTime(input, tz = DEFAULT_TZ) {
  if (!input) return DateTime.now().setZone(tz);

  if (input instanceof Date) return DateTime.fromJSDate(input, { zone: tz });

  if (typeof input === "number") return DateTime.fromMillis(input, { zone: tz });

  if (typeof input === "string") {
    // Try ISO first, then RFC2822, then a couple of common UK-ish patterns
    let dt = DateTime.fromISO(input, { zone: tz });
    if (dt.isValid) return dt;

    dt = DateTime.fromRFC2822(input, { zone: tz });
    if (dt.isValid) return dt;

    // Try dd/MM/yyyy (optionally with time)
    dt = DateTime.fromFormat(input, "dd/MM/yyyy HH:mm", { zone: tz });
    if (dt.isValid) return dt;

    dt = DateTime.fromFormat(input, "dd/MM/yyyy", { zone: tz });
    if (dt.isValid) return dt;

    // Fallback to native Date parse
    const fallback = new Date(input);
    if (!Number.isNaN(fallback.getTime())) {
      return DateTime.fromJSDate(fallback, { zone: tz });
    }
  }

  // Final fallback: now()
  return DateTime.now().setZone(tz);
}

module.exports = function registerDateTimeFilters(filters = {}) {

  // Date of n days in the past
  filters.daysAgo = (n, from = null, tz = DEFAULT_TZ) =>
    toDateTime(from, tz).minus({ days: Number(n) || 0 }).toJSDate();

  // Date of n days in the future
  filters.daysAhead = (n, from = null, tz = DEFAULT_TZ) =>
    toDateTime(from, tz).plus({ days: Number(n) || 0 }).toJSDate();

  // Generic formatter (defaults to NHS style "DD MMMM YYYY")
  // Luxon tokens: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
  filters.formatDate = (input, fmt = DEFAULT_FORMAT, tz = DEFAULT_TZ) =>
    toDateTime(input, tz).toFormat(fmt);

  filters.formatTime = (input, fmt = "h:mm a", tz = DEFAULT_TZ) =>
    toDateTime(input, tz).toFormat(fmt);

  // Explicit NHS format alias
  filters.nhsDate = (input, tz = DEFAULT_TZ) =>
    toDateTime(input, tz).toFormat(DEFAULT_FORMAT);

  // ISO string (keeps timezone)
  filters.iso = (input, tz = DEFAULT_TZ) => toDateTime(input, tz).toISO();

  // Convenience labels
  filters.dayName = (input, tz = DEFAULT_TZ) =>
    toDateTime(input, tz).toFormat("cccc"); // Monday
  filters.monthName = (input, tz = DEFAULT_TZ) =>
    toDateTime(input, tz).toFormat("LLLL"); // October

  return filters;
};
