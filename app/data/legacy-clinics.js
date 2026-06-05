const { DateTime } = require('luxon');

const today = DateTime.now().startOf('day');

module.exports = Array.from({ length: 23 }, (_, index) => {
  const date = today.plus({ days: index }).toISODate();

  return {
    label: `Legacy clinic ${index + 1}`,
    startDate: date,
    endDate: date,
    from: '10:00',
    until: '14:00',
    slotLength: 15,
    services: ['COVID:18+'],
    capacity: 1,
    legacy: true
  };
});
    