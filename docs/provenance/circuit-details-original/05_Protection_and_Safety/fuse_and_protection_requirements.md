# Fuse and Protection Requirements

**Status:** requirements audit, not selected ratings. No fuse is approved in this package.

## Required fuse locations

| Device | Intended location | Rating status |
|---|---|---|
| F1 main | Battery positive, close to BAT+ | TBD |
| FL Light | Positive bus branch takeoff, before Light wiring/sensor | TBD |
| FM Motor | Positive bus branch takeoff, before motor branch wiring/sensor/driver | TBD |
| F2 electronics | Positive bus branch takeoff, before thin sense and converter wiring | TBD |

Fuse placement protects only the conductors and components downstream when the correct fuse and holder are selected. A fuse does not regulate voltage, suppress motor transients or protect a GPIO from a sensor output fault.

## Required selection data

Do not select from nominal load current alone. Obtain:
- Battery maximum voltage and prospective short-circuit current at each branch.
- Load steady, startup/inrush, stall/locked-rotor and fault current versus time.
- Wire copper area/gauge, strand, insulation, length, routing/bundling, ambient temperature and terminal rating.
- Fuse time-current curve, I²t, DC voltage rating and interrupting/breaking capacity.
- Fuse-holder contact resistance, temperature, enclosure and mounting data.
- Switch and sensor/module series-current limits, if any.
- Coordination with driver protection and charger/regen direction.

Select each fuse to protect the weakest conductor/component while tolerating legitimate operating transients. Confirm interrupting rating exceeds prospective fault current at the actual DC voltage. A generic fuse amperage or an AC rating is not enough. Littelfuse’s fuse guidance explains current rating, time-current behavior, voltage rating, interrupting rating and I²t considerations.

## Project-specific correction

The older project states a 30 A main fuse in one artifact and 1–2 A F2 in another, without source fault current, load profile or conductor coordination. Neither is approved. The latest handoff correctly leaves F1/F2 values TBD. The buck example input of about 0.391 A is not a fuse recommendation.

## Other protection layers

Reverse-polarity protection, overvoltage/transient clamping, sensor powered-off isolation, branch overcurrent coordination, enclosure, strain relief and battery-terminal protection remain open. They must be selected from actual source/load limits; the current schematic intentionally shows no unselected protection part as installed.
