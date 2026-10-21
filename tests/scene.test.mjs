import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './load-module.mjs';

const scene = await loadModule('src/scene.ts');

function rgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
}
function mix(a, b, t) {
  const left = rgb(a);
  const right = rgb(b);
  return `#${left.map((value, index) => Math.round(value + (right[index] - value) * t).toString(16).padStart(2, '0')).join('')}`;
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

test('夜间强度连续变化，不是固定时刻硬切', () => {
  assert.equal(scene.nightAmount(12), 0);
  assert.equal(scene.nightAmount(22), 1);
  assert.equal(scene.nightAmount(4), 1);
  assert.ok(scene.nightAmount(6) > 0.5 && scene.nightAmount(6) < 1);
  assert.ok(scene.nightAmount(19) > 0 && scene.nightAmount(19) < 1);
  let previous = scene.nightAmount(0);
  for (let minute = 1; minute < 24 * 60; minute += 1) {
    const value = scene.nightAmount(minute / 60);
    assert.ok(Math.abs(value - previous) < 0.012, `jump at ${minute / 60}`);
    previous = value;
  }
});

test('昼、暮、夜三个时刻的配色与可见度符合预期', () => {
  const day = scene.computeScene(12);
  const dusk = scene.computeScene(17.7);
  const night = scene.computeScene(22);
  assert.equal(day.period, 'day');
  assert.equal(dusk.period, 'dusk');
  assert.equal(night.period, 'night');
  assert.ok(day.night < 0.01);
  assert.ok(night.night > 0.99);
  assert.ok(Number(night.vars['--shq-stars-opacity']) > 0.9);
  assert.ok(Number(night.vars['--shq-lights-opacity']) > 0.9);
  assert.equal(Number(day.vars['--shq-stars-opacity']), 0);
  assert.equal(Number(day.vars['--shq-lights-opacity']), 0);
  assert.ok(Number(night.vars['--shq-land-brightness']) < Number(day.vars['--shq-land-brightness']));
});

test('聊天正文颜色在整天的湖面与天空混合背景上保持可读', () => {
  for (let minute = 0; minute < 24 * 60; minute += 5) {
    const time = scene.computeScene(minute / 60);
    const background = mix(mix(time.colors.waterTop, time.colors.skyBottom, 0.35), '#30452f', 0.18);
    const ratio = contrast(time.ink, background);
    assert.ok(ratio >= 4.4, `ink contrast ${ratio.toFixed(2)} at ${minute / 60}`);
    assert.ok(['dark', 'light'].includes(time.inkMode));
  }
});

test('夜间气泡与阅读面使用墨绿底浅色字，白昼相反', () => {
  const day = scene.computeScene(12);
  const night = scene.computeScene(22);
  assert.match(day.bubbleFill, /255, 252, 241/);
  assert.equal(day.bubbleInk, '#2c3a29');
  assert.match(night.bubbleFill, /26, 42, 35/);
  assert.equal(night.bubbleInk, '#f1f4e6');
  assert.match(day.readingFill, /255, 252, 241/);
  assert.match(night.readingFill, /18, 30, 24/);
  assert.equal(night.readingInk, '#e9eedd');
  const bgDay = contrast(day.bubbleInk, '#fffcf1');
  const bgNight = contrast(night.bubbleInk, '#1a2a23');
  assert.ok(bgDay >= 4.8 && bgNight >= 4.8);
});

test('窄屏取景移向小屋与农田，viewBox 不越界', () => {
  const wide = scene.sceneViewBox(1920, 1080).split(' ').map(Number);
  assert.deepEqual(wide, [0, 0, 1920, 1080]);
  for (const [width, height] of [[1440, 900], [1000, 800], [390, 844], [1920, 400]]) {
    const [x, y, w, h] = scene.sceneViewBox(width, height).split(' ').map(Number);
    assert.ok(w > 0 && h > 0);
    assert.ok(x >= -0.01 && y >= -0.01);
    assert.ok(x + w <= 1920.01 && y + h <= 1080.01);
    assert.ok(Math.abs(w / h - width / height) < 0.01);
  }
  const narrow = scene.sceneViewBox(390, 844).split(' ').map(Number);
  assert.ok(narrow[0] > 600, 'narrow view keeps the cottage and field in frame');
});

test('农人路线从画外进入农田，两端坐标稳定', () => {
  const start = scene.farmerRoutePoint(0);
  const end = scene.farmerRoutePoint(1);
  assert.ok(Math.abs(start.x - 2040) < 1 && Math.abs(start.y - 1050) < 1);
  assert.ok(Math.abs(end.x - 1642) < 1 && Math.abs(end.y - 918) < 1);
  assert.ok(scene.FARMER_ROUTE_LENGTH > 300);
});

test('窄屏取景时进场起点跟随可视右边界，农人不会长时间在画外', () => {
  const route = scene.createFarmerRoute(1840);
  const start = route.point(0);
  assert.ok(Math.abs(start.x - 1840) < 1);
  assert.ok(route.length < scene.FARMER_ROUTE_LENGTH);
  const end = route.point(1);
  assert.ok(Math.abs(end.x - 1642) < 1 && Math.abs(end.y - 918) < 1);
});

test('场景标记包含缓存图层、窗灯遮挡与农人，且农人在灯光之后', () => {
  const markup = scene.sceneMarkup();
  assert.match(markup, /id="shq-farmer-mover"/);
  assert.match(markup, /mask="url\(#shq-window-tree-mask\)"/);
  assert.ok((markup.match(/data:image\/png;base64/g) ?? []).length >= 4);
  assert.ok(!markup.includes('<script'));
  assert.ok(markup.indexOf('shq-cottage-lights') < markup.indexOf('shq-farmer-mover'));
  for (const id of [
    'shq-farmer-torso',
    'shq-farmer-hoe',
    'shq-back-sleeve',
    'shq-front-sleeve',
    'shq-back-grip',
    'shq-front-grip',
    'shq-farmer-soil',
    'shq-back-leg',
    'shq-front-leg',
  ]) {
    assert.ok(markup.includes(`id="${id}"`), id);
  }
  assert.ok((markup.match(/<circle class="shq-star/g) ?? []).length > 100);
});
