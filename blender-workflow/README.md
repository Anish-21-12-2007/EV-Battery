# Blender assets and generators

The current Aeris GT source is `../assets/vehicle/ev-ems-gt.blend` and the website loads `../assets/vehicle/ev-ems-gt.glb`. See [the vehicle workflow](../assets/vehicle/README.md) for rebuilding, semantic part names, the animated drivetrain and limitations. `scripts/build_ev_ems_gt.py` uses the original detail generator with new continuous coachwork and a separated mechanical rig.

`output/ecs-battery-assembly.glb`, `output/ev-vehicle-assembly.glb`, `output/ecs-gt-complete-car.blend`, and `output/inspected-assembly.blend` are retained original source assets. Their electrical wiring metadata predates the current 60-row engineering handoff. They are distinct historical evidence and are not loaded as the current physical circuit.

The original `generate_ecs_assembly.py`, `generate_ev_assembly.py` and `assembly_reference.py` are historical generators. They expect the inputs in `hardware-validation/` and can regenerate model metadata that does not match the final engineering package. The interactive engineering lab uses the unchanged final package directly; the Aeris GT geometry represents the independent software scenario.
