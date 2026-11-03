"""Dependency-free integrity check of the shipped vehicle GLB and public rig."""
import json
import math
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"assets"/"vehicle"
raw=(OUT/"ev-ems-gt.glb").read_bytes()
magic,version,total=struct.unpack_from("<4sII",raw)
assert magic==b"glTF" and version==2 and total==len(raw)
json_length,json_type=struct.unpack_from("<II",raw,12)
assert json_type==0x4e4f534a
doc=json.loads(raw[20:20+json_length])
bin_offset=20+json_length
bin_length,bin_type=struct.unpack_from("<II",raw,bin_offset)
assert bin_type==0x004e4942
binary=raw[bin_offset+8:bin_offset+8+bin_length]
assert not any("uri" in b for b in doc["buffers"])
by_name={n.get("name"):n for n in doc["nodes"]}
required=["Body","Glass","Interior","Battery","Motor","Inverter","DCDC","Charger","Cooling","Headlights","Taillights","CabinLights","Infotainment","Chassis","MotorStator","MotorRotor","GearIntermediate","Differential","DriveShaft_L","DriveShaft_R","Wheel_FL","Wheel_FR","Wheel_RL","Wheel_RR"]
assert all(n in by_name for n in required)
for n in required:
    assert by_name[n].get("children"), n+" has no geometry"
for name,expected in {"MotorRotor":[1.48,.49,-.05],"GearIntermediate":[1.32,.49,-.05],"Differential":[1.32,.31,-.05],"Wheel_RL":[1.32,.31,-.78]}.items():
    actual=by_name[name].get("translation",[0,0,0])
    assert all(abs(a-b)<1e-5 for a,b in zip(actual,expected)), (name,actual,expected)
materials=doc["materials"]
def group_materials(name):
    result=[]
    for i in by_name[name]["children"]:
        node=doc["nodes"][i]
        if "mesh" not in node: continue
        for primitive in doc["meshes"][node["mesh"]]["primitives"]:
            result.append(materials[primitive["material"]]["name"])
    return result
for name in ("Wheel_FL","Wheel_FR","Wheel_RL","Wheel_RR"):
    assert "GT_rotor" in group_materials(name), name+" does not contain its brake disc"
    assert "GT_caliper" not in group_materials(name), name+" incorrectly rotates its caliper"
assert "GT_caliper" in group_materials("Chassis")
float_components=0
for accessor in doc["accessors"]:
    if accessor["componentType"]!=5126 or "bufferView" not in accessor:continue
    view=doc["bufferViews"][accessor["bufferView"]]
    n={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}[accessor["type"]]
    start=view.get("byteOffset",0)+accessor.get("byteOffset",0)
    stride=view.get("byteStride",n*4)
    assert start+(accessor["count"]-1)*stride+n*4 <= len(binary)
    for i in range(accessor["count"]):
        values=struct.unpack_from("<"+"f"*n,binary,start+i*stride)
        assert all(math.isfinite(v) for v in values)
    float_components += accessor["count"]*n
triangles=sum(doc["accessors"][p["indices"]]["count"]//3 for m in doc["meshes"] for p in m["primitives"])
manifest=json.loads((OUT/"model-manifest.json").read_text())
assert triangles==manifest["triangles"]
result={"passed":True,"format":"glTF 2.0 binary, self-contained","bytes":len(raw),"triangles":triangles,"meshes":len(doc["meshes"]),"nodes":len(doc["nodes"]),"float_components_checked":float_components,"required_groups":required,"checks":["GLB chunk lengths","no external buffers","required semantic groups","mechanical pivots","rotating discs and stationary calipers","finite vertex/normal values","triangle count agrees with manifest"],"scope":"Software asset integrity only, not physical engineering validation"}
(OUT/"glb-validation.json").write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
