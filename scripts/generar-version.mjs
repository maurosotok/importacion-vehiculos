import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = process.env.BUILD_SHA || 'local';
const version = { sha, construido_en: new Date().toISOString() };

await mkdir(path.join(RAIZ, 'dist'), { recursive: true });
await writeFile(path.join(RAIZ, 'dist', 'version.json'), `${JSON.stringify(version, null, 2)}\n`);
console.log(`dist/version.json generado (sha: ${sha})`);
