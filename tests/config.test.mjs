import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './load-module.mjs';

const config = await loadModule('src/config.ts');

test('normalize 校正类型、范围与未知值', () => {
  assert.deepEqual(config.normalize(undefined), config.DEFAULTS);
  assert.deepEqual(config.normalize({ enabled: 'yes', timeMode: 'cycle', previewHour: 'x', farmer: 1, ambient: null }), config.DEFAULTS);
  assert.deepEqual(
    config.normalize({ enabled: false, timeMode: 'preview', previewHour: 25.5, farmer: false, ambient: false }),
    { enabled: false, timeMode: 'preview', previewHour: 1.5, farmer: false, ambient: false },
  );
  assert.equal(config.normalize({ previewHour: -1 }).previewHour, 23);
  assert.equal(config.normalize({ previewHour: 0.129 }).previewHour, 0.13);
});

test('formatHour 与本地小时格式', () => {
  assert.equal(config.formatHour(0), '00:00');
  assert.equal(config.formatHour(17.5), '17:30');
  assert.equal(config.formatHour(23.999), '23:59');
  assert.equal(config.formatHour(-1), '23:00');
  const date = new Date(2026, 9, 20, 21, 30, 15);
  assert.ok(Math.abs(config.localHour(date) - 21.5042) < 0.001);
});

test('时段边界连续，不依赖累计计时', () => {
  assert.equal(config.periodOf(4.9), 'night');
  assert.equal(config.periodOf(5), 'dawn');
  assert.equal(config.periodOf(8), 'day');
  assert.equal(config.periodOf(16.69), 'day');
  assert.equal(config.periodOf(16.7), 'dusk');
  assert.equal(config.periodOf(19.5), 'night');
  assert.equal(config.presetHour('dusk'), 17.7);
});
