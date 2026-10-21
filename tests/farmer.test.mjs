import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './load-module.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:53156/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(document, 'hidden', { configurable: true, value: false });
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Element = dom.window.Element;

let nextFrame = 0;
let frames = new Map();
globalThis.requestAnimationFrame = callback => {
  nextFrame += 1;
  frames.set(nextFrame, callback);
  return nextFrame;
};
globalThis.cancelAnimationFrame = id => {
  frames.delete(id);
};
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame;

const scene = await loadModule('src/scene.ts');

let container;
let farmer;
let mover;
let clock = 0;

beforeEach(() => {
  frames = new Map();
  clock = 0;
  document.body.replaceChildren();
  container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = scene.sceneMarkup();
  farmer = new scene.FarmerAnimator(container);
  mover = container.querySelector('#shq-farmer-mover');
});

function advance(milliseconds) {
  const target = clock + milliseconds;
  while (clock < target) {
    clock += 33;
    const pending = [...frames.entries()];
    frames.clear();
    for (const [, callback] of pending) callback(clock);
  }
}

function position() {
  const match = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(mover.getAttribute('transform') ?? '');
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

test('农人从画外走入、耕作、收锄离场，位置连续无瞬移', () => {
  assert.equal(farmer.state.phase, 'off');
  assert.equal(mover.style.display, 'none');
  assert.equal(container.querySelectorAll('#shq-farmer-mover').length, 1);

  farmer.setWorking(true);
  assert.equal(farmer.state.phase, 'entering');
  assert.notEqual(mover.style.display, 'none');
  advance(1000);
  const entered = farmer.state.progress;
  assert.ok(entered > 0 && entered < 0.4);

  advance(8500);
  assert.equal(farmer.state.phase, 'working');

  const field = position();
  assert.ok(field);
  farmer.setWorking(false);
  assert.equal(farmer.state.phase, 'packing');
  advance(1000);
  assert.equal(farmer.state.phase, 'leaving');
  const startLeaving = position();
  assert.ok(startLeaving && field);
  assert.ok(Math.hypot(startLeaving.x - field.x, startLeaving.y - field.y) < 40, '收锄后从当前位置离开');

  advance(3000);
  assert.ok(farmer.state.progress < 0.8);
  advance(6000);
  assert.equal(farmer.state.phase, 'off');
  assert.equal(mover.style.display, 'none');
});

test('动作中途反向：进场途中结束思考立即离开，离场途中再次思考立即返回', () => {
  farmer.setWorking(true);
  advance(1500);
  assert.equal(farmer.state.phase, 'entering');
  const beforeReverse = farmer.state.progress;
  farmer.setWorking(false);
  assert.equal(farmer.state.phase, 'leaving');
  assert.ok(Math.abs(farmer.state.progress - beforeReverse) < 0.001, '转身不改变当前路径位置');
  advance(800);
  const left = farmer.state.progress;
  assert.ok(left < beforeReverse);

  farmer.setWorking(true);
  assert.equal(farmer.state.phase, 'entering');
  assert.ok(Math.abs(farmer.state.progress - left) < 0.001, '返回时不瞬移');
  advance(8000);
  assert.ok(['working', 'preparing', 'entering'].includes(farmer.state.phase));
  farmer.setWorking(false);
  advance(12000);
  assert.equal(farmer.state.phase, 'off');
});

test('重复的思考事件不会重置动作或生成第二个农人', () => {
  farmer.setWorking(true);
  advance(600);
  const progress = farmer.state.progress;
  farmer.setWorking(true);
  farmer.setWorking(true);
  advance(600);
  assert.ok(farmer.state.progress > progress);
  assert.equal(container.querySelectorAll('#shq-farmer-mover').length, 1);
  farmer.setWorking(false);
  advance(12000);
});

test('关闭联动时隐藏农人；重新开启后按当前思考状态重新进场', () => {
  farmer.setEnabled(false);
  assert.equal(farmer.state.phase, 'off');
  farmer.setWorking(true);
  assert.equal(farmer.state.phase, 'off', '关闭联动时不展示');
  farmer.setEnabled(true);
  assert.equal(farmer.state.phase, 'entering');
  farmer.setEnabled(false);
  assert.equal(farmer.state.phase, 'off');
  farmer.setEnabled(true);
  farmer.setWorking(false);
  advance(12000);
  assert.equal(farmer.state.phase, 'off');
  farmer.dispose();
});
