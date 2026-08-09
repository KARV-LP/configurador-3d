import { describe, expect, it } from 'vitest';
import { ConfigurationStore } from './configuration-store';

describe('ConfigurationStore', () => {
  it('substitui snapshot completo e limpa superfícies omitidas', () => {
    const store = new ConfigurationStore(['seat', 'backrest-front']);
    store.assignAll('fabric-kv-001');
    store.replace({ seat: 'fabric-kv-002' });

    expect(store.read()).toEqual({
      assignments: {
        seat: 'fabric-kv-002',
        'backrest-front': null,
      },
    });
  });

  it('rejeita superfície desconhecida antes de alterar o estado', () => {
    const store = new ConfigurationStore(['seat', 'backrest-front']);
    store.assign('seat', 'fabric-kv-001');
    const before = store.read();

    expect(() => store.replace({ 'surface-ghost': 'fabric-kv-002' })).toThrow(
      'Superfície fora do estado configurável',
    );
    expect(store.read()).toEqual(before);
  });
});
