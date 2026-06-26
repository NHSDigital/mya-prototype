## Why this journey exists

A recurring series is mostly regular, but individual days differ — a one-off shorter session, a
different set of services. This journey changes a **single occurrence** without disturbing the
rest of the series.

## Key decisions

- Changing one occurrence records an **exception against the series** rather than editing a
  first-class object, so the underlying pattern is preserved.
- Because of that, the **date cannot be changed** here (there is no date field) — to move a clinic
  you cancel the occurrence and create another. A standalone single clinic mistakenly entered here
  is handed off to the "Change a clinic" journey instead.

> Note: the example occurrence id in `map.json` (`080f4e5e322ce5bf`) is derived from the seed
> data's "today"-relative dates and is a snapshot. Refresh it and re-capture if the dates move.
