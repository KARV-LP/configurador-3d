import { describe, expect, it } from 'vitest';

import {
  buildCommercialEmail,
  resolveCommercialRecipient,
  resolveSmtpConfig,
} from '../../netlify/functions/submit-proposal.mjs';

describe('commercial proposal recipient', () => {
  it('uses the KARV commercial email by default', () => {
    expect(resolveCommercialRecipient({})).toBe('comercial@k-arv.com');
  });

  it('allows an explicit runtime override', () => {
    expect(
      resolveCommercialRecipient({ KARV_PROPOSAL_RECIPIENT_EMAIL: ' propostas@k-arv.com ' }),
    ).toBe('propostas@k-arv.com');
  });

  it('requires complete SMTP credentials', () => {
    expect(resolveSmtpConfig({ KARV_SMTP_HOST: 'smtp.hostinger.com' })).toBeNull();
    expect(
      resolveSmtpConfig({
        KARV_SMTP_HOST: 'smtp.hostinger.com',
        KARV_SMTP_USER: 'comercial@k-arv.com',
        KARV_SMTP_PASSWORD: 'secret',
      }),
    ).toMatchObject({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      user: 'comercial@k-arv.com',
      fromEmail: 'comercial@k-arv.com',
    });
  });

  it('builds a safe commercial summary', () => {
    const message = buildCommercialEmail({
      proposalId: 'KARV-PROP-TESTE',
      receivedAt: '2026-10-21T23:00:00Z',
      manifestKey: 'KARV-PROP-TESTE/manifest.json',
      contact: {
        name: '<Cliente>',
        company: 'Estúdio',
        whatsapp: '11999999999',
        email: 'cliente@example.com',
        cityState: 'São Paulo/SP',
        notes: '<script>alert(1)</script>',
      },
      surfaces: [
        {
          surfaceName: 'Assento',
          source: 'custom-art',
          customFileName: 'arte.pdf',
        },
      ],
    });
    expect(message.subject).toContain('KARV-PROP-TESTE');
    expect(message.text).toContain('Assento: Sua ARTE — arte.pdf');
    expect(message.html).toContain('&lt;Cliente&gt;');
    expect(message.html).not.toContain('<script>');
  });
});
