# 3D electrical circuit lab

The first Engineering lab tab loads `assets/circuit/circuit-lab.glb`, generated with Blender by `blender-workflow/scripts/build_circuit_lab.py`. The matching `.blend` contains editable source geometry and a static curved-wire assembly. Runtime wires are rebuilt from the authoritative `wiring_connections.csv` so they remain attached when components move.

## Source contract

- 60 source wire records; 33 connected components; 87 logical terminal anchors.
- 36 component groups include the disconnected RP1, D1 and quantity-zero RLY1 audit objects.
- Exact source IDs, endpoint names, source statuses and evidence/conditions are retained.
- The manifest and actual GLB terminal transforms are compared at load time. A missing component/contact fails explicitly rather than silently drawing a partial confirmed circuit.
- Candidate ESP32, ACS712, LM2596, OLED and DS18B20 appearances are illustrations. The engineering package does not identify installed carrier/module revisions, physical pin order, dimensions or usable battery capacity.
- Colours, cable thickness and scene spacing are presentation choices, not approved insulation colours, gauges, conductor lengths or fabrication dimensions.

## Inspect the assembly

Drag to orbit, right-drag to pan and scroll/pinch to zoom. Use the component menu or select a modeled part. The inspector shows the original BOM specification and status, physical-placement uncertainty and incident connections. Use **Move** or **Rotate** to manipulate its axes, or apply numeric offsets. **Hide**, **Reveal**, **Reset component**, **Assembled**, **Exploded** and **Restore assembly** support inspection without modifying the engineering design.

Select a wire directly or from the wire menu. Its complete tube becomes highlighted and both contact endpoints are marked. The inspector lists source/destination terminals and the original condition. Optional and unresolved paths have visible status treatment; crossings do not create junctions. Labels can be switched between components, terminals and none for dense areas.

The source omits a scheduled TVS anode return and full RP1 insertion. The optional temperature pullup needs a scheduled part and endpoints. Motor suppression D1 depends on the unselected driver topology. RLY1 has quantity zero. No extra connection is silently added to any of these.

## Electrical schematic

`circuit-schematic.js` generates conventional symbols from the same 60 rows. Each repeated N label identifies an electrical net. BUS+ terminals join through the documented distribution rail; quiet and star grounds join through explicit W053. Resistors, fuses, switches and device interiors are not treated as short-circuit wires. Symbol pins carry wire IDs and the connection index exposes the source status. The generated diagram has separate zoom controls. The original package drawing remains available below it.

W053 does not establish a unique physical ground tie: with a non-isolated buck, W016, the internal OUT−/IN− connection, W014 and W052 provide a parallel path. The inspector and architecture now flag this and other source contradictions. The [independent electrical audit](docs/advanced-circuit-audit.md) supplements the unchanged source records.

## Separate hardware proposal

The Hardware proposal tab loads [revision-b.json](hardware/revision-b.json). It specifies candidate digital INA219 branch sensing and USB-only ESP32 power, plus exact small motor/lamp and on/off driver candidates. Its proposed connection schedule has B-prefixed IDs, distinct from the inherited W-prefixed source model. The [build proposal](docs/hardware-build-proposal.md) states component links, reference pin names, measurement losses, staged commissioning and unresolved supply/protection/wiring requirements. This is not a qualified battery circuit, and the source 3D appearance does not depict revision B's purchased modules.

## Verification boundary

Software tests compare all original endpoints, actual exported contact positions, route endpoints after inspection transforms, selectors, visibility, resets and scene controls. Conventional net tests check isolation across the battery and dividers and the explicit ground tie. Browser tests and screenshots verify rendering and responsive layouts. These tests do not identify installed hardware, establish ratings, calibrate sensors or constitute physical circuit testing.
