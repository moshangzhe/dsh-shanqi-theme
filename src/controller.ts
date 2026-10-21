/**
 * 控制器：连接配置表单、设置界面与场景运行时。
 *
 * - 写入是异步的：先显示乐观草稿，失败时回到宿主已接受的值并给出错误状态。
 * - 只对实际变化的字段写入；并发保存用 pending + generation 去重，旧结果不覆盖新结果。
 * - 恢复默认使用一次原子 mutate，避免逐字段闪烁。
 */
import { DEFAULTS, normalize, PREFERENCE_KEYS, type Period, type Preferences } from './config';
import type { ConfigForm, FormSnapshot, ThemeService } from './contracts';
import type { RuntimeStatus, VisualRuntime } from './runtime';

export interface AppearanceState {
  prefs: Preferences;
  form: FormSnapshot;
  dark: boolean;
  scheme: 'light' | 'dark';
  hour: number;
  period: Period;
  working: boolean;
  mounted: boolean;
  saving: number;
  resetting: boolean;
  /** 文案键（见 locale.ts），空字符串表示没有额外提示。 */
  message: string;
  error: boolean;
  fontSize: number;
  version: number;
}

export interface AppearanceController {
  getSnapshot(): AppearanceState;
  subscribe(listener: () => void): () => void;
  attach(runtime: VisualRuntime): void;
  themeChanged(): void;
  write<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void>;
  /** 原子地切换到手动预览并设置预览时刻。 */
  preview(hour: number): Promise<void>;
  enable(): Promise<void>;
  disable(): Promise<void>;
  reset(): Promise<void>;
  dispose(): void;
}

function reading(prefs: Preferences, pending: ReadonlyMap<keyof Preferences, { value: unknown }>): Preferences {
  const draft: Record<string, unknown> = { ...prefs };
  for (const [key, item] of pending) draft[key] = item.value;
  return normalize(draft);
}

