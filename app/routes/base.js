// ./routes/site/base.js
const express = require('express');
const router = express.Router();
const { DateTime } = require('luxon');
const { randomUUID } = require('crypto');

const enhanceData = require('../helpers/enhanceData');
const mergeDailyAvailability = require('../helpers/recurringToDailyAvailability');

const override_today = process.env.OVERRIDE_TODAY || null;

function getToday() {
  return override_today || DateTime.now().toFormat('yyyy-MM-dd');
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function applyServiceOperations(baseServices = [], operations = []) {
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

function sortedStringArray(values = []) {
  return asArray(values)
    .map((value) => String(value))
    .sort((a, b) => a.localeCompare(b));
}

function servicesEqual(left = [], right = []) {
  return JSON.stringify(sortedStringArray(left)) === JSON.stringify(sortedStringArray(right));
}

function normalizeSessionType(type) {
  if (type === 'Single date') return 'Single clinic';
  if (type === 'Weekly session' || type === 'Weekly sessions' || type === 'Weekly repeating') return 'Clinic series';
  return type;
}

function clinicFlowType(data) {
  const type = normalizeSessionType(data?.newSession?.type);
  if (type === 'Single clinic') return 'single';
  if (type === 'Clinic series') return 'series';
  return null;
}

function ensureCreateSession(data) {
  const current = data.newSession || {};
  const sessionType = normalizeSessionType(current.type);

  const session = {
    name: current.name || '',
    type: sessionType || '',
    startDate: {
      day: current.startDate?.day || '',
      month: current.startDate?.month || '',
      year: current.startDate?.year || ''
    },
    endDate: {
      day: current.endDate?.day || '',
      month: current.endDate?.month || '',
      year: current.endDate?.year || ''
    },
    singleDate: {
      day: current.singleDate?.day || '',
      month: current.singleDate?.month || '',
      year: current.singleDate?.year || ''
    },
    days: asArray(current.days),
    startTime: {
      hour: current.startTime?.hour || '',
      minute: current.startTime?.minute || ''
    },
    endTime: {
      hour: current.endTime?.hour || '',
      minute: current.endTime?.minute || ''
    },
    capacity: current.capacity || '',
    duration: current.duration || '',
    services: asArray(current.services),
    closures: asArray(current.closures)
      .filter((closure) => closure?.startDate && closure?.endDate)
      .map((closure) => ({
        startDate: closure.startDate,
        endDate: closure.endDate,
        label: closure.label || ''
      }))
  };

  data.newSession = session;
  return session;
}

function toDateObject(dateInput) {
  const fallback = DateTime.now();

  return {
    day: String(dateInput?.day || fallback.day),
    month: String(dateInput?.month || fallback.month),
    year: String(dateInput?.year || fallback.year)
  };
}

function toTimeString(timeInput) {
  const hour = String(timeInput?.hour || '00').padStart(2, '0');
  const minute = String(timeInput?.minute || '00').padStart(2, '0');
  return `${hour}:${minute}`;
}

function toTimeParts(timeString = '') {
  const [hour = '', minute = ''] = String(timeString).split(':');
  return { hour, minute };
}

function toDateParts(isoDate) {
  const dt = DateTime.fromISO(isoDate || '');
  if (!dt.isValid) {
    return { day: '', month: '', year: '' };
  }

  return {
    day: String(dt.day),
    month: String(dt.month),
    year: String(dt.year)
  };
}

function inferClinicTypeFromModel(model = {}) {
  const explicit = normalizeSessionType(model.type);
  if (explicit === 'Single clinic' || explicit === 'Clinic series') {
    return explicit;
  }

  if (model.startDate && model.endDate && model.startDate === model.endDate) {
    return 'Single clinic';
  }

  return 'Clinic series';
}

function populateEditSession(data, model) {
  const clinicType = inferClinicTypeFromModel(model);
  const startDateParts = toDateParts(model.startDate);
  const endDateParts = toDateParts(model.endDate || model.startDate);

  data.newSession = {
    name: model.label || '',
    type: clinicType,
    startDate: startDateParts,
    endDate: endDateParts,
    singleDate: clinicType === 'Single clinic' ? startDateParts : { day: '', month: '', year: '' },
    days: asArray(model.recurrencePattern?.byDay),
    startTime: toTimeParts(model.from),
    endTime: toTimeParts(model.until),
    capacity: String(Number(model.capacity) || ''),
    duration: String(Number(model.slotLength) || ''),
    services: asArray(model.services),
    closures: asArray(model.closures)
      .filter((closure) => closure?.startDate && closure?.endDate)
      .map((closure) => ({
        startDate: closure.startDate,
        endDate: closure.endDate,
        label: closure.label || ''
      }))
  };

  data.editingSessionId = model.id;
}

function buildPersistableSession(newSession) {
  const mode = normalizeSessionType(newSession.type) || 'Clinic series';
  const isSingleDate = mode === 'Single clinic';
  const startDate = isSingleDate ? toDateObject(newSession.singleDate) : toDateObject(newSession.startDate);
  const endDate = isSingleDate ? toDateObject(newSession.singleDate) : toDateObject(newSession.endDate);
  const startTime = toTimeString(newSession.startTime);
  const endTime = toTimeString(newSession.endTime);

  let days = asArray(newSession.days);
  if (isSingleDate) {
    const iso = `${startDate.year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`;
    const dt = DateTime.fromISO(iso);
    days = dt.isValid ? [dt.toFormat('cccc')] : [];
  }

  return {
    startDate,
    endDate,
    days,
    startTime: {
      hour: startTime.split(':')[0],
      minute: startTime.split(':')[1]
    },
    endTime: {
      hour: endTime.split(':')[0],
      minute: endTime.split(':')[1]
    },
    services: asArray(newSession.services),
    capacity: Number(newSession.capacity) || 1,
    duration: Number(newSession.duration) || 10
  };
}

function toIsoDate(dateParts) {
  return DateTime.fromObject({
    day: +dateParts.day,
    month: +dateParts.month,
    year: +dateParts.year
  }).toISODate();
}

function toIsoDateIfValid(dateInput) {
  const day = String(dateInput?.day || '').trim();
  const month = String(dateInput?.month || '').trim();
  const year = String(dateInput?.year || '').trim();
  if (!day || !month || !year) return null;

  const dt = DateTime.fromObject({
    day: +day,
    month: +month,
    year: +year
  });

  return dt.isValid ? dt.toISODate() : null;
}

function toDateInputParts(isoDate) {
  const dt = DateTime.fromISO(isoDate || '');
  if (!dt.isValid) {
    return { day: '', month: '', year: '' };
  }

  return {
    day: String(dt.day),
    month: String(dt.month),
    year: String(dt.year)
  };
}

function parseClosureFromBody(closureBody = {}) {
  const label = String(closureBody.name || '').trim();

  const startDate = toIsoDateIfValid(closureBody.startDate);
  const endDate = toIsoDateIfValid(closureBody.endDate);
  if (!startDate || !endDate) return null;

  return {
    startDate,
    endDate,
    label
  };
}

function toEditableClosure(closure = {}) {
  return {
    name: closure.label || '',
    startDate: toDateInputParts(closure.startDate),
    endDate: toDateInputParts(closure.endDate)
  };
}

function toClosureFormInput(input = {}) {
  return {
    name: String(input.name || ''),
    startDate: {
      day: String(input.startDate?.day || ''),
      month: String(input.startDate?.month || ''),
      year: String(input.startDate?.year || '')
    },
    endDate: {
      day: String(input.endDate?.day || ''),
      month: String(input.endDate?.month || ''),
      year: String(input.endDate?.year || '')
    }
  };
}

function toByDay(newSession, startDateISO) {
  const mode = normalizeSessionType(newSession.type) || 'Clinic series';
  if (mode === 'Single clinic') {
    const day = DateTime.fromISO(startDateISO).toFormat('cccc');
    return [day];
  }

  return asArray(newSession.days);
}

function buildSessionLabel(byDay, fromTime) {
  if (!byDay || byDay.length === 0) return `Clinic series ${fromTime}`;
  return `${byDay.join(', ')} clinic series ${fromTime}`;
}

function buildRecurringSessionModel(newSession) {
  const mode = normalizeSessionType(newSession.type) || 'Clinic series';
  const isSingleDate = mode === 'Single clinic';

  const startDateISO = isSingleDate ? toIsoDate(newSession.singleDate) : toIsoDate(newSession.startDate);
  const endDateISO = isSingleDate ? toIsoDate(newSession.singleDate) : toIsoDate(newSession.endDate);
  const byDay = toByDay(newSession, startDateISO);

  const from = toTimeString(newSession.startTime);
  const until = toTimeString(newSession.endTime);
  const slotLength = Number(newSession.duration) || 10;
  const capacity = Number(newSession.capacity) || 1;
  const services = asArray(newSession.services);

  return {
    id: randomUUID().split('-')[0],
    type: mode,
    label: (newSession.name || '').trim() || buildSessionLabel(byDay, from),
    startDate: startDateISO,
    endDate: endDateISO,
    recurrencePattern: {
      frequency: 'Weekly',
      interval: 1,
      byDay
    },
    from,
    until,
    slotLength,
    services,
    capacity,
    childSessions: [],
    closures: asArray(newSession.closures)
      .filter((closure) => closure?.startDate && closure?.endDate)
      .map((closure) => ({
        startDate: closure.startDate,
        endDate: closure.endDate,
        label: closure.label || ''
      }))
  };
}

function persistRecurringSession(data, site_id, model) {
  data.recurring_sessions = data.recurring_sessions || {};
  data.recurring_sessions[site_id] = data.recurring_sessions[site_id] || {};
  data.recurring_sessions[site_id][model.id] = model;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function editFieldOptions(isSeries) {
  const options = [
    { value: 'name', text: 'Name' },
    { value: 'date', text: isSeries ? 'Dates' : 'Date' },
    ...(isSeries ? [{ value: 'days', text: 'Days' }] : []),
    { value: 'time', text: 'Time' },
    { value: 'capacity', text: 'Vaccinators and capacity' },
    { value: 'duration', text: 'Appointment length' },
    { value: 'services', text: 'Services' },
    ...(isSeries ? [{ value: 'closures', text: 'Clinic closures' }] : [])
  ];

  return options;
}

function getEditState(data) {
  return data.editClinic || null;
}

function setEditState(data, state) {
  data.editClinic = state;
}

function clearEditState(data) {
  delete data.editClinic;
}

function resetEditOutcome(state) {
  state.bookingAction = null;
  state.affectedBookingIds = [];
  state.childOverrideWarning = null;
  state.postWarningPath = null;
}

function editFieldsForStep(step, isSeries) {
  switch (step) {
    case 'details':
      return ['name', 'date'];
    case 'days':
      return isSeries ? ['days'] : ['date'];
    case 'clinic-times':
      return ['time'];
  return initializeEditStateForSession(data, siteId, sessionId);
      return ['capacity', 'duration'];
    case 'services':
      return ['services'];
    case 'clinic-closures':
      return isSeries ? ['closures'] : ['date'];
    default:
      return [];
  }
}

function currentEditableFields(state) {
  const isSeries = state?.draft?.type === 'Clinic series';

  if (state?.currentEditField) {
    return [state.currentEditField];
  }

  if (state?.currentEditStep) {
    const fields = editFieldsForStep(state.currentEditStep, isSeries);
    if (fields.length > 0) return fields;
  }

  return [];
}

function setCurrentEditField(state, field) {
  state.currentEditField = field || null;
  state.currentEditStep = editStepForField(field, state?.draft?.type === 'Clinic series');
  resetEditOutcome(state);
}

function setCurrentEditStep(state, step) {
  state.currentEditStep = step || null;
  state.currentEditField = null;
  resetEditOutcome(state);
}

function editSummaryPath(siteId, sessionId) {
  return `/site/${siteId}/clinics/edit/${sessionId}`;
}

function editStepPath(siteId, sessionId, step) {
  return `${editSummaryPath(siteId, sessionId)}/${step}`;
}

function editCaptionText(draft) {
  return draft?.type === 'Clinic series' ? 'Edit clinic series' : 'Edit single clinic';
}

function editStepForField(field, isSeries) {
  switch (field) {
    case 'name':
    case 'date':
      return 'details';
    case 'days':
      return isSeries ? 'days' : 'details';
    case 'time':
      return 'clinic-times';
    case 'capacity':
    case 'duration':
      return 'appointments-calculator';
    case 'services':
      return 'services';
    case 'closures':
      return isSeries ? 'clinic-closures' : 'details';
    default:
      return null;
  }
}

function setEditTemplateData(res, data, state) {
  res.locals.data = {
    ...data,
    newSession: draftToNewSession(state.draft)
  };
}

function updateDraftFromDetails(state, newSession = {}) {
  const editableFields = currentEditableFields(state);

  if (editableFields.length === 0 || editableFields.includes('name')) {
    state.draft.name = String(newSession.name || '').trim();
  }

  if (state.draft.type === 'Clinic series') {
    if (editableFields.length === 0 || editableFields.includes('date')) {
      const startISO = parseDateInputToISO(newSession.startDate || {});
      const endISO = parseDateInputToISO(newSession.endDate || {});
      if (startISO && endISO) {
        state.draft.startDate = startISO;
        state.draft.endDate = endISO;
        state.draft.startDateInput = toDateParts(startISO);
        state.draft.endDateInput = toDateParts(endISO);
      }
    }
    return;
  }

  if (editableFields.length === 0 || editableFields.includes('date')) {
    const singleISO = parseDateInputToISO(newSession.singleDate || {});
    if (singleISO) {
      state.draft.startDate = singleISO;
      state.draft.endDate = singleISO;
      state.draft.singleDate = singleISO;
      state.draft.singleDateInput = toDateParts(singleISO);
    }
  }
}

function updateDraftFromDays(state, newSession = {}) {
  state.draft.days = asArray(newSession.days);
}

function updateDraftFromTimes(state, newSession = {}) {
  const startHour = String(newSession.startTime?.hour || '').padStart(2, '0');
  const startMinute = String(newSession.startTime?.minute || '').padStart(2, '0');
  const endHour = String(newSession.endTime?.hour || '').padStart(2, '0');
  const endMinute = String(newSession.endTime?.minute || '').padStart(2, '0');

  state.draft.startTime = { hour: startHour, minute: startMinute };
  state.draft.endTime = { hour: endHour, minute: endMinute };
  state.draft.from = `${startHour}:${startMinute}`;
  state.draft.until = `${endHour}:${endMinute}`;
}

function updateDraftFromAppointments(state, newSession = {}) {
  const editableFields = currentEditableFields(state);

  if (editableFields.length === 0 || editableFields.includes('capacity')) {
    state.draft.capacity = Math.max(1, Number(newSession.capacity) || 1);
  }

  if (editableFields.length === 0 || editableFields.includes('duration')) {
    const duration = Number(newSession.duration) || 10;
    state.draft.duration = Math.min(60, Math.max(1, duration));
  }
}

function updateDraftFromServices(state, newSession = {}) {
  state.draft.services = asArray(newSession.services);
}

function normalizeIsoMinute(datetimeISO) {
  const dt = DateTime.fromISO(datetimeISO || '', { zone: 'Europe/London' });
  if (!dt.isValid) return null;
  return dt.toFormat("yyyy-MM-dd'T'HH:mm");
}

function modelToDraft(model) {
  const type = inferClinicTypeFromModel(model);
  const startDateParts = toDateParts(model.startDate);
  const endDateParts = toDateParts(model.endDate || model.startDate);

  return {
    id: model.id,
    type,
    name: model.label || '',
    startDate: model.startDate,
    endDate: model.endDate || model.startDate,
    singleDate: model.startDate,
    days: asArray(model.recurrencePattern?.byDay),
    from: model.from,
    until: model.until,
    startTime: toTimeParts(model.from),
    endTime: toTimeParts(model.until),
    capacity: Number(model.capacity) || 1,
    duration: Number(model.slotLength) || 10,
    services: asArray(model.services),
    childSessions: clone(asArray(model.childSessions)),
    closures: asArray(model.closures)
      .filter((closure) => closure?.startDate && closure?.endDate)
      .map((closure) => ({
        startDate: closure.startDate,
        endDate: closure.endDate,
        label: closure.label || ''
      })),
    startDateInput: startDateParts,
    endDateInput: endDateParts,
    singleDateInput: startDateParts
  };
}

function draftToNewSession(draft) {
  return {
    name: draft.name,
    type: draft.type,
    startDate: draft.startDateInput,
    endDate: draft.endDateInput,
    singleDate: draft.singleDateInput,
    days: asArray(draft.days),
    startTime: draft.startTime,
    endTime: draft.endTime,
    capacity: String(draft.capacity),
    duration: String(draft.duration),
    services: asArray(draft.services),
    closures: asArray(draft.closures)
  };
}

function draftToModel(draft) {
  const model = buildRecurringSessionModel(draftToNewSession(draft));
  model.id = draft.id;
  model.type = draft.type;
  model.childSessions = clone(asArray(draft.childSessions));
  return model;
}

function normalizedBookingImpact(model = {}) {
  const normalizeServiceOps = (ops = []) => asArray(ops).map((op) => {
    if (typeof op === 'string') return op;
    if (!op || typeof op !== 'object') return op;
    return {
      operation: op.operation || '',
      service: op.service || '',
      values: asArray(op.values).slice().sort()
    };
  });

  return {
    startDate: model.startDate || '',
    endDate: model.endDate || '',
    recurrencePattern: {
      frequency: model.recurrencePattern?.frequency || '',
      interval: Number(model.recurrencePattern?.interval) || 1,
      byDay: asArray(model.recurrencePattern?.byDay).slice().sort()
    },
    from: model.from || '',
    until: model.until || '',
    slotLength: Number(model.slotLength) || 10,
    capacity: Number(model.capacity) || 1,
    services: asArray(model.services).slice().sort(),
    childSessions: asArray(model.childSessions)
      .map((child) => ({
        date: child?.date || '',
        from: child?.from || '',
        until: child?.until || '',
        capacity: child?.capacity ?? null,
        services: normalizeServiceOps(child?.services)
      }))
      .sort((a, b) => `${a.date}-${a.from}-${a.until}`.localeCompare(`${b.date}-${b.from}-${b.until}`)),
    closures: asArray(model.closures)
      .filter((closure) => closure?.startDate && closure?.endDate)
      .map((closure) => ({
        startDate: closure.startDate,
        endDate: closure.endDate,
        label: closure.label || ''
      }))
      .sort((a, b) => `${a.startDate}-${a.endDate}-${a.label}`.localeCompare(`${b.startDate}-${b.endDate}-${b.label}`))
  };
}

function ensureEditStateForSession(data, siteId, sessionId) {
  const existing = getEditState(data);
  if (existing && existing.siteId === siteId && existing.sessionId === sessionId) {
    return existing;
  }

  return initializeEditStateForSession(data, siteId, sessionId);
}

function initializeEditStateForSession(data, siteId, sessionId) {
  const model = data?.recurring_sessions?.[siteId]?.[sessionId];
  if (!model) return null;

  const draft = modelToDraft(model);
  const state = {
    siteId,
    sessionId,
    original: clone(model),
    draft,
    bookingAction: null,
    affectedBookingIds: []
  };

  setEditState(data, state);
  return state;
}

function parseDateInputToISO(input = {}) {
  const day = String(input.day || '').trim();
  const month = String(input.month || '').trim();
  const year = String(input.year || '').trim();
  if (!day || !month || !year) return null;

  const dt = DateTime.fromObject({ day: +day, month: +month, year: +year });
  return dt.isValid ? dt.toISODate() : null;
}

function servicesSummaryListHtml(serviceIds = [], servicesById = {}) {
  const names = asArray(serviceIds)
    .map((id) => servicesById?.[id]?.name || id)
    .filter(Boolean);

  if (names.length === 0) {
    return 'None selected';
  }

  const items = names.map((name) => `<li>${name}</li>`).join('');
  return `<ul class="nhsuk-list nhsuk-u-margin-bottom-0">${items}</ul>`;
}

function buildSummaryRowMap(draft, siteId, sessionId, data) {
  const isSeries = draft.type === 'Clinic series';
  const startDateText = DateTime.fromISO(draft.startDate).toFormat('d MMM yyyy');
  const endDateText = DateTime.fromISO(draft.endDate).toFormat('d MMM yyyy');
  const dateText = isSeries ? `${startDateText} to ${endDateText}` : startDateText;
  const servicesHtml = servicesSummaryListHtml(draft.services, data.services);
  const closuresText = draft.closures?.length ? `${draft.closures.length} added` : 'None added';

  return {
    name: {
      key: { text: 'Name' },
      value: { text: draft.name || 'Not provided' },
      actions: { items: [{ href: `/site/${siteId}/clinics/edit/${sessionId}/change/name`, text: 'Change', visuallyHiddenText: ' name' }] }
    },
    date: {
      key: { text: isSeries ? 'Dates' : 'Date' },
      value: { text: dateText },
      actions: { items: [{ href: `/site/${siteId}/clinics/edit/${sessionId}/change/date`, text: 'Change', visuallyHiddenText: ' dates' }] }
    },
    ...(isSeries ? {
      days: {
        key: { text: 'Days' },
        value: { text: asArray(draft.days).join(', ') },
        actions: { items: [{ href: `/site/${siteId}/clinics/edit/${sessionId}/change/days`, text: 'Change', visuallyHiddenText: ' days' }] }
      },
      closures: {
        key: { text: 'Clinic closures' },
        value: { text: closuresText },
        actions: { items: [{ href: `/site/${siteId}/clinics/edit/${sessionId}/change/closures`, text: 'Change', visuallyHiddenText: ' clinic closures' }] }
      }
    } : {}),
    time: {
      key: { text: 'Time' },
      value: { text: `${draft.from} to ${draft.until}` },
      actions: { items: [{ href: `/site/${siteId}/clinics/edit/${sessionId}/change/time`, text: 'Change', visuallyHiddenText: ' time' }] }
    },
    capacity: {
      key: { text: 'Vaccinators and capacity' },
      value: { text: String(draft.capacity) },
      actions: { items: [{ href: `/site/${siteId}/clinics/edit/${sessionId}/change/capacity`, text: 'Change', visuallyHiddenText: ' vaccinators and capacity' }] }
    },
    duration: {
      key: { text: 'Appointment length' },
      value: { text: `${draft.duration} minutes` },
      actions: { items: [{ href: `/site/${siteId}/clinics/edit/${sessionId}/change/duration`, text: 'Change', visuallyHiddenText: ' appointment length' }] }
    },
    services: {
      key: { text: 'Services' },
      value: { html: servicesHtml },
      actions: { items: [{ href: `/site/${siteId}/clinics/edit/${sessionId}/change/services`, text: 'Change', visuallyHiddenText: ' services' }] }
    }
  };
}

function buildSummaryRowsForEdit(draft, siteId, sessionId, data) {
  const rowsByField = buildSummaryRowMap(draft, siteId, sessionId, data);
  const orderedFields = [
    'name',
    'date',
    'days',
    'time',
    'capacity',
    'duration',
    'services',
    'closures'
  ];

  return orderedFields
    .map((field) => rowsByField[field])
    .filter(Boolean);
}

function hasEditFieldChanged(original, draft, field) {
  switch (field) {
    case 'name':
      return String(original?.label || '') !== String(draft?.name || '');
    case 'date':
      if (draft?.type === 'Clinic series') {
        return String(original?.startDate || '') !== String(draft?.startDate || '')
          || String(original?.endDate || '') !== String(draft?.endDate || '');
      }
      return String(original?.startDate || '') !== String(draft?.startDate || '');
    case 'days':
      return JSON.stringify(asArray(original?.recurrencePattern?.byDay).slice().sort())
        !== JSON.stringify(asArray(draft?.days).slice().sort());
    case 'time':
      return String(original?.from || '') !== String(draft?.from || '')
        || String(original?.until || '') !== String(draft?.until || '');
    case 'capacity':
      return (Number(original?.capacity) || 1) !== (Number(draft?.capacity) || 1);
    case 'duration':
      return (Number(original?.slotLength) || 10) !== (Number(draft?.duration) || 10);
    case 'services':
      return JSON.stringify(asArray(original?.services).slice().sort())
        !== JSON.stringify(asArray(draft?.services).slice().sort());
    case 'closures': {
      const normalizeClosures = (closures) => asArray(closures)
        .filter((closure) => closure?.startDate && closure?.endDate)
        .map((closure) => ({
          startDate: closure.startDate,
          endDate: closure.endDate,
          label: closure.label || ''
        }))
        .sort((a, b) => `${a.startDate}-${a.endDate}-${a.label}`.localeCompare(`${b.startDate}-${b.endDate}-${b.label}`));

      return JSON.stringify(normalizeClosures(original?.closures))
        !== JSON.stringify(normalizeClosures(draft?.closures));
    }
    default:
      return false;
  }
}

function buildChangedRowsForEdit(original, draft, state, siteId, sessionId, data) {
  const rowsByField = buildSummaryRowMap(draft, siteId, sessionId, data);
  const editableFields = currentEditableFields(state);
  const candidateFields = editableFields.length > 0
    ? editableFields
    : ['name', 'date', 'days', 'time', 'capacity', 'duration', 'services', 'closures'];

  const changedRows = candidateFields
    .filter((field) => rowsByField[field] && hasEditFieldChanged(original, draft, field))
    .map((field) => rowsByField[field]);

  if (changedRows.length > 0) {
    return changedRows;
  }

  if (editableFields.length > 0) {
    return editableFields
      .filter((field) => rowsByField[field])
      .map((field) => rowsByField[field]);
  }

  return buildSummaryRowsForEdit(draft, siteId, sessionId, data);
}

function reviewBackPath(siteId, sessionId, state) {
  if (asArray(state?.affectedBookingIds).length > 0) {
    return `${editSummaryPath(siteId, sessionId)}/affected-bookings`;
  }

  const step = state?.currentEditStep
    || editStepForField(state?.currentEditField, state?.draft?.type === 'Clinic series');
  if (step) {
    return editStepPath(siteId, sessionId, step);
  }

  return editSummaryPath(siteId, sessionId);
}

function prepareReviewAfterEdit(data, siteId, state) {
  const updatedModel = draftToModel(state.draft);
  updatedModel.site_id = siteId;
  const originalModel = { ...state.original, site_id: siteId };
  const siteBookings = data?.bookings?.[siteId] || {};
  const affectedIds = calculateAffectedBookings(originalModel, updatedModel, siteBookings);

  state.affectedBookingIds = affectedIds;
  if (affectedIds.length === 0) {
    state.bookingAction = null;
  }

  const nextPath = affectedIds.length > 0
    ? `${editSummaryPath(siteId, state.sessionId)}/affected-bookings`
    : `${editSummaryPath(siteId, state.sessionId)}/check-answers`;

  const warning = buildChildOverrideWarningContext(
    state,
    originalModel,
    updatedModel
  );

  state.childOverrideWarning = warning;
  state.postWarningPath = warning ? nextPath : null;

  setEditState(data, state);
  return warning
    ? `${editSummaryPath(siteId, state.sessionId)}/child-clinic-overrides`
    : nextPath;
}

function buildChildOverrideWarningContext(state, originalModel, updatedModel) {
  if (state?.draft?.type !== 'Clinic series') return null;

  const editableFields = currentEditableFields(state);
  const modelChanges = {
    time: String(originalModel?.from || '') !== String(updatedModel?.from || '')
      || String(originalModel?.until || '') !== String(updatedModel?.until || ''),
    capacity: (Number(originalModel?.capacity) || 1) !== (Number(updatedModel?.capacity) || 1),
    services: !servicesEqual(originalModel?.services, updatedModel?.services)
  };

  let targetedFields = ['time', 'capacity', 'services'].filter((field) => editableFields.includes(field));
  if (targetedFields.length === 0) {
    targetedFields = Object.entries(modelChanges)
      .filter(([, changed]) => changed)
      .map(([field]) => field);
  }

  if (targetedFields.length === 0) return null;

  const changedFields = targetedFields.filter((field) => modelChanges[field]);

  if (changedFields.length === 0) return null;

  const parentServices = asArray(updatedModel?.services);
  const parentLabel = String(updatedModel?.label || '').trim() || 'Clinic series';
  const rows = [];

  for (const child of asArray(updatedModel?.childSessions)) {
    if (!child?.date) continue;

    const childHasPairedTime = Boolean(child?.from && child?.until);
    const resolvedFrom = childHasPairedTime ? child.from : updatedModel?.from;
    const resolvedUntil = childHasPairedTime ? child.until : updatedModel?.until;
    const hasTimeOverride = childHasPairedTime
      && (String(resolvedFrom) !== String(updatedModel?.from || '')
        || String(resolvedUntil) !== String(updatedModel?.until || ''));

    const hasCapacityOverride = child?.capacity !== undefined
      && child?.capacity !== null;

    const effectiveServices = child?.services
      ? applyServiceOperations(parentServices, child.services)
      : [...parentServices];
    const hasServicesOverride = asArray(child?.services).length > 0;

    const include = (
      (changedFields.includes('time') && hasTimeOverride)
      || (changedFields.includes('capacity') && hasCapacityOverride)
      || (changedFields.includes('services') && hasServicesOverride)
    );

    if (!include) continue;

    rows.push({
      dateISO: child.date,
      parentLabel,
      childLabel: child?.label || '',
      from: resolvedFrom,
      until: resolvedUntil,
      capacity: Number(child?.capacity ?? updatedModel?.capacity) || 1,
      effectiveServiceIds: asArray(effectiveServices)
    });
  }

  if (rows.length === 0) return null;

  rows.sort((a, b) => String(a.dateISO).localeCompare(String(b.dateISO)));

  const originalParentServiceIds = sortedStringArray(originalModel?.services);
  const updatedParentServiceIds = sortedStringArray(updatedModel?.services);
  const parentServicesAddedIds = updatedParentServiceIds
    .filter((serviceId) => !originalParentServiceIds.includes(serviceId));
  const parentServicesRemovedIds = originalParentServiceIds
    .filter((serviceId) => !updatedParentServiceIds.includes(serviceId));

  return {
    count: rows.length,
    hasTimeChange: changedFields.includes('time'),
    hasCapacityChange: changedFields.includes('capacity'),
    hasServicesChange: changedFields.includes('services'),
    parentServicesAddedIds,
    parentServicesRemovedIds,
    rows,
    changedFields
  };
}

function calculateAffectedBookings(originalModel, updatedModel, siteBookings) {
  if (JSON.stringify(normalizedBookingImpact(originalModel)) === JSON.stringify(normalizedBookingImpact(updatedModel))) {
    return [];
  }

  const collectMinuteSlots = (model) => {
    const slotsByMinute = new Map();
    const merged = mergeDailyAvailability({}, String(model.site_id || ''), { [model.id]: model });

    for (const [date, day] of Object.entries(merged || {})) {
      for (const session of (day.sessions || [])) {
        const start = DateTime.fromISO(`${date}T${session.from}`, { zone: 'Europe/London' });
        const end = DateTime.fromISO(`${date}T${session.until}`, { zone: 'Europe/London' });
        const slotLength = Number(session.slotLength) || 10;
        const capacity = Number(session.capacity) || 1;
        const services = asArray(session.services).slice().sort();

        for (let dt = start; dt < end; dt = dt.plus({ minutes: slotLength })) {
          const key = dt.toFormat("yyyy-MM-dd'T'HH:mm");
          const minuteSlots = slotsByMinute.get(key) || [];
          minuteSlots.push({
            sessionId: session.id || null,
            recurringSessionId: session.recurringId || model.id,
            slotKey: key,
            services,
            capacity
          });
          slotsByMinute.set(key, minuteSlots);
        }
      }
    }

    return slotsByMinute;
  };

  const bookingFitsSlot = (booking, slot) => {
    return slot.remaining > 0 && slot.services.includes(booking.service);
  };

  const assignBookingsToSlots = (bookings, slots) => {
    const survivors = new Set();
    const workingSlots = (slots || []).map((slot) => ({
      services: slot.services,
      remaining: Number(slot.capacity) || 0
    }));

    for (const booking of bookings) {
      const candidates = workingSlots
        .filter((slot) => bookingFitsSlot(booking, slot))
        .sort((a, b) => {
          if (a.services.length !== b.services.length) {
            return a.services.length - b.services.length;
          }
          return a.remaining - b.remaining;
        });

      const chosen = candidates[0];
      if (!chosen) continue;

      chosen.remaining -= 1;
      survivors.add(String(booking.id));
    }

    return survivors;
  };

  const originalSlotsByMinute = collectMinuteSlots(originalModel);
  const updatedSlotsByMinute = collectMinuteSlots(updatedModel);
  const bookingsByMinute = new Map();

  for (const booking of Object.values(siteBookings || {})) {
    if (booking?.status !== 'scheduled') continue;

    const key = booking?.slotKey || normalizeIsoMinute(booking?.datetime);
    if (!key) continue;

    const originalSlots = originalSlotsByMinute.get(key) || [];
    const belongsToOriginal = booking?.recurringSessionId
      ? String(booking.recurringSessionId) === String(originalModel.id)
      : originalSlots.some((slot) => asArray(slot.services).includes(booking.service));
    if (!belongsToOriginal) continue;

    const fitsOriginal = booking?.sessionId
      ? originalSlots.some((slot) => String(slot.sessionId) === String(booking.sessionId) && asArray(slot.services).includes(booking.service))
      : originalSlots.some((slot) => asArray(slot.services).includes(booking.service));
    if (!fitsOriginal) continue;

    const bucket = bookingsByMinute.get(key) || [];
    bucket.push(booking);
    bookingsByMinute.set(key, bucket);
  }

  const affectedIds = [];

  for (const [minute, minuteBookings] of bookingsByMinute.entries()) {
    const sortedBookings = minuteBookings
      .slice()
      .sort((a, b) => Number(a.id) - Number(b.id));
    const updatedSlots = updatedSlotsByMinute.get(minute) || [];
    const survivors = assignBookingsToSlots(sortedBookings, updatedSlots);

    for (const booking of sortedBookings) {
      if (!survivors.has(String(booking.id))) {
        affectedIds.push(String(booking.id));
      }
    }
  }

  return Array.from(new Set(affectedIds));
}

function applyAffectedBookingAction(siteBookings, affectedIds, action) {
  if (!action || !Array.isArray(affectedIds) || affectedIds.length === 0) return;

  for (const id of affectedIds) {
    if (!siteBookings?.[id]) continue;
    if (action === 'orphan') {
      siteBookings[id].status = 'orphaned';
      continue;
    }
    if (action === 'cancel') {
      siteBookings[id].status = 'cancelled';
    }
  }
}

function buildSessionHistory(siteRecurringSessions, startDate = null, endDate = null, today = null) {
  const rows = [];

  for (const session of Object.values(siteRecurringSessions || {})) {
    const sessionStart = session?.startDate;
    const sessionEnd = session?.endDate || sessionStart;
    if (!sessionStart || !sessionEnd) continue;

    // Keep recurring sessions visible while they are still active.
    if (today && sessionEnd < today) continue;

    // Keep sessions that overlap the requested filter window.
    if (startDate && sessionEnd < startDate) continue;
    if (endDate && sessionStart > endDate) continue;

    rows.push({
      id: session.id,
      type: session.type,
      label: session.label,
      date: sessionStart,
      endDate: sessionEnd,
      days: session.recurrencePattern?.byDay || [],
      from: session.from,
      until: session.until,
      services: session.services || [],
      capacity: Number(session.capacity) || 0,
      slotLength: Number(session.slotLength) || 0
    });
  }

  return rows.sort((a, b) => {
    if (a.date === b.date) {
      return (a.from || '').localeCompare(b.from || '');
    }
    return b.date.localeCompare(a.date);
  });
}

function buildPastSessionHistory(siteRecurringSessions, startDate = null, endDate = null, today = null) {
  const rows = [];

  for (const session of Object.values(siteRecurringSessions || {})) {
    const sessionStart = session?.startDate;
    const sessionEnd = session?.endDate || sessionStart;
    if (!sessionStart || !sessionEnd) continue;

    // Keep only sessions that have ended.
    if (!today || sessionEnd >= today) continue;

    if (startDate && sessionEnd < startDate) continue;
    if (endDate && sessionStart > endDate) continue;

    rows.push({
      id: session.id,
      type: session.type,
      label: session.label,
      date: sessionStart,
      endDate: sessionEnd,
      days: session.recurrencePattern?.byDay || [],
      from: session.from,
      until: session.until,
      services: session.services || [],
      capacity: Number(session.capacity) || 0,
      slotLength: Number(session.slotLength) || 0
    });
  }

  return rows.sort((a, b) => {
    if (a.endDate === b.endDate) {
      return (a.from || '').localeCompare(b.from || '');
    }
    return b.endDate.localeCompare(a.endDate);
  });
}

function sortSessionsForAvailability(sessions = []) {
  return asArray(sessions).slice().sort((a, b) => {
    const left = `${a?.from || ''}-${a?.until || ''}-${a?.label || ''}`;
    const right = `${b?.from || ''}-${b?.until || ''}-${b?.label || ''}`;
    return left.localeCompare(right);
  });
}

function slotMatchesSession(slot, session) {
  if (slot?.sessionId && session?.id) {
    return String(slot.sessionId) === String(session.id);
  }

  return slot?.group?.start === session?.from
    && slot?.group?.end === session?.until
    && (!slot?.recurringSessionId || !session?.recurringId || String(slot.recurringSessionId) === String(session.recurringId));
}

function buildWeekAvailabilitySummary(week, dailyAvailability, slotsByDate, servicesById, siteBookings, siteId, today, recurringSessionsById = {}) {
  return week.map((day) => {
    const sessions = sortSessionsForAvailability(dailyAvailability?.[day]?.sessions);
    const dateSlots = asArray(slotsByDate?.[day]);

    const sessionSummaries = sessions.map((session) => {
      const sessionSlots = dateSlots.filter((slot) => slotMatchesSession(slot, session));
      const bookedTotal = sessionSlots.filter((slot) => slot?.booking_status === 'scheduled').length;
      const totalSlots = sessionSlots.length;
      const resolvedLabel = session.label || recurringSessionsById?.[session?.recurringId]?.label || '';

      return {
        id: session.id,
        label: resolvedLabel,
        from: session.from,
        until: session.until,
        services: asArray(session.services).map((serviceId) => ({
          id: serviceId,
          name: servicesById?.[serviceId]?.name || serviceId,
          bookedCount: sessionSlots.filter((slot) => (
            slot?.booking_status === 'scheduled'
            && slot?.booking_id
            && siteBookings?.[slot.booking_id]?.service === serviceId
          )).length
        })),
        bookedTotal,
        unbookedTotal: Math.max(0, totalSlots - bookedTotal),
        actionHref: day < today || !session?.recurringId ? null : `/site/${siteId}/change/session/${session.id}`
      };
    });

    const totalAppointments = sessionSummaries.reduce((sum, session) => sum + session.bookedTotal + session.unbookedTotal, 0);
    const bookedAppointments = sessionSummaries.reduce((sum, session) => sum + session.bookedTotal, 0);
    const clinicNames = [...new Set(sessionSummaries.map((session) => session.label).filter(Boolean))];

    return {
      date: day,
      isToday: day === today,
      isPast: day < today,
      clinicNames,
      sessions: sessionSummaries,
      totalAppointments,
      bookedAppointments,
      unbookedAppointments: Math.max(0, totalAppointments - bookedAppointments),
      dayViewHref: `/site/${siteId}/availability/day?date=${day}`
    };
  });
}

function buildMonthWeekRanges(referenceDateISO) {
  const fallback = DateTime.fromISO(getToday());
  const referenceDate = DateTime.fromISO(referenceDateISO || '', { zone: 'Europe/London' });
  const current = (referenceDate.isValid ? referenceDate : fallback).startOf('month');
  const firstWeekStart = current.startOf('week');
  const lastWeekStart = current.endOf('month').startOf('week');
  const weeks = [];

  for (let cursor = firstWeekStart; cursor <= lastWeekStart; cursor = cursor.plus({ days: 7 })) {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      days.push(cursor.plus({ days: i }).toISODate());
    }

    weeks.push({
      start: cursor.toISODate(),
      end: cursor.plus({ days: 6 }).toISODate(),
      days
    });
  }

  return {
    currentDate: current.toISODate(),
    previousMonthDate: current.minus({ months: 1 }).toISODate(),
    nextMonthDate: current.plus({ months: 1 }).toISODate(),
    weeks
  };
}

function buildMonthAvailabilitySummary(weekRanges, dailyAvailability, slotsByDate, servicesById, siteBookings, siteId, today, recurringSessionsById = {}) {
  return asArray(weekRanges).map((weekRange) => {
    const daySummaries = buildWeekAvailabilitySummary(
      weekRange.days,
      dailyAvailability,
      slotsByDate,
      servicesById,
      siteBookings,
      siteId,
      today,
      recurringSessionsById
    );

    const services = new Map();

    daySummaries.forEach((day) => {
      day.sessions.forEach((session) => {
        session.services.forEach((service) => {
          const existing = services.get(service.id) || {
            id: service.id,
            name: service.name,
            bookedCount: 0
          };

          existing.bookedCount += Number(service.bookedCount) || 0;
          services.set(service.id, existing);
        });
      });
    });

    const totalAppointments = daySummaries.reduce((sum, day) => sum + day.totalAppointments, 0);
    const bookedAppointments = daySummaries.reduce((sum, day) => sum + day.bookedAppointments, 0);

    return {
      start: weekRange.start,
      end: weekRange.end,
      services: Array.from(services.values()),
      totalAppointments,
      bookedAppointments,
      unbookedAppointments: Math.max(0, totalAppointments - bookedAppointments),
      weekViewHref: `/site/${siteId}/availability/week?date=${weekRange.start}`
    };
  });
}

// -----------------------------------------------------------------------------
// PARAM HANDLER – capture site_id once for all /site/:id routes
// -----------------------------------------------------------------------------
router.param('id', (req, res, next, id) => {
  req.site_id = id;
  res.locals.site_id = id; // expose to templates
  next();
});


// -----------------------------------------------------------------------------
// MIDDLEWARE – enhance data for the current site before any route runs
// -----------------------------------------------------------------------------
router.use('/site/:id', (req, res, next) => {
  const data = req.session.data;
  const site_id = String(req.site_id);
  const isClinicsCreateFlowPath = /^\/clinics\/(type-of-clinc|details|dates|days|time-and-capacity|clinic-times|appointments-calculator|services|clinic-closures(?:\/.*)?|check-answers|success)$/.test(req.path);
  const isClinicsEditFlowPath = /^\/clinics\/edit\/.+/.test(req.path);

  // Hide top-level navigation on create/edit flow pages to reduce context switching.
  res.locals.hideMainNav = isClinicsCreateFlowPath || isClinicsEditFlowPath;

  const today = getToday();
  const sessionFilters = data.filters?.[site_id] || {};
  const from = req.query.from ?? sessionFilters.from ?? null;
  const until = req.query.until ?? sessionFilters.until ?? null;

  // Keep filter state intentionally small in baseline mode.
  data.filters = data.filters || {};
  data.filters[site_id] = {
    from,
    until
  };

  data.today = today;


  if (!data?.sites?.[site_id]) {
    console.warn(`⚠️ Site ${site_id} not found in session data`);
    return res.status(404).send('Site not found');
  }

  const siteDailyAvailability = data.daily_availability?.[site_id] || {};
  const siteRecurringSessions = data.recurring_sessions?.[site_id] || {};
  const siteBookings = data.bookings?.[site_id] || {};
  const effectiveDailyAvailability = mergeDailyAvailability(siteDailyAvailability, site_id, siteRecurringSessions);

  // Generate slots data for this site
  const slots = enhanceData({
    daily_availability: { [site_id]: effectiveDailyAvailability },
    bookings: { [site_id]: siteBookings }
  });

  // Expose to templates
  res.locals.slots = slots[site_id];
  res.locals.dailyAvailability = effectiveDailyAvailability;
  res.locals.sessionHistory = buildSessionHistory(siteRecurringSessions, from, until, today);
  res.locals.pastSessionHistory = buildPastSessionHistory(siteRecurringSessions, from, until, today);

  next();
});

// -----------------------------------------------------------------------------
// SET FILTERS
// -----------------------------------------------------------------------------
router.post('/set-filters', (req, res) => {
  const next = req.body.next || '/sites';
  const site_id = req.body.site_id || req.body.id || req.query.site_id;
  const incomingFilters = req.body.filters || {};

  req.session.data.filters = req.session.data.filters || {};

  if (site_id) {
    req.session.data.filters[String(site_id)] = {
      ...(req.session.data.filters[String(site_id)] || {}),
      from: incomingFilters.from || null,
      until: incomingFilters.until || null
    };
  }

  res.redirect(next);
});

// -----------------------------------------------------------------------------
// All sites (reset any site-specific data)
// -----------------------------------------------------------------------------
router.get('/sites', (req, res) => {
  const transientKeys = [
    'newSession',
    'currentGroup',
    'changeComparison',
    'cancelAvailability',
    'select-date',
    'filters'
  ];

  transientKeys.forEach((key) => {
    delete req.session.data[key];
  });

  res.render('sites');
});


// -----------------------------------------------------------------------------
// DASHBOARD
// -----------------------------------------------------------------------------
router.get('/site/:id', (req, res) => {
  res.render('site/dashboard');
});


// -----------------------------------------------------------------------------
// CLINICS
// -----------------------------------------------------------------------------
router.get('/site/:id/clinics', (req, res) => {
  clearEditState(req.session.data);
  ensureCreateSession(req.session.data);
  res.render('site/clinics/clinics');
});

router.get('/site/:id/clinics/edit/:sessionId', (req, res) => {
  const data = req.session.data;
  const state = initializeEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  const heading = state.draft.type === 'Clinic series' ? 'Edit clinic series' : 'Edit single clinic';
  return res.render('site/clinics/edit/summary', {
    pageName: heading,
    draft: state.draft,
    sessionId: req.params.sessionId
  });
});

router.all('/site/:id/clinics/edit/:sessionId/details', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  if (state.currentEditStep !== 'details') {
    setCurrentEditStep(state, 'details');
    setEditState(data, state);
  }

  if (req.method === 'POST') {
    updateDraftFromDetails(state, req.body?.newSession || {});
    return res.redirect(prepareReviewAfterEdit(data, req.site_id, state));
  }

  setEditTemplateData(res, data, state);
  return res.render(`site/clinics/${state.draft.type === 'Clinic series' ? 'series' : 'single'}/details`, {
    backUrl: editSummaryPath(req.site_id, req.params.sessionId),
    captionText: editCaptionText(state.draft),
    formAction: editStepPath(req.site_id, req.params.sessionId, 'details')
  });
});

router.all('/site/:id/clinics/edit/:sessionId/days', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state || state.draft.type !== 'Clinic series') {
    return res.redirect(editSummaryPath(req.site_id, req.params.sessionId));
  }

  if (state.currentEditStep !== 'days') {
    setCurrentEditStep(state, 'days');
    setEditState(data, state);
  }

  if (req.method === 'POST') {
    updateDraftFromDays(state, req.body?.newSession || {});
    return res.redirect(prepareReviewAfterEdit(data, req.site_id, state));
  }

  setEditTemplateData(res, data, state);
  return res.render('site/clinics/series/days', {
    backUrl: editSummaryPath(req.site_id, req.params.sessionId),
    captionText: editCaptionText(state.draft),
    formAction: editStepPath(req.site_id, req.params.sessionId, 'days')
  });
});

