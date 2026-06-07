const registerDateTimeFilters = require('../../app/filters/datetime')

describe('datetime filters', () => {
  test('nhsDateRange formats same-month ranges in NHS style', () => {
    const filters = registerDateTimeFilters({})

    expect(filters.nhsDateRange('2026-06-10', '2026-06-12')).toBe('10 to 12 June 2026')
  })

  test('nhsDateRange formats same-year different-month ranges in NHS style', () => {
    const filters = registerDateTimeFilters({})

    expect(filters.nhsDateRange('2026-10-30', '2026-11-02')).toBe('30 October to 2 November 2026')
  })

  test('nhsDateRange formats cross-year ranges in NHS style', () => {
    const filters = registerDateTimeFilters({})

    expect(filters.nhsDateRange('2026-12-30', '2027-01-02')).toBe('30 December 2026 to 2 January 2027')
  })

  test('nhsDateRange normalizes reversed dates', () => {
    const filters = registerDateTimeFilters({})

    expect(filters.nhsDateRange('2026-06-12', '2026-06-10')).toBe('10 to 12 June 2026')
  })
})
