# Aeris GT — phase 2 vehicle assembly

The final interactive asset is `ev-ems-gt-phase2.glb`; open `ev-ems-gt-phase2.blend` for its editable Blender source and working mechanical timeline. The saved `ev-ems-gt.blend` remains preserved because it contains the user's phase-1 session. No background build overwrites that file.

This is an original illustrative 2+2 concept coupe, not manufacturer CAD, a production gear design, or the physical 12 V circuit.

## Current files

- `ev-ems-gt-phase2.blend`: editable coachwork, sculpted seats, cabin, display meshes, separate assembly parts, studio and mechanical animation.
- `ev-ems-gt-phase2.glb`: final self-contained web asset with 48 assembly groups, 251 draw meshes and 321,578 triangles; 8,457,760 bytes.
- `model-manifest-phase2.json`: exact group names, pivots, source hash, counts and screen contract.
- `model-validation-phase2.json`: executed seat-fit, screen visibility and source animation checks.
- `poster-phase2.png`: current exterior render and fallback image.
- `interior-window-phase2.png`, `interior-seats-phase2.png`, `interior-rear-phase2.png`: multi-angle cabin inspection renders.
- Files without `phase2` preserve the earlier release and its evidence; the website uses the phase-2 GLB.

## Interior improvements

Four separately editable seats use smooth upholstery lofts, shaped cushions, lumbar inserts, thigh and torso bolsters, tapered back shells, headrests, adjustable posts, stitching, pleats, buckles and floor rails. The rear seats are deliberately shorter and lower for the compact fastback roof. These are low seating 2+2 proportions, not a claim of full-size rear legroom.

The new interior includes a continuous soft-touch dashboard, larger D-shaped steering wheel with switches and paddles, a moulded centre console, cup wells, armrest, drive selector, pedals and two physically mounted display surfaces. Decorative old screen text is removed. Live values are drawn by the website from its existing simulation state.

## Assembly hierarchy

Every assembly component is a sibling at the GLB root. The mesh children carry matching `component_id` metadata. Their original position is the fully assembled pose.

| Groups | Contents and behaviour |
| --- | --- |
| Body, Glass, Interior | Remaining exterior, glazing and cabin structure |
| Bonnet | Curved hood skin, hinge leaves and inner reinforcement ribs |
| Door_L, Door_R | Separate body panels, corresponding glazing, handles, mirrors and door trim |
| Seat_FL, Seat_FR, Seat_RL, Seat_RR | Complete individual seat assemblies |
| Dashboard, CenterConsole, SteeringWheel | Independent cabin components |
| InstrumentCluster, Infotainment | Mounted display assemblies with named UV faces |
| Wheel_FL/FR/RL/RR | Tyres, rims, hubs and visible rotation index marks |
| BrakeDisc_FL/FR/RL/RR | Separate discs and hats; rotate with matching wheel |
| BrakeCaliper_FL/FR/RL/RR | Separate fixed calipers |
| Suspension_FL/FR/RL/RR | Independently movable corner suspension; remains fixed during straight-line wheel animation |
| Battery, Inverter, DCDC, Charger, Cooling | Independently inspectable energy systems |
| Motor, MotorStator | Fixed outer casing and fixed copper/stator components |
| MotorRotor, GearIntermediate, Differential | Separately rotating drivetrain internals |
| DriveShaft_L, DriveShaft_R | Rear rotating CV halfshafts |
| Headlights, Taillights, CabinLights, Harness, Chassis | Optical systems, illustrative harness and remaining structure |

Door origins are at their hinge regions. Bonnet origin is near its rear hinge. Wheel and brake-disc origins coincide with their axle centres. Exact glTF pivots are in the manifest. Root siblings allow the website to attach move/rotate controls and restore individual parts without moving unrelated geometry.

## Screens and texture orientation

| Exact mesh | Parent group | Material | Physical size | Suggested canvas |
| --- | --- | --- | --- | --- |
| Screen_Cluster | InstrumentCluster | Display_Cluster | 0.32 × 0.10 m | 1280 × 400 |
| Screen_Infotainment | Infotainment | Display_Infotainment | 0.28 × 0.175 m | 1024 × 640 |

Both front faces point toward cabin **+X**. The screen planes are 7 mm ahead of the solid bezel fronts so live pixels cannot be occluded by their mounting geometry. They have no transparent cover mesh.

Blender source UV0 is bottom-left (0,0), top-right (1,1). Blender's exporter converts V to glTF convention: in the raw GLB, the physical top-left is (0,0), bottom-left (0,1), top-right (1,0), bottom-right (1,1). Use **CanvasTexture.flipY = false**. The GLB contains tiny blank idle textures; runtime values and device states come entirely from the shared simulator state.

## Coordinates and mechanical playback

Metres throughout. Blender: nose **-X**, width Y, Z up. glTF: nose **-X**, **+Y up**, axle direction Z. Tyre radius is 0.31 m; the contact plane is glTF Y=0.

For a wheel angle `theta = distance / 0.31`, rotate local glTF Z:

- Wheels, brake discs, differential and both halfshafts: `theta`.
- Motor rotor: `8.2 * theta`.
- Intermediate compound shaft: `-3 * theta`.
- Calipers, suspension, motor stator and casing remain fixed.

Two external stages use 41/15 and 60/20 tooth ratios, giving 8.2:1. The source timeline runs frames 1–241 at 24 fps: five wheel turns, 41 motor turns and -15 intermediate turns. These integer turns form a seamless mechanical loop. Press Space over the Blender timeline to play it; index patches make tyre rotation visible. Browser playback uses simulated distance rather than the Blender animation.

This demonstrates straight-line kinematics. It does not simulate tooth stresses, tyre slip, cornering differential action or suspension dynamics. Tooth meshes are visual approximations, not manufacturing involutes.

## Rebuild and validate

From the project root with Blender 5.x:

```powershell
blender --background --python blender-workflow/scripts/build_ev_ems_phase2.py
blender --background --python blender-workflow/scripts/run_phase2_checks.py
```

For quick source checks without new renders, append `-- --checks-only` to the second command. The Microsoft Store installation can use `%LOCALAPPDATA%\Microsoft\WindowsApps\blender-launcher.exe` in place of `blender`. The wrapper preserves a traceback if source validation fails.

Source modules are `build_ev_ems_phase2.py`, `ev_ems_phase2_interior.py` and the retained original geometry/helpers. Phase-1 generation remains reproducible separately. No third-party meshes or textures were used. The authoritative 12 V engineering package is unchanged; vehicle geometry must never be used to infer its wiring, pin positions, fuse ratings or conductor sizing.