router.all('/site/:id/clinics/edit/:sessionId/clinic-times', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  if (state.currentEditStep !== 'clinic-times') {
    setCurrentEditStep(state, 'clinic-times');
    setEditState(data, state);
  }

  if (req.method === 'POST') {
    updateDraftFromTimes(state, req.body?.newSession || {});
    return res.redirect(prepareReviewAfterEdit(data, req.site_id, state));
  }

  setEditTemplateData(res, data, state);
  return res.render(`site/clinics/${state.draft.type === 'Clinic series' ? 'series' : 'single'}/clinic-times`, {
    backUrl: editSummaryPath(req.site_id, req.params.sessionId),
    captionText: editCaptionText(state.draft),
    formAction: editStepPath(req.site_id, req.params.sessionId, 'clinic-times')
  });
});

router.all('/site/:id/clinics/edit/:sessionId/appointments-calculator', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  if (state.currentEditStep !== 'appointments-calculator') {
    setCurrentEditStep(state, 'appointments-calculator');
    setEditState(data, state);
  }

  if (req.method === 'POST') {
    updateDraftFromAppointments(state, req.body?.newSession || {});
    return res.redirect(prepareReviewAfterEdit(data, req.site_id, state));
  }

  setEditTemplateData(res, data, state);
  return res.render(`site/clinics/${state.draft.type === 'Clinic series' ? 'series' : 'single'}/appointments-calculator`, {
    backUrl: editSummaryPath(req.site_id, req.params.sessionId),
    captionText: editCaptionText(state.draft),
    formAction: editStepPath(req.site_id, req.params.sessionId, 'appointments-calculator'),
    hideDuration: state.currentEditField === 'capacity',
    fixedDuration: state.draft.duration
  });
});

