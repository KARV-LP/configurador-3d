import QRCode from 'qrcode';
import { CONFIGURATION_QUERY_PARAM } from '../configurator/config-serializer';
import { ConfigurationSession } from '../configurator/configuration-session';
import type { CoreConfigurationSnapshot } from '../configurator/configuration-store';

export const AR_INTENT_QUERY_PARAM = 'intent';
export const AR_INTENT_VALUE = 'ar';
const MAX_QR_URL_BYTES = 2800;

export interface QRHandoffPayload {
  readonly url: string;
  readonly svg: string;
}

export class QRHandoffError extends Error {}

function hasAssignments(snapshot: CoreConfigurationSnapshot): boolean {
  return Object.values(snapshot.assignments).some((materialId) => materialId !== null);
}

export function createARHandoffUrl(
  currentUrl: string,
  session: ConfigurationSession,
  snapshot: CoreConfigurationSnapshot,
): string {
  const shareUrl = hasAssignments(snapshot)
    ? session.createShareUrl(currentUrl, snapshot)
    : currentUrl;
  const url = new URL(shareUrl);

  if (!hasAssignments(snapshot)) {
    url.searchParams.delete(CONFIGURATION_QUERY_PARAM);
  }

  url.searchParams.set(AR_INTENT_QUERY_PARAM, AR_INTENT_VALUE);
  url.hash = '';
  return url.href;
}

export function hasARIntent(currentUrl: string): boolean {
  const url = new URL(currentUrl);
  return url.searchParams.get(AR_INTENT_QUERY_PARAM) === AR_INTENT_VALUE;
}

export async function createQRHandoff(
  currentUrl: string,
  session: ConfigurationSession,
  snapshot: CoreConfigurationSnapshot,
): Promise<QRHandoffPayload> {
  const url = createARHandoffUrl(currentUrl, session, snapshot);
  const bytes = new TextEncoder().encode(url).byteLength;
  if (bytes > MAX_QR_URL_BYTES) {
    throw new QRHandoffError('Configuração excede a capacidade segura do QR Code.');
  }

  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: 'L',
      margin: 2,
      color: { dark: '#101010', light: '#F8F6F0' },
    });
    return Object.freeze({ url, svg });
  } catch (error) {
    throw new QRHandoffError('Não foi possível gerar o QR Code.', { cause: error });
  }
}
