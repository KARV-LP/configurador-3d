export interface ProposalContact {
  readonly name: string;
  readonly company: string;
  readonly whatsapp: string;
  readonly email: string;
  readonly cityState: string;
  readonly notes: string;
}

export interface ProposalSurfacePayload {
  readonly surfaceId: string;
  readonly surfaceName: string;
  readonly source: 'original' | 'library' | 'custom-art';
  readonly materialId: string | null;
  readonly materialName: string | null;
  readonly customFileName: string | null;
  readonly customFileField: string | null;
}

export interface ProposalPayload {
  readonly schema: 'karv.customer-proposal/1';
  readonly geometry: {
    readonly id: string;
    readonly version: number;
    readonly sha256: string;
  };
  readonly submittedAt: string;
  readonly contact: ProposalContact;
  readonly surfaces: readonly ProposalSurfacePayload[];
  readonly snapshotField: 'snapshot';
}

interface SubmitProposalInput {
  readonly endpoint?: string;
  readonly payload: ProposalPayload;
  readonly snapshot: Blob;
  readonly customFiles: ReadonlyMap<string, File>;
  readonly signal?: AbortSignal;
}

export interface ProposalReceipt {
  readonly proposalId: string;
}

const UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024;

interface UploadDescriptor {
  readonly field: string;
  readonly surfaceId: string | null;
  readonly originalName: string;
  readonly mediaType: string;
  readonly bytes: number;
  readonly parts: number;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',', 2);
  const mediaType = header?.match(/^data:([^;]+);base64$/)?.[1];
  if (!mediaType || !encoded) throw new Error('Snapshot da poltrona inválido.');
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mediaType });
}

export async function submitProposal({
  endpoint = import.meta.env.VITE_KARV_PROPOSAL_ENDPOINT || '/.netlify/functions/submit-proposal',
  payload,
  snapshot,
  customFiles,
  signal,
}: SubmitProposalInput): Promise<ProposalReceipt> {
  const initialize = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'initialize' }),
    signal: signal ?? null,
  });
  if (!initialize.ok) throw new Error('Não foi possível iniciar o envio da proposta.');
  const session = (await initialize.json()) as { proposalId?: unknown; uploadToken?: unknown };
  if (typeof session.proposalId !== 'string' || typeof session.uploadToken !== 'string') {
    throw new Error('Resposta inválida do atendimento KARV.');
  }

  const sources: readonly Readonly<{
    field: string;
    surfaceId: string | null;
    file: Blob;
    name: string;
  }>[] = [
    { field: 'snapshot', surfaceId: null, file: snapshot, name: 'poltrona-karv.png' },
    ...[...customFiles].map(([surfaceId, file]) => ({
      field: `art:${surfaceId}`,
      surfaceId,
      file,
      name: file.name,
    })),
  ];
  const descriptors: UploadDescriptor[] = [];

  for (const source of sources) {
    const parts = Math.max(1, Math.ceil(source.file.size / UPLOAD_CHUNK_BYTES));
    for (let part = 0; part < parts; part++) {
      const chunk = source.file.slice(
        part * UPLOAD_CHUNK_BYTES,
        Math.min(source.file.size, (part + 1) * UPLOAD_CHUNK_BYTES),
        source.file.type,
      );
      const params = new URLSearchParams({
        action: 'upload',
        proposalId: session.proposalId,
        uploadToken: session.uploadToken,
        field: source.field,
        part: String(part),
        parts: String(parts),
      });
      const upload = await fetch(`${endpoint}?${params}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: chunk,
        signal: signal ?? null,
      });
      if (!upload.ok) throw new Error(`Falha ao enviar ${source.name}. Tente novamente.`);
    }
    descriptors.push({
      field: source.field,
      surfaceId: source.surfaceId,
      originalName: source.name,
      mediaType: source.file.type,
      bytes: source.file.size,
      parts,
    });
  }

  const finalize = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'finalize',
      proposalId: session.proposalId,
      uploadToken: session.uploadToken,
      payload,
      files: descriptors,
    }),
    signal: signal ?? null,
  });
  if (!finalize.ok) throw new Error('Não foi possível finalizar a proposta. Tente novamente.');
  const result = (await finalize.json()) as { proposalId?: unknown };
  if (result.proposalId !== session.proposalId)
    throw new Error('Resposta inválida do atendimento KARV.');
  return Object.freeze({ proposalId: session.proposalId });
}