router.all('/site/:id/clinics/edit/:sessionId/services', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  if (state.currentEditStep !== 'services') {
    setCurrentEditStep(state, 'services');
    setEditState(data, state);
  }

  if (req.method === 'POST') {
    updateDraftFromServices(state, req.body?.newSession || {});
    return res.redirect(prepareReviewAfterEdit(data, req.site_id, state));
  }

  setEditTemplateData(res, data, state);
  return res.render(`site/clinics/${state.draft.type === 'Clinic series' ? 'series' : 'single'}/services`, {
    backUrl: editSummaryPath(req.site_id, req.params.sessionId),
    captionText: editCaptionText(state.draft),
    formAction: editStepPath(req.site_id, req.params.sessionId, 'services')
  });
});

router.all('/site/:id/clinics/edit/:sessionId/clinic-closures', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state || state.draft.type !== 'Clinic series') {
    return res.redirect(editSummaryPath(req.site_id, req.params.sessionId));
  }

  if (state.currentEditStep !== 'clinic-closures') {
    setCurrentEditStep(state, 'clinic-closures');
    setEditState(data, state);
  }

  const closures = asArray(state.draft.closures);

  if (req.method === 'POST') {
    const addAnother = req.body?.addAnother;
    if (addAnother === 'yes') {
      return res.redirect(editStepPath(req.site_id, req.params.sessionId, 'clinic-closures/add'));
    }

    if (addAnother === 'no') {
      return res.redirect(prepareReviewAfterEdit(data, req.site_id, state));
    }
  }

  return res.render('site/clinics/series/clinic-closures', {
    backUrl: editSummaryPath(req.site_id, req.params.sessionId),
    captionText: editCaptionText(state.draft),
    formAction: editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'),
    closures
  });
});

