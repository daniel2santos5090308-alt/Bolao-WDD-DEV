const fs = require('node:fs');
const path = require('node:path');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

const rootDir = path.resolve(__dirname, '..');
loadDotEnv(path.join(rootDir, '.env'));
loadDotEnv(path.join(rootDir, '.env.local'));

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  APP_ENV: process.env.APP_ENV || ''
};

const outputPath = path.join(rootDir, 'public', 'assets', 'js', 'runtime-config.js');
const output = `window.BOLAO_RUNTIME_CONFIG = ${JSON.stringify(config, null, 2)};\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(`Runtime config written to ${path.relative(rootDir, outputPath)}`);
