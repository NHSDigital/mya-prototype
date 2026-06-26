# Affected bookings logic

## Rule

A booking is affected only if its exact booked slot no longer survives after the edit.

Exact slot means:

- same date
- same start time
- same service support
- enough remaining capacity

## Included bookings

| Booking status | Check? |
| -------------- | ------ |
| `scheduled`    | Yes    |
| `cancelled`    | No     |
| `orphaned`     | No     |

## Changes that do not affect bookings

| Change                                     | Affected? |
| ------------------------------------------ | --------- |
| clinic name / label only                   | No        |
| add capacity                               | No        |
| add services                               | No        |
| extend range without removing booked slots | No        |

## Changes that may affect bookings

| Change                  | Why                                     |
| ----------------------- | --------------------------------------- |
| reduce capacity         | fewer surviving places                  |
| change slot length      | booked start time may disappear         |
| change start / end time | booked slot may disappear               |
| change single date      | booked occurrence may disappear         |
| change series days      | booked occurrence may disappear         |
| shorten date range      | booked occurrence may disappear         |
| remove services         | booked service may disappear            |
| add closures            | booked occurrence may disappear         |
| child-session override  | booked slot/service/capacity may change |

## Capacity rule

If a slot survives but capacity is reduced:

- keep earliest bookings
- affect the rest

Current tie-break:

- lowest booking id first
