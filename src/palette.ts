/**
 * DSH 主题令牌映射。
 *
 * 这里只覆盖界面材质与语义色，不覆盖场景（场景由 runtime.ts 写在 body 的
 * --shq-* 变量上）。浅色与深色两套值同时提交给 theme.overrideTokens，
 * 因此宿主切换外观时不需要重新叠加，也不会产生 theme/change 递归。
 */

export interface UiPalette {
  bgBase: string;
  bgL1: string;
  bgL2: string;
  bgL3: string;
  bgL4: string;
  bgOverlay: string;
  bgModule: string;
  labelPrimary: string;
  labelSecondary: string;
  labelTertiary: string;
  labelCaption: string;
  labelDimmed: string;
  borderL1: string;
  borderL2: string;
  borderL3: string;
  borderL4: string;
  brand: string;
  brandInk: string;
  accent: string;
  accentInk: string;
  error: string;
  warn: string;
  success: string;
  idle: string;
  codeBlock: string;
  codeBanner: string;
  inlineCode: string;
  inputMajor: string;
  sidebar: string;
  sidebarHover: string;
  sidebarActive: string;
  sidebarAccent: string;
  menu: string;
  menuHeader: string;
  selector: string;
  settingsCard: string;
  settingsStroke: string;
  tooltip: string;
  toast: string;
  toastInk: string;
  link: string;
  switchThumb: string;
  focus: string;
  scrollbar: string;
  scrollbarHover: string;
  bubble: string;
  turnTrigger: string;
}

export const LIGHT: UiPalette = {
  bgBase: '#faf6e9',
  bgL1: '#fffdf4',
  bgL2: '#f6f0df',
  bgL3: '#efe8d5',
  bgL4: '#e8e0ca',
  bgOverlay: '#fffdf4',
  bgModule: '#f4eeda',
  labelPrimary: '#2c3a29',
  labelSecondary: '#53614a',
  labelTertiary: '#5a6650',
  labelCaption: '#5f6b54',
  labelDimmed: '#66725b',
  borderL1: '#2c3a2912',
  borderL2: '#2c3a291f',
  borderL3: '#2c3a292b',
  borderL4: '#2c3a2938',
  brand: '#4a6040',
  brandInk: '#faf6e9',
  accent: '#556a41',
  accentInk: '#faf6e9',
  error: '#9e3f33',
  warn: '#8a641c',
  success: '#3f6b37',
  idle: '#a9ae9a',
  codeBlock: '#f4efdf',
  codeBanner: '#ebe4d0',
  inlineCode: '#2c3a2914',
  inputMajor: 'rgba(255, 253, 244, 0.96)',
  sidebar: '#f2ecdb',
  sidebarHover: '#ebe5d2',
  sidebarActive: '#e3ddc8',
  sidebarAccent: '#d8e2c3',
  menu: '#fffdf4f5',
  menuHeader: '#f8f3e4f2',
  selector: '#f3eddd',
  settingsCard: '#fffdf5',
  settingsStroke: '#2c3a2926',
  tooltip: '#2c3a29',
  toast: '#2c3a29',
  toastInk: '#faf6e9',
  link: '#4f6b48',
  switchThumb: '#fffdf4',
  focus: '#5f7449',
  scrollbar: '#2c3a2933',
  scrollbarHover: '#2c3a294d',
  bubble: '#fffdf4',
  turnTrigger: '#f4efdf',
};

export const DARK: UiPalette = {
  bgBase: '#16241e',
  bgL1: '#1c2d25',
  bgL2: '#21342b',
  bgL3: '#273d32',
  bgL4: '#2e473a',
  bgOverlay: '#22362c',
  bgModule: '#1c2d25',
  labelPrimary: '#e8eddc',
  labelSecondary: '#b9c7ad',
  labelTertiary: '#9cae8f',
  labelCaption: '#92a485',
  labelDimmed: '#8a9c7e',
  borderL1: '#e8eddc12',
  borderL2: '#e8eddc1f',
  borderL3: '#e8eddc2b',
  borderL4: '#e8eddc3d',
  brand: '#c2d29a',
  brandInk: '#16241e',
  accent: '#b9cc94',
  accentInk: '#16241e',
  error: '#f09a8e',
  warn: '#e6bf72',
  success: '#9ed18a',
  idle: '#6b7a63',
  codeBlock: '#121d19',
  codeBanner: '#1a2a23',
  inlineCode: '#e8eddc1a',
  inputMajor: 'rgba(32, 51, 42, 0.96)',
  sidebar: '#12201a',
  sidebarHover: '#1d2d25',
  sidebarActive: '#263a30',
  sidebarAccent: '#2c4236',
  menu: '#1d3027f5',
  menuHeader: '#182820f2',
  selector: '#243a30',
  settingsCard: '#1f332a',
  settingsStroke: '#e8eddc26',
  tooltip: '#0f1a15',
  toast: '#0f1a15',
  toastInk: '#eef2e2',
  link: '#b9d0a2',
  switchThumb: '#16241e',
  focus: '#d3e0ad',
  scrollbar: '#e8eddc33',
  scrollbarHover: '#e8eddc4d',
  bubble: '#22362c',
  turnTrigger: '#1a2a23',
};

