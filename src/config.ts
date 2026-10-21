/**
 * 插件标识、偏好类型、默认值与校正逻辑。
 * 配置通过宿主 Settings / configForms 持久化，客户端只读取已接受的值。
 */
export const ENTRY_ID = 'ui-shanqi-theme';
export const PACKAGE_ID = 'dsh-shanqi-theme';
export const DISPLAY_NAME = '山栖';
export const DESIGN_NAME = '山水之间';

export type TimeMode = 'system' | 'preview';
export type Period = 'dawn' | 'day' | 'dusk' | 'night';

export interface Preferences {
  /** 主题总开关。关闭后释放全部样式、场景、订阅与定时器。 */
  enabled: boolean;
  /** 默认且主要的运行方式：跟随本机系统时间。 */
  timeMode: TimeMode;
  /** 手动预览时刻（0–24 小时）。只在 timeMode === 'preview' 时使用。 */
  previewHour: number;
  /** 农人任务联动总开关：只决定是否展示联动，农民出现仍由当前对话的 running 状态触发。 */
  farmer: boolean;
  /** 炊烟、星光与萤火等环境微动。 */
  ambient: boolean;
}

export const DEFAULTS: Readonly<Preferences> = Object.freeze({
  enabled: true,
  timeMode: 'system',
  previewHour: 17.5,
  farmer: true,
  ambient: true,
});

export const PREFERENCE_KEYS = ['enabled', 'timeMode', 'previewHour', 'farmer', 'ambient'] as const;

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampHour(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const wrapped = ((value % 24) + 24) % 24;
  return Math.round(wrapped * 100) / 100;
}

/** 把任意来源的配置值校正为完整、可用的偏好。 */
export function normalize(value: unknown): Preferences {
  const raw = value && typeof value === 'object' ? (value as Partial<Preferences>) : {};
  return {
    enabled: boolean(raw.enabled, DEFAULTS.enabled),
    timeMode: raw.timeMode === 'preview' ? 'preview' : DEFAULTS.timeMode,
    previewHour: clampHour(raw.previewHour, DEFAULTS.previewHour),
    farmer: boolean(raw.farmer, DEFAULTS.farmer),
    ambient: boolean(raw.ambient, DEFAULTS.ambient),
  };
}

/** 把小时数格式化为 HH:MM，用于设置页与状态。 */
export function formatHour(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  const total = Math.floor(wrapped * 60 + 1e-6) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** 当前本地小时（含分钟与秒），由 Date 直接读取，不累计计时。 */
export function localHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600 + date.getMilliseconds() / 3600000;
}

/**
 * 场景时段：只用于文案与样式标记。真正的明暗由连续的 nightAmount 计算，
 * 因此这里不是固定时刻的硬切换。
 */
export function periodOf(hour: number): Period {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5 || h >= 21) return 'night';
  if (h < 8) return 'dawn';
  if (h < 16.7) return 'day';
  if (h < 19.5) return 'dusk';
  return 'night';
}

export function presetHour(preset: 'dawn' | 'day' | 'dusk' | 'night'): number {
  return { dawn: 6.6, day: 12.5, dusk: 17.7, night: 22 }[preset];
}
