import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };

const files = {
  surfaceSchema: 'schemas/surface-map.schema.json',
  configurationSchema: 'schemas/configuration.schema.json',
  materialSchema: 'schemas/material.schema.json',
  surfaceMap: 'contracts/surface-map.json',
  configuration: 'contracts/examples/configuration.example.json',
  material: 'contracts/examples/material.example.json',
  manifest: 'assets/geometry/karv-chair/v2/base.manifest.json',
};

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

function validateJson(name, schemaPath, dataPath) {
  const schema = readJson(schemaPath);
  const data = readJson(dataPath);
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    fail(`${name} inválido:\n${JSON.stringify(validate.errors, null, 2)}`);
  }
  console.log(`✓ ${name} validado por ${schemaPath}`);
  return data;
}

function parseGlb(buffer) {
  check(buffer.length >= 20, 'GLB truncado');
  check(buffer.toString('utf8', 0, 4) === 'glTF', 'magic GLB inválido');
  check(buffer.readUInt32LE(4) === 2, 'GLB deve usar glTF 2.0');
  check(buffer.readUInt32LE(8) === buffer.length, 'tamanho declarado no GLB não confere');

  let offset = 12;
  let json;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + chunkLength;
    check(end <= buffer.length, 'chunk GLB ultrapassa o arquivo');
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(buffer.subarray(start, end).toString('utf8').replace(/\0+$/u, '').trimEnd());
    }
    offset = end;
  }
  check(json, 'chunk JSON ausente no GLB');
  return json;
}

function collectBindings(gltf) {
  const bindings = [];
  for (const node of gltf.nodes ?? []) {
    if (node.mesh == null) continue;
    const mesh = gltf.meshes[node.mesh];
    mesh.primitives.forEach((primitive, primitiveIndex) => {
      const material = gltf.materials?.[primitive.material];
      bindings.push({
        mesh_name: mesh.name,
        material_name: material?.name,
        primitive_index: primitiveIndex,
        vertices: gltf.accessors[primitive.attributes.POSITION].count,
        triangles: primitive.indices == null ? gltf.accessors[primitive.attributes.POSITION].count / 3 : gltf.accessors[primitive.indices].count / 3,
      });
    });
  }
  return bindings;
}

const surfaceMap = validateJson('surface-map', files.surfaceSchema, files.surfaceMap);
const configuration = validateJson('configuration example', files.configurationSchema, files.configuration);
const material = validateJson('material example', files.materialSchema, files.material);
const manifest = readJson(files.manifest);

const glbPath = path.resolve(root, path.dirname(files.surfaceMap), surfaceMap.geometry.asset);
const glb = fs.readFileSync(glbPath);
const gltf = parseGlb(glb);
const digest = crypto.createHash('sha256').update(glb).digest('hex');

check(digest === surfaceMap.geometry.sha256, 'hash do GLB diverge do surface-map');
check(digest === manifest.asset.sha256, 'hash do GLB diverge do manifesto');
check(glb.length === manifest.asset.byte_length, 'tamanho do GLB diverge do manifesto');
check(surfaceMap.geometry.id === manifest.geometry_id, 'geometry_id diverge entre contratos');
check(surfaceMap.geometry.version === manifest.geometry_version, 'geometry_version diverge entre contratos');
check(configuration.geometry.id === manifest.geometry_id, 'configuration geometry_id diverge do manifesto');
check(configuration.geometry.version === manifest.geometry_version, 'configuration geometry_version diverge do manifesto');
check(configuration.geometry.sha256 === digest, 'configuration hash diverge do GLB');
check(gltf.extensionsRequired?.includes('KHR_draco_mesh_compression'), 'GLB canônico deve declarar Draco como obrigatório');
console.log('✓ GLB, hash, tamanho, versão e extensão conferidos');

const key = (value) => `${value.mesh_name}\u0000${value.primitive_index}\u0000${value.material_name}`;
const glbBindings = collectBindings(gltf);
const mapBindings = surfaceMap.surfaces.map((surface) => ({ ...surface.binding, surface_id: surface.surface_id }));
const glbKeys = new Set(glbBindings.map(key));
const mapKeys = new Set(mapBindings.map(key));

