# Automated Journey Variant Capture

This repo includes a first-pass automation scaffold for capturing documentation screenshots from deterministic variant states.

## Current scope

- Step: change clinic series -> success
- Step version: v3
- Manifest: `docs/doc-variants/change-clinic-series-success.json`
- Fixture source: `app/data/doc-variants/clinic-edit-success.js`

## Why this pattern

The same variant ids are used for:

1. Previewing a specific success page state in the prototype.
2. Capturing screenshots into the map step screenshot folder.
3. Validating that map step variants still have manifest coverage.

This reduces drift between route logic, screenshots, and map docs.

## Implementation notes: success variant content matrix

Template source: `app/views/site/clinics/edit/success.html`

Fixture source: `app/data/doc-variants/clinic-edit-success.js`

Across all variants, these blocks always render:

- panel via `panel({ titleText: ... })`
- `What would you like to do next?` heading and next-actions list

The table below shows the variant situation and which conditional markup is expected.

| Variant id | Situation | Content markup shown |
| --- | --- | --- |
| `keep-bookings` (`updated-default`) | Clinic updated with no cancelled bookings and no unaffected child clinics. | Uses the non-cancellation branch (`{% else %}` of `if cancelSummary`). Does **not** render `if unaffectedChildClinics and unaffectedChildClinics.length`. |
| `unaffected-time-single` (`updated-unaffected-time-single`) | Clinic updated with no cancelled bookings, and one child clinic not updated because times were already changed. | Uses non-cancellation branch plus unaffected block: `if unaffectedChildClinics and unaffectedChildClinics.length`. Reason text resolves to `start and end times` (`unaffectedChildReasonText`). |
| `unaffected-vaccinators-single` (`updated-unaffected-vaccinators-single`) | Clinic updated with no cancelled bookings, and one child clinic not updated because vaccinators were already changed. | Uses non-cancellation branch plus unaffected block: `if unaffectedChildClinics and unaffectedChildClinics.length`. Reason text resolves to `vaccinators` (`unaffectedChildReasonText`). |
| `cancel-bookings` (`updated-cancelled`) | Clinic updated and bookings cancelled; everyone notifiable has been notified. | Uses cancellation branch (`{% if cancelSummary %}`), renders cancellation panel and notification paragraph. Does **not** render unnotified block (`cancelSummary.unnotifiedCount > 0` is false). Does **not** render unaffected block. |
| `cancel-unnotified` (`updated-cancelled-unnotified`) | Clinic updated and bookings cancelled; some people could not be notified. | Uses cancellation branch and renders unnotified block (`if cancelSummary.unnotifiedCount > 0`), including the “not been notified” heading and list link. Does **not** render unaffected block. |
| `cancel-unnotified-unaffected` (`updated-cancelled-unnotified-unaffected`) | Clinic updated and bookings cancelled; some people could not be notified; some child clinics were not updated. | Uses cancellation branch and renders both conditional blocks: unnotified (`if cancelSummary.unnotifiedCount > 0`) and unaffected child clinics (`if unaffectedChildClinics and unaffectedChildClinics.length`). Reason text resolves to `services` (`unaffectedChildReasonText`). |

Notes:

- This journey supports one change at a time, so there is no reachable “all-fields changed” unaffected-child state.
- For unaffected-child content, the key copy line is: `These clinics were not changed because you have already changed their {{ unaffectedReason }}.`

## Preview a single variant in browser

Use the success route with the doc variant preview feature enabled:

- `/site/1/clinics/edit/1/success?features=docVariantPreview:on&docVariant=updated-default`

If a variant id is unknown, the route returns HTTP 400 with the list of available ids.

## Capture screenshots

1. Start the prototype app.
2. Run:

```bash
npm run docs:variants:capture
```

Optional flags:

```bash
node scripts/capture-doc-variants.js --dry-run
node scripts/capture-doc-variants.js --id keep-bookings
node scripts/capture-doc-variants.js --base-url http://localhost:2001
node scripts/capture-doc-variants.js --manifest docs/doc-variants/change-clinic-series-success.json
```

Base URL notes:

- Default base URL is `http://localhost:2001` (works with `npm start` in this repo).
- If you run the app without BrowserSync (for example `npm run start:app`), use `--base-url http://localhost:3000`.
- You can also set `DOC_CAPTURE_BASE_URL` to override the default.

## Validate manifest coverage

Run:

```bash
npm run docs:variants:validate
```

This validates:

- manifest structure
- unique ids and screenshot paths
- manifest docVariant ids against fixture ids
- map step coverage for mapped variant ids

To also require screenshot files to exist:

```bash
node scripts/validate-doc-variants.js --require-screenshots
```