router.all('/site/:id/clinics/edit/:sessionId/clinic-closures/add', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state || state.draft.type !== 'Clinic series') {
    return res.redirect(editSummaryPath(req.site_id, req.params.sessionId));
  }

  if (req.method === 'POST') {
    const parsed = parseClosureFromBody(req.body?.closure || {});
    if (!parsed) {
      return res.render('site/clinics/series/clinic-closures-form', {
        pageName: 'Add clinic closure',
        backUrl: editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'),
        captionText: editCaptionText(state.draft),
        actionHref: editStepPath(req.site_id, req.params.sessionId, 'clinic-closures/add'),
        mode: 'add',
        closure: toClosureFormInput(req.body?.closure || {}),
        error: 'Enter valid closure start and end dates'
      });
    }

    state.draft.closures = asArray(state.draft.closures);
    state.draft.closures.push(parsed);
    setEditState(data, state);
    return res.redirect(editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'));
  }

  return res.render('site/clinics/series/clinic-closures-form', {
    pageName: 'Add clinic closure',
    backUrl: editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'),
    captionText: editCaptionText(state.draft),
    actionHref: editStepPath(req.site_id, req.params.sessionId, 'clinic-closures/add'),
    mode: 'add',
    closure: toClosureFormInput({
      name: '',
      startDate: { day: '', month: '', year: '' },
      endDate: { day: '', month: '', year: '' }
    })
  });
});

