"""Home Twin <-> Maya.

Two jobs:

update  Replace only some groups or parts of maya/house.mb with a new export,
        keeping your edits elsewhere (used when the plans change, for example
        the 2017 basement):
            mayapy tools/maya/home_twin.py update B site/lawn_and_paving
        It compares the targets with maya/export_prev (the export the scene
        was built from) and stops if you edited them, backs the scene up to
        maya/backups, swaps the parts, saves and exports for the app.

build   Turn the app's export (maya/export: scene.json, scene.bin, textures)
        into a Maya scene, maya/house.mb, and the FBX the app loads,
        public/model/house.fbx. Run once to start from the plans:
            mayapy tools/maya/home_twin.py build
        (npm run maya:build does the same.)

export  Write the open Maya scene to public/model/house.fbx with the settings
        the app expects. In Maya's Script Editor (Python):
            import sys; sys.path.append(r'W:/0_PROJECTS/HomeInfo/tools/maya')
            import home_twin; home_twin.export_to_app()
        or from a shell: mayapy tools/maya/home_twin.py export maya/house.mb

Scene conventions the app relies on:
  * 1 unit = 1 foot (leave Maya's working units at centimeters), Y up,
    x left to right, z from the back of the house toward the street.
  * Top groups B, L1, L2 (the floors, cut away one at a time), roof, site,
    utilities (shown with Systems), trees (the yard's maples) and woods (the
    trees on the neighboring lots, one object per tree), all under
    home_twin. New objects go inside one of them. Trees and woods are
    hidden in floor views.
  * The woods export to their own files: woods.fbx, and woods_phone.fbx, a
    reduced copy made at export time for phones.
  * Room floors are named room_<id> (room_kitchen...): the app selects rooms
    by clicking them. Keep those names if you reshape a room.
  * Materials keep their names; the app reads roughness and bump maps for
    them from public/model/materials.json (new materials get defaults).
"""

import array
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORT_DIR = os.path.join(ROOT, 'maya', 'export')
MAYA_DIR = os.path.join(ROOT, 'maya')
SCENE_FILE = os.path.join(MAYA_DIR, 'house.mb')
APP_DIR = os.path.join(ROOT, 'public', 'model')
FBX_FILE = os.path.join(APP_DIR, 'house.fbx')
WOODS_FILE = os.path.join(APP_DIR, 'woods.fbx')
WOODS_PHONE_FILE = os.path.join(APP_DIR, 'woods_phone.fbx')
GROUP_ORDER = ['B', 'L1', 'L2', 'roof', 'site', 'utilities', 'trees', 'woods']
# Share of each tree's polygons the phone copy keeps
PHONE_KEEP = 0.35


def _cmds():
    import maya.cmds as cmds
    return cmds


def _hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def _srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# ---------------------------------------------------------------- build

MAT_KEYS = ('color', 'map', 'bump', 'bumpScale', 'roughness', 'metalness', 'opacity', 'transparent', 'alphaTest',
            'vertexColors', 'emissive', 'emissiveIntensity')
EXTRA_KEYS = ('roughness', 'metalness', 'opacity', 'transparent', 'alphaTest', 'vertexColors', 'bump', 'bumpScale',
              'emissive', 'emissiveIntensity')


def _mat_sig(m):
    return json.dumps([m[k] for k in MAT_KEYS])


def _load_export(export_dir):
    with open(os.path.join(export_dir, 'scene.json'), encoding='utf8') as f:
        manifest = json.load(f)
    with open(os.path.join(export_dir, 'scene.bin'), 'rb') as f:
        blob = f.read()
    return manifest, blob


def _copy_textures(manifest, export_dir):
    # textures live next to the Maya scene so the file nodes keep working
    tex_dir = os.path.join(MAYA_DIR, 'textures')
    os.makedirs(tex_dir, exist_ok=True)
    for t in manifest['textures']:
        shutil.copyfile(os.path.join(export_dir, t['file']), os.path.join(tex_dir, t['name'] + '.png'))
    return tex_dir


