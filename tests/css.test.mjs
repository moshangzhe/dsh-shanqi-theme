import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('浮动层阴影不使用浅色前景色，避免夜间出现光晕', () => {
  const shadows = [...css.matchAll(/box-shadow:([^;]+);/g)].map(match => match[1]);
  assert.ok(shadows.length > 0);
  for (const shadow of shadows) {
    assert.doesNotMatch(shadow, /var\(--dsw-alias-label-primary\)/, shadow);
    assert.doesNotMatch(shadow, /var\(--shq-bubble-ink\)/, shadow);
    assert.doesNotMatch(shadow, /var\(--shq-ink\)/, shadow);
  }
});

test('设置页缩略图复用聊天背景的真实场景层，而不是简化 SVG', () => {
  assert.match(css, /\.shq-mini-canvas\s+\.shq-world/);
  assert.doesNotMatch(css, /\.shq-mini-sky/);
  assert.doesNotMatch(css, /\.shq-mini-far\b/);
});

test('弹窗使用中性暗阴影，并关闭遮罩/面板的磨砂、滤镜与渐变', () => {
  assert.match(css, /\[role='dialog'\][\s\S]{0,220}box-shadow:\s*0 18px 50px rgba\(0, 0, 0, \.38\)/);
  assert.match(css, /\[class\*='_mask'\][\s\S]{0,260}backdrop-filter:\s*none !important/);
  assert.match(css, /\[class\*='_mask'\][\s\S]{0,260}background-image:\s*none !important/);
});
