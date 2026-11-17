import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { captureInstallPrompt, registerServiceWorker } from '../pwa/pwa';
import '../styles/tokens.css';
import '../styles/app.css';

// App instalavel (Fase 8): o Chrome avisa que pode instalar antes de qualquer tela montar.
captureInstallPrompt();
registerServiceWorker();

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