router.all('/site/:id/clinics/edit/:sessionId/clinic-closures/:index/change', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state || state.draft.type !== 'Clinic series') {
    return res.redirect(editSummaryPath(req.site_id, req.params.sessionId));
  }

  const index = Number(req.params.index);
  const closures = asArray(state.draft.closures);
  const current = closures[index];
  if (!Number.isInteger(index) || index < 0 || !current) {
    return res.redirect(editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'));
  }

  if (req.method === 'POST') {
    const parsed = parseClosureFromBody(req.body?.closure || {});
    if (!parsed) {
      return res.render('site/clinics/series/clinic-closures-form', {
        pageName: 'Change clinic closure',
        backUrl: editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'),
        captionText: editCaptionText(state.draft),
        actionHref: editStepPath(req.site_id, req.params.sessionId, `clinic-closures/${index}/change`),
        mode: 'change',
        closure: toClosureFormInput(req.body?.closure || toEditableClosure(current)),
        error: 'Enter valid closure start and end dates'
      });
    }

    closures[index] = parsed;
    state.draft.closures = closures;
    setEditState(data, state);
    return res.redirect(editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'));
  }

  return res.render('site/clinics/series/clinic-closures-form', {
    pageName: 'Change clinic closure',
    backUrl: editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'),
    captionText: editCaptionText(state.draft),
    actionHref: editStepPath(req.site_id, req.params.sessionId, `clinic-closures/${index}/change`),
    mode: 'change',
    closure: toClosureFormInput(toEditableClosure(current))
  });
});

