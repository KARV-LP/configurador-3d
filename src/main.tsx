import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './3d/register-model-viewer';
import './app/styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root não encontrado');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
