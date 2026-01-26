const { filter } = require("lodash");
const { DateTime } = require("luxon");

const DEFAULT_TZ = "Europe/London";
const DEFAULT_FORMAT = "d LLLL yyyy"; // e.g. 05 October 2025 (NHS style)

function toDateTime(input, tz = DEFAULT_TZ) {
  if (!input) return DateTime.now().setZone(tz);

  // accept Luxon DateTime (and keep timezone consistent)
  if (DateTime.isDateTime(input)) return input.setZone(tz);

  // accept objects that can turn into a JS Date (e.g. other libs)
  if (input && typeof input.toJSDate === "function") {
    return DateTime.fromJSDate(input.toJSDate(), { zone: tz });
  }

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

  filters.nhsTime = (input, options = {}) => {
    if (!input) return '';

    const dt = toDateTime(input);
    if (!dt.isValid) return input;

    const hour = dt.hour;
    const minute = dt.minute;
    const useSpecialCases = options.specialCases === true;

    // Optional special cases
    if (useSpecialCases) {
      if (hour === 0 && minute === 0) return 'midnight';
      if (hour === 12 && minute === 0) return 'midday';
    }

    // Convert to 12-hour format
    const displayHour = dt.toFormat('h'); // removes leading zero
    const displayMinutes = minute === 0 ? '' : `:${dt.toFormat('mm')}`;
    const period = hour < 12 ? 'am' : 'pm';

    return `${displayHour}${displayMinutes}${period}`;
  }

  filters.isDateInPast = (input, comparisonDate = null, tz = DEFAULT_TZ) => {
    const dt = toDateTime(input, tz);
    let now = DateTime.now().setZone(tz);
    if (comparisonDate) {
      now = toDateTime(comparisonDate, tz);
    }
    return dt < now.startOf('day');
  }

  //follow the nhs date range logic
  //https://service-manual.nhs.uk/content/numbers-measurements-dates-time#ranges
  filters.nhsDateRange = (firstDate, secondDate, tz = DEFAULT_TZ) => {

    const dt1 = toDateTime(firstDate, tz);
    const dt2 = toDateTime(secondDate, tz);

    if (!dt1.isValid || !dt2.isValid) return '';

    //same day
    if (dt1.hasSame(dt2, 'day')) {
      return dt1.toFormat(DEFAULT_FORMAT);
    }

    //same month and year
    if (dt1.hasSame(dt2, 'month') && dt1.hasSame(dt2, 'year')) {
      return `${dt1.toFormat('d')} to ${dt2.toFormat(DEFAULT_FORMAT)}`;
    }

    //same year
    if (dt1.hasSame(dt2, 'year')) {
      return `${dt1.toFormat('d LLLL')} to ${dt2.toFormat(DEFAULT_FORMAT)}`;
    }

    //different years
    return `${dt1.toFormat(DEFAULT_FORMAT)} to ${dt2.toFormat(DEFAULT_FORMAT)}`;
  }

  filters.isDateBetween = (input, startDate, endDate, tz = DEFAULT_TZ) => {
    const dt = toDateTime(input, tz);
    const startDt = toDateTime(startDate, tz).startOf('day');
    const endDt = toDateTime(endDate, tz).endOf('day');
    return dt >= startDt && dt <= endDt;
  }

  filters.isTimeBetween = (input, startTime, endTime, tz = DEFAULT_TZ) => {
    const dt = toDateTime(input, tz);
    //just compare the time parts
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);

    const startDt = dt.set({ hour: startParts[0], minute: startParts[1] || 0, second: 0, millisecond: 0 });
    const endDt = dt.set({ hour: endParts[0], minute: endParts[1] || 0, second: 0, millisecond: 0 });
    return dt >= startDt && dt <= endDt;
  }

  filters.extractTimePart = (input, part = 'hours', tz = DEFAULT_TZ) => {
    const dt = toDateTime(input, tz);

    switch (part) {
      case 'hours':
      case 'hour':
      case 'h':
        return dt.hour;

      case 'minutes':
      case 'minute':
      case 'm':
        return dt.minute;

      case 'seconds':
      case 's':
        return dt.second;

      default:
        return null;
    }
  };

  return filters;
};
