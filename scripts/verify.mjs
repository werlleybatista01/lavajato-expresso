import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const localAssets = [...html.matchAll(/(?:src|href)="(\.\/(?:js|css)\/[^"?#]+)"/g)]
  .map(([, path]) => path);

if (localAssets.length === 0) {
  throw new Error('Nenhum asset local foi encontrado no index.html.');
}

for (const asset of localAssets) {
  await access(resolve(root, asset), constants.R_OK);
}

const scripts = localAssets.filter((asset) => asset.endsWith('.js'));
for (const script of scripts) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, script)], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `JavaScript inválido: ${script}`);
  }
}

const requiredModules = [
  'utils.js', 'database.js', 'charts.js', 'dashboard.js', 'financeiro.js',
  'servicos.js', 'estoque.js', 'funcionarios.js', 'simuladores.js',
  'relatorios.js', 'app.js'
];

for (const moduleName of requiredModules) {
  if (!scripts.some((path) => path.endsWith(`/${moduleName}`))) {
    throw new Error(`Módulo obrigatório ausente no HTML: ${moduleName}`);
  }
}

console.log(`Verificação concluída: ${localAssets.length} assets e ${scripts.length} módulos válidos.`);