export function createController(form: ConfigForm, theme: ThemeService): AppearanceController {
  let disposed = false;
  let runtime: VisualRuntime | null = null;
  let unsubscribeRuntime: (() => void) | undefined;
  let version = 0;
  let generation = 0;
  let themeRefreshQueued = false;
  const listeners = new Set<() => void>();
  const pending = new Map<keyof Preferences, { value: unknown; generation: number }>();

  const initialTheme = theme.getTheme();
  const initialAccepted = form.getSnapshot();
  let state: AppearanceState = {
    prefs: reading(normalize(initialAccepted.value), pending),
    form: initialAccepted,
    dark: initialTheme.active?.colorScheme === 'dark',
    scheme: initialTheme.active?.colorScheme === 'dark' ? 'dark' : 'light',
    hour: new Date().getHours() + new Date().getMinutes() / 60,
    period: 'day',
    working: false,
    mounted: false,
    saving: 0,
    resetting: false,
    message: '',
    error: false,
    fontSize: initialTheme.fontSizes?.text ?? 14,
    version: 0,
  };

  const emit = (patch: Partial<AppearanceState> = {}): void => {
    if (disposed) return;
    const accepted = form.getSnapshot();
    const snapshot = theme.getTheme();
    version += 1;
    state = {
      ...state,
      ...patch,
      form: accepted,
      prefs: reading(normalize(accepted.value), pending),
      dark: snapshot.active?.colorScheme === 'dark',
      scheme: snapshot.active?.colorScheme === 'dark' ? 'dark' : 'light',
      fontSize: snapshot.fontSizes?.text ?? 14,
      version,
    };
    runtime?.update(state.prefs);
    for (const listener of listeners) listener();
  };

  const unsubscribeForm = form.subscribe(() => emit());

  const applyRuntimeStatus = (status: RuntimeStatus): void => {
    if (disposed) return;
    state = {
      ...state,
      dark: status.dark,
      scheme: status.scheme,
      hour: status.hour,
      period: status.period,
      working: status.working,
      mounted: status.mounted,
    };
    for (const listener of listeners) listener();
  };

  const canWrite = (): boolean => {
    if (disposed || state.resetting) return false;
    const snapshot = form.getSnapshot();
    return snapshot.writable === true && snapshot.status !== 'loading' && snapshot.status !== 'unavailable';
  };

  async function commit(entries: readonly (readonly [keyof Preferences, unknown])[]): Promise<void> {
    if (!canWrite() || disposed) return;
    const changed = entries.filter(([key, value]) => state.prefs[key] !== value);
    if (changed.length === 0) {
      emit({ message: 'status.saved', error: false });
      return;
    }
    const revision = form.getSnapshot().revision;
    const own = ++generation;
    for (const [key, value] of changed) pending.set(key, { value, generation: own });
    emit({ saving: state.saving + 1, message: 'status.saving', error: false });
    let accepted = false;
    try {
      if (changed.length === 1) {
        const [key, value] = changed[0]!;
        accepted = await form.set(key, value);
      } else {
        accepted = await form.mutate(changed.map(([key, value]) => ({ op: 'set' as const, path: [key], value })));
      }
      const refreshed = form.getSnapshot();
      const stillCurrent = changed.every(([key]) => pending.get(key)?.generation === own) && !disposed;
      if (!accepted && stillCurrent && refreshed.writable === true && refreshed.status === 'ready') {
        if (typeof revision === 'number' && typeof refreshed.revision === 'number' && refreshed.revision > revision) {
          accepted = await form.mutate(changed.map(([key, value]) => ({ op: 'set' as const, path: [key], value })));
        }
      }
    } catch {
      accepted = false;
    }
    if (disposed) return;
    const current = changed.every(([key]) => pending.get(key)?.generation === own);
    if (current) for (const [key] of changed) pending.delete(key);
    const saving = Math.max(0, state.saving - 1);
    if (!current) {
      emit({ saving, message: saving > 0 ? 'status.saving' : 'status.saved', error: false });
      return;
    }
    if (accepted) {
      emit({ saving, message: saving > 0 ? 'status.saving' : 'status.saved', error: false });
    } else {
      emit({ saving, message: 'status.saveFailed', error: true });
    }
  }

  async function write<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void> {
    await commit([[key, value]]);
  }

  const controller: AppearanceController = {
    getSnapshot: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach(next: VisualRuntime): void {
      runtime = next;
      unsubscribeRuntime?.();
      unsubscribeRuntime = next.subscribeStatus(() => applyRuntimeStatus(next.getStatus()));
      next.update(state.prefs);
      applyRuntimeStatus(next.getStatus());
    },
    themeChanged(): void {
      if (disposed || themeRefreshQueued) return;
      themeRefreshQueued = true;
      // 等同一轮 theme/change 的其它监听器先完成，再应用宿主快照，避免旧值覆盖新值。
      queueMicrotask(() => {
        themeRefreshQueued = false;
        if (disposed) return;
        runtime?.refreshTheme();
        emit();
      });
    },
    write,
    async preview(hour: number): Promise<void> {
      const wrapped = ((hour % 24) + 24) % 24;
      await commit([
        ['previewHour', Math.round(wrapped * 100) / 100],
        ['timeMode', 'preview'],
      ]);
    },
    async enable(): Promise<void> {
      if (!canWrite() || state.saving > 0) return;
      await commit([['enabled', true]]);
    },
    async disable(): Promise<void> {
      if (!canWrite()) return;
      await write('enabled', false);
    },
    async reset(): Promise<void> {
      if (!canWrite() || state.saving > 0 || !form.getSnapshot().writable) return;
      emit({ saving: 1, resetting: true, message: 'status.saving', error: false });
      let accepted = false;
      try {
        accepted = await form.mutate(
          PREFERENCE_KEYS.map(key => ({ op: 'set' as const, path: [key], value: DEFAULTS[key] })),
        );
      } catch {
        accepted = false;
      }
      emit({
        saving: 0,
        resetting: false,
        message: accepted ? 'status.resetDone' : 'status.resetFailed',
        error: !accepted,
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unsubscribeForm();
      unsubscribeRuntime?.();
      unsubscribeRuntime = undefined;
      runtime = null;
      listeners.clear();
      pending.clear();
    },
  };

  return controller;
}
