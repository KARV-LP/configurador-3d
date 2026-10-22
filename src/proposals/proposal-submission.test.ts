import { describe, expect, it } from 'vitest';
import { dataUrlToBlob } from './proposal-submission';

describe('envio de proposta', () => {
  it('converte o snapshot base64 sem alterar os bytes', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,AQID');
    expect(blob.type).toBe('image/png');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it('rejeita snapshot fora do formato esperado', () => {
    expect(() => dataUrlToBlob('https://example.com/image.png')).toThrow(
      'Snapshot da poltrona inválido.',
    );
  });
});
