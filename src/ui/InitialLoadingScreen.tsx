interface InitialLoadingScreenProps {
  readonly progress: number;
  readonly stage: string;
  readonly status: 'loading' | 'ready' | 'error';
  readonly visible: boolean;
  readonly onRetry: () => void;
}

export function InitialLoadingScreen({
  progress,
  stage,
  status,
  visible,
  onRetry,
}: InitialLoadingScreenProps) {
  if (!visible) return null;

  const roundedProgress = Math.round(progress);
  const isError = status === 'error';

  return (
    <section
      className={`initial-loader initial-loader--${status}`}
      data-testid="initial-loading"
      data-progress={roundedProgress}
      data-stage={stage}
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      aria-label="Carregamento do Configurador 3D KARV"
    >
      <div className="initial-loader__content">
        <span className="initial-loader__brand" aria-hidden="true">
          KARV
        </span>
        <h1>Preparando sua Poltrona KARV</h1>

        {isError ? (
          <>
            <p className="initial-loader__error">
              Não foi possível preparar o configurador. Verifique sua conexão e tente novamente.
            </p>
            <button type="button" onClick={onRetry}>
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <div
              className="initial-loader__progress"
              role="progressbar"
              aria-label="Progresso do carregamento"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={roundedProgress}
            >
              <span style={{ width: `${roundedProgress}%` }} />
            </div>
            <div className="initial-loader__meta">
              <span>{stage}</span>
              <strong>{roundedProgress}%</strong>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
