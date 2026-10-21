/**
 * 场景运行时：宿主布局适配、主题令牌覆盖、系统时间同步与资源释放。
 *
 * 设计约束：
 * - 不依赖 CSS Module 哈希，只使用宿主公开的 data-slot / data-* 稳定标记。
 * - 背景层 pointer-events: none，不拦截鼠标、触摸或键盘。
 * - 场景时间每秒读取一次系统时钟；颜色只在值变化时写入，不做逐帧昼夜计算。
 * - 页面不可见时停止时钟与人物动画；恢复时立即重读系统时间与当前任务状态。
 */
import { localHour, normalize, periodOf, PACKAGE_ID, type Preferences } from './config';
import type { ThemeService } from './contracts';
import { uiTokens, darkTokenValues } from './palette';
import { computeScene, createSceneView, type SceneTime, type SceneView } from './scene';

export interface RuntimeStatus {
  active: boolean;
  dark: boolean;
  hour: number;
  period: ReturnType<typeof periodOf>;
  working: boolean;
  farmer: boolean;
  ambient: boolean;
  scheme: 'light' | 'dark';
  mounted: boolean;
}

export interface VisualRuntime {
  update(preferences: Preferences): void;
  setWorking(working: boolean): void;
  /** 连接断开时立即停止展示联动，但保留任务状态；重连后由订阅方重新同步。 */
  setConnected(connected: boolean): void;
  refreshTheme(): void;
  getStatus(): RuntimeStatus;
  subscribeStatus(listener: () => void): () => void;
  dispose(): void;
}

const STAGE_CLASS = 'shq-stage';

/** 需要写在 body 上供聊天文字与阅读面继承的场景变量。 */
const BODY_VARS = [
  '--shq-ink',
  '--shq-ink-soft',
  '--shq-ink-muted',
  '--shq-halo',
  '--shq-bubble-fill',
  '--shq-bubble-ink',
  '--shq-reading-fill',
  '--shq-reading-border',
  '--shq-reading-ink',
  '--shq-reading-muted',
] as const;

/**
 * 场景入夜时的整页深色令牌。
 * 不写宿主主题偏好；只在本主题启用期间用内联变量覆盖界面材质，白昼或卸载时立即恢复。
 */
const NIGHT_TOKENS = darkTokenValues();

interface Adapter {
  conversation: HTMLElement;
  frame: HTMLElement | null;
  column: HTMLElement | null;
}

