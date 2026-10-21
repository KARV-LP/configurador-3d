import type { CustomRevestimento } from './custom-revestimento';

export interface CustomProposal {
  readonly contract_version: 1;
  readonly proposal_id: string;
  readonly geometry: Readonly<{ id: 'karv-chair'; version: 2; sha256: string }>;
  readonly validation_status: 'draft' | 'approved' | 'rejected';
  readonly revestimentos: readonly CustomRevestimento[];
  readonly public_metadata: Readonly<{ title: string }>;
}
