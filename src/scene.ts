/**
 * 田园场景：静态绘景、昼夜插值与农人动画。
 *
 * - 静态山湖、湖面笔触、前景与房屋使用资源包中已缓存的透明图层，不把原始
 *   两万节点矢量挂进实时 DOM。
 * - 昼夜完全由传入的本地小时计算，不累计时间；only 值变化才写 DOM。
 * - 农人仅在任务联动激活时运行动画帧，最高约 30fps。
 */
import type { Period } from './config';
import { periodOf } from './config';
import layerOccluder from '../assets/shq-occluder.png';
import layerTerrain from '../assets/shq-terrain.png';
import layerLake from '../assets/shq-lake.png';
import layerShore from '../assets/shq-shore.png';

const TAU = Math.PI * 2;
const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const smooth = (value: number): number => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function rgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function hex(channels: readonly number[]): string {
  return `#${channels.map(value => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: string, b: string, t: number): string {
  const left = rgb(a);
  const right = rgb(b);
  return hex(left.map((value, index) => lerp(value, right[index] ?? value, clamp(t))));
}

function luminance(color: string): number {
  return rgb(color)
    .map(value => value / 255)
    .map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
}

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export interface SceneColors {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  waterTop: string;
  waterBottom: string;
  mountainFar: string;
  mountainMid: string;
}

const DAY: SceneColors = {
  skyTop: '#aec8cf',
  skyMid: '#dde0c0',
  skyBottom: '#f5e6b5',
  waterTop: '#b1cdbd',
  waterBottom: '#719e98',
  mountainFar: '#a4b2b0',
  mountainMid: '#a6b6a1',
};

const DUSK: SceneColors = {
  skyTop: '#b5a6ba',
  skyMid: '#e6bdac',
  skyBottom: '#f5d597',
  waterTop: '#c1c4ad',
  waterBottom: '#929f98',
  mountainFar: '#aaa3b0',
  mountainMid: '#a6aa9a',
};

const NIGHT: SceneColors = {
  skyTop: '#10253e',
  skyMid: '#28465b',
  skyBottom: '#607e83',
  waterTop: '#4b7379',
  waterBottom: '#294d59',
  mountainFar: '#3f5e6e',
  mountainMid: '#3e6465',
};

export function nightAmount(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5 || h >= 21) return 1;
  if (h < 8) return 1 - smooth((h - 5) / 3);
  if (h < 17) return 0;
  return smooth((h - 17) / 4);
}

export function goldAmount(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const evening = Math.exp(-(((h - 17.6) / 1.65) ** 2));
  const morning = Math.exp(-(((h - 6.5) / 1.35) ** 2));
  return Math.max(evening, morning);
}

function readableInk(background: string, preferLight: boolean): string {
  const base = preferLight ? '#fff9ea' : '#1f3126';
  if (contrast(base, background) >= 4.5) return base;
  const extreme = preferLight ? '#ffffff' : '#000000';
  for (let step = 1; step <= 100; step += 1) {
    const candidate = mix(base, extreme, step / 100);
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return extreme;
}

export interface SceneTime {
  hour: number;
  night: number;
  gold: number;
  period: Period;
  colors: SceneColors;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  inkMode: 'dark' | 'light';
  halo: string;
  bubbleFill: string;
  bubbleInk: string;
  readingFill: string;
  readingBorder: string;
  readingInk: string;
  readingMuted: string;
  sun: { x: number; y: number; opacity: number };
  moon: { x: number; y: number; opacity: number };
  vars: Record<string, string>;
}

/** 由本地小时计算完整的场景状态；纯函数，便于测试。 */
export function computeScene(hour: number): SceneTime {
  const h = ((hour % 24) + 24) % 24;
  const night = nightAmount(h);
  const gold = goldAmount(h);
  const colors = Object.fromEntries(
    (Object.keys(DAY) as (keyof SceneColors)[]).map(key => {
      const evening = mix(DAY[key], DUSK[key], gold * 0.92);
      return [key, mix(evening, NIGHT[key], night)];
    }),
  ) as unknown as SceneColors;

  // 正文叠在真实风景上：取湖面与近地天空的混合色判断明暗，而不是按固定时刻。
  const background = mix(mix(colors.waterTop, colors.skyBottom, 0.35), '#30452f', 0.18);
  const preferLight = luminance(background) <= 0.179;
  const ink = readableInk(background, preferLight);
  const inkMode: 'dark' | 'light' = preferLight ? 'light' : 'dark';
  const inkSoft = mix(ink, background, 0.2);
  const inkMuted = mix(ink, background, 0.34);
  const halo = preferLight ? '0 1px 2px rgba(8, 18, 14, 0.55)' : '0 1px 2px rgba(255, 250, 236, 0.5)';

  const bubbleFill = preferLight ? 'rgba(26, 42, 35, 0.92)' : 'rgba(255, 252, 241, 0.94)';
  const bubbleInk = preferLight ? '#f1f4e6' : '#2c3a29';
  const readingFill = preferLight ? 'rgba(18, 30, 24, 0.9)' : 'rgba(255, 252, 241, 0.93)';
  const readingBorder = preferLight ? 'rgba(232, 237, 220, 0.18)' : 'rgba(44, 58, 41, 0.16)';
  const readingInk = preferLight ? '#e9eedd' : '#2c3a29';
  const readingMuted = preferLight ? '#b7c6aa' : '#5b6a52';

  const sunPhase = clamp((h - 6) / 12);
  const sun = {
    x: 270 + sunPhase * 1410,
    y: 505 - Math.sin(sunPhase * Math.PI) * 365,
    opacity: h >= 5.6 && h <= 18.6 ? clamp(1 - night * 1.5) : 0,
  };
  const moonHour = h < 12 ? h + 24 : h;
  const moonPhase = clamp((moonHour - 18) / 12);
  const moon = {
    x: 350 + moonPhase * 1310,
    y: 480 - Math.sin(moonPhase * Math.PI) * 335,
    opacity: smooth((night - 0.18) / 0.72),
  };

  const vars: Record<string, string> = {
    '--shq-sky-top': colors.skyTop,
    '--shq-sky-mid': colors.skyMid,
    '--shq-sky-bottom': colors.skyBottom,
    '--shq-water-top': colors.waterTop,
    '--shq-water-bottom': colors.waterBottom,
    '--shq-mountain-far': colors.mountainFar,
    '--shq-mountain-mid': colors.mountainMid,
    '--shq-land-brightness': (1 - night * 0.61).toFixed(3),
    '--shq-land-saturation': (1 - night * 0.27).toFixed(3),
    '--shq-farmer-brightness': (1 - night * 0.27).toFixed(3),
    '--shq-night-wash': (night * 0.25).toFixed(3),
    '--shq-stars-opacity': smooth((night - 0.18) / 0.72).toFixed(3),
    '--shq-lights-opacity': smooth((night - 0.12) / 0.56).toFixed(3),
    '--shq-fireflies-opacity': (smooth((night - 0.07) / 0.6) * 0.88).toFixed(3),
    '--shq-cloud-opacity': (0.65 - night * 0.46).toFixed(3),
    '--shq-water-lines': (0.68 - night * 0.4).toFixed(3),
    '--shq-gold-opacity': (gold * 0.6).toFixed(3),
    '--shq-ink': ink,
    '--shq-ink-soft': inkSoft,
    '--shq-ink-muted': inkMuted,
    '--shq-halo': halo,
    '--shq-bubble-fill': bubbleFill,
    '--shq-bubble-ink': bubbleInk,
    '--shq-reading-fill': readingFill,
    '--shq-reading-border': readingBorder,
    '--shq-reading-ink': readingInk,
    '--shq-reading-muted': readingMuted,
  };

  return {
    hour: h,
    night,
    gold,
    period: periodOf(h),
    colors,
    ink,
    inkSoft,
    inkMuted,
    inkMode,
    halo,
    bubbleFill,
    bubbleInk,
    readingFill,
    readingBorder,
    readingInk,
    readingMuted,
    sun,
    moon,
    vars,
  };
}

/** 计算场景 viewBox：宽屏保留全部构图，窄屏把取景移向小屋与农田。 */
export function sceneViewBox(width: number, height: number): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const aspect = w / h;
  const base = 1920 / 1080;
  if (aspect >= base) {
    const viewHeight = 1920 / aspect;
    const y = Math.max(0, 1080 - viewHeight);
    return `0 ${y.toFixed(1)} 1920 ${viewHeight.toFixed(1)}`;
  }
  const viewWidth = 1080 * aspect;
  const x = Math.min(1920 - viewWidth, Math.max(0, 1240 - viewWidth * 0.6));
  return `${x.toFixed(1)} 0 ${viewWidth.toFixed(1)} 1080`;
}

function starMarkup(): string {
  let seed = 20261020;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const parts: string[] = [];
  for (let index = 0; index < 168; index += 1) {
    const x = (random() * 1910 + 5).toFixed(1);
    const y = (random() * 505 + 8).toFixed(1);
    const radius = (0.5 + random() * 1.1).toFixed(2);
    const opacity = (0.35 + random() * 0.6).toFixed(2);
    const twinkle = index % 23 === 0 ? ' shq-twinkle' : '';
    const delay = (-(random() * 8)).toFixed(2);
    parts.push(
      `<circle class="shq-star${twinkle}" cx="${x}" cy="${y}" r="${radius}" fill="#f0eed5" opacity="${opacity}" style="animation-delay:${delay}s"/>`,
    );
  }
  return parts.join('');
}

function fireflyMarkup(): string {
  const spots = [
    [1769, 809], [1295, 990], [1369, 986], [1510, 876], [1848, 988], [1417, 838],
    [1540, 841], [1421, 893], [1651, 966], [1741, 891], [1531, 872], [1498, 955],
    [1748, 951], [1316, 886], [1532, 982], [1434, 892], [1548, 774], [1699, 972],
    [1439, 987], [1822, 842], [1523, 949], [1363, 864],
  ];
  return spots
    .map(([x, y], index) => `<circle class="shq-firefly" cx="${x}" cy="${y}" r="2" fill="#e4df8d" style="animation-delay:-${(index * 0.83).toFixed(2)}s"/>`)
    .join('');
}

function smokeMarkup(): string {
  const plumes: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    plumes.push(`<g class="shq-smoke-plume" style="animation-delay:-${(index * 1.7).toFixed(1)}s">
      <path d="M285 379C272 365 292 354 283 339C275 323 299 317 295 298" fill="none" stroke="#fff0cf" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".55" filter="url(#shq-smoke-soft)"/>
      <path d="M287 373C299 354 285 343 304 329C321 313 307 298 319 290" fill="none" stroke="#f9eddb" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".3" filter="url(#shq-smoke-soft)"/>
    </g>`);
  }
  return plumes.join('');
}

export interface FarmerRoute {
  points: { x: number; y: number; length: number }[];
  length: number;
  point(progress: number): { x: number; y: number };
}

/**
 * 按当前可视右边界生成进场路径。路径起点始终在画外一点，
 * 这样窄屏裁切时农人也不会在画面外走完整段路才出现。
 */
export function createFarmerRoute(entranceX = 2040, endX = 1642, endY = 918): FarmerRoute {
  const startX = Math.max(endX + 120, entranceX);
  const startY = 1050 - (2040 - startX) * 0.18;
  const span = startX - endX;
  const control1 = { x: startX - span * 0.28, y: startY - 7 };
  const control2 = { x: endX + span * 0.35, y: endY + 54 };
  const points: { x: number; y: number; length: number }[] = [];
  let length = 0;
  for (let index = 0; index <= 200; index += 1) {
    const t = index / 200;
    const u = 1 - t;
    const x = u * u * u * startX + 3 * u * u * t * control1.x + 3 * u * t * t * control2.x + t * t * t * endX;
    const y = u * u * u * startY + 3 * u * u * t * control1.y + 3 * u * t * t * control2.y + t * t * t * endY;
    const previous = points[points.length - 1];
    if (previous) length += Math.hypot(x - previous.x, y - previous.y);
    points.push({ x, y, length });
  }
  const point = (progress: number): { x: number; y: number } => {
    const distance = clamp(progress) * length;
    let index = points.findIndex(candidate => candidate.length >= distance);
    if (index < 0) index = points.length - 1;
    index = Math.max(0, index - 1);
    const from = points[index]!;
    const to = points[Math.min(points.length - 1, index + 1)]!;
    const segment = to.length - from.length || 1;
    const t = clamp((distance - from.length) / segment);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  };
  return { points, length, point };
}

const DEFAULT_ROUTE = createFarmerRoute(2040);

const DIG_FRAMES: readonly (readonly number[])[] = [
  [0, -14, -59, 132, -25],
  [0.13, -12, -59, 176, -12],
  [0.37, -3, -65, 304, 5],
  [0.45, -3, -65, 304, 5],
  [0.63, -14, -59, 132, -25],
  [0.7, -14, -59, 132, -28],
  [0.84, -9, -58, 137, -26],
  [1, -14, -59, 132, -25],
];

function digPose(phase: number): number[] {
  const frames = DIG_FRAMES;
  let index = 0;
  for (let i = 0; i < frames.length - 1; i += 1) {
    if (phase >= frames[i]![0]! && phase <= frames[i + 1]![0]!) {
      index = i;
      break;
    }
  }
  const a = frames[Math.max(0, index)]!;
  const b = frames[Math.max(0, index) + 1] ?? a;
  const t = smooth((phase - a[0]!) / ((b[0]! - a[0]!) || 1));
  return a.slice(1).map((value, i) => lerp(value, b[i + 1] ?? value, t));
}

function rotateShoulder(x: number, y: number, angle: number, bob: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return {
    x: x * Math.cos(rad) - (y + 33) * Math.sin(rad),
    y: -33 + x * Math.sin(rad) + (y + 33) * Math.cos(rad) + bob,
  };
}

function solveElbow(shoulder: { x: number; y: number }, hand: { x: number; y: number }, bend = 1): { x: number; y: number } {
  const upper = 22;
  const fore = 23;
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  const distance = Math.max(0.01, Math.hypot(dx, dy));
  const along = (upper * upper - fore * fore + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return {
    x: shoulder.x + (along * dx) / distance + (bend * height * dy) / distance,
    y: shoulder.y + (along * dy) / distance - (bend * height * dx) / distance,
  };
}

const pointText = (point: { x: number; y: number }): string => `${point.x.toFixed(3)} ${point.y.toFixed(3)}`;

type FarmerPhase = 'off' | 'entering' | 'preparing' | 'working' | 'packing' | 'leaving';

interface FarmerParts {
  torso: SVGElement;
  hoe: SVGElement;
  backSleeve: SVGElement;
  backWrist: SVGElement;
  frontSleeve: SVGElement;
  frontWrist: SVGElement;
  backGrip: SVGElement;
  frontGrip: SVGElement;
  soil: SVGElement;
  backLeg: SVGElement;
  backShoe: SVGElement;
  frontLeg: SVGElement;
  frontShoe: SVGElement;
  mover: SVGGElement;
  facing: SVGGElement;
  farmer: SVGGElement;
}

export class FarmerAnimator {
  private readonly parts: FarmerParts;
  private readonly root: HTMLElement;
  private route: FarmerRoute = DEFAULT_ROUTE;
  private pendingPath: { entranceX: number; endX: number } | null = null;
  private phase: FarmerPhase = 'off';
  private progress = 0;
  private phaseAge = 0;
  private farmClock = 0;
  private walkDistance = 0;
  private facing = 1;
  private pose: number[] | null = null;
  private poseFrom: number[] | null = null;
  private readonly feet = { back: { contact: false, anchor: { x: 0, y: 0 } }, front: { contact: false, anchor: { x: 0, y: 0 } } };
  private working = false;
  private enabled = true;
  private paused = false;
  private disposed = false;
  private raf: number | null = null;
  private lastFrame = 0;
  private position = { x: 2040, y: 1050 };

  constructor(root: HTMLElement) {
    this.root = root;
    const find = <T extends Element = SVGElement>(id: string): T => {
      const element = root.querySelector<T>(`#${id}`);
      if (!element) throw new Error(`山栖：缺少农人部件 ${id}`);
      return element;
    };
    this.parts = {
      torso: find('shq-farmer-torso'),
      hoe: find('shq-farmer-hoe'),
      backSleeve: find('shq-back-sleeve'),
      backWrist: find('shq-back-wrist'),
      frontSleeve: find('shq-front-sleeve'),
      frontWrist: find('shq-front-wrist'),
      backGrip: find('shq-back-grip'),
      frontGrip: find('shq-front-grip'),
      soil: find('shq-farmer-soil'),
      backLeg: find('shq-back-leg'),
      backShoe: find('shq-back-shoe'),
      frontLeg: find('shq-front-leg'),
      frontShoe: find('shq-front-shoe'),
      mover: find<SVGGElement>('shq-farmer-mover'),
      facing: find<SVGGElement>('shq-farmer-facing'),
      farmer: find<SVGGElement>('shq-farmer'),
    };
    this.parts.mover.style.display = 'none';
    this.root.dataset.shqFarm = 'off';
  }

  get state(): { phase: FarmerPhase; progress: number; working: boolean } {
    return { phase: this.phase, progress: this.progress, working: this.working };
  }

  /** 可视范围变化时调整进场起点与田间落脚点；行走中延迟到回到画外后再应用。 */
  setPath(entranceX: number, endX: number): void {
    if (this.disposed) return;
    const entrance = Math.max(1762, Math.min(2400, entranceX));
    const field = Math.max(1280, Math.min(1642, endX));
    if (this.phase === 'off') {
      this.route = createFarmerRoute(entrance, field, 918 - (1642 - field) * 0.28);
      this.pendingPath = null;
    } else {
      this.pendingPath = { entranceX: entrance, endX: field };
    }
  }

  setWorking(working: boolean): void {
    if (this.disposed) return;
    if (this.working === working) return;
    this.working = working;
    if (!this.enabled) {
      if (!working) this.resetToOff();
      return;
    }
    if (working) {
      if (this.phase === 'off' || this.phase === 'leaving') this.enter('entering');
      else if (this.phase === 'packing') this.enter(this.progress >= 1 ? 'preparing' : 'entering');
    } else if (this.phase === 'entering') {
      // 尚未走到农田：直接转身沿原路离开，不额外播放放锄动作。
      this.enter('leaving');
    } else if (this.phase === 'preparing' || this.phase === 'working') {
      this.enter('packing');
    }
    this.start();
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      this.resetToOff();
      return;
    }
    if (this.working) {
      this.enter('entering');
      this.start();
    }
  }

  pause(): void {
    this.paused = true;
    this.stop();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastFrame = 0;
    if (this.phase !== 'off') this.start();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.phase = 'off';
    this.pose = null;
    this.poseFrom = null;
  }

  private resetToOff(): void {
    this.stop();
    this.phase = 'off';
    this.progress = 0;
    this.phaseAge = 0;
    this.farmClock = 0;
    this.walkDistance = 0;
    this.pose = null;
    this.poseFrom = null;
    if (this.pendingPath !== null) {
      this.route = createFarmerRoute(this.pendingPath.entranceX, this.pendingPath.endX, 918 - (1642 - this.pendingPath.endX) * 0.28);
      this.pendingPath = null;
    }
    this.parts.mover.style.display = 'none';
    this.parts.soil.setAttribute('opacity', '0');
    this.root.dataset.shqFarm = 'off';
  }

  private start(): void {
    if (this.raf !== null || this.paused || this.disposed || this.phase === 'off') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this.lastFrame = 0;
    this.raf = requestAnimationFrame(now => this.frame(now));
  }

  private stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.lastFrame = 0;
  }

  private frame(now: number): void {
    this.raf = null;
    if (this.paused || this.disposed || this.phase === 'off') return;
    if (!this.lastFrame) this.lastFrame = now;
    const elapsed = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    // 最高约 30fps：两次渲染之间至少间隔 30ms。
    if (now - this.lastFrame < 30) {
      this.raf = requestAnimationFrame(next => this.frame(next));
      return;
    }
    this.lastFrame = now;
    this.step(elapsed);
    this.render();
    if ((this.phase as FarmerPhase) === 'off') {
      this.stop();
      return;
    }
    this.raf = requestAnimationFrame(next => this.frame(next));
  }

  private enter(phase: FarmerPhase): void {
    this.phase = phase;
    this.phaseAge = 0;
    this.poseFrom = this.pose ? this.pose.slice() : null;
    if (phase === 'working') this.farmClock = 0;
    if (phase === 'entering' || phase === 'leaving') {
      this.facing = phase === 'leaving' ? -1 : 1;
      this.feet.back.contact = false;
      this.feet.front.contact = false;
      this.walkDistance = 0;
    }
    this.parts.mover.style.display = phase === 'off' ? 'none' : '';
    this.root.dataset.shqFarm = phase;
  }

  private step(dt: number): void {
    this.phaseAge += dt;
    const previous = this.progress;
    if (this.working) {
      if (this.phase === 'off') this.enter('entering');
      else if (this.phase === 'leaving') this.enter('entering');
      else if (this.phase === 'packing') this.enter(this.progress >= 1 ? 'preparing' : 'entering');
    } else if (this.phase === 'working' || this.phase === 'preparing') {
      this.enter('packing');
    } else if (this.phase === 'entering') {
      this.enter('leaving');
    }

    if (this.phase === 'entering') {
      const speed = smooth(this.phaseAge / 0.35) * clamp((1 - this.progress) * 14, 0.22, 1);
      const duration = clamp(this.route.length / 46, 2.4, 7.5);
      this.progress = clamp(this.progress + (dt / duration) * speed);
      if (this.progress >= 1) this.enter('preparing');
    } else if (this.phase === 'preparing' && this.phaseAge >= 0.9) {
      this.enter('working');
    } else if (this.phase === 'packing' && this.phaseAge >= 0.9) {
      this.enter('leaving');
    } else if (this.phase === 'leaving') {
      const duration = clamp(this.route.length / 46, 2.4, 6.5);
      this.progress = clamp(this.progress - (dt / duration) * smooth(this.phaseAge / 0.35));
      if (this.progress <= 0) {
        this.resetToOff();
        return;
      }
    }
    if (this.phase === 'working') this.farmClock += dt;
    this.walkDistance += Math.abs(this.progress - previous) * this.route.length;
    this.position = this.route.point(this.progress);
  }

  private render(): void {
    if (this.phase === 'off') return;
    const moving = this.phase === 'entering' || this.phase === 'leaving';
    const working = this.phase === 'working';
    const phase = (this.farmClock % 3.2) / 3.2;
    const bob = this.walkLegs(moving);
    const carry = this.carryPose(bob);
    const blend = smooth(this.phaseAge / 0.9);
    let pose = carry;
    let gripBlend = 0;
    if (working) {
      pose = digPose(phase);
      gripBlend = 1;
    } else if (this.phase === 'preparing') {
      const target = digPose(0);
      pose = (this.poseFrom ?? carry).map((value, index) => lerp(value, target[index] ?? value, blend));
      gripBlend = blend;
    } else if (this.phase === 'packing') {
      pose = (this.poseFrom ?? digPose(0)).map((value, index) => lerp(value, carry[index] ?? value, blend));
      gripBlend = 1 - blend;
    }
    this.pose = pose;
    const x = pose[0] ?? -14;
    const y = pose[1] ?? -59;
    const angle = pose[2] ?? 132;
    const torso = pose[3] ?? -25;
    const radians = (angle * Math.PI) / 180;
    const grip = (distance: number): { x: number; y: number } => ({
      x: x + Math.cos(radians) * distance,
      y: y + Math.sin(radians) * distance,
    });

    this.parts.mover.setAttribute('transform', `translate(${this.position.x.toFixed(2)} ${this.position.y.toFixed(2)})`);
    this.parts.facing.setAttribute('transform', `scale(${this.facing} 1)`);
    this.parts.torso.setAttribute('transform', `translate(0 ${bob.toFixed(3)}) rotate(${torso.toFixed(3)} 0 -33)`);
    this.parts.hoe.setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${angle.toFixed(3)})`);
    this.parts.farmer.setAttribute('class', `shq-farmer ${working ? 'shq-working' : 'shq-walking'}`);

    const swing = Math.sin((this.walkDistance / 48) * TAU) * 10;
    const freeLeftHand = { x: -12 + (moving ? swing : 0), y: -18 + bob + Math.abs(swing) * 0.12 };
    const rightGrip = grip(lerp(25, 10, gripBlend));
    this.drawArm('back', rotateShoulder(9, -57, torso, bob), rightGrip, angle);
    const nearGrip = grip(32);
    this.drawArm(
      'front',
      rotateShoulder(-8, -56, torso, bob),
      { x: lerp(freeLeftHand.x, nearGrip.x, gripBlend), y: lerp(freeLeftHand.y, nearGrip.y, gripBlend) },
      angle,
    );

    const impact = working && phase >= 0.63 && phase < 0.77 ? (phase - 0.63) / 0.14 : -1;
    this.parts.soil.setAttribute('opacity', impact >= 0 ? String(Math.sin(impact * Math.PI) * 0.85) : '0');
    this.parts.soil.setAttribute('transform', impact >= 0 ? `translate(${-impact * 5} ${-impact * 7})` : 'translate(0 0)');
  }

  private drawArm(side: 'back' | 'front', shoulder: { x: number; y: number }, hand: { x: number; y: number }, angle: number): void {
    const elbow = solveElbow(shoulder, hand);
    const wrist = { x: lerp(elbow.x, hand.x, 0.72), y: lerp(elbow.y, hand.y, 0.72) };
    this.parts[`${side}Sleeve`].setAttribute('d', `M${pointText(shoulder)}L${pointText(elbow)} ${pointText(hand)}`);
    this.parts[`${side}Wrist`].setAttribute('d', `M${pointText(wrist)}L${pointText(hand)}`);
    this.parts[`${side}Grip`].setAttribute('transform', `translate(${pointText(hand)}) rotate(${angle - 90})`);
  }

  private drawLeg(side: 'back' | 'front', hip: { x: number; y: number }, ankle: { x: number; y: number }, shoeAngle: number): void {
    const dx = ankle.x - hip.x;
    const dy = ankle.y - hip.y;
    const distance = Math.max(0.01, Math.hypot(dx, dy));
    const height = Math.sqrt(Math.max(0, 23 * 23 - (distance * distance) / 4));
    const knee = {
      x: (hip.x + ankle.x) / 2 - (height * dy) / distance,
      y: (hip.y + ankle.y) / 2 + (height * dx) / distance,
    };
    this.parts[`${side}Leg`].setAttribute('d', `M${pointText(hip)}L${pointText(knee)} ${pointText(ankle)}`);
    this.parts[`${side}Shoe`].setAttribute('transform', `translate(${pointText(ankle)}) rotate(${shoeAngle.toFixed(3)})`);
    this.parts[`${side}Shoe`].dataset.contact = String(this.feet[side].contact);
  }

  private walkLegs(moving: boolean): number {
    const stride = 48;
    const support = 0.62;
    const cycle = this.walkDistance / stride;
    const bob = moving ? -1.05 + Math.cos(cycle * Math.PI * 4) * 0.8 : 0;
    const ahead = this.route.point(clamp(this.progress + (this.facing === 1 ? 0.002 : -0.002)));
    const groundSlope = (ahead.y - this.position.y) / (ahead.x - this.position.x || 1);
    for (const [side, offset, hipX] of [
      ['back', 0, 5],
      ['front', 0.5, -5],
    ] as const) {
      const foot = this.feet[side];
      const phase = (cycle + offset) % 1;
      const contact = phase < support;
      let ankle: { x: number; y: number };
      let angle = 0;
      if (moving && contact) {
        if (!foot.contact) {
          const localX = hipX - 15 + phase * stride;
          foot.anchor = {
            x: this.position.x + this.facing * localX,
            y: this.position.y - 3 + groundSlope * this.facing * localX,
          };
        }
        ankle = {
          x: (foot.anchor.x - this.position.x) * this.facing,
          y: foot.anchor.y - this.position.y,
        };
      } else if (moving) {
        const t = (phase - support) / (1 - support);
        const footX = hipX + lerp(stride * support - 15, -15, smooth(t));
        ankle = { x: footX, y: -3 + groundSlope * this.facing * footX - 7 * Math.sin(t * Math.PI) };
        angle = lerp(-18, 12, smooth(t));
      } else {
        ankle = { x: side === 'front' ? -11 : 9, y: -3 };
      }
      foot.contact = moving && contact;
      this.drawLeg(side, { x: hipX, y: -37 + bob }, ankle, angle);
    }
    return bob;
  }

  private carryPose(bob: number): number[] {
    const torso = -4;
    const shoulder = rotateShoulder(9, -57, torso, bob);
    const angle = 348;
    const radians = (angle * Math.PI) / 180;
    // 远侧右手握柄、右肩承重；右手与经过躯干的锄柄由身体遮挡。
    return [shoulder.x - 32 * Math.cos(radians), shoulder.y - 32 * Math.sin(radians), angle, torso];
  }
}

/** 生成整幅场景的 SVG 标记（图像使用构建时内联的本地资源）。 */
export function sceneMarkup(): string {
  return `<svg class="shq-world" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="shq-sky-gradient" x2="0" y2="1"><stop stop-color="var(--shq-sky-top)"/><stop offset=".65" stop-color="var(--shq-sky-mid)"/><stop offset="1" stop-color="var(--shq-sky-bottom)"/></linearGradient>
    <linearGradient id="shq-lake-gradient" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="var(--shq-water-top)"/><stop offset="1" stop-color="var(--shq-water-bottom)"/></linearGradient>
    <radialGradient id="shq-sun-glow"><stop stop-color="#fffedf"/><stop offset=".1" stop-color="#fffcc6"/><stop offset=".3" stop-color="#fff49b" stop-opacity=".7"/><stop offset="1" stop-color="#ffe783" stop-opacity="0"/></radialGradient>
    <radialGradient id="shq-haze"><stop stop-color="#ffebaf" stop-opacity=".8"/><stop offset="1" stop-color="#ffe6aa" stop-opacity="0"/></radialGradient>
    <radialGradient id="shq-lamp"><stop stop-color="#ffdb7a" stop-opacity=".8"/><stop offset=".2" stop-color="#ffd27a" stop-opacity=".28"/><stop offset="1" stop-color="#ffca70" stop-opacity="0"/></radialGradient>
    <filter id="shq-cloud-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="shq-smoke-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6"/></filter>
    <filter id="shq-light-occluder"><feFlood flood-color="#000"/><feComposite in2="SourceAlpha" operator="in"/></filter>
    <mask id="shq-window-tree-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" style="mask-type:luminance">
      <rect width="1920" height="1080" fill="#fff"/>
      <image x="0" y="437" width="1910" height="467" href="${layerOccluder}" filter="url(#shq-light-occluder)"/>
    </mask>
    <clipPath id="shq-world-clip"><path d="M0 0H1920V1080H0Z"/></clipPath>
    <clipPath id="shq-lake-clip"><path d="M0 510Q384 478 668 486T1212 491L1920 514V912L0 900Z"/></clipPath>
  </defs>
  <g clip-path="url(#shq-world-clip)">
    <rect width="1920" height="1080" fill="url(#shq-sky-gradient)"/>
    <g class="shq-stars" style="opacity:var(--shq-stars-opacity,0)">${starMarkup()}</g>
    <g class="shq-sun"><ellipse cx="0" cy="0" rx="182" ry="182" fill="url(#shq-sun-glow)"/><ellipse cx="0" cy="0" rx="22" ry="22" fill="#fff0b1" opacity=".94"/></g>
    <g class="shq-moon" style="opacity:var(--shq-stars-opacity,0)"><ellipse cx="0" cy="0" rx="61" ry="61" fill="url(#shq-lamp)"/><ellipse cx="0" cy="0" rx="17" ry="17" fill="#e8e5c5"/><ellipse cx="-5" cy="-4" rx="2.5" ry="3" fill="#bdccb8" opacity=".5"/><ellipse cx="6" cy="6" rx="4" ry="3" fill="#bdccb8" opacity=".35"/></g>
    <g class="shq-clouds" style="opacity:var(--shq-cloud-opacity,.55)">
      <path d="M31.6 158.8q47 -18 71 -5q-3 -27 22 -26q22 -38 50 -6q31 -11 38 20q38 -6 60 14Z" fill="#fff2d0" opacity=".54" filter="url(#shq-cloud-blur)"/>
      <path d="M590.2 204.6q47 -18 71 -5q-3 -27 22 -26q22 -38 50 -6q31 -11 38 20q38 -6 60 14Z" fill="#fff2d0" opacity=".54" filter="url(#shq-cloud-blur)"/>
      <path d="M872.4 142.2q47 -18 71 -5q-3 -27 22 -26q22 -38 50 -6q31 -11 38 20q38 -6 60 14Z" fill="#fff2d0" opacity=".54" filter="url(#shq-cloud-blur)"/>
      <path d="M1478.8 203.4q47 -18 71 -5q-3 -27 22 -26q22 -38 50 -6q31 -11 38 20q38 -6 60 14Z" fill="#fff2d0" opacity=".54" filter="url(#shq-cloud-blur)"/>
    </g>
    <path d="M0 480L141 422 252 389 324 413 403 354 472 380 571 335 657 352 737 392 829 349 922 373 1016 336 1148 383 1267 348 1380 408 1490 372 1610 411 1770 394 1920 448V597H0Z" fill="var(--shq-mountain-far)"/>
    <path d="M0 489L158 461 277 468 417 424 569 453 681 434 845 466 972 416 1127 436 1280 424 1413 458 1539 435 1730 467 1920 455V579H0Z" fill="var(--shq-mountain-mid)"/>
    <g class="shq-terrain" style="filter:brightness(var(--shq-land-brightness,1)) saturate(var(--shq-land-saturation,1))"><image x="0" y="137" width="1920" height="452" href="${layerTerrain}"/></g>
    <path d="M0 552Q384 511 668 527T1212 531Q1581 507 1920 551V912H0Z" fill="url(#shq-lake-gradient)"/>
    <g class="shq-lake-strokes" clip-path="url(#shq-lake-clip)" style="opacity:var(--shq-water-lines,.6)"><image x="0" y="532" width="1920" height="377" href="${layerLake}"/></g>
    <ellipse cx="1460" cy="593" rx="230" ry="124" fill="url(#shq-haze)" style="opacity:var(--shq-gold-opacity,.3)"/>
    <g class="shq-shore" style="filter:brightness(var(--shq-land-brightness,1)) saturate(var(--shq-land-saturation,1))"><image x="0" y="437" width="1920" height="643" href="${layerShore}"/></g>
    <g class="shq-smoke" transform="translate(1240 244) scale(.67)" aria-hidden="true">${smokeMarkup()}</g>
    <rect class="shq-night-wash" width="1920" height="1080" fill="#102c45" style="opacity:var(--shq-night-wash,0)" pointer-events="none"/>
    <g class="shq-cottage-lights" mask="url(#shq-window-tree-mask)">
      <g transform="translate(1240 244) scale(.67)" style="opacity:var(--shq-lights-opacity,0)">
        <ellipse cx="446.5" cy="626.5" rx="56" ry="57" fill="url(#shq-lamp)"/><polygon points="437,607 456,600.6 456,637.6 437,646" fill="#eab96a"/><path d="M446.5 601.8L446.5 642.8" fill="none" stroke="#806b46" stroke-width="2" stroke-linecap="round"/><path d="M437 629.4L456 621" fill="none" stroke="#806b46" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="589.5" cy="606.5" rx="56" ry="57" fill="url(#shq-lamp)"/><polygon points="580,586 599,579.6 599,618.6 580,627" fill="#eab96a"/><path d="M589.5 580.8L589.5 623.8" fill="none" stroke="#806b46" stroke-width="2" stroke-linecap="round"/><path d="M580 609.6L599 601.1" fill="none" stroke="#806b46" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="451.5" cy="703" rx="56" ry="57" fill="url(#shq-lamp)"/><polygon points="444,683 459,677.8 459,715.8 444,723" fill="#eab96a"/><path d="M451.5 678.4L451.5 720.4" fill="none" stroke="#806b46" stroke-width="2" stroke-linecap="round"/><path d="M444 706L459 698.8" fill="none" stroke="#806b46" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="505.5" cy="455.5" rx="56" ry="57" fill="url(#shq-lamp)"/><polygon points="497,443 514,437.2 514,460.2 497,468" fill="#eab96a"/><path d="M505.5 438.1L505.5 465.1" fill="none" stroke="#806b46" stroke-width="2" stroke-linecap="round"/><path d="M497 457.6L514 449.8" fill="none" stroke="#806b46" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="552" cy="682" rx="54" ry="58" fill="url(#shq-lamp)"/><path d="M549 675h8l1 13 -9 2Z" fill="#ffdf91" stroke="#90764b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M544 671q11 -9 17 0" fill="none" stroke="#726447" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </g>
    <g class="shq-fireflies" style="opacity:var(--shq-fireflies-opacity,0)">${fireflyMarkup()}</g>
    <g id="shq-farmer-mover" transform="translate(2040 1020)" style="display:none">
      <ellipse cx="0" cy="1" rx="24" ry="7" fill="#32472d" opacity=".25"/>
      <g id="shq-farmer-facing">
        <g id="shq-farmer" class="shq-farmer shq-walking">
          <g class="shq-leg shq-leg-back"><path id="shq-back-leg" d="M6 -32L13 -16 8 -3" fill="none" stroke="#51594d" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/><path id="shq-back-shoe" d="M-6 -3L-4 -5 4 -4 5 1Q0 4 -12 2L-12 0Z" transform="translate(8 -3)" fill="#4b4532" stroke="#393f2d" stroke-width="1.2"/></g>
          <g class="shq-leg shq-leg-front"><path id="shq-front-leg" d="M-6 -32L-8 -17 -10 -3" fill="none" stroke="#667062" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/><path id="shq-front-shoe" d="M-6 -3L-4 -5 4 -4 5 1Q0 4 -12 2L-12 0Z" transform="translate(-10 -3)" fill="#554833" stroke="#393f2d" stroke-width="1.2"/></g>
          <g class="shq-arm shq-arm-back"><path id="shq-back-sleeve" d="M-1.986 -58.555L-3.237 -36.591 -20.691 -51.569" fill="none" stroke="#647d4c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path id="shq-back-wrist" d="M-15.804 -47.375L-20.691 -51.569" fill="none" stroke="#cda57d" stroke-width="5.5" stroke-linecap="round"/></g>
          <g class="shq-hoe" id="shq-farmer-hoe" transform="translate(-14 -59) rotate(132)"><path d="M0 0H56" stroke="#795a36" stroke-width="3.8" stroke-linecap="round"/><path d="M2 -1H53" stroke="#c6a571" stroke-width="1.1" stroke-linecap="round"/><path d="M53 -2L57 -3 60 -15 66 -15 64 -2 57 3 53 2Z" fill="#91a093" stroke="#526254" stroke-width="1.3"/><path d="M61 -14h5" stroke="#c2c8b4" stroke-width="1"/></g>
          <g id="shq-back-grip" transform="translate(-20.691 -51.569) rotate(42)"><ellipse rx="3.2" ry="4.1" fill="#cda57d" stroke="#9b7d58" stroke-width=".6"/><path d="M-1 -2v4M1 -2v4" stroke="#ac8960" stroke-width=".5"/></g>
          <g class="shq-farmer-upper" id="shq-farmer-torso" transform="rotate(-25 0 -33)">
            <path d="M-9 -62Q1 -67 12 -59L15 -32Q2 -27 -13 -33Z" fill="#667e4d" stroke="#3f5736" stroke-width="1.6"/>
            <path d="M3 -60L5 -34M-10 -44L11 -42" fill="none" stroke="#95a56a" stroke-width="1.2"/>
            <path d="M-3 -65L-3 -58" stroke="#cba37c" stroke-width="7"/>
            <g class="shq-farmer-head"><path d="M-11 -76Q-14 -63 -4 -63Q6 -63 8 -75" fill="#dbb58b" stroke="#856b4c" stroke-width="1"/><path d="M-11 -73L-15 -69 -10 -68" fill="#dbb58b"/><path d="M-7 -73h1" stroke="#554d37" stroke-width="1.8"/><path d="M0 -80q10 2 8 11l-4 2 -3 -8Z" fill="#544b34"/><path d="M-21 -77Q-4 -84 17 -78Q24 -73 2 -72Q-19 -71 -21 -77Z" fill="#d4b76c" stroke="#8c7c47" stroke-width="1.3"/><path d="M-12 -79L-9 -88Q1 -93 9 -85L12 -78Z" fill="#dfc581" stroke="#9b8952" stroke-width="1.3"/><path d="M-11 -79Q1 -77 11 -79" fill="none" stroke="#98854d" stroke-width="2"/></g>
          </g>
          <g class="shq-arm shq-arm-front"><path id="shq-front-sleeve" d="M-16.971 -50.464L-13.336 -28.766 -35.412 -35.219" fill="none" stroke="#7e925c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><path id="shq-front-wrist" d="M-29.231 -33.413L-35.412 -35.219" fill="none" stroke="#deb88c" stroke-width="5.8" stroke-linecap="round"/></g>
          <g id="shq-front-grip" transform="translate(-35.412 -35.219) rotate(42)"><ellipse rx="3.4" ry="4.3" fill="#deb88c" stroke="#a18760" stroke-width=".6"/><path d="M-1 -2v4M1 -2v4" stroke="#b38d63" stroke-width=".5"/></g>
          <g class="shq-soil" id="shq-farmer-soil" opacity="0"><path d="M-58 0l-4 -5M-63 1l-1 -7M-68 0l-6 -2" stroke="#ab955d" stroke-width="1.8" stroke-linecap="round"/></g>
        </g>
      </g>
    </g>
  </g>
