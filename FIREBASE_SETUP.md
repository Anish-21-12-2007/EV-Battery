# Firebase authentication and telemetry

The web client signs in through Firebase Email/Password Authentication and reads the Realtime Database path `readings/latest`. It does not write data. Authentication, RTDB connectivity, the presence of a record, and physical publisher identity are separate facts.

## Current behavior

- An authorized Firebase account is required before RTDB subscriptions start.
- The browser reads `readings/latest` and `.info/connected` only. Sign-out detaches listeners and clears displayed data.
- Missing configuration or SDK/network access, permission denial, disconnection, missing data, invalid data and stale data produce distinct status text.
- A record older than five minutes is labeled stale. This is a display rule, not a device-heartbeat specification.
- `source: "esp32"` is a database value. The client cannot establish that a physical ESP32 published it or that its values are accurate.
- The website never creates substitute hardware readings.
- After reconnecting, the last accepted record is restored with its current freshness label even if Firebase does not resend an unchanged value. It is never relabeled as a new measurement.

## Record schema

Required fields:

| Field | Requirement |
| --- | --- |
| `voltage` | Finite number ≥ 0; aggregate supply/battery field |
| `current` | Finite number ≥ 0; aggregate current field |
| `power` | Finite number ≥ 0; aggregate power supplied by the record |
| `energyWh` | Finite number ≥ 0; cumulative energy supplied by the record |
| `timestamp` | Integer Unix time in milliseconds; not before 2000 and no more than five minutes in the future |
| `source` | Exactly `"esp32"` (label only; not proof of physical origin) |

Optional fields:

| Field | Requirement / display rule |
| --- | --- |
| `temperatureC` | Finite number from −100 through 200; absent is N/A, malformed rejects the record |
| `motorOn` | Boolean; read-only display only, never an actuator |
| `lightVoltageV`, `lightCurrentA` | Each finite and ≥ 0. Light power is computed as V × I only if both are present |
| `motorVoltageV`, `motorCurrentA` | Each finite and ≥ 0. Motor power is computed as V × I only if both are present |

Example payload *shape only* (not real readings):

```json
{
  "voltage": 0,
  "current": 0,
  "power": 0,
  "energyWh": 0,
  "timestamp": 1762041600000,
  "source": "esp32"
}
```

The example's zeros describe field types, not a measured or published record. Firmware must document the measurement boundaries, units, calibration, sampling and energy integration. A single upstream current sensor cannot split simultaneous Light and Motor load current. Individual branch power requires a current sensor and same-boundary voltage measurement for each branch, sampled close enough in time for the intended accuracy. Total power is the sum of synchronized branch powers only when both branches are available; otherwise the page labels `power` as the reported aggregate value.

Validation also rejects nonfinite derived branch products or sums. It does not force aggregate `power` to equal `voltage × current`: the source may provide an averaged instantaneous product or use a different declared boundary. The schema alone does not establish either derivation or measurement correctness.

## Console setup

1. Enable Email/Password sign-in and create intended user accounts in Firebase Authentication.
2. Review deployed RTDB security rules. No rule is changed by this project. The following example permits authenticated reads and denies client writes at the telemetry path; adapt it to your access policy before publishing:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "readings": {
      "latest": {
        ".read": "auth != null",
        ".write": false
      }
    }
  }
}
```

This example grants read access to every authenticated account. Do not use it if access must be restricted further. A device writer needs its own secure authentication path; do not place service-account credentials or privileged database secrets in browser code.

3. Confirm the existing Web App configuration in `firebase-config.js` belongs to the intended project. The file uses Firebase SDK 10.11.0 from the official CDN; a blocked CDN is reported in the UI.
4. Serve the project over HTTP and check the browser console for Firebase SDK diagnostics.

Firebase Web App configuration is client-visible and is not a service-account secret. Database rules and Authentication must enforce access.

## Verification boundary

Software validation can exercise schema handling and UI states with local fixtures. It cannot prove deployed rules, real account access, sensor calibration, physical publisher provenance, branch wiring or electrical safety. Sign-in, live RTDB reads, writes and physical ESP32 measurements were not performed as part of this implementation.