type Pair = { light: string; dark: string };

function pairs(map: Record<string, keyof UiPalette>): Record<string, Pair> {
  return Object.fromEntries(Object.entries(map).map(([token, key]) => [token, { light: LIGHT[key], dark: DARK[key] }]));
}

/**
 * 提交给宿主 theme.overrideTokens 的完整令牌层。
 * 名称均来自 DSH 0.2.1-rc.2 的 --dsw-* 设计令牌。
 */
export function uiTokens(): Record<string, Pair> {
  const tokens: Record<string, Pair> = {
    '--dsw-alias-bg-base': { light: LIGHT.bgBase, dark: DARK.bgBase },
    '--dsw-alias-bg-document-preview': { light: LIGHT.bgBase, dark: DARK.bgBase },
    '--dsw-alias-bg-document-selection': { light: '#6b7f4f2e', dark: '#b9cc9433' },
    '--dsw-alias-bg-layer-1': { light: LIGHT.bgL1, dark: DARK.bgL1 },
    '--dsw-alias-bg-layer-2': { light: LIGHT.bgL2, dark: DARK.bgL2 },
    '--dsw-alias-bg-layer-3': { light: LIGHT.bgL3, dark: DARK.bgL3 },
    '--dsw-alias-bg-layer-4': { light: LIGHT.bgL4, dark: DARK.bgL4 },
    '--dsw-alias-bg-mask-drop': { light: '#faf6e9b3', dark: '#16241eb3' },
    '--dsw-alias-bg-module-platform': { light: LIGHT.bgModule, dark: DARK.bgModule },
    '--dsw-alias-bg-multi-select': { light: LIGHT.bgL2, dark: DARK.bgL2 },
    '--dsw-alias-bg-overlay': { light: LIGHT.bgOverlay, dark: DARK.bgOverlay },
    '--dsw-alias-bg-skeleton': { light: '#2c3a2914', dark: '#e8eddc14' },
    '--dsw-alias-brand-primary': { light: LIGHT.brand, dark: DARK.brand },
    '--dsw-alias-brand-primary-invert': { light: LIGHT.brandInk, dark: DARK.brandInk },
    '--dsw-alias-brand-text': { light: LIGHT.labelPrimary, dark: DARK.labelPrimary },
    '--dsw-alias-button-contrast-fill': { light: LIGHT.labelPrimary, dark: DARK.labelPrimary },
    '--dsw-alias-button-elevated-fill': { light: LIGHT.bgL1, dark: DARK.bgL1 },
    '--dsw-alias-button-floating-fill': { light: LIGHT.bgL1, dark: DARK.bgL1 },
    '--dsw-alias-button-floating-hover': { light: LIGHT.bgL2, dark: DARK.bgL2 },
    '--dsw-alias-button-ghost-active-border': { light: LIGHT.accent, dark: DARK.accent },
    '--dsw-alias-button-ghost-active-fill': { light: LIGHT.bgL3, dark: DARK.bgL3 },
    '--dsw-alias-button-ghost-active-hover': { light: LIGHT.bgL4, dark: DARK.bgL4 },
    '--dsw-alias-button-info-fill': { light: LIGHT.accent, dark: DARK.accent },
    '--dsw-alias-button-info-hover': { light: '#6d8455', dark: '#cbd9a4' },
    '--dsw-alias-button-primary-dimmed': { light: LIGHT.bgL4, dark: DARK.bgL4 },
    '--dsw-alias-button-primary-fill': { light: LIGHT.brand, dark: DARK.brand },
    '--dsw-alias-button-primary-hover': { light: '#577148', dark: '#d0dea9' },
    '--dsw-alias-button-tool-bar-fill': { light: '#fffdf4cc', dark: '#1c2d25cc' },
    '--dsw-alias-button-tool-bar-fill-invisible': { light: '#fffdf466', dark: '#1c2d2566' },
    '--dsw-alias-button-tool-bar-hover': { light: LIGHT.bgL2, dark: DARK.bgL2 },
    '--dsw-alias-interactive-bg-active': { light: LIGHT.borderL3, dark: DARK.borderL3 },
    '--dsw-alias-interactive-bg-hover': { light: LIGHT.borderL2, dark: DARK.borderL2 },
    '--dsw-alias-interactive-bg-hover-accent': { light: '#6b7f4f24', dark: '#b9cc942e' },
    '--dsw-alias-interactive-bg-hover-danger': { light: '#9e3f3312', dark: '#f09a8e1f' },
    '--dsw-alias-interactive-bg-hover-solid': { light: LIGHT.bgL2, dark: DARK.bgL2 },
    '--dsw-alias-label-caption': { light: LIGHT.labelCaption, dark: DARK.labelCaption },
    '--dsw-alias-label-deep-diving': { light: '#4d6b46', dark: '#9fc0a0' },
    '--dsw-alias-label-deep-diving-shimmer': { light: '#7d9455', dark: '#cfe0b4' },
    '--dsw-alias-label-dimmed': { light: LIGHT.labelDimmed, dark: DARK.labelDimmed },
    '--dsw-alias-label-primary': { light: LIGHT.labelPrimary, dark: DARK.labelPrimary },
    '--dsw-alias-label-primary-bluish': { light: '#33452f', dark: '#e2ead6' },
    '--dsw-alias-label-primary-dimmed': { light: '#3a4a35', dark: '#d6dfc8' },
    '--dsw-alias-label-primary-foreground': { light: '#faf6e9', dark: '#16241e' },
    '--dsw-alias-label-primary-inverted': { light: '#faf6e9', dark: '#16241e' },
    '--dsw-alias-label-secondary': { light: LIGHT.labelSecondary, dark: DARK.labelSecondary },
    '--dsw-alias-label-shimmer': { light: '#2c3a2933', dark: '#e8eddc59' },
    '--dsw-alias-label-tertiary': { light: LIGHT.labelTertiary, dark: DARK.labelTertiary },
    '--dsw-alias-link': { light: LIGHT.link, dark: DARK.link },
    '--dsw-alias-markdown-citation': { light: LIGHT.bgL2, dark: DARK.bgL3 },
    '--dsw-alias-markdown-code-block': { light: LIGHT.codeBlock, dark: DARK.codeBlock },
    '--dsw-alias-markdown-code-block-banner': { light: LIGHT.codeBanner, dark: DARK.codeBanner },
    '--dsw-alias-markdown-code-segment-selected': { light: LIGHT.bgL1, dark: DARK.bgL4 },
    '--dsw-alias-markdown-code-segment-unselected': { light: LIGHT.bgL2, dark: DARK.bgL3 },
    '--dsw-alias-markdown-inline-code': { light: LIGHT.inlineCode, dark: DARK.inlineCode },
    '--dsw-alias-markdown-placeholder': { light: LIGHT.bgL2, dark: DARK.bgL3 },
    '--dsw-alias-markdown-tag': { light: LIGHT.bgL2, dark: DARK.bgL3 },
    '--dsw-alias-menu-group-header-fill': { light: LIGHT.menuHeader, dark: DARK.menuHeader },
    '--dsw-alias-menu-icon': { light: '#3a4a35', dark: '#d6dfc8' },
    '--dsw-alias-scrollbar-bg-l1': { light: LIGHT.scrollbar, dark: DARK.scrollbar },
    '--dsw-alias-scrollbar-bg-l2': { light: LIGHT.scrollbar, dark: DARK.scrollbar },
    '--dsw-alias-scrollbar-hover-l1': { light: LIGHT.scrollbarHover, dark: DARK.scrollbarHover },
    '--dsw-alias-scrollbar-hover-l2': { light: LIGHT.scrollbarHover, dark: DARK.scrollbarHover },
    '--dsw-alias-separator-primary': { light: '#6b775f66', dark: '#9cae8f73' },
    '--dsw-alias-settings-card-fill': { light: LIGHT.settingsCard, dark: DARK.settingsCard },
    '--dsw-alias-settings-card-stroke': { light: LIGHT.settingsStroke, dark: DARK.settingsStroke },
    '--dsw-alias-state-business-primary': { light: LIGHT.accent, dark: DARK.accent },
    '--dsw-alias-state-business-tertiary': { light: '#dbe4c8', dark: '#2a4034' },
    '--dsw-alias-state-error-primary': { light: LIGHT.error, dark: DARK.error },
    '--dsw-alias-state-error-secondary': { light: '#b86154', dark: '#f0b0a6' },
    '--dsw-alias-state-idle-primary': { light: LIGHT.idle, dark: DARK.idle },
    '--dsw-alias-state-success-primary': { light: LIGHT.success, dark: DARK.success },
    '--dsw-alias-state-success-secondary': { light: '#74a068', dark: '#b7dda6' },
    '--dsw-alias-state-warn-label': { light: LIGHT.warn, dark: DARK.warn },
    '--dsw-alias-state-warn-primary': { light: '#b8862a', dark: '#e6bf72' },
    '--dsw-alias-state-warn-secondary': { light: '#d0a14c', dark: '#efd39a' },
    /*
     * 文件/代码 diff 的底色不在 Theme Inspect 的注册表里，但 Web 视图实际使用。
     * 宿主只在 data-ds-dark-theme 下切深色；这里显式提供两套值，避免夜景出现浅绿/浅粉行。
     */
    '--dsw-alias-code-diff-added': { light: 'rgba(34, 197, 94, .08)', dark: 'rgba(34, 197, 94, .12)' },
    '--dsw-alias-code-diff-deleted': { light: 'rgba(236, 19, 19, .08)', dark: 'rgba(242, 90, 90, .12)' },
    '--dsw-alias-file-diff-added-bg': { light: '#e6f4e7', dark: '#1f3124' },
    '--dsw-alias-file-diff-added-gutter': { light: '#edf7ed', dark: '#132016' },
    '--dsw-alias-file-diff-added-marker': { light: '#01a241', dark: '#41c977' },
    '--dsw-alias-file-diff-deleted-bg': { light: '#fce6e2', dark: '#3c1f1b' },
    '--dsw-alias-file-diff-deleted-gutter': { light: '#fdece9', dark: '#28130e' },
    '--dsw-alias-file-diff-deleted-marker': { light: '#ba2723', dark: '#fa423e' },
    '--dsw-alias-switch-thumb': { light: LIGHT.switchThumb, dark: DARK.switchThumb },
    '--dsw-alias-toast-bg': { light: LIGHT.toast, dark: DARK.toast },
    '--dsw-alias-toast-label': { light: LIGHT.toastInk, dark: DARK.toastInk },
    '--dsw-alias-tooltip-bg': { light: LIGHT.tooltip, dark: DARK.tooltip },
    '--dsw-alias-tooltip-key-bg': { light: '#4a5a43', dark: '#2b4035' },
    '--dsw-alias-turn-trigger-bg': { light: LIGHT.turnTrigger, dark: DARK.turnTrigger },
    '--dsw-alias-turn-trigger-bg-hover': { light: LIGHT.bgL2, dark: DARK.bgL2 },
    '--dsw-focus-ring-color': { light: LIGHT.focus, dark: DARK.focus },
    '--dsw-menu-surface-fill': { light: LIGHT.menu, dark: DARK.menu },
    '--dsw-specific-bubble': { light: LIGHT.bubble, dark: DARK.bubble },
    '--dsw-specific-input-major': { light: LIGHT.inputMajor, dark: DARK.inputMajor },
    '--dsw-specific-menu': { light: LIGHT.menu, dark: DARK.menu },
    '--dsw-specific-selector': { light: LIGHT.selector, dark: DARK.selector },
    '--dsw-specific-sidebar-fill': { light: LIGHT.sidebar, dark: DARK.sidebar },
    '--dsw-specific-sidebar-nav-item-active': { light: LIGHT.sidebarActive, dark: DARK.sidebarActive },
    '--dsw-specific-sidebar-nav-item-active-accent': { light: LIGHT.sidebarAccent, dark: DARK.sidebarAccent },
    '--dsw-specific-sidebar-nav-item-hover': { light: LIGHT.sidebarHover, dark: DARK.sidebarHover },
    '--dsw-specific-tip': { light: LIGHT.selector, dark: DARK.selector },
    /*
     * 宿主把 present 交付卡、文件变更卡、计划卡等写死在这两个“静态中性色”上。
     * 若不覆盖，夜景里会出现纯白卡片配浅色文字。这里换成主题纸面/夜色。
     */
    '--dsw-static-neutral-50': { light: LIGHT.bgL1, dark: DARK.bgL1 },
    '--dsw-static-neutral-100': { light: LIGHT.bgL2, dark: DARK.bgL2 },
  };
  return tokens;
}

/** 夜间把整套界面令牌切到深色，避免宿主浅色外观与夜景混搭。 */
export function darkTokenValues(): Record<string, string> {
  return Object.fromEntries(Object.entries(uiTokens()).map(([name, pair]) => [name, pair.dark]));
}

/** 只读渲染设置页时用来标注当前外观。 */
export function schemeLabel(scheme: 'light' | 'dark'): 'appearance.light' | 'appearance.dark' {
  return scheme === 'dark' ? 'appearance.dark' : 'appearance.light';
}

/** 供测试与运行时检查使用的背景组。 */
export const CONTRAST_BACKGROUNDS: readonly (keyof UiPalette)[] = ['bgBase', 'bgL1', 'bgL2', 'sidebar', 'settingsCard'];
