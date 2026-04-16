const { DateTime } = require('luxon');
const { createHash } = require('crypto');

function stableId(input) {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyServiceOperations(baseServices = [], operations = []) {
  const first = operations[0];
  if (typeof first === 'string') return asArray(operations);

  let services = [...asArray(baseServices)];

  for (const change of asArray(operations)) {
    if (!change || typeof change !== 'object') continue;

    if (change.operation === 'replace') {
      services = asArray(change.values);
      continue;
    }

    if (change.operation === 'add' && change.service) {
      if (!services.includes(change.service)) {
        services.push(change.service);
      }
      continue;
    }

    if (change.operation === 'remove' && change.service) {
      services = services.filter((service) => service !== change.service);
    }
  }

  return services;
}

function dateIsExcluded(dateISO, exclusionDateRanges = []) {
  for (const range of asArray(exclusionDateRanges)) {
    const from = range?.from;
    const until = range?.until;
    if (!from || !until) continue;
    if (dateISO >= from && dateISO <= until) return true;
  }

  return false;
}

function findOverrideForDate(dateISO, overrideDates = []) {
  return asArray(overrideDates).find((override) => override?.date === dateISO) || null;
}

function createSessionFromRecurring(recurring, dateISO) {
  const override = findOverrideForDate(dateISO, recurring.overrideDates);
  const from = override?.from || recurring.from;
  const until = override?.until || recurring.until;
  const services = override?.services
    ? applyServiceOperations(recurring.services, override.services)
    : asArray(recurring.services);

  return {
    id: stableId(`${recurring.id}-${dateISO}-${from}-${until}`),
    recurringId: recurring.id,
    from,
    until,
    services,
    slotLength: Number(recurring.slotLength) || 10,
    capacity: Number(recurring.capacity) || 1
  };
}

function matchesPattern(date, startDate, recurrencePattern = {}) {
  const byDay = asArray(recurrencePattern.byDay);
  const interval = Number(recurrencePattern.interval) || 1;

  if (!byDay.includes(date.toFormat('cccc'))) return false;

  const startWeek = startDate.startOf('week');
  const thisWeek = date.startOf('week');
  const weekDiff = Math.floor(thisWeek.diff(startWeek, 'weeks').weeks);

  return weekDiff % interval === 0;
}

function mergeDailyAvailability(baseDaily = {}, site_id, recurringSessions = {}) {
  const merged = clone(baseDaily || {});

  for (const recurring of Object.values(recurringSessions || {})) {
    if (!recurring?.startDate || !recurring?.endDate) continue;

    const start = DateTime.fromISO(recurring.startDate);
    const end = DateTime.fromISO(recurring.endDate);
    if (!start.isValid || !end.isValid) continue;

    for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
      const dateISO = cursor.toISODate();
      if (dateIsExcluded(dateISO, recurring.exclusionDateRanges)) continue;
      if (!matchesPattern(cursor, start, recurring.recurrencePattern)) continue;

      const session = createSessionFromRecurring(recurring, dateISO);

      if (!merged[dateISO]) {
        merged[dateISO] = {
          date: dateISO,
          site_id,
          sessions: [session]
        };
      } else {
        merged[dateISO].sessions.push(session);
      }
    }
  }

  return merged;
}

module.exports = mergeDailyAvailability;
