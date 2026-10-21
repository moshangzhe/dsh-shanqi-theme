import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './load-module.mjs';

const config = await loadModule('src/config.ts');
const controllerModule = await loadModule('src/controller.ts');

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

class FakeForm {
  constructor(value = {}) {
    this.snapshot = {
      status: 'ready',
      value: { ...config.DEFAULTS, ...value },
      writable: true,
      mode: 'host',
      revision: 1,
    };
    this.listeners = new Set();
    this.calls = [];
    this.mutations = [];
    this.fail = false;
    this.gates = [];
  }
  getSnapshot() {
    return this.snapshot;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    for (const listener of this.listeners) listener();
  }
  accept(patch) {
    this.snapshot = {
      ...this.snapshot,
      value: { ...this.snapshot.value, ...patch },
      revision: this.snapshot.revision + 1,
    };
    this.notify();
  }
  async set(key, value) {
    this.calls.push([key, value]);
    if (this.gates.length) {
      const gate = this.gates.shift();
      await gate.promise;
    }
    if (this.fail) return false;
    this.accept({ [key]: value });
    return true;
  }
  async mutate(operations) {
    this.mutations.push(operations);
    if (this.fail) return false;
    this.accept(Object.fromEntries(operations.map(operation => [operation.path[0], operation.value])));
    return true;
  }
}

const theme = {
  getTheme: () => ({ active: { colorScheme: 'light' }, fontSizes: { text: 14 } }),
  overrideTokens: () => () => undefined,
};

function makeRuntime() {
  const updates = [];
  let statusListener;
  const status = {
    active: true,
    dark: false,
    hour: 9.5,
    period: 'day',
    working: false,
    farmer: true,
    ambient: true,
    scheme: 'light',
    mounted: true,
  };
  return {
    updates,
    runtime: {
      update: prefs => updates.push(prefs),
      setWorking: () => undefined,
      refreshTheme: () => undefined,
      getStatus: () => status,
      subscribeStatus: listener => {
        statusListener = listener;
        return () => {
          statusListener = undefined;
        };
      },
      dispose: () => undefined,
    },
    pushStatus(patch) {
      Object.assign(status, patch);
      statusListener?.();
    },
  };
}

test('写入成功、失败回退与提示状态', async () => {
  const form = new FakeForm({ ambient: true });
  const controller = controllerModule.createController(form, theme);
  assert.equal(controller.getSnapshot().prefs.ambient, true);

  await controller.write('ambient', false);
  assert.equal(form.calls.at(-1)[0], 'ambient');
  assert.equal(controller.getSnapshot().prefs.ambient, false);
  assert.equal(controller.getSnapshot().saving, 0);
  assert.equal(controller.getSnapshot().message, 'status.saved');
  assert.equal(controller.getSnapshot().error, false);

  form.fail = true;
  await controller.write('farmer', false);
  assert.equal(controller.getSnapshot().prefs.farmer, true, '失败后回到已保存值');
  assert.equal(controller.getSnapshot().error, true);
  assert.equal(controller.getSnapshot().message, 'status.saveFailed');
  controller.dispose();
});

test('并发保存按次数记账，旧结果不会覆盖新结果', async () => {
  const form = new FakeForm();
  const controller = controllerModule.createController(form, theme);
  const first = {};
  first.promise = new Promise(resolve => {
    first.resolve = resolve;
  });
  const second = {};
  second.promise = new Promise(resolve => {
    second.resolve = resolve;
  });
  form.gates.push(first, second);

  const a = controller.write('ambient', false);
  assert.equal(controller.getSnapshot().saving, 1);
  const b = controller.write('farmer', false);
  assert.equal(controller.getSnapshot().saving, 2);
  assert.equal(controller.getSnapshot().prefs.ambient, false, '乐观草稿立即反映');
  assert.equal(controller.getSnapshot().prefs.farmer, false);

  first.resolve();
  await a;
  assert.equal(controller.getSnapshot().saving, 1);
  second.resolve();
  await b;
  assert.equal(controller.getSnapshot().saving, 0);
  assert.equal(controller.getSnapshot().error, false);
  assert.equal(controller.getSnapshot().prefs.ambient, false);
  assert.equal(controller.getSnapshot().prefs.farmer, false);
  controller.dispose();
});

test('手动预览用一次原子 mutate 同时写入时刻与模式', async () => {
  const form = new FakeForm();
  const controller = controllerModule.createController(form, theme);
  await controller.preview(6.6);
  assert.equal(form.mutations.length, 1);
  assert.deepEqual(form.mutations[0].map(operation => operation.path[0]).sort(), ['previewHour', 'timeMode']);
  assert.equal(controller.getSnapshot().prefs.timeMode, 'preview');
  assert.equal(controller.getSnapshot().prefs.previewHour, 6.6);
  controller.dispose();
});

test('恢复默认一次提交全部字段，失败时保留错误状态', async () => {
  const form = new FakeForm({ enabled: false, ambient: false, timeMode: 'preview', previewHour: 3 });
  const controller = controllerModule.createController(form, theme);
  await controller.reset();
  assert.equal(form.mutations.length, 1);
  assert.equal(controller.getSnapshot().prefs.enabled, true);
  assert.equal(controller.getSnapshot().prefs.ambient, true);
  assert.equal(controller.getSnapshot().resetting, false);
  assert.equal(controller.getSnapshot().message, 'status.resetDone');

  form.fail = true;
  await controller.reset();
  assert.equal(controller.getSnapshot().error, true);
  assert.equal(controller.getSnapshot().message, 'status.resetFailed');
  assert.equal(controller.getSnapshot().resetting, false);
  controller.dispose();
});

test('attach 后同步运行时状态；dispose 后不再写入', async () => {
  const form = new FakeForm();
  const controller = controllerModule.createController(form, theme);
  const harness = makeRuntime();
  controller.attach(harness.runtime);
  assert.equal(harness.updates.length, 1);
  harness.pushStatus({ hour: 21.25, period: 'night', dark: true, scheme: 'dark', working: true });
  assert.equal(controller.getSnapshot().hour, 21.25);
  assert.equal(controller.getSnapshot().period, 'night');
  assert.equal(controller.getSnapshot().working, true);

  controller.dispose();
  await controller.write('ambient', false);
  assert.equal(form.calls.length, 0);
});