def _create_shader(m, name, tex_dir):
    """A Lambert (it travels best through FBX) and its shading group."""
    cmds = _cmds()
    shader = cmds.shadingNode('lambert', asShader=True, name=name)
    sg = cmds.sets(renderable=True, noSurfaceShader=True, empty=True, name=shader + 'SG')
    cmds.connectAttr(shader + '.outColor', sg + '.surfaceShader', force=True)
    if m['map']:
        fn = cmds.shadingNode('file', asTexture=True, isColorManaged=True, name=m['map'] + '_file')
        p2d = cmds.shadingNode('place2dTexture', asUtility=True)
        for attr in ('coverage', 'translateFrame', 'rotateFrame', 'mirrorU', 'mirrorV', 'stagger', 'wrapU', 'wrapV',
                     'repeatUV', 'offset', 'rotateUV', 'noiseUV', 'vertexUvOne', 'vertexUvTwo', 'vertexUvThree',
                     'vertexCameraOne'):
            cmds.connectAttr(p2d + '.' + attr, fn + '.' + attr, force=True)
        cmds.connectAttr(p2d + '.outUV', fn + '.uv', force=True)
        cmds.connectAttr(p2d + '.outUvFilterSize', fn + '.uvFilterSize', force=True)
        cmds.setAttr(fn + '.fileTextureName', os.path.join(tex_dir, m['map'] + '.png').replace('\\', '/'), type='string')
        cmds.connectAttr(fn + '.outColor', shader + '.color', force=True)
        if m['alphaTest'] > 0:
            cmds.connectAttr(fn + '.outTransparency', shader + '.transparency', force=True)
    else:
        r, g, b = (_srgb_to_linear(c) for c in _hex_rgb(m['color']))
        cmds.setAttr(shader + '.color', r, g, b, type='double3')
    if m['opacity'] < 1:
        t = 1 - m['opacity']
        cmds.setAttr(shader + '.transparency', t, t, t, type='double3')
    if m['emissiveIntensity'] > 0 and m['emissive'] != '#000000':
        r, g, b = (_srgb_to_linear(c) * m['emissiveIntensity'] for c in _hex_rgb(m['emissive']))
        cmds.setAttr(shader + '.incandescence', r, g, b, type='double3')
    return shader, sg


def _create_mesh(mesh, blob, parent, shading_groups):
    """One exported part as a Maya mesh: welded, in quads, hard edges on built
    parts and soft on plants. shading_groups maps manifest material index to SG."""
    import maya.api.OpenMaya as om
    cmds = _cmds()

    def floats(offset, count):
        a = array.array('f')
        a.frombytes(blob[offset:offset + count * 4])
        return a

    def uints(offset, count):
        a = array.array('I')
        a.frombytes(blob[offset:offset + count * 4])
        return a

    n = mesh['vertexCount']
    tris = mesh['triCount']
    pos = floats(mesh['positions'], n * 3)
    idx = uints(mesh['indices'], tris * 3)
    fmat = uints(mesh['faceMaterials'], tris)
    points = om.MFloatPointArray([om.MFloatPoint(pos[i], pos[i + 1], pos[i + 2]) for i in range(0, n * 3, 3)])
    counts = om.MIntArray([3] * tris)
    connects = om.MIntArray(list(idx))
    fn = om.MFnMesh()
    if mesh['uvs'] is not None:
        uv = floats(mesh['uvs'], n * 2)
        obj = fn.create(points, counts, connects, om.MFloatArray(list(uv[0::2])), om.MFloatArray(list(uv[1::2])))
        fn.assignUVs(counts, connects)
    else:
        obj = fn.create(points, counts, connects)
    if mesh['colors'] is not None:
        col = floats(mesh['colors'], n * 3)
        colors = om.MColorArray([om.MColor((col[i], col[i + 1], col[i + 2], 1.0)) for i in range(0, n * 3, 3)])
        fn.setVertexColors(colors, om.MIntArray(list(range(n))))
    transform = om.MFnDagNode(obj).fullPathName()
    transform = cmds.rename(transform, mesh['name'])
    transform = cmds.parent(transform, parent)[0]
    shape = cmds.listRelatives(transform, shapes=True, fullPath=True)[0]
    # per-face shaders, by runs of faces
    runs = {}
    start = 0
    for i in range(1, tris + 1):
        if i == tris or fmat[i] != fmat[start]:
            runs.setdefault(fmat[start], []).append('{}.f[{}:{}]'.format(shape, start, i - 1))
            start = i
    for local, faces in runs.items():
        cmds.sets(faces, edit=True, forceElement=shading_groups[mesh['materials'][local]])
    organic = mesh['kind'] in ('plant', 'tree') or mesh['colors'] is not None
    cmds.polyMergeVertex(transform, distance=0.0005, constructionHistory=False)
    cmds.polyQuad(transform, angle=30, keepGroupBorder=True, keepTextureBorders=True, worldSpace=True)
    cmds.polySoftEdge(transform, angle=180 if organic else 30)
    cmds.delete(transform, constructionHistory=True)
    if mesh['colors'] is not None:
        cmds.setAttr(shape + '.displayColors', 1)
    return transform


