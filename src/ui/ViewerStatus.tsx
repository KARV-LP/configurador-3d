import type { ViewerState } from '../3d/ChairViewer';

const messages: Record<ViewerState, string> = {
  registering: 'Preparando visualizador 3D…',
  loading: 'Carregando poltrona oficial…',
  ready: 'Modelo 3D carregado',
  error: 'Não foi possível carregar o modelo 3D.',
};

export function ViewerStatus({ state }: { readonly state: ViewerState }) {
  return (
    <p
      className={`viewer-status viewer-status--${state}`}
      data-testid="viewer-status"
      data-state={state}
      role="status"
      aria-live="polite"
    >
      <span className="status-dot" aria-hidden="true" />
      {messages[state]}
    </p>
  );
}
