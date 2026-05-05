# Auto Name Rules

## Rules

1. Input is the selected service IDs only.
2. Group selected services by vaccine (vaccine-first grouping).
3. Keep unique types per vaccine.
4. Type order is always Child, then Adult.
5. Vaccine output order is fixed to match `SERVICE_GROUPS` intent:
	   - Flu
	   - COVID-19
	   - RSV
	   - MenB
6. Per-vaccine phrase format:
	   - child and adult Vaccine (both types present)
	   - child Vaccine (child only)
	   - adult Vaccine (adult only)
	   - Vaccine (no type)
7. Final output is a single comma-separated string of vaccine phrases.

## Service IDs

- COVID:5-11 -> COVID 5 to 11
- COVID:12-17 -> COVID 12 to 17
- COVID:18+ -> COVID 18+
- FLU:2-3 -> Flu 2 to 3
- FLU:18-64 -> Flu 18 to 64
- FLU:65+ -> Flu 65+
- COVID_FLU:18-64 -> COVID and Flu 18 to 64
- COVID_FLU:65+ -> COVID and Flu 65+
- RSV:Adult -> RSV Adult
- RSV_COVID:12-17 -> RSV and COVID 12 to 17
- RSV_COVID:18+ -> RSV and COVID 18+
- MENB:All -> MenB

## Example scenarios

| Example scenario | Selected IDs | Expected Output |
|---|---|---|
| Single vaccine, child only | COVID:12-17 | Child COVID-19 |
| Single vaccine, adult only | FLU:65+ | Adult Flu |
| Single vaccine, both types | COVID:12-17, COVID:18+ | Child and adult COVID-19 |
| Age variants collapse under same type | FLU:18-64, FLU:65+ | Adult Flu |
| Co-admin contributes to both vaccines | COVID_FLU:18-64 | Adult Flu, adult COVID-19 |
| Co-admin + child COVID creates both COVID types | COVID_FLU:18-64, COVID:12-17 | Adult Flu, child and adult COVID-19 |
| RSV single | RSV:Adult | Adult RSV |
| RSV+COVID child | RSV_COVID:12-17 | Child COVID-19, child RSV |
| RSV+COVID adult | RSV_COVID:18+ | Adult COVID-19, adult RSV |
| MenB untyped | MENB:ALL | MenB |
| Mixed all vaccines | FLU:2-3, COVID:18+, RSV:Adult, MENB:ALL | Child Flu, adult COVID-19, adult RSV, MenB |
| Order check with scrambled selection | MENB:ALL, RSV_COVID:18+, COVID:12-17, FLU:65+, FLU:2-3, COVID:18+ | Child and adult Flu, child and adult COVID-19, adult RSV, MenB |
| Child-only vaccines across groups | COVID:5-11, FLU:2-3, RSV_COVID:12-17 | Child Flu, child COVID-19, child RSV |
| Adult-only vaccines across groups | FLU:65+, COVID:18+, RSV:Adult | Adult Flu, adult COVID-19, adult RSV |
| Duplicate coverage via multiple selections | COVID:18+, COVID_FLU:18-64, COVID_FLU:65+ | Adult Flu, adult COVID-19 |

## Notes

- This file is intentionally curated for readability and review.
- If needed, an exhaustive 4095-combination export can be regenerated separately.
