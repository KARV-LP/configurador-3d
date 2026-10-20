/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixture from '../../contracts/examples/proposal.example.json';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import mapJson from '../../contracts/surface-map.json';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import { ConfigurationStore } from '../configurator/configuration-store';
import { ConfigSerializer } from '../configurator/config-serializer';
import { SurfaceRegistry } from '../3d/surface-registry';
import { PbrMaterialController } from '../3d/pbr-material-controller';
import { MaterialController } from '../3d/material-controller';
import { Core3DController } from '../3d/core-3d-controller';
import { SelectionController } from '../3d/selection-controller';
import type {
  MaterialAppearancePort,
  PbrTexturePort,
  PbrTextureSet,
  RuntimeTextureHandle,
} from '../3d/model-viewer-adapter';
import type { MaterialAppearance } from '../materials/runtime-material';
import { CustomProposalCoordinator } from './custom-proposal-coordinator';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const map = parseSurfaceMap(mapJson, manifest);
const registry = new SurfaceRegistry(map);
const bytes = new Uint8Array(readFileSync('assets/proposals/demo-custom/v1/seat.webp'));
function texture(): RuntimeTextureHandle {
  return {
    sampler: {
      scale: { u: 1, v: 1 },
      offset: { u: 0, v: 0 },
      rotation: 0,
      setScale() {},
      setOffset() {},
      setRotation() {},
    },
  };
}
const transform = { scale: { u: 1, v: 1 }, offset: { u: 0, v: 0 }, rotationRadians: 0.2 };
const baseline: PbrTextureSet = {
  baseColor: { texture: texture(), transform },
  normal: { texture: texture(), transform },
  ambientOcclusion: { texture: texture(), transform },
};
const appearance: MaterialAppearance = {
  baseColorFactor: [0.7, 0.7, 0.7, 1],
  metallicFactor: 0.1,
  roughnessFactor: 0.82,
};
class Port implements PbrTexturePort, MaterialAppearancePort {
  textures = new Map<string, PbrTextureSet>();
  appearances = new Map<string, MaterialAppearance>();
  fail: string | null = null;
  materialNameAtPoint() {
    return null;
  }
  async createTexture() {
    return texture();
  }
  getTextures(name: string) {
    return this.textures.get(name) ?? baseline;
  }
  getAppearance(name: string) {
    return this.appearances.get(name) ?? appearance;
  }
  setTextures(name: string, value: PbrTextureSet) {
    this.textures.set(name, value); // Simula também erro depois da mutação.
    if (this.fail === name) {
      this.fail = null;
      throw new Error('face falhou');
    }
  }
  setAppearance(name: string, value: MaterialAppearance) {
    this.appearances.set(name, value);
  }
  setPbrFactors() {
    throw new Error('F11 não deve alterar fatores PBR');
  }
}
function setup() {
  const port = new Port();
  const pbr = new PbrMaterialController(registry, port);
  pbr.initialize();
  const materials = new MaterialController(registry, port);
  materials.initialize();
  const store = new ConfigurationStore(registry.configurableSurfaces.map((s) => s.surfaceId));
  store.assign('seat', 'fabric-kv-002');
  const core = new Core3DController(
    new SelectionController(registry, port),
    materials,
    store,
    () => undefined,
    pbr,
  );
  let creates = 0;
  let disposed = 0;
  const coordinator = new CustomProposalCoordinator(
    core,
    map,
    {
      read: async () =>
        new Response(new Uint8Array(bytes), { headers: { 'content-type': 'image/webp' } }),
      decode: async () => ({ width: 128, height: 128, close() {} }),
    },
    async () => {
      creates++;
      return {
        texture: texture(),
        dispose() {
          disposed++;
        },
      };
    },
  );
  return { coordinator, core, pbr, port, store, counts: () => ({ creates, disposed }) };
}
function proposal(id = 'demo-custom', surface = 'seat') {
  const p = structuredClone(fixture);
  p.proposal_id = id;
  p.revestimentos[0]!.proposal_id = id;
  p.revestimentos[0]!.surface_id = surface;
  p.revestimentos[0]!.base_color.uri = `/proposal-assets/${id}/v1/${surface}.webp`;
  return p;
}
const name = (surfaceId: string) => registry.runtimeMaterialName(registry.get(surfaceId)!);

