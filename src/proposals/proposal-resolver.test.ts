import { describe, expect, it, vi } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import mapJson from '../../contracts/surface-map.json';
import fixture from '../../contracts/examples/proposal.example.json';
import proposalSchema from '../../schemas/proposal.schema.json';
import customSchema from '../../schemas/custom-revestimento.schema.json';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import { ConfigurationStore } from '../configurator/configuration-store';
import { loadCustomProposal, resolveCustomProposal } from './proposal-resolver';

const map = parseSurfaceMap(mapJson, parseCanonicalGeometryManifest(manifestJson));
const ajv = new Ajv2020({ strict: true });
ajv.addSchema(customSchema);
const validate = ajv.compile(proposalSchema);
const fresh = () => structuredClone(fixture);

describe('F11 contratos e resolver', () => {
  it('valida fixture, mapeia binding canônico e não modifica entrada/estado', () => {
    const input = fresh();
    const store = new ConfigurationStore(['seat']);
    const result = resolveCustomProposal(input, map);
    expect(validate(input)).toBe(true);
    expect(result.assignments[0]?.surface).toBe(map.surfaces.find((s) => s.surfaceId === 'seat'));
    expect(result.assignments[0]?.reference).toBe('custom:demo-custom:seat:v1');
    input.revestimentos[0]!.base_color.uri = '/alterado';
    expect(result.proposal.revestimentos[0]?.base_color.uri).toBe(
      fixture.revestimentos[0]!.base_color.uri,
    );
    expect(store.read().assignments.seat).toBeNull();
  });
  const cases: [string, (p: ReturnType<typeof fresh>) => void][] = [
    [
      'surface_id inexistente',
      (p) => {
        p.revestimentos[0]!.surface_id = 'unknown';
      },
    ],
    [
      'superfície fixa',
      (p) => {
        p.revestimentos[0]!.surface_id = map.surfaces.find(
          (s) => s.classification === 'fixed',
        )!.surfaceId;
      },
    ],
    [
      'geometria incompatível',
      (p) => {
        p.geometry.version = 3;
      },
    ],
    [
      'hash de geometria incompatível',
      (p) => {
        p.geometry.sha256 = 'b'.repeat(64);
      },
    ],
    [
      'asset custom inválido',
      (p) => {
        p.revestimentos[0]!.base_color.uri = 'https://example.com/private?token=secret';
      },
    ],
    [
      'hash inválido',
      (p) => {
        p.revestimentos[0]!.base_color.sha256 = 'invalid';
      },
    ],
    [
      'resolução inválida',
      (p) => {
        p.revestimentos[0]!.base_color.width_px = 0;
      },
    ],
    [
      'sem aprovação',
      (p) => {
        p.validation_status = 'draft';
      },
    ],
    [
      'arte sem aprovação',
      (p) => {
        p.revestimentos[0]!.validation_status = 'rejected';
      },
    ],
    [
      'proposta cruzada',
      (p) => {
        p.revestimentos[0]!.proposal_id = 'other';
      },
    ],
    [
      'face duplicada',
      (p) => {
        p.revestimentos.push(p.revestimentos[0]!);
      },
    ],
  ];
  it.each(cases)('rejeita %s', (_, mutate) => {
    const input = fresh();
    mutate(input);
    expect(() => resolveCustomProposal(input, map)).toThrow();
  });
  it.each(['root', 'metadata', 'custom', 'asset', 'geometry', 'physical'])(
    'proíbe metadata privada em %s pelo schema e runtime',
    (location) => {
      const input = fresh();
      const targets: Record<string, object> = {
        root: input,
        metadata: input.public_metadata,
        custom: input.revestimentos[0]!,
        asset: input.revestimentos[0]!.base_color,
        geometry: input.geometry,
        physical: input.revestimentos[0]!.physical_size_mm,
      };
      Object.assign(targets[location]!, { customer_email: 'private@example.com' });
      expect(validate(input)).toBe(false);
      expect(() => resolveCustomProposal(input, map)).toThrow(/contrato público/);
    },
  );
  it('loader valida identidade e propaga falha de leitura', async () => {
    const read = vi.fn().mockResolvedValue(fresh());
    await expect(loadCustomProposal('demo-custom', read, map)).resolves.toHaveProperty(
      'proposal.proposal_id',
      'demo-custom',
    );
    await expect(loadCustomProposal('other', read, map)).rejects.toThrow('divergente');
    await expect(loadCustomProposal('../bad', read, map)).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(2);
    await expect(
      loadCustomProposal(
        'demo-custom',
        async () => {
          throw new Error('offline');
        },
        map,
      ),
    ).rejects.toThrow('offline');
  });
});
