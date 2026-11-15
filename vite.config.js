const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
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
});
