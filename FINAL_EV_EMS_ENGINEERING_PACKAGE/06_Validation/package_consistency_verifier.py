import csv
import json
from pathlib import Path

pkg_root = Path(__file__).resolve().parent.parent

# 1. Verify BOM and Netlist referential integrity
with open(pkg_root / "02_Component_Details/component_list.csv", encoding="utf-8") as f:
    bom_rows = list(csv.DictReader(f))
bom_ids = {r["ID"].strip() for r in bom_rows}

with open(pkg_root / "03_Circuit_Design/wiring_connections.csv", encoding="utf-8") as f:
    wire_reader = csv.DictReader(f)
    assert "evidence_or_condition" in wire_reader.fieldnames, "Header typo not fixed!"
    wire_rows = list(wire_reader)

missing_src = {r["source_component"].strip() for r in wire_rows} - bom_ids
missing_dst = {r["destination_component"].strip() for r in wire_rows} - bom_ids
assert not missing_src, f"Unresolved source components in netlist: {missing_src}"
assert not missing_dst, f"Unresolved destination components in netlist: {missing_dst}"

# 2. Verify SVG schematics contain key upgraded designators and wire IDs
schem_svg = (pkg_root / "03_Circuit_Design/2D_circuit_schematic.svg").read_text(encoding="utf-8")
for token in ["JGND.STAR_RETURN", "JGND.LOGIC_GND", "W053", "W014", "W016", "U_I_L", "M1 DC Motor", "NODE_VL", "NODE_IM", "NODE_VM", "TVS1", "RP1"]:
    assert token in schem_svg, f"Missing {token} in 2D_circuit_schematic.svg"

# 3. Verify calculation_results.json exists and matches key values
calc = json.loads((pkg_root / "06_Validation/calculation_results.json").read_text(encoding="utf-8"))
assert abs(calc["voltage_divider_per_load"]["node_at_18v_nominal_v"] - 18.0 * 10 / 78) < 1e-12
assert abs(calc["current_divider"]["plus_30a_nominal_adc_node_v"] - (2.5 + 30 * 0.066) * 20 / 47) < 1e-12

print(f"PACKAGE CONSISTENCY VERIFIED: {len(bom_rows)} BOM items, {len(wire_rows)} netlist wires, 0 unresolved endpoints.")
