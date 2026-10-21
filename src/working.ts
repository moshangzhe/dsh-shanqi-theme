/**
 * 任务工作状态订阅。
 *
 * 农人联动的不是“模型此刻是否在思考”，而是**当前展示对话是否有任务在工作**：
 * 宿主 SessionSnapshot.running 从用户发出消息开始，覆盖模型思考、工具调用、
 * 回答流式输出与收尾，直到整轮任务结束。
 *
 * 因此只读取公开的 binding.session.running；不读界面文案，也不区分思考/回答阶段。
 * 任务结束、报错、会话移除或连接断开时立即离场。
 */
import type { SessionBinding } from './contracts';

export interface WorkingTracker {
  getWorking(): boolean;
  resync(): void;
  dispose(): void;
}

export type WorkingListener = (working: boolean) => void;

/** 只依赖 running 与错误/移除状态，避免把回答阶段误判为“任务结束”。 */
export function createWorkingTracker(
  binding: SessionBinding,
  onChange: (working: boolean) => void,
): WorkingTracker {
  let disposed = false;
  let published = false;
  let last = false;

  const readWorking = (): boolean => {
    const snapshot = binding.session.getSnapshot();
    const dead = snapshot.removed === true || snapshot.openState === 'error' || Boolean(snapshot.lastAgentError);
    return snapshot.running === true && !dead;
  };

  const publish = (force = false): void => {
    if (disposed) return;
    const next = readWorking();
    if (!force && published && next === last) return;
    last = next;
    published = true;
    onChange(next);
  };

  const unsubscribe = binding.session.subscribe(() => publish());
  publish(true);

  return {
    getWorking: () => !disposed && readWorking(),
    resync: () => publish(true),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
    },
  };
}

interface ActiveEntry {
  token: number;
  sessionId: string;
  tracker: WorkingTracker;
}

/**
 * 多个会话界面可能同时挂载（主界面与嵌入视图）。栈顶为当前展示的对话；
 * 卸载只移除自己的 token，不会误删后来挂载的会话。
 */
export class WorkingHub {
  private readonly listeners = new Set<WorkingListener>();
  private readonly stack: ActiveEntry[] = [];
  private readonly sessions: { binding(id: string): SessionBinding | undefined; list: { subscribe(listener: () => void): () => void } };
  private sequence = 0;
  private current: ActiveEntry | null = null;
  private working = false;
  private readonly cleanups: (() => void)[] = [];

  constructor(sessions: WorkingHub['sessions']) {
    this.sessions = sessions;
    if (typeof document !== 'undefined') {
      const onVisibility = (): void => {
        if (!document.hidden) this.current?.tracker.resync();
      };
      document.addEventListener('visibilitychange', onVisibility);
      this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
    }
    if (typeof window !== 'undefined') {
      const onFocus = (): void => this.current?.tracker.resync();
      window.addEventListener('focus', onFocus);
      this.cleanups.push(() => window.removeEventListener('focus', onFocus));
    }
  }

  subscribe(listener: WorkingListener): () => void {
    this.listeners.add(listener);
    listener(this.working);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getWorking(): boolean {
    return this.working;
  }

  /** 返回本次挂载的 token；清理时原样传回。 */
  attach(sessionId: string): number {
    const token = ++this.sequence;
    const entry = this.createEntry(token, sessionId);
    this.stack.push(entry);
    if (entry === this.stack[this.stack.length - 1]) this.activate();
    return token;
  }

  detach(token: number): void {
    const index = this.stack.findIndex(entry => entry.token === token);
    if (index < 0) return;
    const [entry] = this.stack.splice(index, 1);
    entry?.tracker.dispose();
    if (this.current === entry) this.activate();
  }

  resync(): void {
    this.current?.tracker.resync();
  }

  dispose(): void {
    for (const entry of this.stack.splice(0)) entry.tracker.dispose();
    this.current = null;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.listeners.clear();
  }

  private createEntry(token: number, sessionId: string): ActiveEntry {
    const binding = this.sessions.binding(sessionId);
    if (binding) {
      return {
        token,
        sessionId,
        tracker: createWorkingTracker(binding, working => this.publish(working)),
      };
    }
    // 绑定尚未建立时先占位，等 Session 列表就绪后重建。
    let created: WorkingTracker | null = null;
    let stop: (() => void) | null = null;
    const entry: ActiveEntry = {
      token,
      sessionId,
      tracker: {
        getWorking: () => created?.getWorking() ?? false,
        resync: () => created?.resync(),
        dispose: () => {
          stop?.();
          stop = null;
          created?.dispose();
          created = null;
        },
      },
    };
    stop = this.sessions.list.subscribe(() => {
      const next = this.sessions.binding(sessionId);
      if (!next) return;
      stop?.();
      stop = null;
      created = createWorkingTracker(next, working => this.publish(working));
      if (this.current === entry) this.activate(true);
    });
    return entry;
  }

  private activate(forcePublish = false): void {
    const next = this.stack[this.stack.length - 1] ?? null;
    this.current = next;
    if (next) next.tracker.resync();
    const working = next ? next.tracker.getWorking() : false;
    this.publish(working, forcePublish || next === null);
  }

  private publish(working: boolean, force = false): void {
    if (!force && working === this.working) return;
    this.working = working;
    for (const listener of this.listeners) listener(working);
  }
}
