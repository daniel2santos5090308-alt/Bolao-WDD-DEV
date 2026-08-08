const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        react: 'react.html'
      }
    }
  }
});