def _write_extras(materials, export_dir, merge):
    """Material settings the FBX cannot carry, and the bump maps, for the app."""
    os.makedirs(os.path.join(APP_DIR, 'textures'), exist_ok=True)
    path = os.path.join(APP_DIR, 'materials.json')
    extras = {}
    if merge and os.path.exists(path):
        with open(path, encoding='utf8') as f:
            extras = json.load(f).get('materials', {})
    for name, m in materials:
        extras[name] = {k: m[k] for k in EXTRA_KEYS}
        if m['bump']:
            shutil.copyfile(os.path.join(export_dir, 'textures', m['bump'] + '.png'), os.path.join(APP_DIR, 'textures', m['bump'] + '.png'))
    with open(path, 'w', encoding='utf8') as f:
        json.dump({'note': 'Per-material settings for public/model/house.fbx, by Maya material name.', 'materials': extras}, f, indent=2)
        f.write('\n')


def build_from_export():
    """Start over: a new Maya scene from maya/export (replaces maya/house.mb)."""
    cmds = _cmds()
    cmds.file(new=True, force=True)
    cmds.currentUnit(linear='cm')  # 1 unit = 1 foot, see the notes above
    cmds.upAxis(axis='y')
    manifest, blob = _load_export(EXPORT_DIR)
    tex_dir = _copy_textures(manifest, EXPORT_DIR)
    shading_groups = [_create_shader(m, m['name'], tex_dir)[1] for m in manifest['materials']]
    root = cmds.group(empty=True, name='home_twin')
    groups = {}
    for g in sorted(manifest['groups'], key=lambda g: GROUP_ORDER.index(g['name']) if g['name'] in GROUP_ORDER else 99):
        groups[g['name']] = cmds.group(empty=True, name=g['name'], parent=root)
    for g in manifest['groups']:
        for mesh in g['meshes']:
            _create_mesh(mesh, blob, groups[g['name']], shading_groups)
    os.makedirs(MAYA_DIR, exist_ok=True)
    cmds.file(rename=SCENE_FILE)
    cmds.file(save=True, type='mayaBinary', force=True)
    _write_extras([(m['name'], m) for m in manifest['materials']], EXPORT_DIR, merge=False)
    export_to_app()
    print('Built', SCENE_FILE, 'and', FBX_FILE)


# ---------------------------------------------------------------- update

