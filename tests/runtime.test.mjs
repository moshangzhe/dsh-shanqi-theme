import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './load-module.mjs';

const dom = new JSDOM(
  `<!doctype html><html><body>
    <div id="root">
      <div data-slot="root">
        <div>
          <div data-shell-overlay></div>
          <div data-slot="main">
            <div data-slot="main.conversation"><div data-phase="active"></div></div>
          </div>
        </div>
      </div>
    </div>
  </body></html>`,
  { url: 'http://127.0.0.1:53156/' },
);

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});

let hidden = false;
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });

let rafQueue = [];
globalThis.requestAnimationFrame = callback => {
  rafQueue.push(callback);
  return rafQueue.length;
};
globalThis.cancelAnimationFrame = () => {
  rafQueue = [];
};
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame;

function flushRaf() {
  const queue = rafQueue;
  rafQueue = [];
  for (const callback of queue) callback(16);
}

const conversation = document.querySelector('[data-phase]');
Object.defineProperty(conversation, 'getBoundingClientRect', {
  configurable: true,
  value: () => ({ left: 120, top: 0, right: 920, bottom: 600, width: 800, height: 600, x: 120, y: 0 }),
});

const runtimeModule = await loadModule('src/runtime.ts');
const config = await loadModule('src/config.ts');

const tokenCalls = [];
let releases = 0;
const theme = {
  getTheme: () => ({ active: { colorScheme: 'light' }, fontSizes: { text: 14 } }),
  overrideTokens: (source, tokens) => {
    tokenCalls.push({ source, tokens });
    return () => {
      releases += 1;
    };
  },
};

const runtimes = [];
function createRuntime() {
  const runtime = runtimeModule.createVisualRuntime(theme);
  runtimes.push(runtime);
  return runtime;
}

afterEach(() => {
  while (runtimes.length) runtimes.pop().dispose();
  rafQueue = [];
});

after(() => {
  dom.window.close();
});

test('启用时挂载场景、覆盖一次令牌并适配真实聊天元素', () => {
  const runtime = createRuntime();
  runtime.update({ ...config.DEFAULTS, enabled: true });
  flushRaf();

  assert.equal(document.querySelectorAll('.shq-stage').length, 1);
  assert.equal(tokenCalls.length, 1);
  assert.equal(tokenCalls[0].source, 'dsh-shanqi-theme');
  assert.ok(Object.keys(tokenCalls[0].tokens).length > 50);
  const stage = document.querySelector('.shq-stage');
  assert.equal(stage.style.width, '800px');
  assert.equal(stage.style.height, '600px');
  assert.equal(stage.hidden, false);
  assert.ok(document.querySelector('[data-phase]').hasAttribute('data-shq-conversation'));
  assert.equal(document.body.dataset.shqTheme, '');
  assert.ok(document.body.style.getPropertyValue('--shq-ink').length > 0);
  assert.ok(document.querySelector('.shq-world').getAttribute('viewBox'));

  // 重复更新不会重复挂载，也不会重新叠加令牌层。
  runtime.update({ ...config.DEFAULTS, enabled: true, ambient: false });
  runtime.update({ ...config.DEFAULTS, enabled: true, ambient: true });
  assert.equal(document.querySelectorAll('.shq-stage').length, 1);
  assert.equal(tokenCalls.length, 1);

  runtime.update({ ...config.DEFAULTS, enabled: true, timeMode: 'preview', previewHour: 6.6, farmer: false });
  flushRaf();
  assert.equal(document.body.dataset.shqMode, 'preview');
  assert.equal(document.body.dataset.shqFarmer, 'off');
  assert.equal(document.body.dataset.shqPeriod, 'dawn');
  assert.ok(Math.abs(runtime.getStatus().hour - 6.6) < 0.001);

  runtime.setWorking(true);
  assert.equal(document.body.dataset.shqWorking, 'on');
  assert.equal(runtime.getStatus().working, true);

  // 连接中断立即收场；重连后若任务仍在工作，联动恢复。
  runtime.setConnected(false);
  assert.equal(document.body.dataset.shqWorking, 'off');
  assert.equal(runtime.getStatus().working, false);
  runtime.setConnected(true);
  assert.equal(document.body.dataset.shqWorking, 'on');
  assert.equal(runtime.getStatus().working, true);
});

test('夜间把整页界面令牌切到深色，白昼与关闭时恢复', () => {
  const runtime = createRuntime();
  runtime.update({ ...config.DEFAULTS, enabled: true, timeMode: 'preview', previewHour: 22 });
  flushRaf();
  assert.equal(document.body.dataset.shqInk, 'light');
  assert.ok(document.body.hasAttribute('data-shq-night-ui'));
  assert.equal(document.body.style.getPropertyValue('--dsw-alias-bg-base'), '#16241e');
  assert.equal(document.body.style.getPropertyValue('--dsw-alias-label-primary'), '#e8eddc');

  runtime.update({ ...config.DEFAULTS, enabled: true, timeMode: 'preview', previewHour: 12.5 });
  flushRaf();
  assert.equal(document.body.dataset.shqInk, 'dark');
  assert.equal(document.body.hasAttribute('data-shq-night-ui'), false);
  assert.equal(document.body.style.getPropertyValue('--dsw-alias-bg-base'), '');

  runtime.update({ ...config.DEFAULTS, enabled: false });
  assert.equal(document.body.hasAttribute('data-shq-night-ui'), false);
});

test('页面隐藏时暂停场景，恢复后重新同步系统时间', () => {
  const runtime = createRuntime();
  runtime.update({ ...config.DEFAULTS, enabled: true });
  flushRaf();
  const stage = document.querySelector('.shq-stage');

  hidden = true;
  document.dispatchEvent(new window.Event('visibilitychange'));
  assert.equal(stage.getAttribute('data-shq-paused'), 'on');

  hidden = false;
  document.dispatchEvent(new window.Event('visibilitychange'));
  assert.notEqual(stage.getAttribute('data-shq-paused'), 'on');
  assert.equal(stage.hidden, false);
});

test('关闭主题时移除场景并完整释放令牌、属性与观察器', () => {
  const before = releases;
  const runtime = createRuntime();
  runtime.update({ ...config.DEFAULTS, enabled: true });
  flushRaf();
  assert.equal(document.querySelectorAll('.shq-stage').length, 1);

  runtime.update({ ...config.DEFAULTS, enabled: false });
  assert.equal(document.querySelectorAll('.shq-stage').length, 0);
  assert.equal(releases, before + 1);
  assert.equal(document.body.hasAttribute('data-shq-theme'), false);
  assert.equal(document.body.dataset.shqTheme, undefined);
  assert.equal(document.body.style.getPropertyValue('--shq-ink'), '');
  assert.equal(document.querySelector('[data-phase]').hasAttribute('data-shq-conversation'), false);
  assert.equal(document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-shq-frame'), false);

  runtime.dispose();
  runtime.dispose();
});