check(glbBindings.length === glbKeys.size, 'GLB contém binding técnico duplicado');
check(mapBindings.length === mapKeys.size, 'surface-map contém binding técnico duplicado');
for (const binding of glbBindings) check(mapKeys.has(key(binding)), `binding ausente no surface-map: ${JSON.stringify(binding)}`);
for (const binding of mapBindings) check(glbKeys.has(key(binding)), `binding inexistente no GLB: ${JSON.stringify(binding)}`);

const surfaceIds = surfaceMap.surfaces.map((surface) => surface.surface_id);
check(surfaceIds.length === new Set(surfaceIds).size, 'surface_id duplicado');
check(!surfaceMap.surfaces.some((surface) => /Material\.\d+|[A-Z]{2,}_/u.test(surface.public_name)), 'identificador técnico vazou para nome público');

const configurableIds = surfaceMap.surfaces
  .filter((surface) => surface.classification === 'configurable')
  .map((surface) => surface.surface_id)
  .sort();
const fixedIds = new Set(surfaceMap.surfaces
  .filter((surface) => surface.classification === 'fixed')
  .map((surface) => surface.surface_id));
const assignmentIds = Object.keys(configuration.assignments).sort();

check(JSON.stringify(assignmentIds) === JSON.stringify(configurableIds), 'configuration example não cobre exatamente as superfícies configuráveis');
check(!assignmentIds.some((surfaceId) => fixedIds.has(surfaceId)), 'configuration example atribui material a superfície fixa');
check(Object.values(configuration.assignments).every((materialId) => materialId === material.material_id), 'configuration example referencia material diferente do exemplo publicado');
console.log('✓ cobertura de 11 bindings e configuração completa (10 configuráveis, 1 fixa)');

const vertexCount = glbBindings.reduce((total, binding) => total + binding.vertices, 0);
const triangleCount = glbBindings.reduce((total, binding) => total + binding.triangles, 0);
check(glbBindings.length === manifest.statistics.part_count, 'part_count do manifesto diverge do GLB');
check(configurableIds.length === manifest.statistics.configurable_surface_count, 'contagem configurável do manifesto diverge');
check(fixedIds.size === manifest.statistics.fixed_surface_count, 'contagem fixa do manifesto diverge');
check(vertexCount === manifest.statistics.upload_vertex_count, 'contagem de vértices do manifesto diverge do GLB');
check(triangleCount === manifest.statistics.triangle_count, 'contagem de triângulos do manifesto diverge do GLB');

check(surfaceMap.camera.limits.min_polar_deg <= surfaceMap.camera.default_orbit.polar_deg, 'órbita polar inicial abaixo do limite');
check(surfaceMap.camera.default_orbit.polar_deg <= surfaceMap.camera.limits.max_polar_deg, 'órbita polar inicial acima do limite');
check(surfaceMap.camera.limits.min_radius_m <= surfaceMap.camera.default_orbit.radius_m, 'raio inicial abaixo do limite');
check(surfaceMap.camera.default_orbit.radius_m <= surfaceMap.camera.limits.max_radius_m, 'raio inicial acima do limite');

const forbiddenPublicKeys = new Set(['supplier', 'vendor', 'cost', 'margin', 'private_sku', 'credentials', 'fornecedor', 'custo']);
function assertNoPrivateKeys(value, location = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoPrivateKeys(item, `${location}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [field, child] of Object.entries(value)) {
    check(!forbiddenPublicKeys.has(field.toLowerCase()), `campo privado ${field} encontrado em ${location}`);
    assertNoPrivateKeys(child, `${location}.${field}`);
  }
}
assertNoPrivateKeys(material);
assertNoPrivateKeys(configuration);
console.log('✓ estatísticas, câmera e limite público/privado conferidos');
console.log('\nF0 contracts: PASS');
