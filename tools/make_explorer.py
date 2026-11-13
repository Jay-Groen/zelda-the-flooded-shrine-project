"""
Builds the shrine explorer: an original, stylised character for The Flooded Shrine.

Run from the project root:
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python tools/make_explorer.py

Outputs
  public/models/explorer.glb   character + 16-bone rig + actions (Idle, Walk, Swim, Jump, Push, Hold)
  tools/explorer.blend         editable source
  tools/explorer-preview.png   studio render

Construction: each body part is a primitive bound 100% to one bone (segmented,
puppet-like limbs). Blender is Z-up with the character facing -Y; the glTF
export is Y-up facing +Z, which matches the game.
"""
import bpy, math, os, json, struct
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, 'public', 'models', 'explorer.glb')
TOOLS = os.path.join(ROOT, 'tools')
os.makedirs(os.path.dirname(GLB), exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0.0, rough=0.7, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    try:
        m.use_nodes = True  # always on in newer Blender versions
    except Exception:
        pass
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = strength
    return m


rust = material('Rust hood', (0.42, 0.11, 0.05))
rust_dark = material('Rust lining', (0.22, 0.05, 0.03))
slate = material('Slate tunic', (0.10, 0.16, 0.22))
teal = material('Teal scarf', (0.03, 0.40, 0.36))
linen = material('Linen', (0.70, 0.62, 0.45))
charcoal = material('Charcoal trousers', (0.06, 0.06, 0.07))
leather = material('Leather', (0.20, 0.09, 0.035))
skin = material('Skin', (0.62, 0.38, 0.24))
hair = material('Dark hair', (0.05, 0.03, 0.02))
blush = material('Blush', (0.75, 0.28, 0.22))
ink = material('Eyes', (0.015, 0.015, 0.02), rough=0.2)
shine = material('Eye shine', (0.95, 0.95, 0.95), rough=0.1)
brass = material('Brass', (0.70, 0.45, 0.14), metallic=0.8, rough=0.35)
glow = material('Lantern glow', (1.0, 0.75, 0.35), emit=(1.0, 0.62, 0.25), strength=6.0)

parts = []


def finish(o, name, mat, bone):
    o.name = name
    o.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    parts.append((o, bone))
    return o


def ell(name, loc, scale, mat, bone, seg=20, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    o = bpy.context.object
    o.scale = scale
    return finish(o, name, mat, bone)


def cone(name, loc, r1, r2, depth, mat, bone, verts=20):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    return finish(bpy.context.object, name, mat, bone)


def cube(name, loc, scale, mat, bone, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = scale
    finish(o, name, mat, bone)
    mod = o.modifiers.new('Soft edges', 'BEVEL')
    mod.width = bevel
    mod.segments = 2
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def segment(name, a, b, r, mat, bone, taper=0.88):
    a, b = Vector(a), Vector(b)
    o = cone(name, (a + b) / 2, r, r * taper, (a - b).length, mat, bone, 14)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = (b - a).to_track_quat('Z', 'Y')
    return o


# ---------------------------------------------------------------- head
# A round face peeking out of a deep, rounded hood. Front is -Y.
ell('Head', (0, 0, 2.0), (0.30, 0.27, 0.29), skin, 'head')
for x, z, sx in ((-0.12, 2.17, 0.1), (0.0, 2.19, 0.11), (0.12, 2.17, 0.1)):
    ell('Hair tuft', (x, -0.2, z), (sx, 0.07, 0.065), hair, 'head')
ell('Nose', (0, -0.27, 1.96), (0.035, 0.03, 0.03), skin, 'head')
for s in (-1, 1):
    ell('Eye', (s * 0.105, -0.245, 2.03), (0.038, 0.02, 0.058), ink, 'head')
    ell('Eye shine', (s * 0.095, -0.262, 2.05), (0.012, 0.006, 0.014), shine, 'head')
    ell('Cheek', (s * 0.175, -0.215, 1.93), (0.05, 0.012, 0.03), blush, 'head')
ell('Mouth', (0, -0.262, 1.885), (0.03, 0.006, 0.01), rust_dark, 'head')

# Hood: a big soft dome sitting behind the face, with a lip around the face
# and a short droop down the back.
ell('Hood', (0, 0.08, 2.07), (0.37, 0.34, 0.37), rust, 'head', 24, 12)
bpy.ops.mesh.primitive_torus_add(major_radius=0.29, minor_radius=0.065, major_segments=32,
                                 minor_segments=10, location=(0, -0.19, 2.04), rotation=(math.pi / 2, 0, 0))
finish(bpy.context.object, 'Hood lip', rust_dark, 'head')
ell('Hood droop', (0, 0.3, 1.86), (0.22, 0.13, 0.22), rust, 'head')

# ---------------------------------------------------------------- body
cone('Tunic', (0, 0, 1.13), 0.31, 0.24, 0.56, slate, 'hips')
cone('Tunic hem', (0, 0, 0.87), 0.32, 0.31, 0.05, linen, 'hips')
cone('Capelet', (0, 0.02, 1.5), 0.42, 0.17, 0.40, rust, 'chest', 24)
cone('Capelet trim', (0, 0.02, 1.31), 0.425, 0.40, 0.04, teal, 'chest', 24)
# Scarf wrapped at the neck, one end trailing over the shoulder and down the back.
cone('Scarf', (0, 0, 1.73), 0.21, 0.17, 0.13, teal, 'chest', 20)
segment('Scarf tail', (0.1, 0.16, 1.72), (0.17, 0.33, 1.3), 0.065, teal, 'chest', 0.75)

# Satchel on the right hip, lantern on the left.
cube('Satchel', (-0.33, 0.02, 1.0), (0.1, 0.22, 0.18), leather, 'hips')
cube('Satchel flap', (-0.38, 0.02, 1.07), (0.03, 0.23, 0.08), rust_dark, 'hips', 0.01)
segment('Lantern hook', (0.3, -0.04, 1.08), (0.33, -0.04, 0.97), 0.015, brass, 'hips', 1.0)
cone('Lantern cap', (0.33, -0.04, 0.95), 0.06, 0.03, 0.05, brass, 'hips', 8)
ell('Lantern glass', (0.33, -0.04, 0.86), (0.055, 0.055, 0.075), glow, 'hips', 12, 8)
cone('Lantern base', (0.33, -0.04, 0.77), 0.05, 0.065, 0.04, brass, 'hips', 8)

# ---------------------------------------------------------------- limbs
for s, side in ((1, 'L'), (-1, 'R')):
    segment('Sleeve', (s * 0.24, 0, 1.6), (s * 0.38, 0, 1.31), 0.09, linen, 'upper_arm.' + side)
    segment('Forearm', (s * 0.38, 0, 1.31), (s * 0.41, -0.04, 1.08), 0.075, linen, 'forearm.' + side)
    segment('Wrist wrap', (s * 0.40, -0.03, 1.15), (s * 0.41, -0.04, 1.07), 0.08, teal, 'forearm.' + side, 1.0)
    ell('Hand', (s * 0.415, -0.045, 1.0), (0.075, 0.065, 0.085), skin, 'hand.' + side)

    segment('Trouser', (s * 0.13, 0, 0.92), (s * 0.13, 0, 0.5), 0.1, charcoal, 'thigh.' + side)
    segment('Shin', (s * 0.13, 0, 0.5), (s * 0.13, 0, 0.17), 0.09, charcoal, 'shin.' + side)
    segment('Shin wrap', (s * 0.13, 0, 0.45), (s * 0.13, 0, 0.2), 0.098, linen, 'shin.' + side, 0.95)
    ell('Shoe', (s * 0.13, -0.06, 0.1), (0.11, 0.18, 0.1), leather, 'foot.' + side)

# ---------------------------------------------------------------- rig
bpy.ops.object.armature_add()
rig = bpy.context.object
rig.name = 'ExplorerRig'
bpy.ops.object.mode_set(mode='EDIT')
rig.data.edit_bones.remove(rig.data.edit_bones[0])


def bone(name, a, b, parent=None):
    eb = rig.data.edit_bones.new(name)
    eb.head = a
    eb.tail = b
    if parent:
        eb.parent = rig.data.edit_bones[parent]


bone('root', (0, 0, 0), (0, 0, 0.2))
bone('hips', (0, 0, 0.92), (0, 0, 1.3), 'root')
bone('chest', (0, 0, 1.3), (0, 0, 1.75), 'hips')
bone('head', (0, 0, 1.75), (0, 0, 2.4), 'chest')
for s, side in ((1, 'L'), (-1, 'R')):
    bone('upper_arm.' + side, (s * 0.24, 0, 1.6), (s * 0.38, 0, 1.31), 'chest')
    bone('forearm.' + side, (s * 0.38, 0, 1.31), (s * 0.41, -0.04, 1.08), 'upper_arm.' + side)
    bone('hand.' + side, (s * 0.41, -0.04, 1.08), (s * 0.415, -0.045, 0.94), 'forearm.' + side)
    bone('thigh.' + side, (s * 0.13, 0, 0.92), (s * 0.13, 0, 0.5), 'hips')
    bone('shin.' + side, (s * 0.13, 0, 0.5), (s * 0.13, 0, 0.17), 'thigh.' + side)
    bone('foot.' + side, (s * 0.13, 0, 0.17), (s * 0.13, -0.16, 0.08), 'shin.' + side)
bpy.ops.object.mode_set(mode='OBJECT')

for obj, bn in parts:
    vg = obj.vertex_groups.new(name=bn)
    vg.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    mod = obj.modifiers.new('Rig', 'ARMATURE')
    mod.object = rig
    obj.parent = rig
    for poly in obj.data.polygons:
        poly.use_smooth = True

for p in rig.pose.bones:
    p.rotation_mode = 'XYZ'

# ---------------------------------------------------------------- animation
# Sign conventions (limb bones point down): rotation_euler.x < 0 swings a limb
# forward, > 0 backward. chest.x > 0 leans forward.
B = rig.pose.bones


def pose_idle(ph, t):
    B['chest'].rotation_euler.x = 0.02 * math.sin(ph)
    B['head'].rotation_euler.z = 0.05 * math.sin(ph * 0.5)
    B['head'].rotation_euler.x = -0.02 * math.sin(ph)
    for s, side in ((1, 'L'), (-1, 'R')):
        B['upper_arm.' + side].rotation_euler.y = s * 0.04 * math.sin(ph)


def pose_walk(ph, t):
    for sign, side in ((1, 'L'), (-1, 'R')):
        swing = math.sin(ph) * sign
        B['thigh.' + side].rotation_euler.x = 0.55 * swing
        B['shin.' + side].rotation_euler.x = 0.7 * max(0.0, swing)
        B['upper_arm.' + side].rotation_euler.x = -0.45 * swing
        B['forearm.' + side].rotation_euler.x = -0.25
    B['root'].location.z = 0.04 * (1 - math.cos(ph * 2))
    B['chest'].rotation_euler.z = 0.08 * math.sin(ph)
    B['chest'].rotation_euler.x = 0.06


def pose_swim(ph, t):
    # Breaststroke: arms reach forward, sweep out and back. Body pitch is applied in-game.
    for s, side in ((1, 'L'), (-1, 'R')):
        B['upper_arm.' + side].rotation_euler.x = -1.6 + 0.7 * math.sin(ph)
        B['upper_arm.' + side].rotation_euler.y = s * 0.5 * (1 + math.cos(ph))
        B['forearm.' + side].rotation_euler.x = -0.4 - 0.4 * math.cos(ph)
        B['thigh.' + side].rotation_euler.x = 0.3 * math.sin(ph * 2 + (0 if s > 0 else math.pi))
        B['shin.' + side].rotation_euler.x = 0.4
    B['head'].rotation_euler.x = -0.25


def pose_jump(ph, t):
    for s, side in ((1, 'L'), (-1, 'R')):
        B['thigh.' + side].rotation_euler.x = -0.75 + 0.05 * math.sin(ph)
        B['shin.' + side].rotation_euler.x = 1.1
        B['upper_arm.' + side].rotation_euler.x = -0.5
        B['upper_arm.' + side].rotation_euler.y = s * 0.7
        B['forearm.' + side].rotation_euler.x = -0.5
    B['chest'].rotation_euler.x = 0.12


def pose_push(ph, t):
    B['chest'].rotation_euler.x = 0.35
    B['head'].rotation_euler.x = -0.25
    for sign, side in ((1, 'L'), (-1, 'R')):
        B['upper_arm.' + side].rotation_euler.x = -1.35
        B['forearm.' + side].rotation_euler.x = -0.2
        step = math.sin(ph) * sign
        B['thigh.' + side].rotation_euler.x = 0.35 + 0.25 * step
        B['shin.' + side].rotation_euler.x = 0.35 * max(0.0, step)
    B['root'].location.z = 0.02 * (1 - math.cos(ph * 2))


def pose_hold(ph, t):
    # Both hands raised high, presenting the treasure.
    for s, side in ((1, 'L'), (-1, 'R')):
        B['upper_arm.' + side].rotation_euler.x = -2.75
        B['upper_arm.' + side].rotation_euler.y = -s * 0.25
        B['forearm.' + side].rotation_euler.x = -0.3
    B['head'].rotation_euler.x = -0.3
    B['chest'].rotation_euler.x = -0.08 + 0.02 * math.sin(ph)
    B['root'].location.z = 0.015 * math.sin(ph)


ACTIONS = [
    ('Idle', 61, pose_idle),
    ('Walk', 25, pose_walk),
    ('Swim', 33, pose_swim),
    ('Jump', 21, pose_jump),
    ('Push', 33, pose_push),
    ('Hold', 49, pose_hold),
]

rig.animation_data_create()
for name, frames, pose in ACTIONS:
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for frame in range(1, frames + 1, 2):
        t = (frame - 1) / (frames - 1)
        ph = t * 2 * math.pi
        for p in B:
            p.rotation_euler = (0, 0, 0)
            p.location = (0, 0, 0)
        pose(ph, t)
        for p in B:
            p.keyframe_insert('rotation_euler', frame=frame)
            p.keyframe_insert('location', frame=frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    track.mute = True

rig.animation_data.action = bpy.data.actions['Idle']
scene = bpy.context.scene
scene.render.fps = 24
scene.frame_end = 61
scene.frame_set(1)

bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for o, _ in parts:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=GLB,
    use_selection=True,
    export_format='GLB',
    export_animation_mode='ACTIONS',
    export_force_sampling=True,
)

# ---------------------------------------------------------------- preview render
floor = material('Studio floor', (0.06, 0.07, 0.065))
bpy.ops.mesh.primitive_plane_add(size=200)
bpy.context.object.data.materials.append(floor)


def aim(o, point):
    o.rotation_euler = (Vector(point) - o.location).to_track_quat('-Z', 'Y').to_euler()


bpy.ops.object.camera_add(location=(3.6, -6.5, 3.0))
cam = bpy.context.object
aim(cam, (0, 0, 1.25))
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 3.2
scene.camera = cam
for loc, power, size in (((2, -4, 6), 800, 5), ((-4, -2, 3), 400, 4), ((1, 3, 5), 900, 3)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    light = bpy.context.object
    light.data.energy = power
    light.data.shape = 'DISK'
    light.data.size = size
    aim(light, (0, 0, 1.25))
if scene.world is None:
    scene.world = bpy.data.worlds.new('World')
scene.world.color = (0.22, 0.24, 0.23)

for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'CYCLES'):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
if scene.render.engine == 'CYCLES':
    scene.cycles.samples = 32
scene.render.resolution_x = 800
scene.render.resolution_y = 900
scene.render.filepath = os.path.join(TOOLS, 'explorer-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(TOOLS, 'explorer.blend'))
bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- verify export
with open(GLB, 'rb') as f:
    f.read(12)
    length, _ = struct.unpack('<II', f.read(8))
    data = json.loads(f.read(length))
assert data.get('skins'), 'no skin exported'
names = [a['name'] for a in data.get('animations', [])]
missing = [n for n, _, _ in ACTIONS if n not in names]
assert not missing, ('missing animations', missing, names)
print('VERIFIED', names, 'skins', len(data['skins']), 'engine', scene.render.engine)
