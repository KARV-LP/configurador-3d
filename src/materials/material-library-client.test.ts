import { describe, expect, it } from 'vitest';
import { MaterialLibraryClient } from './material-library-client';

const rawCatalog = {
  schema: 'karv.public-material-catalog/1',
  channels: ['fabric', 'karv_design'],
  materials: [
    {
      id: 'fabric-kv-001',
      channel: 'fabric',
      name: 'Tecido Preto',
      collection: 'Coleção A',
      color: { name: 'Preto', family: 'preto' },
      material_type: 'veludo',
      technologies: [],
      functional: {
        pet_friendly: false,
        water_repellency: false,
        easy_clean: false,
        indoor_use: true,
        outdoor_use: false,
      },
      appearance: { texture: 'lisa', touch: 'macio', sheen: 'baixo', visual_character: ['neutro'] },
      physical_reference_cm: { width: 120, height: 60 },
      assets: {
        preview: './assets/fabric-kv-001/preview.webp',
        base_color: './assets/fabric-kv-001/base-color.webp',
        normal: null,
        ao: null,
      },
      published: true,
      ready_for_configurator: true,
      pbr_ready: false,
      compatibility: { geometry_ids: ['karv-chair'], min_geometry_version: 2 },
    },
  ],
};

class MemoryStorage {
  value: string | null = null;
  getItem() {
    return this.value;
  }
  setItem(_key: string, value: string) {
    this.value = value;
  }
}

describe('MaterialLibraryClient', () => {
  it('usa rede e grava somente catálogo validado no cache', async () => {
    const storage = new MemoryStorage();
    const client = new MaterialLibraryClient(
      'https://example.test/public/v1/catalog.json',
      async () => new Response(JSON.stringify(rawCatalog), { status: 200 }),
      storage,
    );
    const result = await client.load();
    expect(result.source).toBe('network');
    expect(storage.value).toContain('fabric-kv-001');
  });

  it('degrada para cache validado quando a Biblioteca está indisponível', async () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify(rawCatalog);
    const client = new MaterialLibraryClient(
      'https://example.test/public/v1/catalog.json',
      async () => {
        throw new Error('offline');
      },
      storage,
    );
    const result = await client.load();
    expect(result.source).toBe('cache');
    expect(result.catalog.materials).toHaveLength(1);
  });

  it('gera erro controlado sem cache e não depende do Core 3D', async () => {
    const client = new MaterialLibraryClient(
      'https://example.test/public/v1/catalog.json',
      async () => new Response('', { status: 503 }),
      new MemoryStorage(),
    );
    await expect(client.load()).rejects.toThrow('Biblioteca KARV indisponível');
  });
});
