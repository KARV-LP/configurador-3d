export interface ConfigurationSummaryItem {
  readonly surfaceName: string;
  readonly materialName: string;
}

export type ShareConfigurationState = 'idle' | 'copied' | 'ready' | 'error';

interface ConfigurationSummaryProps {
  readonly items: readonly ConfigurationSummaryItem[];
  readonly total: number;
  readonly shareState: ShareConfigurationState;
  readonly onClose: () => void;
  readonly onResetAll: () => void;
  readonly onShare: () => void;
}

export function ConfigurationSummary({
  items,
  total,
  shareState,
  onClose,
  onResetAll,
  onShare,
}: ConfigurationSummaryProps) {
  const shareMessage =
    shareState === 'copied'
      ? 'Link copiado.'
      : shareState === 'ready'
        ? 'Link pronto na barra do navegador.'
        : shareState === 'error'
          ? 'O link foi gerado, mas não foi possível copiá-lo automaticamente.'
          : 'O link usa somente IDs públicos da configuração.';

  return (
    <aside className="summary-sheet" role="dialog" aria-label="Resumo da configuração">
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <div>
          <p className="sheet-kicker">Sua KARV</p>
          <h2>Resumo da configuração</h2>
          <p className="sheet-subtitle">
            {items.length}/{total} áreas personalizadas
          </p>
        </div>
        <button type="button" className="icon-button" aria-label="Fechar resumo" onClick={onClose}>
          ×
        </button>
      </header>

      <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="summary-progress" aria-hidden="true">
          <span style={{ width: total > 0 ? `${(items.length / total) * 100}%` : '0%' }} />
        </div>

        {items.length === 0 ? (
          <div className="summary-empty">
            <span className="summary-empty__mark" aria-hidden="true">
              K
            </span>
            <strong>Sua configuração começa no 3D</strong>
            <p>Toque em uma área da poltrona e escolha um material para montar sua combinação.</p>
          </div>
        ) : (
          <ol className="summary-list">
            {items.map((item, index) => (
              <li key={`${item.surfaceName}-${index}`}>
                <span className="summary-list__index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{item.surfaceName}</strong>
                  <span>{item.materialName}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className="summary-actions">
        <button type="button" className="button button--primary" disabled={items.length === 0} onClick={onShare}>
          Compartilhar configuração
        </button>
        <button type="button" className="button" disabled={items.length === 0} onClick={onResetAll}>
          Restaurar poltrona
        </button>
        <p data-testid="share-status" aria-live="polite">
          {shareMessage}
        </p>
      </footer>
    </aside>
  );
}
