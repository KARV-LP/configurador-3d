import type { SurfaceMap, SurfaceDescriptor } from '../domain/surface-map';
import type { CustomProposal } from './proposal';
import type { CustomRevestimento } from './custom-revestimento';

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Objeto de proposta inválido.');
  }
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(source, key))
  ) {
    throw new Error('Campos fora do contrato público da proposta.');
  }
  return source;
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const id = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/u.test(value);
const positive = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max;
const integer = (value: unknown, max = Number.MAX_SAFE_INTEGER) =>
  positive(value, max) && Number.isSafeInteger(value);
const hash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

export interface ResolvedCustomProposal {
  readonly proposal: CustomProposal;
  readonly assignments: readonly Readonly<{
    surface: SurfaceDescriptor;
    revestimento: CustomRevestimento;
    /** ID reservado; nunca enviar ao restaurador F7 de catálogo. */
    reference: string;
  }>[];
}

/** Valida o manifesto público inteiro antes de retornar qualquer atribuição. Sem I/O ou mutações. */
export function resolveCustomProposal(value: unknown, map: SurfaceMap): ResolvedCustomProposal {
  const root = object(value, [
    'contract_version',
    'proposal_id',
    'geometry',
    'validation_status',
    'revestimentos',
    'public_metadata',
  ]);
  check(root.contract_version === 1 && id(root.proposal_id), 'Contrato de proposta inválido.');
  check(root.validation_status === 'approved', 'Proposta sem aprovação KARV.');
  const geometry = object(root.geometry, ['id', 'version', 'sha256']);
  check(
    geometry.id === map.geometry.id &&
      geometry.version === map.geometry.version &&
      hash(geometry.sha256) &&
      geometry.sha256 === map.geometry.sha256,
    'Geometria incompatível com a Poltrona KARV.',
  );
  const metadata = object(root.public_metadata, ['title']);
  check(
    typeof metadata.title === 'string' && metadata.title.length > 0 && metadata.title.length <= 120,
    'Metadata pública inválida.',
  );
  check(
    Array.isArray(root.revestimentos) &&
      root.revestimentos.length > 0 &&
      root.revestimentos.length <= 10,
    'Revestimentos ausentes ou excessivos.',
  );
  const used = new Set<string>();
  const assignments = root.revestimentos.map((entry: unknown) => {
    const custom = object(entry, [
      'kind',
      'proposal_id',
      'surface_id',
      'asset_version',
      'validation_status',
      'base_color',
      'physical_size_mm',
      'orientation',
      'lifecycle',
    ]);
    check(
      custom.kind === 'custom' &&
        custom.proposal_id === root.proposal_id &&
        custom.validation_status === 'approved' &&
        integer(custom.asset_version) &&
        custom.orientation === 'canonical-uv' &&
        custom.lifecycle === 'archive-on-replacement',
      'Revestimento custom inválido ou não aprovado.',
    );
    check(id(custom.surface_id), 'surface_id inválido.');
    const surface = map.surfaces.find((item) => item.surfaceId === custom.surface_id);
    check(surface?.classification === 'configurable', 'surface_id inexistente ou fixo.');
    check(!used.has(custom.surface_id), 'surface_id duplicado.');
    used.add(custom.surface_id);
    const asset = object(custom.base_color, [
      'uri',
      'media_type',
      'sha256',
      'byte_length',
      'width_px',
      'height_px',
    ]);
    check(
      typeof asset.uri === 'string' &&
        asset.uri ===
          `/proposal-assets/${root.proposal_id}/v${custom.asset_version}/${custom.surface_id}.webp` &&
        asset.media_type === 'image/webp' &&
        hash(asset.sha256) &&
        integer(asset.byte_length, 16777216) &&
        integer(asset.width_px, 16384) &&
        integer(asset.height_px, 16384),
      'Asset custom inválido.',
    );
    const physical = object(custom.physical_size_mm, ['width', 'height']);
    check(
      positive(physical.width, 10000) && positive(physical.height, 10000),
      'Dimensões inválidas.',
    );
    // A cópia validada impede alterações posteriores no objeto de entrada.
    const revestimento = Object.freeze({
      ...custom,
      base_color: Object.freeze({ ...asset }),
      physical_size_mm: Object.freeze({ ...physical }),
    }) as unknown as CustomRevestimento;
    return Object.freeze({
      surface,
      revestimento,
      reference: `custom:${root.proposal_id}:${custom.surface_id}:v${custom.asset_version}`,
    });
  });
  const proposal: CustomProposal = Object.freeze({
    contract_version: 1,
    proposal_id: root.proposal_id,
    geometry: Object.freeze({ id: 'karv-chair', version: 2, sha256: String(geometry.sha256) }),
    validation_status: 'approved',
    revestimentos: Object.freeze(assignments.map((a) => a.revestimento)),
    public_metadata: Object.freeze({ title: metadata.title }),
  });
  return Object.freeze({ proposal, assignments: Object.freeze(assignments) });
}

/** Fronteira de leitura injetável: o chamador controla origem, autorização e limites de rede. */
export async function loadCustomProposal(
  proposalId: string,
  read: (proposalId: string) => Promise<unknown>,
  map: SurfaceMap,
): Promise<ResolvedCustomProposal> {
  check(id(proposalId), 'proposal_id inválido.');
  const resolved = resolveCustomProposal(await read(proposalId), map);
  check(resolved.proposal.proposal_id === proposalId, 'proposal_id divergente.');
  return resolved;
}