def _targets(manifest, targets):
    """(group, mesh) pairs a target list selects: 'B' is a whole group,
    'site/lawn_and_paving' one part."""
    out = []
    for g in manifest['groups']:
        for mesh in g['meshes']:
            if g['name'] in targets or '{}/{}'.format(g['name'], mesh['name']) in targets:
                out.append((g['name'], mesh))
    return out


def _shape_sig(transform):
    cmds = _cmds()
    box = [round(v, 2) for v in cmds.exactWorldBoundingBox(transform)]
    return (cmds.polyEvaluate(transform, face=True), cmds.polyEvaluate(transform, vertex=True), tuple(box))


def _scene_parts(targets):
    """'group/name' -> transform for what the open scene has under the targets."""
    cmds = _cmds()
    found = {}
    for t in targets:
        group, _, name = t.partition('/')
        path = '|home_twin|' + group
        if not cmds.objExists(path):
            continue
        for child in cmds.listRelatives(path, children=True, fullPath=True, type='transform') or []:
            short = child.split('|')[-1]
            if not name or short == name:
                found['{}/{}'.format(group, short)] = child
    return found


def update_from_export(targets, prev_dir, force=False):
    """Replace only `targets` in maya/house.mb with their new versions from
    maya/export, keeping everything else (your edits) as it is. First checks
    that the targets are still exactly what prev_dir (the export the scene was
    built from) produced, so edits inside them are never lost silently."""
    cmds = _cmds()
    prev, prev_blob = _load_export(prev_dir)
    new, new_blob = _load_export(EXPORT_DIR)

    # 1. the targets as built from the previous export, in a scratch scene
    cmds.file(new=True, force=True)
    tex_dir = _copy_textures(prev, prev_dir)
    scratch = cmds.group(empty=True, name='scratch')
    built = {}
    sgs = {}
    for group, mesh in _targets(prev, targets):
        for i in mesh['materials']:
            if i not in sgs:
                sgs[i] = _create_shader(prev['materials'][i], 'tmp_' + prev['materials'][i]['name'], tex_dir)[1]
        built['{}/{}'.format(group, mesh['name'])] = _shape_sig(_create_mesh(mesh, prev_blob, scratch, sgs))

    # 2. the same parts in your scene
    cmds.file(SCENE_FILE, open=True, force=True)
    current = {k: _shape_sig(v) for k, v in _scene_parts(targets).items()}
    changed = sorted(k for k in set(built) | set(current) if built.get(k) != current.get(k))
    if changed and not force:
        print('NOT UPDATED: these parts differ from the plans export (edited in Maya?):')
        for k in changed:
            print('  ', k, 'scene:', current.get(k), 'plans:', built.get(k))
        print('Re-run with --force to replace them anyway.')
        return False

    # 3. back up, then swap the targets for their new versions
    backups = os.path.join(MAYA_DIR, 'backups')
    os.makedirs(backups, exist_ok=True)
    import time
    backup = os.path.join(backups, 'house_{}.mb'.format(time.strftime('%Y%m%d_%H%M%S')))
    shutil.copyfile(SCENE_FILE, backup)
    for path in _scene_parts(targets).values():
        cmds.delete(path)
    tex_dir = _copy_textures(new, EXPORT_DIR)
    # reuse your scene's shaders where the new export asks for the same material
    prev_by_sig = {_mat_sig(m): m['name'] for m in prev['materials']}
    sgs = {}
    added = []
    for group, mesh in _targets(new, targets):
        for i in mesh['materials']:
            if i in sgs:
                continue
            m = new['materials'][i]
            name = prev_by_sig.get(_mat_sig(m))
            if name and cmds.objExists(name):
                found = cmds.listConnections(name + '.outColor', type='shadingEngine') or []
                if found:
                    sgs[i] = found[0]
                    continue
            shader, sgs[i] = _create_shader(m, m['name'] if not cmds.objExists(m['name']) else m['name'] + '_new', tex_dir)
            added.append((shader, m))
        parent = '|home_twin|' + group
        if not cmds.objExists(parent):
            cmds.group(empty=True, name=group, parent='|home_twin')
        _create_mesh(mesh, new_blob, parent, sgs)
    cmds.file(save=True, type='mayaBinary', force=True)
    _write_extras(added, EXPORT_DIR, merge=True)
    export_to_app()
    # the scene now matches this export: it is the baseline for the next update
    if os.path.abspath(prev_dir) != os.path.abspath(EXPORT_DIR):
        shutil.rmtree(prev_dir, ignore_errors=True)
        shutil.copytree(EXPORT_DIR, prev_dir)
    print('Updated', ', '.join(targets), 'in', SCENE_FILE, '(backup:', backup + ')')
    return True


