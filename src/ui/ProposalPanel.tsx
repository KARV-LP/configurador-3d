import { useState, type FormEvent } from 'react';
import type { ProposalContact, ProposalSurfacePayload } from '../proposals/proposal-submission';

export type ProposalSubmitState =
  | { readonly kind: 'idle' | 'submitting' }
  | { readonly kind: 'success'; readonly proposalId: string }
  | { readonly kind: 'error'; readonly message: string };

interface ProposalPanelProps {
  readonly snapshotUrl: string;
  readonly surfaces: readonly ProposalSurfacePayload[];
  readonly previewBySurface: Readonly<Record<string, string | null | undefined>>;
  readonly submitState: ProposalSubmitState;
  readonly onClose: () => void;
  readonly onSubmit: (contact: ProposalContact) => void;
}

const EMPTY_CONTACT: ProposalContact = Object.freeze({
  name: '',
  company: '',
  whatsapp: '',
  email: '',
  cityState: '',
  notes: '',
});

export function ProposalPanel({
  snapshotUrl,
  surfaces,
  previewBySurface,
  submitState,
  onClose,
  onSubmit,
}: ProposalPanelProps) {
  const [contact, setContact] = useState<ProposalContact>(EMPTY_CONTACT);
  const busy = submitState.kind === 'submitting';

  const update = (field: keyof ProposalContact, value: string) => {
    setContact((current) => ({ ...current, [field]: value }));
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(contact);
  };

  return (
    <aside className="proposal-sheet" role="dialog" aria-label="Enviar Proposta">
      <header className="proposal-sheet__header">
        <div>
          <p className="sheet-kicker">Atendimento comercial KARV</p>
          <h2>Enviar Proposta</h2>
          <p>Confira a configuração atual e informe seus dados.</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar proposta"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="proposal-sheet__content">
        <section className="proposal-preview" aria-label="Preview da Poltrona KARV">
          <img src={snapshotUrl} alt="Poltrona KARV com a configuração atual" />
          <ol>
            {surfaces.map((surface) => (
              <li key={surface.surfaceId}>
                {previewBySurface[surface.surfaceId] && (
                  <img src={previewBySurface[surface.surfaceId] ?? undefined} alt="" />
                )}
                <div>
                  <strong>{surface.surfaceName}</strong>
                  <span>
                    {surface.source === 'custom-art'
                      ? 'Sua ARTE'
                      : surface.source === 'library'
                        ? surface.materialName
                        : 'Acabamento original'}
                  </span>
                  {surface.customFileName && <small>{surface.customFileName}</small>}
                  {surface.materialId && <small>ID: {surface.materialId}</small>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <form className="proposal-form" onSubmit={handleSubmit}>
          <label>
            <span>Nome *</span>
            <input
              name="name"
              autoComplete="name"
              required
              maxLength={120}
              value={contact.name}
              onChange={(event) => update('name', event.target.value)}
            />
          </label>
          <label>
            <span>Empresa/Estúdio</span>
            <input
              name="company"
              autoComplete="organization"
              maxLength={160}
              value={contact.company}
              onChange={(event) => update('company', event.target.value)}
            />
          </label>
          <label>
            <span>WhatsApp *</span>
            <input
              name="whatsapp"
              type="tel"
              autoComplete="tel"
              required
              maxLength={40}
              value={contact.whatsapp}
              onChange={(event) => update('whatsapp', event.target.value)}
            />
          </label>
          <label>
            <span>E-mail *</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={200}
              value={contact.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </label>
          <label>
            <span>Cidade/UF *</span>
            <input
              name="cityState"
              autoComplete="address-level2"
              required
              maxLength={120}
              value={contact.cityState}
              onChange={(event) => update('cityState', event.target.value)}
            />
          </label>
          <label className="proposal-form__wide">
            <span>Observações</span>
            <textarea
              name="notes"
              rows={4}
              maxLength={2000}
              value={contact.notes}
              onChange={(event) => update('notes', event.target.value)}
            />
          </label>

          <div className="proposal-form__actions">
            <button type="submit" className="button button--primary" disabled={busy}>
              {busy ? 'Enviando…' : 'ENVIAR PROPOSTA'}
            </button>
            <p role="status" aria-live="polite">
              {submitState.kind === 'success'
                ? `Proposta ${submitState.proposalId} recebida. A KARV dará continuidade ao atendimento.`
                : submitState.kind === 'error'
                  ? submitState.message
                  : 'Sem checkout: este envio inicia o atendimento comercial.'}
            </p>
          </div>
        </form>
      </div>
    </aside>
  );
}
