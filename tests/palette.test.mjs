import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './load-module.mjs';

const palette = await loadModule('src/palette.ts');

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

test('浅色与深色的正文、次要文字、强调色在当前实色底板上达到 4.8:1', () => {
  for (const [name, theme] of [['light', palette.LIGHT], ['dark', palette.DARK]]) {
    const backgrounds = [theme.bgBase, theme.bgL1, theme.bgL2, theme.sidebar, theme.settingsCard];
    for (const key of ['labelPrimary', 'labelSecondary', 'labelTertiary', 'accent', 'link']) {
      for (const background of backgrounds) {
        const ratio = contrast(theme[key], background);
        assert.ok(ratio >= 4.8, `${name}.${key} on ${background} = ${ratio.toFixed(2)}`);
      }
    }
  }
});

test('主按钮文字与填充色对比可读', () => {
  for (const theme of [palette.LIGHT, palette.DARK]) {
    const ratio = contrast(theme.brandInk, theme.brand);
    assert.ok(ratio >= 4.5, `brand ink ratio ${ratio.toFixed(2)}`);
  }
});

test('token 覆盖层为每个名字同时提供浅色与深色', () => {
  const tokens = palette.uiTokens();
  const names = Object.keys(tokens);
  assert.ok(names.length >= 60);
  for (const [name, pair] of Object.entries(tokens)) {
    assert.match(name, /^--dsw-/, name);
    assert.equal(typeof pair.light, 'string', name);
    assert.equal(typeof pair.dark, 'string', name);
    assert.ok(pair.light.length > 0 && pair.dark.length > 0, name);
  }
  for (const required of [
    '--dsw-alias-bg-base',
    '--dsw-alias-label-primary',
    '--dsw-alias-label-secondary',
    '--dsw-specific-sidebar-fill',
    '--dsw-specific-input-major',
    '--dsw-alias-markdown-code-block',
    '--dsw-alias-settings-card-fill',
    '--dsw-menu-surface-fill',
    '--dsw-static-neutral-50',
    '--dsw-static-neutral-100',
    '--dsw-alias-code-diff-added',
    '--dsw-alias-code-diff-deleted',
    '--dsw-alias-file-diff-added-bg',
    '--dsw-alias-file-diff-deleted-bg',
  ]) {
    assert.ok(tokens[required], required);
  }
  // 文件/代码 diff 在宿主浅色外观下也必须能随场景转深。
  assert.equal(tokens['--dsw-alias-file-diff-added-bg'].dark, '#1f3124');
  assert.equal(tokens['--dsw-alias-file-diff-deleted-bg'].dark, '#3c1f1b');
  assert.equal(tokens['--dsw-alias-file-diff-added-gutter'].dark, '#132016');
  assert.match(tokens['--dsw-alias-code-diff-added'].dark, /34, 197, 94/);
  // present 交付卡、文件变更卡共用这两个“静态中性色”，必须随主题纸面/夜色走。
  assert.equal(tokens['--dsw-static-neutral-50'].light, '#fffdf4');
  assert.equal(tokens['--dsw-static-neutral-50'].dark, '#1c2d25');
  assert.equal(tokens['--dsw-static-neutral-100'].dark, '#21342b');
});
