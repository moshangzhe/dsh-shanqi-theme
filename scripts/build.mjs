/**
 * 构建脚本：
 * - lib/index.js：宿主半侧（ESM，schema 依赖外置）。
 * - lib/client.js：浏览器模块，注册进 window.__ModuleLoader__.load，
 *   id 必须等于包名 dsh-shanqi-theme。
 */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assetLoaders } from './asset-loaders.mjs';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('lib', { recursive: true });

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['@deepseek-ai/schemastery'],
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});

const client = await build({
  entryPoints: ['src/client.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'chrome120',
  write: false,
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  loader: assetLoaders,
  jsx: 'automatic',
  legalComments: 'none',
  minify: false,
  logLevel: 'info',
});

const banner = `/* 山栖 · dsh-shanqi-theme — MIT License. 场景美术资源版权归插件作者所有。 */\n`;
const body = client.outputFiles?.[0]?.text ?? '';
await writeFile(
  'lib/client.js',
  `${banner}window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${body}\nreturn module.exports;}});\n`,
);

const host = await readFile('lib/index.js', 'utf8');
if (!host.includes('export') && !host.includes('Config')) throw new Error('宿主产物缺少导出。');

// 独立场景预览：复用真实 scene.ts，生成单文件可离线打开。
const preview = await build({
  entryPoints: ['preview/preview.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome120',
  write: false,
  loader: assetLoaders,
  minify: true,
  legalComments: 'none',
  logLevel: 'silent',
});
const template = await readFile('preview/preview.html', 'utf8');
const previewScript = preview.outputFiles?.[0]?.text ?? '';
await mkdir('docs', { recursive: true });
await writeFile('docs/preview.html', template.replace('/*__PREVIEW_SCRIPT__*/', previewScript));

console.log(`Built ${pkg.name}: lib/index.js, lib/client.js (${(body.length / 1024 / 1024).toFixed(2)} MiB client body), docs/preview.html (${(previewScript.length / 1024 / 1024).toFixed(2)} MiB preview)`);