router.all('/site/:id/clinics/edit/:sessionId/clinic-closures/:index/remove', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state || state.draft.type !== 'Clinic series') {
    return res.redirect(editSummaryPath(req.site_id, req.params.sessionId));
  }

  const index = Number(req.params.index);
  const closures = asArray(state.draft.closures);
  const current = closures[index];
  if (!Number.isInteger(index) || index < 0 || !current) {
    return res.redirect(editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'));
  }

  if (req.method === 'POST') {
    closures.splice(index, 1);
    state.draft.closures = closures;
    setEditState(data, state);
    return res.redirect(editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'));
  }

  return res.render('site/clinics/series/clinic-closures-remove', {
    backUrl: editStepPath(req.site_id, req.params.sessionId, 'clinic-closures'),
    captionText: editCaptionText(state.draft),
    formAction: editStepPath(req.site_id, req.params.sessionId, `clinic-closures/${index}/remove`),
    index,
    closure: current
  });
});

router.all('/site/:id/clinics/edit/:sessionId/change/:field', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  const step = editStepForField(req.params.field, state.draft.type === 'Clinic series');
  if (!step) {
    return res.redirect(editSummaryPath(req.site_id, req.params.sessionId));
  }

  setCurrentEditField(state, req.params.field);
  setEditState(data, state);
  return res.redirect(editStepPath(req.site_id, req.params.sessionId, step));
});

