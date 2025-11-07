function removeServicesFromDailyAvailability(daily_availability, removedServices) {
  const updated = {};

  for (const [date, day] of Object.entries(daily_availability)) {
    const remainingServices = day.services.filter(
      s => !removedServices.includes(s)
    );
    updated[date] = { ...day, services: remainingServices };
  }

  return updated;
}

module.exports = removeServicesFromDailyAvailability;