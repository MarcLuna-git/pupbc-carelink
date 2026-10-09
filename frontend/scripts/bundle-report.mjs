import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const entry = Object.entries(manifest).find(([, value]) => value.isEntry)?.[0];
const closure = new Set();
function visit(key) {
  if (closure.has(key)) return;
  closure.add(key);
  for (const dependency of manifest[key]?.imports || []) visit(dependency);
}
visit(entry);
function size(file) {
  const data = readFileSync(resolve('dist', file));
  return { file, bytes: statSync(resolve('dist', file)).size, gzip_bytes: gzipSync(data).length };
}
const initial = [...closure].map(key => size(manifest[key].file));
const routes = Object.entries(manifest).filter(([key]) => /KioskScan|NurseDashboard|HealthProfile|pages\/Student\/QR/.test(key))
  .map(([source, item]) => ({ source, ...size(item.file), imports: item.imports || [], dynamic_imports: item.dynamicImports || [] }));
const result = { initial_js: initial, initial_js_bytes: initial.reduce((sum, item) => sum + item.bytes, 0),
  initial_js_gzip_bytes: initial.reduce((sum, item) => sum + item.gzip_bytes, 0), routes };
const output = JSON.stringify(result, null, 2) + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], output);
console.log(output);
