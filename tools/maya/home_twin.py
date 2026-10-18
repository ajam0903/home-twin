"""Home Twin <-> Maya.

Two jobs:

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
    utilities (shown with Systems) and trees (hidden in floor views), all
    under home_twin. New objects go inside one of them.
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
GROUP_ORDER = ['B', 'L1', 'L2', 'roof', 'site', 'utilities', 'trees']


def _cmds():
    import maya.cmds as cmds
    return cmds


def _hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def _srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# ---------------------------------------------------------------- build

def build_from_export():
    import maya.api.OpenMaya as om
    cmds = _cmds()
    cmds.file(new=True, force=True)
    cmds.currentUnit(linear='cm')  # 1 unit = 1 foot, see the notes above
    cmds.upAxis(axis='y')

    with open(os.path.join(EXPORT_DIR, 'scene.json'), encoding='utf8') as f:
        manifest = json.load(f)
    with open(os.path.join(EXPORT_DIR, 'scene.bin'), 'rb') as f:
        blob = f.read()

    def floats(offset, count):
        a = array.array('f')
        a.frombytes(blob[offset:offset + count * 4])
        return a

    def uints(offset, count):
        a = array.array('I')
        a.frombytes(blob[offset:offset + count * 4])
        return a

    # textures live next to the Maya scene so the file nodes keep working
    tex_dir = os.path.join(MAYA_DIR, 'textures')
    os.makedirs(tex_dir, exist_ok=True)
    for t in manifest['textures']:
        shutil.copyfile(os.path.join(EXPORT_DIR, t['file']), os.path.join(tex_dir, t['name'] + '.png'))

    # shaders: Lambert travels best through FBX
    shading_groups = []
    for m in manifest['materials']:
        shader = cmds.shadingNode('lambert', asShader=True, name=m['name'])
        sg = cmds.sets(renderable=True, noSurfaceShader=True, empty=True, name=m['name'] + 'SG')
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
        shading_groups.append(sg)

    root = cmds.group(empty=True, name='home_twin')
    groups = {}
    for g in sorted(manifest['groups'], key=lambda g: GROUP_ORDER.index(g['name']) if g['name'] in GROUP_ORDER else 99):
        groups[g['name']] = cmds.group(empty=True, name=g['name'], parent=root)

    for g in manifest['groups']:
        parent = groups[g['name']]
        for mesh in g['meshes']:
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
                us = om.MFloatArray(list(uv[0::2]))
                vs = om.MFloatArray(list(uv[1::2]))
                obj = fn.create(points, counts, connects, us, vs)
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
            # clean topology for modeling: weld, quads, hard edges on the
            # built parts; plants stay soft all over (leaf clumps, trunks)
            organic = mesh['kind'] == 'plant' or mesh['colors'] is not None
            cmds.polyMergeVertex(transform, distance=0.0005, constructionHistory=False)
            cmds.polyQuad(transform, angle=30, keepGroupBorder=True, keepTextureBorders=True, worldSpace=True)
            cmds.polySoftEdge(transform, angle=180 if organic else 30)
            cmds.delete(transform, constructionHistory=True)
            if mesh['colors'] is not None:
                cmds.setAttr(shape + '.displayColors', 1)

    os.makedirs(MAYA_DIR, exist_ok=True)
    cmds.file(rename=SCENE_FILE)
    cmds.file(save=True, type='mayaBinary', force=True)

    # material settings the FBX cannot carry, and the bump maps, for the app
    os.makedirs(os.path.join(APP_DIR, 'textures'), exist_ok=True)
    extras = {}
    for m in manifest['materials']:
        extras[m['name']] = {k: m[k] for k in ('roughness', 'metalness', 'opacity', 'transparent', 'alphaTest', 'vertexColors', 'bump', 'bumpScale', 'emissive', 'emissiveIntensity')}
        if m['bump']:
            shutil.copyfile(os.path.join(EXPORT_DIR, 'textures', m['bump'] + '.png'), os.path.join(APP_DIR, 'textures', m['bump'] + '.png'))
    with open(os.path.join(APP_DIR, 'materials.json'), 'w', encoding='utf8') as f:
        json.dump({'note': 'Per-material settings for public/model/house.fbx, by Maya material name.', 'materials': extras}, f, indent=2)
        f.write('\n')
    export_to_app()
    print('Built', SCENE_FILE, 'and', FBX_FILE)


# ---------------------------------------------------------------- export

def export_to_app(path=FBX_FILE):
    """Export the open scene for the app (embedded textures, Y up, feet as units)."""
    import maya.mel as mel
    cmds = _cmds()
    cmds.loadPlugin('fbxmaya', quiet=True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
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
    cmds.select('home_twin', replace=True)
    mel.eval('FBXExport -f "{}" -s'.format(path.replace('\\', '/')))
    print('Exported', path)


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
    else:
        print('Unknown job', job)
    maya.standalone.uninitialize()