router.all('/site/:id/clinics/edit/:sessionId/any-other-changes', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  return res.redirect(prepareReviewAfterEdit(data, req.site_id, state));
});

router.all('/site/:id/clinics/edit/:sessionId/affected-bookings', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  const affectedCount = asArray(state.affectedBookingIds).length;
  if (affectedCount === 0) {
    return res.redirect(`/site/${req.site_id}/clinics/edit/${req.params.sessionId}/check-answers`);
  }

  if (req.method === 'POST') {
    const action = req.body?.bookingAction;
    if (action === 'orphan' || action === 'cancel') {
      state.bookingAction = action;
      setEditState(data, state);
      return res.redirect(`/site/${req.site_id}/clinics/edit/${req.params.sessionId}/check-answers`);
    }
  }

  return res.render('site/clinics/edit/affected-bookings', {
    sessionId: req.params.sessionId,
    isSeries: state.draft.type === 'Clinic series',
    affectedCount,
    selectedBookingAction: state.bookingAction || null,
    backHref: reviewBackPath(req.site_id, req.params.sessionId, {
      ...state,
      affectedBookingIds: []
    })
  });
});

router.all('/site/:id/clinics/edit/:sessionId/child-clinic-overrides', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  const warning = state.childOverrideWarning;
  const nextPath = state.postWarningPath
    || (asArray(state.affectedBookingIds).length > 0
      ? `${editSummaryPath(req.site_id, req.params.sessionId)}/affected-bookings`
      : `${editSummaryPath(req.site_id, req.params.sessionId)}/check-answers`);

  if (!warning || !asArray(warning.rows).length) {
    return res.redirect(nextPath);
  }

  if (req.method === 'POST') {
    return res.redirect(nextPath);
  }

  const step = state.currentEditStep || editStepForField(state.currentEditField, state?.draft?.type === 'Clinic series');
  const backHref = step
    ? editStepPath(req.site_id, req.params.sessionId, step)
    : editSummaryPath(req.site_id, req.params.sessionId);

  return res.render('site/clinics/edit/child-clinic-overrides', {
    sessionId: req.params.sessionId,
    backHref,
    formAction: `${editSummaryPath(req.site_id, req.params.sessionId)}/child-clinic-overrides`,
    warning: warning,
    rows: warning.rows
  });
});

router.all('/site/:id/clinics/edit/:sessionId/check-answers', (req, res) => {
  const data = req.session.data;
  const state = ensureEditStateForSession(data, req.site_id, req.params.sessionId);
  if (!state) {
    return res.redirect(`/site/${req.site_id}/clinics`);
  }

  if (req.method === 'POST') {
    const updatedModel = draftToModel(state.draft);
    persistRecurringSession(data, req.site_id, updatedModel);

    const siteBookings = data?.bookings?.[req.site_id] || {};
    applyAffectedBookingAction(siteBookings, state.affectedBookingIds, state.bookingAction);
    clearEditState(data);
    return res.redirect(`/site/${req.site_id}/clinics/edit/${req.params.sessionId}/success`);
  }

  return res.render('site/clinics/edit/check-answers', {
    sessionId: req.params.sessionId,
    isSeries: state.draft.type === 'Clinic series',
    rows: buildChangedRowsForEdit(state.original, state.draft, state, req.site_id, req.params.sessionId, data),
    affectedCount: asArray(state.affectedBookingIds).length,
    bookingAction: state.bookingAction,
    backHref: reviewBackPath(req.site_id, req.params.sessionId, state)
  });
});

router.get('/site/:id/clinics/edit/:sessionId/success', (req, res) => {
  return res.render('site/clinics/edit/success', {
    sessionId: req.params.sessionId
  });
});

router.get('/site/:id/clinics/:sessionId/edit', (req, res) => {
  return res.redirect(`/site/${req.site_id}/clinics/edit/${req.params.sessionId}`);
});