export function createVisualRuntime(theme: ThemeService): VisualRuntime {
  let preferences: Preferences = normalize(undefined);
  let working = false;
  let linkConnected = true;
  let mounted = false;
  let disposed = false;
  let applyingTokens = false;
  let releaseTokens: (() => void) | undefined;
  let stage: HTMLElement | null = null;
  let scene: SceneView | null = null;
  let adapter: Adapter | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let mainObserver: MutationObserver | null = null;
  let phaseObserver: MutationObserver | null = null;
  let clock: ReturnType<typeof setInterval> | null = null;
  let positionFrame = 0;
  let lastSceneKey = '';
  let lastSize = '';
  let lastHourMinute = -1;
  let sceneTime: SceneTime | null = null;
  let media: MediaQueryList | null = null;
  const bodyVars = new Map<string, string>();
  const nightSaved = new Map<string, string>();
  const statusListeners = new Set<() => void>();
  const status: RuntimeStatus = {
    active: false,
    dark: false,
    hour: 0,
    period: 'day',
    working: false,
    farmer: true,
    ambient: true,
    scheme: 'light',
    mounted: false,
  };

  const scheme = (): 'light' | 'dark' => (theme.getTheme().active?.colorScheme === 'dark' ? 'dark' : 'light');

  const notify = (): void => {
    status.working = working && linkConnected;
    status.farmer = preferences.farmer;
    status.ambient = preferences.ambient;
    status.scheme = scheme();
    status.dark = status.scheme === 'dark';
    for (const listener of statusListeners) listener();
  };

  const showFarmer = (): boolean => working && linkConnected && preferences.farmer;

  const reducedMotion = (): boolean => {
    try {
      return media?.matches === true;
    } catch {
      return false;
    }
  };

  const syncBody = (): void => {
    if (!mounted || disposed) return;
    const body = document.body;
    body.dataset.shqTheme = '';
    body.dataset.shqScheme = status.scheme;
    body.dataset.shqMotion = preferences.ambient && !reducedMotion() ? 'on' : 'off';
    body.dataset.shqReduced = reducedMotion() ? 'on' : 'off';
    body.dataset.shqMode = preferences.timeMode;
    body.dataset.shqFarmer = preferences.farmer ? 'on' : 'off';
    body.dataset.shqWorking = working && linkConnected ? 'on' : 'off';
    body.toggleAttribute('data-shq-desktop', document.documentElement.hasAttribute('data-windows-titlebar'));
    if (sceneTime) {
      body.dataset.shqPeriod = sceneTime.period;
      body.dataset.shqInk = sceneTime.inkMode;
    }
  };

  const clearAdapter = (): void => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    phaseObserver?.disconnect();
    phaseObserver = null;
    if (adapter) {
      adapter.conversation.removeAttribute('data-shq-conversation');
      adapter.frame?.removeAttribute('data-shq-frame');
      adapter.column?.removeAttribute('data-shq-column');
    }
    adapter = null;
    if (stage) {
      stage.hidden = true;
    }
  };

  const connected = (): boolean =>
    Boolean(adapter && adapter.conversation.isConnected && (!adapter.frame || adapter.frame.isConnected));

  const position = (): void => {
    if (!mounted || disposed || !stage) return;
    positionFrame = 0;
    if (!adapter || !connected()) {
      ensureAdapter();
      return;
    }
    const rect = adapter.conversation.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      stage.hidden = true;
      return;
    }
    stage.hidden = false;
    stage.style.left = `${Math.round(rect.left)}px`;
    stage.style.top = `${Math.round(rect.top)}px`;
    stage.style.width = `${Math.round(rect.width)}px`;
    stage.style.height = `${Math.round(rect.height)}px`;
    const size = `${Math.round(rect.width)}:${Math.round(rect.height)}`;
    if (size !== lastSize) {
      lastSize = size;
      scene?.setViewBox(rect.width, rect.height);
      stage.dataset.shqSize = rect.width >= 900 ? 'wide' : rect.width >= 580 ? 'narrow' : 'small';
    }
    stage.dataset.shqPhase = adapter.conversation.dataset.phase ?? 'active';
  };

  const schedulePosition = (): void => {
    if (positionFrame) return;
    if (typeof requestAnimationFrame !== 'function') {
      position();
      return;
    }
    positionFrame = requestAnimationFrame(() => position());
  };

  const ensureAdapter = (): void => {
    if (!mounted || disposed) return;
    if (connected()) {
      schedulePosition();
      return;
    }
    clearAdapter();
    const conversation =
      (document.querySelector('[data-slot="main.conversation"] > [data-phase]') as HTMLElement | null) ??
      (document.querySelector('[data-slot="main.conversation"]') as HTMLElement | null) ??
      (document.querySelector('[data-slot="main"] [data-phase]') as HTMLElement | null);
    if (!conversation) {
      stage && (stage.hidden = true);
      watchMain();
      return;
    }
    const overlay = document.querySelector('[data-shell-overlay]') as HTMLElement | null;
    const frame = overlay?.parentElement ?? null;
    let column: HTMLElement | null = conversation;
    if (frame && frame.contains(conversation)) {
      while (column && column.parentElement && column.parentElement !== frame) column = column.parentElement;
    } else {
      column = null;
    }
    adapter = { conversation, frame, column };
    conversation.dataset.shqConversation = '';
    frame?.setAttribute('data-shq-frame', '');
    column?.setAttribute('data-shq-column', '');
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => schedulePosition());
      resizeObserver.observe(conversation);
    }
    if (typeof MutationObserver === 'function') {
      phaseObserver = new MutationObserver(() => {
        if (adapter) stage && (stage.dataset.shqPhase = adapter.conversation.dataset.phase ?? 'active');
      });
      phaseObserver.observe(conversation, { attributes: true, attributeFilter: ['data-phase'] });
    }
    stage && (stage.hidden = false);
    schedulePosition();
    watchMain();
  };

  const watchMain = (): void => {
    if (mainObserver || typeof MutationObserver !== 'function') return;
    const main = document.querySelector('[data-slot="main"]');
    if (!main) return;
    mainObserver = new MutationObserver(() => schedulePosition());
    mainObserver.observe(main, { childList: true });
  };

  /**
   * 场景入夜时把整页界面切到深色。只覆盖当前主题启用期间的内联变量，
   * 不改写宿主 preference，也不触发 theme.setTheme。
   */
  const applyNightTokens = (night: boolean): void => {
    const body = document.body;
    if (night) {
      for (const [name, value] of Object.entries(NIGHT_TOKENS)) {
        if (!nightSaved.has(name)) nightSaved.set(name, body.style.getPropertyValue(name));
        if (body.style.getPropertyValue(name) !== value) body.style.setProperty(name, value);
      }
      body.setAttribute('data-shq-night-ui', '');
      return;
    }
    for (const [name, previous] of nightSaved) {
      if (previous) body.style.setProperty(name, previous);
      else body.style.removeProperty(name);
    }
    nightSaved.clear();
    body.removeAttribute('data-shq-night-ui');
  };

  const applyScene = (force = false): void => {
    if (!scene || !mounted) return;
    const hour = preferences.timeMode === 'system' ? localHour(new Date()) : preferences.previewHour;
    const key = `${preferences.timeMode}:${hour.toFixed(3)}`;
    if (!force && key === lastSceneKey) return;
    lastSceneKey = key;
    sceneTime = computeScene(hour);
    status.hour = hour;
    status.period = sceneTime.period;
    scene.apply(sceneTime);
    for (const name of BODY_VARS) {
      const value = sceneTime.vars[name];
      if (value === undefined || bodyVars.get(name) === value) continue;
      bodyVars.set(name, value);
      document.body.style.setProperty(name, value);
    }
    applyNightTokens(sceneTime.inkMode === 'light');
    syncBody();
    const minute = Math.floor(((hour % 24) + 24) % 24 * 60);
    if (minute !== lastHourMinute) {
      lastHourMinute = minute;
      notify();
    }
  };

  const startClock = (): void => {
    if (clock) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    clock = setInterval(() => {
      ensureAdapter();
      if (preferences.timeMode === 'system') applyScene();
    }, 1000);
  };

  const stopClock = (): void => {
    if (!clock) return;
    clearInterval(clock);
    clock = null;
  };

  const onVisibility = (): void => {
    if (!mounted) return;
    if (document.hidden) {
      stopClock();
      scene?.pause();
      stage?.setAttribute('data-shq-paused', 'on');
      return;
    }
    stage?.removeAttribute('data-shq-paused');
    scene?.resume();
    ensureAdapter();
    applyScene(true);
    startClock();
  };

  const onFocus = (): void => {
    if (!mounted) return;
    ensureAdapter();
    applyScene(true);
  };

  const onResize = (): void => schedulePosition();

  const onMediaChange = (): void => {
    syncBody();
    scene?.setMotion({ reducedMotion: reducedMotion(), ambient: preferences.ambient });
  };

  const applyTokens = (): void => {
    if (releaseTokens) return;
    applyingTokens = true;
    try {
      releaseTokens = theme.overrideTokens(PACKAGE_ID, uiTokens());
    } finally {
      applyingTokens = false;
    }
  };

  const mount = (): void => {
    if (mounted || disposed) return;
    mounted = true;
    status.mounted = true;
    status.active = true;
    if (!stage) {
      stage = document.createElement('div');
      stage.className = STAGE_CLASS;
      stage.setAttribute('data-shq-stage', '');
      stage.setAttribute('aria-hidden', 'true');
      stage.hidden = true;
    }
    applyTokens();
    if (!stage.isConnected) document.body.prepend(stage);
    if (!scene) scene = createSceneView(stage, { reducedMotion: reducedMotion(), ambient: preferences.ambient });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('resize', onResize);
    if (typeof matchMedia === 'function') {
      media = matchMedia('(prefers-reduced-motion: reduce)');
      media.addEventListener?.('change', onMediaChange);
    }
    syncBody();
    ensureAdapter();
    applyScene(true);
    scene.setFarmerEnabled(preferences.farmer);
    scene.setFarmerWorking(showFarmer());
    stage.dataset.shqMotion = preferences.ambient && !reducedMotion() ? 'on' : 'off';
    startClock();
    notify();
  };

  const unmount = (): void => {
    if (!mounted) return;
    mounted = false;
    status.mounted = false;
    status.active = false;
    stopClock();
    if (positionFrame) {
      cancelAnimationFrame(positionFrame);
      positionFrame = 0;
    }
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('resize', onResize);
    media?.removeEventListener?.('change', onMediaChange);
    media = null;
    mainObserver?.disconnect();
    mainObserver = null;
    clearAdapter();
    scene?.dispose();
    scene = null;
    stage?.remove();
    stage = null;
    const release = releaseTokens;
    releaseTokens = undefined;
    release?.();
    lastSceneKey = '';
    lastSize = '';
    lastHourMinute = -1;
    sceneTime = null;
    applyNightTokens(false);
    for (const name of BODY_VARS) document.body.style.removeProperty(name);
    bodyVars.clear();
    const body = document.body;
    for (const name of [
      'shqTheme',
      'shqScheme',
      'shqMotion',
      'shqReduced',
      'shqMode',
      'shqFarmer',
      'shqWorking',
      'shqPeriod',
      'shqInk',
    ]) {
      delete body.dataset[name];
    }
    body.removeAttribute('data-shq-theme');
    body.removeAttribute('data-shq-desktop');
    notify();
  };

  const runtime: VisualRuntime = {
    update(next: Preferences): void {
      if (disposed) return;
      const previous = preferences;
      preferences = normalize(next);
      status.farmer = preferences.farmer;
      status.ambient = preferences.ambient;
      if (!preferences.enabled) {
        if (mounted) unmount();
        return;
      }
      if (!mounted) mount();
      if (scene && previous.ambient !== preferences.ambient) {
        scene.setMotion({ reducedMotion: reducedMotion(), ambient: preferences.ambient });
      }
      if (scene && previous.farmer !== preferences.farmer) {
        scene.setFarmerEnabled(preferences.farmer);
        if (preferences.farmer) scene.setFarmerWorking(showFarmer());
      }
      syncBody();
      applyScene(previous.timeMode !== preferences.timeMode || previous.previewHour !== preferences.previewHour);
      notify();
    },
    setWorking(next: boolean): void {
      if (disposed || working === next) return;
      working = next;
      status.working = next && linkConnected;
      if (mounted) {
        document.body.dataset.shqWorking = next && linkConnected ? 'on' : 'off';
        scene?.setFarmerWorking(showFarmer());
      }
      notify();
    },
    setConnected(next: boolean): void {
      if (disposed || linkConnected === next) return;
      linkConnected = next;
      status.working = working && linkConnected;
      if (mounted) {
        document.body.dataset.shqWorking = working && linkConnected ? 'on' : 'off';
        scene?.setFarmerWorking(showFarmer());
      }
      notify();
    },
    refreshTheme(): void {
      if (disposed) return;
      if (applyingTokens) return;
      status.scheme = scheme();
      status.dark = status.scheme === 'dark';
      if (mounted) {
        syncBody();
        ensureAdapter();
        applyScene(true);
      }
      notify();
    },
    getStatus(): RuntimeStatus {
      return { ...status, working: working && linkConnected, farmer: preferences.farmer, ambient: preferences.ambient };
    },
    subscribeStatus(listener: () => void): () => void {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unmount();
      statusListeners.clear();
    },
  };

  return runtime;
}
