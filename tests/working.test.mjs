import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './load-module.mjs';

const working = await loadModule('src/working.ts');

class FakeBinding {
  constructor(id) {
    this.sessionId = id;
    this.snapshot = { running: false, openState: 'open', removed: false, lastAgentError: null };
    this.listeners = new Set();
    this.session = {
      getSnapshot: () => this.snapshot,
      subscribe: listener => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
    };
    this.eventSource = {
      getSnapshot: () => ({ entries: [], revision: 0 }),
      subscribe: () => () => undefined,
    };
  }
  set(next, notify = true) {
    this.snapshot = { ...this.snapshot, ...next };
    if (notify) for (const listener of this.listeners) listener();
  }
}

function createSessions(bindings = new Map()) {
  const listeners = new Set();
  return {
    binding: id => bindings.get(id),
    list: {
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    notify: () => {
      for (const listener of listeners) listener();
    },
  };
}

test('任务 running 决定农人是否在田间，回答流式输出不会提前结束', () => {
  const binding = new FakeBinding('a');
  const transitions = [];
  const tracker = working.createWorkingTracker(binding, value => transitions.push(value));
  assert.deepEqual(transitions, [false]);

  binding.set({ running: true });
  assert.equal(tracker.getWorking(), true, '用户发出消息、任务开始即入场');
  binding.set({ running: true });
  assert.equal(tracker.getWorking(), true, '流式回答期间仍是同一个 running 任务');
  assert.deepEqual(transitions, [false, true]);

  binding.set({ running: false });
  assert.equal(tracker.getWorking(), false);
  assert.deepEqual(transitions, [false, true, false]);
  tracker.dispose();
});

test('报错、移除或未连接状态视为任务结束', () => {
  const binding = new FakeBinding('a');
  const tracker = working.createWorkingTracker(binding, () => undefined);
  binding.set({ running: true, lastAgentError: 'boom' });
  assert.equal(tracker.getWorking(), false);
  binding.set({ lastAgentError: null, removed: true });
  assert.equal(tracker.getWorking(), false);
  binding.set({ removed: false, openState: 'error' });
  assert.equal(tracker.getWorking(), false);
  binding.set({ openState: 'open', running: true });
  assert.equal(tracker.getWorking(), true);
  tracker.dispose();
});

test('错过通知后 resync 必须重算，而不是继续使用旧状态', () => {
  const binding = new FakeBinding('a');
  const tracker = working.createWorkingTracker(binding, () => undefined);
  assert.equal(tracker.getWorking(), false);
  binding.set({ running: true }, false);
  assert.equal(tracker.getWorking(), true, '读取本身就应反映最新快照');
  tracker.resync();
  assert.equal(tracker.getWorking(), true);
  tracker.dispose();
});

test('释放后不再发布工作状态', () => {
  const binding = new FakeBinding('a');
  const transitions = [];
  const tracker = working.createWorkingTracker(binding, value => transitions.push(value));
  tracker.dispose();
  binding.set({ running: true });
  assert.deepEqual(transitions, [false]);
  assert.equal(tracker.getWorking(), false);
});

test('会话栈：只跟随当前展示对话的任务状态', () => {
  const a = new FakeBinding('a');
  const b = new FakeBinding('b');
  a.set({ running: true });
  const sessions = createSessions(new Map([['a', a], ['b', b]]));
  const hub = new working.WorkingHub(sessions);
  const seen = [];
  hub.subscribe(value => seen.push(value));

  const tokenA = hub.attach('a');
  assert.equal(hub.getWorking(), true);
  const tokenB = hub.attach('b');
  assert.equal(hub.getWorking(), false, '切到空闲会话立即收场');
  b.set({ running: true });
  assert.equal(hub.getWorking(), true);
  hub.detach(tokenB);
  assert.equal(hub.getWorking(), true, '弹回上一个仍在工作的会话');
  hub.detach(tokenA);
  assert.equal(hub.getWorking(), false);
  assert.ok(seen.includes(true) && seen.includes(false));
  hub.dispose();
});

test('绑定尚未建立时先占位，会话就绪后自动接管', () => {
  const sessions = createSessions(new Map());
  const hub = new working.WorkingHub(sessions);
  const token = hub.attach('late');
  assert.equal(hub.getWorking(), false);
  const late = new FakeBinding('late');
  late.set({ running: true });
  sessions.binding = id => (id === 'late' ? late : undefined);
  sessions.notify();
  assert.equal(hub.getWorking(), true);
  hub.detach(token);
  assert.equal(hub.getWorking(), false);
  hub.dispose();
});