# ---------------------------------------------------------------- export

def _fbx_settings():
    import maya.mel as mel
    _cmds().loadPlugin('fbxmaya', quiet=True)
    for line in (
        'FBXResetExport',
        'FBXExportFileVersion -v FBX202000',
        'FBXExportUpAxis y',
        'FBXExportEmbeddedTextures -v true',
        'FBXExportSmoothingGroups -v true',
        'FBXExportSmoothMesh -v false',
        'FBXExportTriangulate -v false',
        'FBXExportCameras -v false',
        'FBXExportLights -v false',
        'FBXExportInputConnections -v false',
        'FBXExportConvertUnitString cm',
        'FBXExportScaleFactor 1',
    ):
        mel.eval(line)


def _export_selection(nodes, path):
    import maya.mel as mel
    cmds = _cmds()
    cmds.select(nodes, replace=True)
    mel.eval('FBXExport -f "{}" -s'.format(path.replace('\\', '/')))
    print('Exported', path)


def export_to_app():
    """Export the open scene for the app: house.fbx (everything but the woods),
    woods.fbx, and woods_phone.fbx (the woods reduced for phones)."""
    cmds = _cmds()
    os.makedirs(APP_DIR, exist_ok=True)
    _fbx_settings()
    groups = cmds.listRelatives('home_twin', children=True, fullPath=True) or []
    woods = [g for g in groups if g.split('|')[-1] == 'woods']
    _export_selection([g for g in groups if g not in woods], FBX_FILE)
    if not woods:
        return
    _export_selection(woods, WOODS_FILE)
    # The phone copy: duplicate the woods, cut each mesh down, export, discard
    copy = cmds.duplicate(woods[0], name='woods_phone')[0]
    meshes = cmds.listRelatives(copy, allDescendents=True, type='mesh', fullPath=True) or []
    for shape in meshes:
        if cmds.getAttr(shape + '.intermediateObject'):
            continue
        transform = cmds.listRelatives(shape, parent=True, fullPath=True)[0]
        cmds.polyReduce(transform, version=1, percentage=(1 - PHONE_KEEP) * 100, keepColorBorder=False,
                        keepQuadsWeight=0, replaceOriginal=True, constructionHistory=False)
    try:
        _export_selection([copy], WOODS_PHONE_FILE)
    finally:
        cmds.delete(copy)


if __name__ == '__main__':
    import maya.standalone
    maya.standalone.initialize(name='python')
    job = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if job == 'build':
        build_from_export()
    elif job == 'export':
        scene = sys.argv[2] if len(sys.argv) > 2 else SCENE_FILE
        _cmds().file(scene, open=True, force=True)
        export_to_app()
    elif job == 'update':
        # update [--force] [--prev DIR] TARGET...   e.g. update B site/lawn_and_paving
        args = sys.argv[2:]
        force = '--force' in args
        prev_dir = os.path.join(MAYA_DIR, 'export_prev')
        if '--prev' in args:
            prev_dir = args[args.index('--prev') + 1]
        targets = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or args[i - 1] != '--prev')]
        update_from_export(targets, prev_dir, force)
    else:
        print('Unknown job', job)
    maya.standalone.uninitialize()
