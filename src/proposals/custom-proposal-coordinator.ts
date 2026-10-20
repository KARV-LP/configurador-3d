import type { Core3DController } from '../3d/core-3d-controller';
import type { CustomBaseColorSource, OwnedCustomTexture } from '../3d/custom-base-color';
import type { SurfaceMap } from '../domain/surface-map';
import { loadCustomAsset, type CustomAssetIO } from './custom-asset-loader';
import { resolveCustomProposal, type ResolvedCustomProposal } from './proposal-resolver';
import { derivePdfUvAsset, pdfUvProfileFor } from './pdf-uv-profile';

export interface ProposalSessionState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly applied: Readonly<{
    proposal_id: string;
    contract_version: 1;
    references: Readonly<Record<string, string>>;
  }> | null;
  readonly error: string | null;
}

/** Fronteira própria F11 → Core, sem adaptar custom para o catálogo. */
export async function prepareCustomProposal(
  resolved: ResolvedCustomProposal,
  io: CustomAssetIO,
  create: (blob: Blob) => Promise<OwnedCustomTexture>,
): Promise<Readonly<Record<string, CustomBaseColorSource>>> {
  if (
    resolved.assignments.reduce((sum, a) => sum + a.revestimento.base_color.byte_length, 0) >
    32 * 1024 * 1024
  ) {
    throw new Error('Budget de bytes da proposta excedido.');
  }
  const sources: Record<string, CustomBaseColorSource> = {};
  // Toda validação de bytes/decodificação termina antes de preparar recursos do viewer.
  for (const assignment of resolved.assignments) {
    const asset = await loadCustomAsset(assignment.revestimento, resolved.proposal.proposal_id, io);
    const profile = pdfUvProfileFor(resolved.proposal.proposal_id, assignment.surface.surfaceId);
    sources[assignment.surface.surfaceId] = Object.freeze({
      cacheKey: profile ? `${asset.cacheKey}|pdf-uv:${profile.id}` : asset.cacheKey,
      create: async () =>
        create(profile ? await derivePdfUvAsset(asset.blob, profile) : asset.blob),
    });
  }
  return Object.freeze(sources);
}

export class CustomProposalCoordinator {
  private state: ProposalSessionState = Object.freeze({
    status: 'idle',
    applied: null,
    error: null,
  });
  private pending: Promise<void> | null = null;
  private disposed = false;
  private resetting: Promise<void> | null = null;

  constructor(
    private readonly core: Pick<Core3DController, 'replaceCustomConfiguration'>,
    private readonly map: SurfaceMap,
    private readonly io: CustomAssetIO,
    private readonly create: (blob: Blob) => Promise<OwnedCustomTexture>,
  ) {}

  read(): ProposalSessionState {
    return this.state;
  }

  apply(value: unknown): Promise<void> {
    if (this.disposed || this.pending || this.resetting)
      return Promise.reject(new Error('Sessão custom indisponível ou ocupada.'));
    this.state = Object.freeze({ ...this.state, status: 'loading', error: null });
    const work = async () => {
      try {
        const resolved = resolveCustomProposal(value, this.map);
        const sources = await prepareCustomProposal(resolved, this.io, this.create);
        if (this.disposed) throw new Error('Sessão custom encerrada.');
        await this.core.replaceCustomConfiguration(sources);
        this.state = Object.freeze({
          status: 'ready',
          error: null,
          applied: Object.freeze({
            proposal_id: resolved.proposal.proposal_id,
            contract_version: 1,
            references: Object.freeze(
              Object.fromEntries(
                resolved.assignments.map((a) => [a.surface.surfaceId, a.reference]),
              ),
            ),
          }),
        });
      } catch (error) {
        this.state = Object.freeze({
          ...this.state,
          status: 'error',
          error: error instanceof Error ? error.message : 'Falha custom.',
        });
        throw error;
      }
    };
    this.pending = work().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  reset(): Promise<void> {
    if (this.resetting) return this.resetting;
    const work = async () => {
      if (this.pending) await this.pending.catch(() => undefined);
      try {
        await this.core.replaceCustomConfiguration({});
        this.state = Object.freeze({ status: 'idle', applied: null, error: null });
      } catch (error) {
        this.state = Object.freeze({
          ...this.state,
          status: 'error',
          error: 'Falha no reset custom.',
        });
        throw error;
      }
    };
    this.resetting = work().finally(() => {
      this.resetting = null;
    });
    return this.resetting;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.reset();
  }
}
