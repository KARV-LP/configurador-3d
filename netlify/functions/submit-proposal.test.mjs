import { describe, expect, it } from 'vitest';

import { resolveCommercialRecipient } from './submit-proposal.mjs';

describe('commercial proposal recipient', () => {
  it('uses the KARV commercial email by default', () => {
    expect(resolveCommercialRecipient({})).toBe('comercial@k-arv.com');
  });

  it('allows an explicit runtime override', () => {
    expect(
      resolveCommercialRecipient({ KARV_PROPOSAL_RECIPIENT_EMAIL: ' propostas@k-arv.com ' }),
    ).toBe('propostas@k-arv.com');
  });
});
