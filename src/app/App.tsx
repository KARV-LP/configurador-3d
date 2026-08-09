import { ModelStage } from '../ui/ModelStage';

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="phase-label">F1 · Fundação técnica</p>
        <h1>Configurador 3D KARV</h1>
        <p>
          Aplicação mínima para validar arquitetura, asset canônico e carregamento
          determinístico do viewer.
        </p>
      </header>
      <ModelStage />
    </main>
  );
}
