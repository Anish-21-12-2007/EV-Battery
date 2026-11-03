"""Inspect source contacts and wire endpoints, then render assembly/detail QA."""
from pathlib import Path
import bpy, json, csv, math, traceback
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets'/'circuit'
status=ROOT/'validation'/'circuit-source-status.json'
status.write_text(json.dumps({'status':'running'}))
try:
    manifest=json.loads((OUT/'circuit-manifest.json').read_text(encoding='utf-8'))
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'circuit-lab.blend'))
    scene=bpy.context.scene;bpy.context.view_layer.update()
    def blender(v):return Vector((v[0],-v[2],v[1]))
    contacts={}
    errors=[]
    for part in manifest['components']:
        root=bpy.data.objects.get(part['node'])
        assert root and root.get('componentId')==part['id']
        assert (root.location-blender(part['position'])).length<1e-6
        for pin in part['terminals']:
            node=bpy.data.objects.get(pin['node']);assert node and node.parent==root
            assert (node.location-blender(pin['position'])).length<1e-6
            contacts[(part['id'],pin['name'])]=node.matrix_world.translation
    assert len(contacts)==87
    for wire in manifest['wires']:
        objects=[o for o in scene.objects if o.get('wire_id')==wire['wire_id']]
        assert len(objects)==1, wire['wire_id']
        mesh=objects[0];assert mesh.type=='MESH'
        # geo.pipe emits eight vertices in each terminal cross-section. The
        # cross-section's centre must be the true source/destination contact.
        start=sum((mesh.matrix_world@v.co for v in list(mesh.data.vertices)[:8]),Vector())/8
        end=sum((mesh.matrix_world@v.co for v in list(mesh.data.vertices)[-8:]),Vector())/8
        a=contacts[(wire['source_component'],wire['source_terminal'])]
        b=contacts[(wire['destination_component'],wire['destination_terminal'])]
        error=max((start-a).length,(end-b).length);errors.append(error)
        assert error<1e-5,(wire['wire_id'],error)
        assert mesh.get('status')==wire['status'] and mesh.get('physicalVerification')=='UNVERIFIED'
    assert len(manifest['wires'])==60
    for cid in ['RP1','D1','RLY1']:
        assert all(w['source_component']!=cid and w['destination_component']!=cid for w in manifest['wires'])
    capacitor_joins=[]
    for cid in ['C_L','C_M','C_V','C_BYP_M','C_FILTER_M']:
        legs=[o for o in scene.objects if o.get('componentId')==cid and o.name.startswith('Capacitor lead')]
        assert len(legs)==2,(cid,'two continuous metallic legs required')
        expected=[contacts[(cid,pin)]-Vector((0,0,.012)) for pin in ['A','B']]
        for leg in legs:
            end=sum((leg.matrix_world@v.co for v in list(leg.data.vertices)[-10:]),Vector())/10
            error=min((end-p).length for p in expected)
            assert error<1e-5,(cid,'metallic leg does not reach contact post',error)
            capacitor_joins.append(error)
    result={'status':'passed','sourceComponents':36,'connectedComponents':33,'logicalContacts':len(contacts),
        'sourceWires':60,'maxWireEndpointError':max(errors),'sourceObjects':len(scene.objects),
        'capacitorLeadContacts':len(capacitor_joins),'maxCapacitorLeadContactError':max(capacitor_joins),
        'physicalHardwareTested':False,'physicalPlacementsVerified':False,
        'checks':['All CSV endpoints have exact logical terminal objects','All wire end-ring centres meet those contacts',
        'Every source status is preserved','Unscheduled RP1, D1 and legacy relay have no invented wires',
        'All ten formed capacitor leads meet their existing A/B metallic contact posts']}
    (OUT/'source-validation.json').write_text(json.dumps(result,indent=2))
    import sys
    if '--checks-only' not in sys.argv:
        scene.render.resolution_x=1800;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
        scene.cycles.samples=32;scene.render.filepath=str(OUT/'circuit-lab-preview.png')
        bpy.ops.render.render(write_still=True)
        camera=scene.camera
        # A legible detail view retains its terminal wings and displayed caveat.
        for o in scene.objects:
            if o.get('componentId') and o.get('componentId')!='U_ESP':o.hide_render=True
            if o.get('wire_id') or o.get('component_id','').startswith('W0'):o.hide_render=True
        target=Vector((2.74,-1.76,.12));camera.location=target+Vector((1.15,-1.62,2.7))
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=2.15
        scene.render.resolution_x=1400;scene.render.resolution_y=1400
        scene.render.filepath=str(OUT/'esp32-detail.png');bpy.ops.render.render(write_still=True)
    status.write_text(json.dumps(result,indent=2))
except Exception:
    status.write_text(json.dumps({'status':'failed','traceback':traceback.format_exc()},indent=2))
    raise
