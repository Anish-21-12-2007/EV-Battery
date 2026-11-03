# EV-EMS 3D physical circuit assembly

`circuit-lab.blend` is the editable Blender source. `circuit-lab.glb` is the optimized web geometry. `circuit-manifest.json` binds each component and each contact to the unchanged final engineering package.

This is the **proposed 12 V educational monitoring circuit**, separate from the software-only 96 V vehicle simulation. The manufacturer and physical identification gaps in the final package prevent an exact model of the installed hardware. The detailed board shapes, dimensions, positions, connector styles, wire colours and wire diameters are illustrative. The geometry does not establish a physical pinout, rating, approved build or completed hardware test.

## Included geometry

The assembly has 33 connected component groups, 87 named logical contacts and all 60 source wire records. Three further objects appear in an unwired reference rack: RP1, D1 and the quantity-zero legacy relay RLY1. The source includes terminal-attached curved wire geometry and identity tags. The web viewer generates those wires again from the same source records so their ends follow component movement and rotation.

Detailed forms include the battery case and binding posts; fuse cartridges and holders; rocker switch; separate positive and star/reference busbars; lamp reflector, diffuser and LED packages; motor can, shaft and mounting feet; ESP32 candidate carrier, USB socket, RF shield, antenna motif and headers; LM2596 candidate converter with toroidal inductor, electrolytics and trimmer; ACS712 candidate module; controller heatsink; ceramic capacitors; five-band resistors; OLED and probe. Unidentified sensor/conditioning modules carry explicit TBD markings. These details illustrate the documented component classes rather than a verified commercial board revision.

The six resistor bodies show the assumed 1% five-band values from the package: 68 kOhm, 10 kOhm, 27 kOhm and 20 kOhm. Fuse ratings remain TBD. The ESP32's separate labelled contact wings are logical anchors, not an asserted development-board header order. S_M represents the IC measurement boundary together with a candidate module form; S_M_BOARD remains separately identified in the BOM as unverified. IC/module pairs are not duplicated as two physical series devices.

## Deliberately incomplete connections

- W060 ends at the proposed TVS cathode. The anode return is mentioned in prose but absent from the CSV, so there is no invented return wire.
- RP1 is an unselected reverse-polarity provision with no scheduled connections.
- D1 depends on the motor-controller topology and has no scheduled connection.
- The optional temperature probe needs the documented 4.7 kOhm pullup; the package has no component ID or wire rows for it. It remains an explicit unresolved item.
- RLY1 has quantity zero and no active connections. The reference object is unwired.

Every displayed wire retains the source status and condition. “Calculated and cross-checked” applies to the stated calculation, not to installed hardware validation. Contact locations and conductor specifications remain unresolved even for those rows.

## Runtime contract

Coordinates are glTF **+Y up**. Blender `(x,y,z)` becomes glTF `(x,z,-y)`. Root scale and rotation are identity. Dimensions use normalized presentation units; they are not measured hardware dimensions. The overall layout is intentionally expanded and small passive parts enlarged for inspection.

Each component root is named by `components[].node` and carries `extras.componentId` with the exact CSV ID. Each terminal is a child empty named by `components[].terminals[].node`, with its logical pin name and local glTF position. Polarity signs are encoded with `_POS` and `_NEG` in node names; consumers must use the manifest mapping. Terminal geometry and labels move with the owning root.

Component/material batching keeps web rendering practical while the `.blend` retains individually editable source objects. The web export excludes the static source wiring, bed, camera and lights. Runtime wiring must use the transformed terminal coordinates, not cached world coordinates after an edit.

## Rebuild and verify

From the project root:

```powershell
blender --background --python blender-workflow/scripts/run_circuit_build.py -- --no-render
blender --background --python blender-workflow/scripts/check_circuit_lab.py
node --test tests/circuit-assets.test.mjs
```

The Microsoft Store installation can use `%LOCALAPPDATA%\Microsoft\WindowsApps\blender-launcher.exe`. On Windows use `Start-Process -WindowStyle Hidden` for a background run. `run_circuit_build.py` captures exceptions in `validation/circuit-build.log` and a completion status. Source validation reopens the saved `.blend`, checks each wire's first/last cross-section centre against the actual contact object, and renders the overview and ESP32 detail. Append `-- --checks-only` to the checker to skip renders.

`source-validation.json` reports model validation only. Unit tests independently read the GLB node hierarchy and unchanged CSV, verify all terminal positions and every connection's evidence/status, and check that unscheduled connections have not been invented.