describe('F11 integração Core/PBR transacional', () => {
  it('altera só Base Color; preserva Normal/AO/fatores/UV e omissões no baseline', async () => {
    const s = setup();
    await s.coordinator.apply(proposal());
    const textures = s.port.getTextures(name('seat'));
    expect(textures.baseColor?.texture).not.toBe(baseline.baseColor?.texture);
    expect(textures.baseColor?.transform).toBe(transform);
    expect(textures.normal).toBe(baseline.normal);
    expect(textures.ambientOcclusion).toBe(baseline.ambientOcclusion);
    for (const surface of registry.configurableSurfaces) {
      expect(s.port.getAppearance(name(surface.surfaceId))).toBe(appearance);
      if (surface.surfaceId !== 'seat')
        expect(s.port.getTextures(name(surface.surfaceId))).toBe(baseline);
    }
    expect(s.coordinator.read().status).toBe('ready');
    expect(s.store.read().assignments.seat).toBe('fabric-kv-002');
  });
  it('rollback restaura todas as faces e mantém estado anterior se a segunda face falhar', async () => {
    const s = setup();
    await s.coordinator.apply(proposal());
    const before = s.port.getTextures(name('seat'));
    const state = s.coordinator.read().applied;
    const b = proposal('proposal-b');
    b.revestimentos.push(
      proposal('proposal-b', registry.configurableSurfaces[1]!.surfaceId).revestimentos[0]!,
    );
    s.port.fail = name(registry.configurableSurfaces[1]!.surfaceId);
    await expect(s.coordinator.apply(b)).rejects.toThrow('face falhou');
    expect(s.port.getTextures(name('seat'))).toBe(before);
    expect(s.coordinator.read().applied).toBe(state);
    expect(s.coordinator.read().status).toBe('error');
    expect(s.pbr.customCacheStats().active).toBe(1);
    await s.coordinator.dispose();
    await Promise.resolve();
    expect(s.counts().disposed).toBe(s.counts().creates);
  });
  it('troca A → B elimina custom omitido; reaplica sem duplicar; reset/dispose libera', async () => {
    const s = setup();
    await s.coordinator.apply(proposal());
    await s.coordinator.apply(proposal());
    expect(s.counts().creates).toBe(1);
    const second = registry.configurableSurfaces[1]!.surfaceId;
    await s.coordinator.apply(proposal('proposal-b', second));
    expect(s.port.getTextures(name('seat'))).toBe(baseline);
    expect(s.pbr.customCacheStats().active).toBe(1);
    await s.coordinator.reset();
    await Promise.resolve();
    expect(s.pbr.customCacheStats().entries).toBe(0);
    expect(s.counts().disposed).toBe(s.counts().creates);
    expect(s.coordinator.read()).toEqual({ status: 'idle', applied: null, error: null });
    expect(s.port.getTextures(name(second))).toBe(baseline);
    await s.coordinator.dispose();
    await expect(s.coordinator.apply(proposal())).rejects.toThrow();
  });
  it('asset ou superfície inválidos não preparam texturas nem alteram ConfigurationStore', async () => {
    const s = setup();
    const previous = s.store.read();
    const bad = proposal();
    bad.revestimentos[0]!.base_color.sha256 = '0'.repeat(64);
    await expect(s.coordinator.apply(bad)).rejects.toThrow('SHA');
    await expect(s.coordinator.apply(proposal('demo-custom', 'unknown'))).rejects.toThrow(
      'surface_id',
    );
    expect(s.counts().creates).toBe(0);
    expect(s.pbr.customCacheStats().active).toBe(0);
    expect(s.store.read()).toEqual(previous);
  });
  it('não aplica parcialmente se último asset é inválido', async () => {
    const s = setup();
    const p = proposal();
    const extra = proposal('demo-custom', registry.configurableSurfaces[1]!.surfaceId)
      .revestimentos[0]!;
    extra.base_color.sha256 = '0'.repeat(64);
    p.revestimentos.push(extra);
    await expect(s.coordinator.apply(p)).rejects.toThrow('SHA');
    expect(s.counts().creates).toBe(0);
    expect(s.port.getTextures(name('seat'))).toBe(baseline);
  });
  it('falha ao preparar textura libera recursos; não permite corrida com catálogo', async () => {
    const s = setup();
    let release!: () => void;
    const pending = s.core.replaceCustomConfiguration({
      seat: {
        cacheKey: 'delayed',
        create: () =>
          new Promise((resolve) => {
            release = () => resolve({ texture: texture(), dispose() {} });
          }),
      },
    });
    await expect(s.core.restorePbrConfiguration({})).rejects.toThrow('proposta custom');
    s.core.dispose();
    release();
    await expect(pending).rejects.toThrow('cancelada');
    expect(s.pbr.customCacheStats().active).toBe(0);
    await expect(
      setup().core.replaceCustomConfiguration({
        seat: {
          cacheKey: 'bad',
          create: async () => {
            throw new Error('GPU');
          },
        },
      }),
    ).rejects.toThrow('GPU');
  });
  it('mantém serializer F7 e GLB canônicos após custom', async () => {
    const s = setup();
    const serializer = new ConfigSerializer(
      manifest,
      registry.configurableSurfaces.map((x) => x.surfaceId),
    );
    const before = serializer.serialize(s.store.read());
    await s.coordinator.apply(proposal());
    await s.coordinator.reset();
    expect(serializer.serialize(s.store.read())).toBe(before);
    expect(before).not.toContain('custom:');
    expect(
      createHash('sha256')
        .update(readFileSync('assets/geometry/karv-chair/v2/base.glb'))
        .digest('hex'),
    ).toBe(manifest.sha256);
  });
});
