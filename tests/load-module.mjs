/** 用 esbuild 把 TS 源文件打成临时 ESM，供 node:test 直接导入。 */
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const cache = new Map();

export async function loadModule(entry) {
  if (cache.has(entry)) return cache.get(entry);
  await mkdir('.test-build', { recursive: true });
  const outfile = `.test-build/${entry.replace(/[\\/]/g, '_')}.mjs`;
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    jsx: 'automatic',
    external: ['react'],
    loader: { '.png': 'dataurl', '.css': 'text' },
    logLevel: 'silent',
  });
  const module = await import(`${pathToFileURL(resolve(outfile)).href}?v=${Date.now()}`);
  cache.set(entry, module);
  return module;
}
