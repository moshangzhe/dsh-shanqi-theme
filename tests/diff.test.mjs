import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './load-module.mjs';

const palette = await loadModule('src/palette.ts');
const tokens = palette.uiTokens();

function rgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
}
function luminance(hex) {
  return rgb(hex)
    .map(value => value / 255)
    .map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function blend(foreground, background, alpha) {
  const f = rgb(foreground);
  const b = rgb(background);
  return '#' + f.map((value, index) => Math.round(value * alpha + b[index] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}

test('夜间 diff 行底色与状态文字保持可读对比度', () => {
  const addedCode = blend('#22c55e', palette.DARK.bgBase, 0.12);
  const deletedCode = blend('#f25a5a', palette.DARK.bgBase, 0.12);
  assert.ok(contrast(palette.DARK.success, addedCode) >= 4.8, `added code ${contrast(palette.DARK.success, addedCode)}`);
  assert.ok(contrast(palette.DARK.error, deletedCode) >= 4.8, `deleted code ${contrast(palette.DARK.error, deletedCode)}`);
  assert.ok(contrast(palette.DARK.success, '#1f3124') >= 4.8);
  assert.ok(contrast(palette.DARK.error, '#3c1f1b') >= 4.8);
});

test('浅色 diff 行文字仍可读', () => {
  assert.ok(contrast(palette.LIGHT.success, '#e6f4e7') >= 4.5);
  assert.ok(contrast(palette.LIGHT.error, '#fce6e2') >= 4.5);
});

test('diff 令牌同时提供浅色与深色两套值', () => {
  for (const name of [
    '--dsw-alias-code-diff-added',
    '--dsw-alias-code-diff-deleted',
    '--dsw-alias-file-diff-added-bg',
    '--dsw-alias-file-diff-added-gutter',
    '--dsw-alias-file-diff-added-marker',
    '--dsw-alias-file-diff-deleted-bg',
    '--dsw-alias-file-diff-deleted-gutter',
    '--dsw-alias-file-diff-deleted-marker',
  ]) {
    assert.ok(tokens[name]?.light, name);
    assert.ok(tokens[name]?.dark, name);
    assert.notEqual(tokens[name].light, tokens[name].dark, name);
  }
});
