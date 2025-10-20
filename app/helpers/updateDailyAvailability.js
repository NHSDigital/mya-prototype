const { DateTime } = require('luxon');

/*
example input:
{
    "type": "Weekly repeating",
    "startDate": {
        "day": "1",
        "month": "12",
        "year": "2025"
    },
    "endDate": {
        "day": "31",
        "month": "12",
        "year": "2025"
    },
    "days": [
        "Monday",
        "Tuesday",
        "Wednesday"
    ],
    "startTime": {
        "hour": "10",
        "minute": "00"
    },
    "endTime": {
        "hour": "14",
        "minute": "00"
    },
    "capacity": "1",
    "duration": "10",
    "services": [
        "FLU:18-64",
        "FLU:65+"
    ]
}
*/

/* example output:
[
  {
    "date": "2025-12-01",
    "site_id": 1,
    "sessions": [
      {
        "from": "10:00",
        "until": "14:00",
        "services": [
          "FLU:18-64",
          "FLU:65+"
        ],
        "slotLength": 10,
        "capacity": 1
      }
    ]
  }, { ...etc }
]
*/

/**
 * 
 * @param {object} newSession - new session object from create session form
 * @param {array} existingSessions - existing sessions to check for conflicts
 */
module.exports = (newSession, existingSessions, site_id = 1) => {
  
  //convert start and end dates to ISO strings
  newSession.startDate = DateTime.fromObject({
    day: parseInt(newSession.startDate.day, 10),
    month: parseInt(newSession.startDate.month, 10),
    year: parseInt(newSession.startDate.year, 10)
  }).toISODate();

  newSession.endDate = DateTime.fromObject({
    day: parseInt(newSession.endDate.day, 10),
    month: parseInt(newSession.endDate.month, 10),
    year: parseInt(newSession.endDate.year, 10)
  }).toISODate();

  //break session into days
  const daily_availability = existingSessions || {};
  const startDate = DateTime.fromISO(newSession.startDate);
  const endDate = DateTime.fromISO(newSession.endDate);

  console.log('Updating daily availability from', startDate.toISODate(), 'to', endDate.toISODate());

  for (let dt = startDate; dt <= endDate; dt = dt.plus({ days: 1 })) {
    //check if day of week is included
    const dayName = dt.toFormat('cccc');
    if (!newSession.days.includes(dayName)) continue;

    //create a new session object for this date
    const newSessionObject = {
      from: `${newSession.startTime.hour}:${newSession.startTime.minute}`,
      until: `${newSession.endTime.hour}:${newSession.endTime.minute}`,
      services: newSession.services,
      slotLength: newSession.duration,
      capacity: newSession.capacity
    };

    //check for existing availability on this date
    if (daily_availability[dt.toISODate()]) {
      //append new session to existing date
      daily_availability[dt.toISODate()].sessions.push(newSessionObject);
    } else {
      //create new date with this session
      daily_availability[dt.toISODate()] = {
        date: dt.toISODate(),
        site_id: site_id,
        sessions: [newSessionObject]
      };
    }

  }
  console.log(daily_availability);
  return daily_availability;
}