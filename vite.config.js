const fs = require('node:fs');
const path = require('node:path');
const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

/**
 * Identificador do deploy (Fase 8). No Netlify: o commit publicado (COMMIT_REF);
 * fora dele: a hora do build. Vai para o app (__APP_BUILD__), para /version.json
 * (aviso de nova versao) e para /sw.js (um cache por deploy).
 */
const BUILD_ID = process.env.COMMIT_REF
  ? `${process.env.COMMIT_REF.slice(0, 12)}-${Date.now().toString(36)}`
  : Date.now().toString(36);

/** Publica /sw.js (de src/pwa/sw.js) e /version.json no build de producao. */
function pwaFiles() {
  return {
    name: 'bolao-pwa-files',
    apply: 'build',
    generateBundle() {
      const template = fs.readFileSync(path.join(__dirname, 'src', 'pwa', 'sw.js'), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template.replaceAll('__BUILD_ID__', BUILD_ID) });
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify({ build: BUILD_ID })}\n` });
    }
  };
}

module.exports = defineConfig(({ command }) => ({
  plugins: [react(), pwaFiles()],
  define: {
    __APP_BUILD__: JSON.stringify(command === 'build' ? BUILD_ID : 'dev')
  },
  build: {
    rolldownOptions: {
      input: {
        index: 'index.html',
        react: 'react.html'
      },
      output: {
        // Bibliotecas (React, Supabase) mudam pouco: chunk separado fica no cache do navegador entre deploys.
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }]
        }
      }
    }
  }
}));
