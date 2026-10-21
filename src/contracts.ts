/**
 * 本插件实际使用的宿主接口（DSH 0.2.1-rc.2）。
 * 只声明已核实的字段，避免把内部实现或未公开结构当作契约。
 */
import type { ComponentType } from 'react';

export interface ThemeSnapshot {
  preference?: string;
  /** 兼容旧字段；当前版本通过 active.colorScheme 读取。 */
  colorScheme?: 'light' | 'dark';
  active: { colorScheme: 'light' | 'dark' };
  fontSizes?: Readonly<Record<string, number>>;
  revision?: number;
}

export interface ThemeService {
  getTheme(): ThemeSnapshot;
  /**
   * 叠加一层 token 覆盖，不改注册表、不写用户偏好。
   * 同一 source 再次调用会整体替换该层；返回的函数只移除本次创建的层。
   */
  overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>): () => void;
}

export interface FormSnapshot {
  status?: 'ready' | 'loading' | 'unavailable' | string;
  value?: unknown;
  writable?: boolean;
  mode?: 'host' | 'memory' | string;
  revision?: number;
}

export interface ConfigForm {
  getSnapshot(): FormSnapshot;
  subscribe(listener: () => void): () => void;
  set(field: string, value: unknown): Promise<boolean>;
  mutate(operations: readonly { path: string[]; op: 'set'; value: unknown }[]): Promise<boolean>;
}

export interface SlotRegistration {
  name: string;
  id?: string;
  order?: number;
  label?: () => string;
  locale?: string;
}

export interface SlotsService {
  inject(name: string, callback: () => unknown): () => void;
  register(options: SlotRegistration, component: ComponentType<any>): () => void;
}

export interface LocaleSnapshot {
  active: string;
  revision: number;
}

export interface LocaleService {
  register(namespace: string, locale: string, dictionary: Record<string, string>): () => void;
  bind(namespace: string): (key: string) => string;
  getSnapshot(): LocaleSnapshot;
  subscribe(listener: () => void): () => void;
}

export interface SessionSnapshot {
  running: boolean;
  removed?: boolean;
  openState?: 'cold' | 'loading' | 'open' | 'error' | string;
  promptError?: unknown;
  lastAgentError?: string | null;
}

export interface SessionEventLike {
  type: string;
  seq: number;
  time?: number;
  surfaceOp?: string;
  data?: any;
}

export interface SessionEventEntry {
  type: 'event' | 'transient';
  event: SessionEventLike;
}

export interface SessionEventWindow {
  entries: readonly SessionEventEntry[];
  revision: number;
  change?: {
    kind: 'replace' | 'prepend' | 'append' | 'settle-assistant' | string;
    entries?: readonly SessionEventEntry[];
    entry?: SessionEventEntry;
  };
}

export interface SessionBinding {
  sessionId: string;
  session: {
    getSnapshot(): SessionSnapshot;
    subscribe(listener: () => void): () => void;
  };
  eventSource: {
    getSnapshot(): SessionEventWindow;
    subscribe(listener: () => void): () => void;
  };
}

export interface SessionsService {
  binding(id: string): SessionBinding | undefined;
  list: {
    getSnapshot(): { byId: Readonly<Record<string, unknown>>; phase?: string };
    subscribe(listener: () => void): () => void;
  };
}

export interface ClientContext {
  theme: ThemeService;
  configForms: { get(entryId: string): ConfigForm };
  slots: SlotsService;
  locale: LocaleService;
  sessions: SessionsService;
  connection?: {
    state: {
      getSnapshot(): 'connected' | 'disconnected' | 'connecting' | undefined;
      subscribe(listener: () => void): () => void;
    };
  };
  inject?(names: string[], callback: (ctx: ClientContext) => void): unknown;
  on(event: 'theme/change', callback: (snapshot: ThemeSnapshot) => void): () => void;
  effect(callback: () => () => void, label?: string): unknown;
}

/** 宿主根上下文：只使用配置登记所需的入口。 */
export interface HostContext {
  fiber: unknown;
  inject(names: string[], callback: (ctx: HostContext) => void): unknown;
  effect(callback: () => unknown): unknown;
  settings?: {
    configure(options: { auto?: boolean }, fiber?: unknown): unknown;
  };
}

/** conversation.composer.dock 的会话标准属性中，本插件实际读取的部分。 */
export interface WorkingBridgeProps {
  sessionId: string;
}
