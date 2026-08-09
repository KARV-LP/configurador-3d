import { runtimeMaterialName } from './runtime-material';

type JsonRecord = Record<string, unknown>;

interface RuntimeBinding {
  readonly mesh_name: string;
  readonly primitive_index: number;
  readonly requires_material_instance: boolean;
}

interface RuntimeSurface {
  readonly surface_id: string;
  readonly binding: RuntimeBinding;
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`glTF runtime inválido: ${label}.`);
  }
  return value as JsonRecord;
}

function readRuntimeSurfaces(surfaceMap: unknown): RuntimeSurface[] {
  const source = record(surfaceMap, 'surface-map');
  if (!Array.isArray(source.surfaces)) throw new Error('Surface map runtime sem surfaces.');
  return source.surfaces.map((value) => {
    const surface = record(value, 'surface');
    const binding = record(surface.binding, 'binding');
    if (
      typeof surface.surface_id !== 'string' ||
      typeof binding.mesh_name !== 'string' ||
      typeof binding.primitive_index !== 'number' ||
      typeof binding.requires_material_instance !== 'boolean'
    ) {
      throw new Error('Binding runtime inválido.');
    }
    return {
      surface_id: surface.surface_id,
      binding: {
        mesh_name: binding.mesh_name,
        primitive_index: binding.primitive_index,
        requires_material_instance: binding.requires_material_instance,
      },
    };
  });
}

export function specializeGltfMaterials(gltfValue: unknown, surfaceMapValue: unknown): JsonRecord {
  const gltf = structuredClone(record(gltfValue, 'root'));
  if (!Array.isArray(gltf.meshes) || !Array.isArray(gltf.materials)) {
    throw new Error('glTF runtime sem meshes/materials.');
  }
  const meshes = gltf.meshes as unknown[];
  const materials = gltf.materials as unknown[];
  const surfaces = readRuntimeSurfaces(surfaceMapValue);

  for (const surface of surfaces) {
    if (!surface.binding.requires_material_instance) continue;
    const meshIndex = meshes.findIndex((value) => {
      const mesh = record(value, 'mesh');
      return mesh.name === surface.binding.mesh_name;
    });
    if (meshIndex < 0) {
      throw new Error(`Mesh runtime não encontrada para ${surface.surface_id}.`);
    }
    const mesh = record(meshes[meshIndex], 'mesh');
    if (!Array.isArray(mesh.primitives)) {
      throw new Error(`Mesh runtime sem primitives para ${surface.surface_id}.`);
    }
    const primitive = record(mesh.primitives[surface.binding.primitive_index], 'primitive');
    if (!Number.isInteger(primitive.material)) {
      throw new Error(`Primitive runtime sem material para ${surface.surface_id}.`);
    }
    const originalIndex = Number(primitive.material);
    const originalMaterial = record(materials[originalIndex], 'material');
    const materialClone = structuredClone(originalMaterial);
    materialClone.name = runtimeMaterialName(surface.surface_id);
    materials.push(materialClone);
    primitive.material = materials.length - 1;
  }

  return gltf;
}
