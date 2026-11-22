# EV Battery Monitoring and EMS Dashboard

An interactive, browser-based electric vehicle battery monitoring and energy-management demonstration. The project combines an engineering circuit lab, a vehicle 3D studio, energy calculations, drivetrain scenarios, and hardware documentation in a single local website.

## Features

- Live-style battery state-of-charge, voltage, current, temperature, and range displays
- Interactive engineering circuit and wiring views
- 3D vehicle, powertrain, cabin, and circuit-assembly models
- Driving scenarios and vehicle-energy simulations
- Engineering calculations and verification reports
- Hardware schematics, component lists, and safety documentation
- Fully local Three.js assets; no external CDN is required

## Run the website

Requirements: [Node.js](https://nodejs.org/) 18 or newer.

```powershell
npm start
```

Open <http://127.0.0.1:5500> in a browser.

To use a different port:

```powershell
$env:PORT = 5501
npm start
```

## Project structure

| Path | Description |
| --- | --- |
| `index.html` | Main website entry point |
| `app.js` | Application initialization and shared behavior |
| `engineering-lab.js` | Engineering lab interface |
| `vehicle-studio.js` | 3D vehicle studio interface |
| `ev-simulation-engine.js` | EV and energy-simulation logic |
| `assets/` | 3D models, images, fonts, and circuit assets |
| `vendor/three/` | Locally served Three.js library |
| `FINAL_EV_EMS_ENGINEERING_PACKAGE/` | Engineering package and validation material |
| `hardware-validation/` | Wiring calculations and hardware verification |
| `hardware/` | Hardware revisions and schematics |
| `docs/` | Additional technical documentation |

## Safety notice

This repository is an educational and visualization project. The circuit proposal is not presented as a finished, safety-certified hardware design.

Before working on real battery or high-voltage systems:

- Use the battery manufacturer's approved monitoring system
- Consult a qualified electrical engineer
- Verify component ratings, insulation, fusing, grounding, isolation, and thermal limits
- Perform documented low-voltage and high-voltage testing under controlled conditions
- Never place lithium-ion systems on charge or operate them unsupervised

## Firebase configuration

Optional Firebase settings are documented in [FIREBASE_SETUP.md](FIREBASE_SETUP.md). The Firebase energy-monitor page is not enabled in the current navigation.