router.all('/site/:id/clinics/type-of-session', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc${query}`);
});

router.all('/site/:id/clinics/type-of-clinc', (req, res) => {
  if (req.method === 'GET' && req.query.new === '1') {
    delete req.session.data.newSession;
  }

  ensureCreateSession(req.session.data);
  res.render('site/clinics/type-of-clinc');
});

router.all('/site/:id/clinics/dates', (req, res) => {
  return res.redirect(`/site/${req.site_id}/clinics/details`);
});

router.all('/site/:id/clinics/details', (req, res) => {
  ensureCreateSession(req.session.data);

  const flowType = clinicFlowType(req.session.data);
  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  return res.render(`site/clinics/${flowType}/details`);
});

router.all('/site/:id/clinics/days', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  if (flowType === 'single') {
    return res.redirect(`/site/${req.site_id}/clinics/clinic-times`);
  }

  return res.render('site/clinics/series/days');
});

router.all('/site/:id/clinics/time-and-capacity', (req, res) => {
  return res.redirect(`/site/${req.site_id}/clinics/clinic-times`);
});

router.all('/site/:id/clinics/clinic-times', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  return res.render(`site/clinics/${flowType}/clinic-times`);
});

router.all('/site/:id/clinics/appointments-calculator', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  return res.render(`site/clinics/${flowType}/appointments-calculator`);
});

router.all('/site/:id/clinics/services', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  res.render(`site/clinics/${flowType}/services`, {
    ...req.query
  });
});

router.all('/site/:id/clinics/clinic-closures', (req, res) => {
  ensureCreateSession(req.session.data);
  let flowType = clinicFlowType(req.session.data);

  if (flowType !== 'series') {
    const postedType = normalizeSessionType(req.body?.newSession?.type);
    if (postedType === 'Clinic series') {
      req.session.data.newSession = req.session.data.newSession || {};
      req.session.data.newSession.type = 'Clinic series';
      flowType = 'series';
    }
  }

  if (flowType !== 'series') {
    return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
  }

  const closures = req.session.data.newSession.closures || [];

  if (req.method === 'POST') {
    const addAnother = req.body?.addAnother;
    if (addAnother === 'yes') {
      return res.redirect(`/site/${req.site_id}/clinics/clinic-closures/add`);
    }

    if (addAnother === 'no') {
      return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
    }

    // Initial POST from services (or no radio selection) should stay on this page.
    return res.render('site/clinics/series/clinic-closures', {
      closures
    });
  }

  return res.render('site/clinics/series/clinic-closures', {
    closures
  });
});

router.all('/site/:id/clinics/clinic-closures/add', (req, res) => {
  ensureCreateSession(req.session.data);
  let flowType = clinicFlowType(req.session.data);

  if (flowType !== 'series') {
    const postedType = normalizeSessionType(req.body?.newSession?.type);
    if (postedType === 'Clinic series') {
      req.session.data.newSession = req.session.data.newSession || {};
      req.session.data.newSession.type = 'Clinic series';
      flowType = 'series';
    }
  }

  if (flowType !== 'series') {
    return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
  }

  if (req.method === 'POST') {
    const parsed = parseClosureFromBody(req.body?.closure || {});
    if (!parsed) {
      return res.render('site/clinics/series/clinic-closures-form', {
        mode: 'add',
        closure: toClosureFormInput(req.body?.closure || {}),
        actionHref: `/site/${req.site_id}/clinics/clinic-closures/add`,
        error: 'Enter valid closure start and end dates'
      });
    }

    req.session.data.newSession.closures = req.session.data.newSession.closures || [];
    req.session.data.newSession.closures.push(parsed);
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  return res.render('site/clinics/series/clinic-closures-form', {
    mode: 'add',
    closure: toClosureFormInput({
      name: '',
      startDate: { day: '', month: '', year: '' },
      endDate: { day: '', month: '', year: '' }
    }),
    actionHref: `/site/${req.site_id}/clinics/clinic-closures/add`
  });
});

router.all('/site/:id/clinics/clinic-closures/:index/change', (req, res) => {
  ensureCreateSession(req.session.data);
  let flowType = clinicFlowType(req.session.data);

  if (flowType !== 'series') {
    const postedType = normalizeSessionType(req.body?.newSession?.type);
    if (postedType === 'Clinic series') {
      req.session.data.newSession = req.session.data.newSession || {};
      req.session.data.newSession.type = 'Clinic series';
      flowType = 'series';
    }
  }

  if (flowType !== 'series') {
    return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
  }

  const index = Number(req.params.index);
  const closures = req.session.data.newSession.closures || [];
  const current = closures[index];

  if (!Number.isInteger(index) || index < 0 || !current) {
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  if (req.method === 'POST') {
    const parsed = parseClosureFromBody(req.body?.closure || {});
    if (!parsed) {
      return res.render('site/clinics/series/clinic-closures-form', {
        mode: 'change',
        closure: toClosureFormInput(req.body?.closure || toEditableClosure(current)),
        actionHref: `/site/${req.site_id}/clinics/clinic-closures/${index}/change`,
        error: 'Enter valid closure start and end dates'
      });
    }

    closures[index] = parsed;
    req.session.data.newSession.closures = closures;
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  return res.render('site/clinics/series/clinic-closures-form', {
    mode: 'change',
    closure: toClosureFormInput(toEditableClosure(current)),
    actionHref: `/site/${req.site_id}/clinics/clinic-closures/${index}/change`
  });
});

router.all('/site/:id/clinics/clinic-closures/:index/remove', (req, res) => {
  ensureCreateSession(req.session.data);
  let flowType = clinicFlowType(req.session.data);

  if (flowType !== 'series') {
    const postedType = normalizeSessionType(req.body?.newSession?.type);
    if (postedType === 'Clinic series') {
      req.session.data.newSession = req.session.data.newSession || {};
      req.session.data.newSession.type = 'Clinic series';
      flowType = 'series';
    }
  }

  if (flowType !== 'series') {
    return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
  }

  const index = Number(req.params.index);
  const closures = req.session.data.newSession.closures || [];
  const current = closures[index];

  if (!Number.isInteger(index) || index < 0 || !current) {
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  if (req.method === 'POST') {
    closures.splice(index, 1);
    req.session.data.newSession.closures = closures;
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  return res.render('site/clinics/series/clinic-closures-remove', {
    index,
    closure: current
  });
});

router.all('/site/:id/clinics/check-answers', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  res.render(`site/clinics/${flowType}/check-answers`);
});

router.all('/site/:id/clinics/process-new-session', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const newSession = ensureCreateSession(data);

  if (!newSession) {
    return res.redirect(`/site/${site_id}/clinics?new-session=false`);
  }

  const recurringSession = buildRecurringSessionModel(newSession);
  if (data.editingSessionId) {
    recurringSession.id = data.editingSessionId;
  }
  persistRecurringSession(data, site_id, recurringSession);
  delete data.newSession;
  delete data.editingSessionId;

  res.redirect(`/site/${site_id}/clinics/success`);
});

router.get('/site/:id/clinics/success', (req, res) => {
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.render('site/clinics/series/success');
  }

  res.render(`site/clinics/${flowType}/success`);
});

// Legacy create-availability URLs
router.get('/site/:id/create-availability', (req, res) => res.redirect(`/site/${req.site_id}/clinics`));
router.all('/site/:id/create-availability/type-of-session', (req, res) => res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`));
router.all('/site/:id/create-availability/dates', (req, res) => res.redirect(`/site/${req.site_id}/clinics/details`));
router.all('/site/:id/create-availability/days', (req, res) => res.redirect(`/site/${req.site_id}/clinics/days`));
router.all('/site/:id/create-availability/time-and-capacity', (req, res) => res.redirect(`/site/${req.site_id}/clinics/clinic-times`));
router.all('/site/:id/create-availability/services', (req, res) => res.redirect(`/site/${req.site_id}/clinics/services`));
router.all('/site/:id/create-availability/clinic-closures', (req, res) => res.redirect(`/site/${req.site_id}/clinics/clinic-closures`));
router.all('/site/:id/create-availability/check-answers', (req, res) => res.redirect(`/site/${req.site_id}/clinics/check-answers`));
router.all('/site/:id/create-availability/process-new-session', (req, res) => res.redirect(`/site/${req.site_id}/clinics/process-new-session`));
router.get('/site/:id/create-availability/success', (req, res) => res.redirect(`/site/${req.site_id}/clinics/success`));

router.get('/site/:id/debug/recurring-expansion', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const recurringSessions = data?.recurring_sessions?.[site_id] || {};
  const records = Object.values(recurringSessions);

  const requestedId = req.query.id;
  const selected = records.find((session) => session.id === requestedId) || records[0] || null;
  const expandedDates = [];

  if (selected) {
    for (const [date, day] of Object.entries(res.locals.dailyAvailability || {})) {
      const hasMatch = (day.sessions || []).some((session) => session.recurringId === selected.id);
      if (hasMatch) expandedDates.push(date);
    }
  }

  expandedDates.sort();

  res.render('site/debug/recurring-expansion', {
    sessionCount: records.length,
    selected,
    expandedDates,
    selectedJson: selected ? JSON.stringify(selected, null, 2) : ''
  });
});


// -----------------------------------------------------------------------------
// VIEW AVAILABILITY
// -----------------------------------------------------------------------------
router.get('/site/:id/availability/day', (req, res) => {
  const date = req.query.date || getToday();

  res.render('site/availability/day', {
    date,
    today: getToday(),
    tomorrow: DateTime.fromISO(date).plus({ days: 1 }).toISODate(),
    yesterday: DateTime.fromISO(date).minus({ days: 1 }).toISODate()
  });
});

router.get('/site/:id/availability/week', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const startFromDate = req.query.date || getToday();
  const today = getToday();

  //return dates for the week containing 'date'
  const week = [];
  const dt = DateTime.fromISO(startFromDate);
  const startOfWeek = dt.startOf('week'); //assuming week starts on Monday
  for (let i = 0; i < 7; i++) {
    week.push(startOfWeek.plus({ days: i }).toISODate());
  }

  //return previous and next week dates
  const previousWeek = {
    start:startOfWeek.minus({ days: 7 }).toISODate(), //previous Monday
    end: startOfWeek.minus({ days: 1 }).toISODate() //previous Sunday
  }
  const nextWeek = {
    start: startOfWeek.plus({ days: 7 }).toISODate(), //next Monday
    end: startOfWeek.plus({ days: 13 }).toISODate() //next Sunday
  }

  const weekDays = buildWeekAvailabilitySummary(
    week,
    res.locals.dailyAvailability,
    res.locals.slots,
    data.services || {},
    data?.bookings?.[site_id] || {},
    site_id,
    today,
    data?.recurring_sessions?.[site_id] || {}
  );

  res.render('site/availability/week', {
    date: startFromDate,
    today,
    week,
    weekDays,
    previousWeek,
    nextWeek
  });
});

router.get('/site/:id/availability/month', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const today = getToday();
  const monthData = buildMonthWeekRanges(req.query.date || today);
  const recurringSessions = data?.recurring_sessions?.[site_id] || {};
  const monthWeeks = buildMonthAvailabilitySummary(
    monthData.weeks,
    res.locals.dailyAvailability,
    res.locals.slots,
    data.services || {},
    data?.bookings?.[site_id] || {},
    site_id,
    today,
    recurringSessions
  );

  res.render('site/availability/month', {
    currentDate: monthData.currentDate,
    previousMonthDate: monthData.previousMonthDate,
    nextMonthDate: monthData.nextMonthDate,
    monthWeeks
  });
});

router.get('/site/:id/availability/all', (req, res) => { 
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.get('/site/:id/availability/all/:groupId', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

// -----------------------------------------------------------------------------
// REMOVE GROUP or SESSION
// -----------------------------------------------------------------------------
router.all('/site/:id/remove/:itemId', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.all('/site/:id/remove/:itemId/do-you-want-to-cancel-bookings', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.all('/site/:id/remove/:itemId/check-answers', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.all('/site/:id/remove/:itemId/success', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

// -----------------------------------------------------------------------------
// CONFIRM REMOVE
// -----------------------------------------------------------------------------
router.get('/site/:id/remove/:itemId/confirm-remove', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

// -----------------------------------------------------------------------------
// CHANGE GROUP
// -----------------------------------------------------------------------------

router.all('/site/:id/change/group/:itemId', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.all('/site/:id/change/group/:itemId/:step', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

// -----------------------------------------------------------------------------
// EXPORT ROUTER
// -----------------------------------------------------------------------------
module.exports = router;