</svg>`;
}

export interface SceneViewOptions {
  /** 减少动态效果时关闭环境动画，但保留任务联动本身。 */
  reducedMotion: boolean;
  ambient: boolean;
}

export interface SceneView {
  apply(time: SceneTime): void;
  setViewBox(width: number, height: number): void;
  setFarmerWorking(working: boolean): void;
  setFarmerEnabled(enabled: boolean): void;
  setMotion(options: SceneViewOptions): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

/** 把场景挂到容器里，并只在实际值变化时写入 DOM。 */
export function createSceneView(container: HTMLElement, options: SceneViewOptions): SceneView {
  container.innerHTML = sceneMarkup();
  const svg = container.querySelector<SVGSVGElement>('.shq-world');
  if (!svg) throw new Error('山栖：场景 SVG 未生成');
  const farmer = new FarmerAnimator(container);
  const applied = new Map<string, string>();
  let previousPeriod = '';
  let previousInk = '';
  let previousSun = '';
  let previousMoon = '';
  let reducedMotion = options.reducedMotion;
  let ambient = options.ambient;
  let paused = false;

  const syncMotion = (): void => {
    container.dataset.shqAmbient = ambient && !reducedMotion ? 'on' : 'off';
    container.dataset.shqReduced = reducedMotion ? 'on' : 'off';
    container.dataset.shqPaused = paused ? 'on' : 'off';
  };
  syncMotion();

  return {
    apply(time: SceneTime): void {
      for (const [name, value] of Object.entries(time.vars)) {
        if (applied.get(name) === value) continue;
        applied.set(name, value);
        container.style.setProperty(name, value);
      }
      if (previousPeriod !== time.period) {
        previousPeriod = time.period;
        container.dataset.shqPeriod = time.period;
      }
      if (previousInk !== time.inkMode) {
        previousInk = time.inkMode;
        container.dataset.shqInk = time.inkMode;
      }
      const sun = `${time.sun.x.toFixed(1)} ${time.sun.y.toFixed(1)} ${time.sun.opacity.toFixed(3)}`;
      if (sun !== previousSun) {
        previousSun = sun;
        const group = container.querySelector<SVGGElement>('.shq-sun');
        group?.setAttribute('transform', `translate(${time.sun.x.toFixed(2)} ${time.sun.y.toFixed(2)})`);
        if (group) group.style.opacity = time.sun.opacity.toFixed(3);
      }
      const moon = `${time.moon.x.toFixed(1)} ${time.moon.y.toFixed(1)}`;
      if (moon !== previousMoon) {
        previousMoon = moon;
        container
          .querySelector<SVGGElement>('.shq-moon')
          ?.setAttribute('transform', `translate(${time.moon.x.toFixed(2)} ${time.moon.y.toFixed(2)})`);
      }
    },
    setViewBox(width: number, height: number): void {
      const box = sceneViewBox(width, height);
      svg.setAttribute('viewBox', box);
      const [x, , w] = box.split(' ').map(Number);
      const right = (x ?? 0) + (w ?? 1920);
      farmer.setPath(right + 40, Math.min(1642, right - 50));
    },
    setFarmerWorking(working: boolean): void {
      farmer.setWorking(working);
    },
    setFarmerEnabled(enabled: boolean): void {
      farmer.setEnabled(enabled);
    },
    setMotion(next: SceneViewOptions): void {
      reducedMotion = next.reducedMotion;
      ambient = next.ambient;
      syncMotion();
    },
    pause(): void {
      paused = true;
      syncMotion();
      farmer.pause();
    },
    resume(): void {
      paused = false;
      syncMotion();
      farmer.resume();
    },
    dispose(): void {
      farmer.dispose();
      container.innerHTML = '';
      container.removeAttribute('style');
    },
  };
}

/** 供测试与调试读取农人路线长度。 */
export const FARMER_ROUTE_LENGTH = DEFAULT_ROUTE.length;
/** 供测试读取默认路线的采样。 */
export function farmerRoutePoint(progress: number): { x: number; y: number } {
  return DEFAULT_ROUTE.point(progress);
}
