import { describe, expect, it } from 'vitest';
import {
  decodeARSessionCredential,
  encodeARSessionCredential,
  readARSessionCredential,
} from './ar-session';

const SESSION_ID = 'KARV-AR-20261022T120000Z-ABCDEF12';
const ACCESS_TOKEN = 'a'.repeat(48);

describe('AR session credential', () => {
  it('transporta uma credencial opaca no link sem incluir a arte', () => {
    const credential = encodeARSessionCredential(SESSION_ID, ACCESS_TOKEN);
    expect(decodeARSessionCredential(credential)).toEqual({
      sessionId: SESSION_ID,
      accessToken: ACCESS_TOKEN,
    });
    expect(
      readARSessionCredential(`https://configurador.k-arv.com/#ar-session=${credential}`),
    ).toBe(credential);
  });

  it('rejeita credenciais previsíveis ou truncadas', () => {
    expect(() => decodeARSessionCredential(`${SESSION_ID}.curto`)).toThrow(
      'Credencial de RA inválida.',
    );
  });
});
