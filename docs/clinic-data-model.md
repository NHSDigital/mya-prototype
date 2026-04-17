# Clinic Data Model Reference

This file is the shared source of truth for clinic data used by the create flow and persistence layer.

## 1) Create Flow Draft (`data.newSession`)

Used while stepping through the create journey forms.

```json
{
  "name": "string",
  "type": "Clinic series | Single clinic",
  "startDate": { "day": "string", "month": "string", "year": "string" },
  "endDate": { "day": "string", "month": "string", "year": "string" },
  "singleDate": { "day": "string", "month": "string", "year": "string" },
  "days": ["Monday", "Tuesday"],
  "startTime": { "hour": "string", "minute": "string" },
  "endTime": { "hour": "string", "minute": "string" },
  "capacity": "string-or-number",
  "duration": "string-or-number",
  "services": ["serviceId1", "serviceId2"]
}
```

## 2) Persisted Clinic Record (`data.recurring_sessions[site_id][id]`)

Used as the stored clinic model.

```json
{
  "id": "string",
  "label": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "recurrencePattern": {
    "frequency": "Weekly",
    "interval": 1,
    "byDay": ["Monday", "Thursday"]
  },
  "from": "HH:mm",
  "until": "HH:mm",
  "slotLength": 10,
  "services": ["serviceId1", "serviceId2"],
  "capacity": 1,
  "childSessions": [
    {
      "date": "YYYY-MM-DD",
      "from": "HH:mm" || undefined,
      "until": "HH:mm" || undefined,
      "services": [
        {
          "operation": "add",
          "service": "serviceId"
        },
        {
          "operation": "remove",
          "service": "serviceId"
        }
      ] || undefined,
      "capacity": 1 || undefined
    }
  ],
  "closures": [
    //1: single day closure
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "label": "Optional"
    },


    //2: date range closure
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "label": "Optional"
    }
  ]
}
```

## 3) Agreed Rules

- `closures` always override `childSessions`.
- Child session is single-per-date (no nested `sessions` array).
- Service operations use service IDs.
- Time overrides require both `from` and `until` together.
- Child session does not support `slotLength` override.
- Closure label is optional.

## Source Code Locations

- Create flow model setup: `app/routes/base.js` (`ensureCreateSession`)
- Persisted model mapping: `app/routes/base.js` (`buildRecurringSessionModel`)
- Seeded recurring defaults: `app/data/session-data-defaults.js`
