import { describe, expect, it } from 'vitest';
import { runtimeMaterialName } from './runtime-material';
import { specializeGltfMaterials } from './runtime-gltf-materials';

const gltf = {
  materials: [{ name: 'shared', pbrMetallicRoughness: { roughnessFactor: 0.8 } }],
  meshes: [
    { name: 'mesh-a', primitives: [{ material: 0, attributes: { POSITION: 0 } }] },
    { name: 'mesh-b', primitives: [{ material: 0, attributes: { POSITION: 1 } }] },
  ],
  accessors: [{ count: 3 }, { count: 7 }],
};

const surfaceMap = {
  surfaces: [
    {
      surface_id: 'surface-a',
      binding: {
        mesh_name: 'mesh-a',
        primitive_index: 0,
        requires_material_instance: true,
      },
    },
    {
      surface_id: 'surface-b',
      binding: {
        mesh_name: 'mesh-b',
        primitive_index: 0,
        requires_material_instance: true,
      },
    },
  ],
};

describe('specializeGltfMaterials', () => {
  it('duplica somente materiais compartilhados e preserva dados geométricos', () => {
    const specialized = specializeGltfMaterials(gltf, surfaceMap);
    const materials = specialized.materials as Array<{ name?: string }>;
    const meshes = specialized.meshes as Array<{ primitives: Array<{ material: number }> }>;

    expect(materials).toHaveLength(3);
    expect(materials[1]?.name).toBe(runtimeMaterialName('surface-a'));
    expect(materials[2]?.name).toBe(runtimeMaterialName('surface-b'));
    expect(meshes[0]?.primitives[0]?.material).toBe(1);
    expect(meshes[1]?.primitives[0]?.material).toBe(2);
    expect(specialized.accessors).toEqual(gltf.accessors);
    expect(gltf.materials).toHaveLength(1);
    expect(gltf.meshes[0]?.primitives[0]?.material).toBe(0);
  });
});
