import type { ARMode, ARSupport } from '../ar/ar-capability.port';
import type { ARPresentationStatus } from '../ar/ar-controller';

export type ARExperienceKind = 'desktop-qr' | 'mobile' | 'unsupported' | 'error';

interface ARExperiencePanelProps {
  readonly kind: ARExperienceKind;
  readonly support: ARSupport;
  readonly mode: ARMode;
  readonly status: ARPresentationStatus;
  readonly qrSvg?: string | null;
  readonly handoffUrl?: string | null;
  readonly onActivate: () => void;
  readonly onCopy: () => void;
  readonly onClose: () => void;
}

function modeLabel(mode: ARMode): string {
  if (mode === 'webxr') return 'RA no navegador';
  if (mode === 'quick-look') return 'AR Quick Look';
  return 'Realidade aumentada';
}

function qrDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function ARExperiencePanel({
  kind,
  support,
  mode,
  status,
  qrSvg,
  handoffUrl,
  onActivate,
  onCopy,
  onClose,
}: ARExperiencePanelProps) {
  if (kind === 'desktop-qr') {
    return (
      <section
        className="ar-handoff"
        role="dialog"
        aria-label="Abrir configuração no celular"
        data-testid="ar-handoff"
        data-handoff-url={handoffUrl ?? ''}
      >
        <button type="button" className="ar-handoff__close" aria-label="Fechar QR Code" onClick={onClose}>
          ×
        </button>
        <div className="ar-handoff__intro">
          <p className="sheet-kicker">Ver no ambiente</p>
          <h2>Leve esta KARV para o celular</h2>
          <p>Escaneie o QR Code. A mesma combinação será restaurada antes de abrir a RA.</p>
        </div>
        <div className="ar-qr-projection" data-testid="ar-qr-projection">
          {qrSvg ? (
            <img src={qrDataUrl(qrSvg)} alt="QR Code da configuração atual" />
          ) : (
            <div className="ar-qr-placeholder" role="status">
              Gerando QR Code…
            </div>
          )}
          <strong>Escaneie com seu celular</strong>
          <span>iPhone e Android compatíveis</span>
        </div>
        <div className="ar-handoff__actions">
          <button type="button" className="button" disabled={!handoffUrl} onClick={onCopy}>
            Copiar link
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            Voltar ao configurador
          </button>
        </div>
      </section>
    );
  }

  if (kind === 'mobile' && support === 'supported') {
    return (
      <section
        className="ar-mobile-sheet"
        role="dialog"
        aria-label="Ver poltrona no ambiente"
        data-testid="ar-mobile-panel"
        data-handoff-url={handoffUrl ?? ''}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <p className="sheet-kicker">{modeLabel(mode)}</p>
        <h2>Sua configuração está pronta</h2>
        <p>
          A poltrona será aberta em escala real, preservando os materiais desta configuração.
        </p>
        {status === 'failed' && (
          <p className="ar-mobile-sheet__error" role="status">
            A RA não iniciou. Você pode continuar usando o configurador normalmente.
          </p>
        )}
        <button type="button" className="button button--primary" onClick={onActivate}>
          Ver no meu ambiente
        </button>
        <button type="button" className="text-button" onClick={onClose}>
          Continuar no 3D
        </button>
      </section>
    );
  }

  return (
    <section
      className="ar-mobile-sheet"
      role="dialog"
      aria-label="Realidade aumentada indisponível"
      data-testid="ar-mobile-panel"
      data-handoff-url={handoffUrl ?? ''}
    >
      <div className="sheet-handle" aria-hidden="true" />
      <p className="sheet-kicker">Ver no ambiente</p>
      <h2>{kind === 'error' ? 'Não foi possível preparar a RA' : 'RA indisponível neste dispositivo'}</h2>
      <p>
        Sua configuração continua preservada no 3D. Você pode compartilhar o link e abrir em outro
        aparelho compatível.
      </p>
      <button type="button" className="button" disabled={!handoffUrl} onClick={onCopy}>
        Copiar link da configuração
      </button>
      <button type="button" className="text-button" onClick={onClose}>
        Continuar no 3D
      </button>
    </section>
  );
}
