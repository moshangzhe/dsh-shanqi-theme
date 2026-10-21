/**
 * 主题设置页：注册在宿主 settings.section 插槽中。
 * 控件沿用宿主设置页的排版语言，只使用宿主令牌着色；不重建任何聊天或设置业务。
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { AppearanceController } from './controller';
import { DISPLAY_NAME, formatHour, presetHour } from './config';
import type { LocaleService } from './contracts';
import { NS, type MessageKey, type Translate } from './locale';
import { computeScene, createSceneView, type SceneView } from './scene';

interface SettingsProps {
  controller: AppearanceController;
  locale: LocaleService;
}

function Segmented<T extends string | boolean>({ value, options, disabled, onChange }: {
  value: T;
  options: readonly (readonly [T, string])[];
  disabled: boolean;
  onChange(value: T): void;
}): ReactNode {
  return (
    <div className="shq-segments" role="group">
      {options.map(([option, label]) => (
        <button
          key={String(option)}
          type="button"
          className="shq-segment"
          aria-pressed={value === option}
          disabled={disabled}
          onClick={() => {
            if (value !== option) onChange(option);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, disabled, label, onChange }: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange(value: boolean): void;
}): ReactNode {
  return (
    <button
      type="button"
      className="shq-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="shq-switch-track" aria-hidden="true"><i /></span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  const id = useId();
  return (
    <section className="shq-group" aria-labelledby={id}>
      <h3 id={id} className="shq-group-title">{title}</h3>
      {children}
    </section>
  );
}

/**
 * 设置页顶部的真实场景缩略图。
 * 直接复用聊天背景的同一套 draw 层与昼夜计算，只关掉农人和环境动画，
 * 这样预览与背景的构图、配色、月色和窗灯完全一致。
 */
function MiniScene({ hour }: { hour: number }): ReactNode {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<SceneView | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const view = createSceneView(canvas, { reducedMotion: true, ambient: false });
    viewRef.current = view;
    view.setFarmerEnabled(false);
    view.setFarmerWorking(false);
    view.pause();
    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      view.setViewBox(Math.max(1, rect.width), Math.max(1, rect.height));
    };
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    return () => {
      observer?.disconnect();
      viewRef.current = null;
      view.dispose();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    const canvas = canvasRef.current;
    if (!view || !canvas) return;
    view.apply(computeScene(hour));
    const rect = canvas.getBoundingClientRect();
    view.setViewBox(Math.max(1, rect.width), Math.max(1, rect.height));
  }, [hour]);

  return (
    <div className="shq-mini-scene" aria-hidden="true">
      <div className="shq-mini-canvas" ref={canvasRef} />
      <span className="shq-mini-caption">{DISPLAY_NAME}</span>
    </div>
  );
}

export function SettingsPanel({ controller, locale }: SettingsProps): ReactNode {
  const state = useSyncExternalStore(
    listener => controller.subscribe(listener),
    () => controller.getSnapshot(),
  );
  useSyncExternalStore(
    listener => locale.subscribe(listener),
    () => locale.getSnapshot(),
  );
  const [rangeDraft, setRangeDraft] = useState<number | null>(null);
  const t = locale.bind(NS) as unknown as Translate;
  const { prefs, form } = state;
  const disabled = state.resetting || (form.writable !== true) || state.saving > 0;
  const active = prefs.enabled;
  const preview = prefs.timeMode === 'preview';
  const previewValue = rangeDraft ?? prefs.previewHour;
  const commitRange = (): void => {
    const value = rangeDraft;
    setRangeDraft(null);
    if (value !== null && Math.abs(value - prefs.previewHour) > 0.001) void controller.preview(value);
  };

  let badge: string;
  if (form.status === 'loading') badge = t('state.loading');
  else if (active) badge = t('state.active');
  else badge = t('state.paused');

  let status = '';
  let error = state.error;
  if (form.status === 'loading') {
    status = t('status.loading');
  } else if (form.writable !== true) {
    status = t('status.readonly');
  } else if (state.message) {
    status = t(state.message as MessageKey);
  } else if (active) {
    status = t('status.saved');
  }
  if (form.writable !== true) error = false;

  const farmerState = !prefs.farmer ? t('farmer.off') : state.working ? t('farmer.working') : t('farmer.idle');
  const clock = `${formatHour(state.hour)} · ${t(`period.${state.period}` as MessageKey)}`;

  return (
    <section className="shq-settings" aria-label={t('settings.aria')} data-active={active} aria-busy={state.saving > 0}>
      <header className="shq-settings-head">
        <div className="shq-settings-title">
          <h2>{t('settings.title')}</h2>
          <p>{t('settings.subtitle')}</p>
        </div>
        <span className="shq-badge" data-active={active}>
          <i aria-hidden="true" />
          {badge}
        </span>
      </header>

      <MiniScene hour={preview ? previewValue : state.hour} />

      <Section title={t('section.time')}>
        <div className="shq-row">
          <div className="shq-row-copy">
            <span className="shq-row-label">{t('row.timeMode')}</span>
            <small>{t('hint.timeMode')}</small>
          </div>
          <Segmented<string>
            value={prefs.timeMode}
            options={[['system', t('mode.system')], ['preview', t('mode.preview')]]}
            disabled={disabled}
            onChange={value => void controller.write('timeMode', value === 'preview' ? 'preview' : 'system')}
          />
        </div>

        <div className="shq-row shq-row-slider">
          <label className="shq-row-copy" htmlFor="shq-preview-hour">
            <span className="shq-row-label">{t('row.previewHour')}</span>
            <small>{t('hint.previewHour')}</small>
          </label>
          <div className="shq-range-wrap">
            <input
              id="shq-preview-hour"
              className="shq-range"
              type="range"
              min={0}
              max={24}
              step={0.1}
              value={previewValue}
              disabled={disabled || !preview}
              aria-label={t('row.previewHour')}
              onChange={event => {
                const next = Number(event.currentTarget.value);
                if (Number.isFinite(next)) setRangeDraft(next);
              }}
              onPointerUp={commitRange}
              onKeyUp={commitRange}
              onBlur={commitRange}
            />
            <output className="shq-range-value" htmlFor="shq-preview-hour">{formatHour(previewValue)}</output>
          </div>
        </div>

        <div className="shq-presets" role="group" aria-label={t('row.previewHour')}>
          {(['dawn', 'day', 'dusk', 'night'] as const).map(preset => (
            <button
              key={preset}
              type="button"
              className="shq-preset"
              disabled={disabled}
              aria-pressed={preview && Math.abs(prefs.previewHour - presetHour(preset)) < 0.13}
              onClick={() => void controller.preview(presetHour(preset))}
            >
              {t(`preset.${preset}` as MessageKey)}
            </button>
          ))}
        </div>

        <p className="shq-live" data-preview={preview}>
          <span>{preview ? t('note.preview') : t('note.system')}</span>
          <b>{clock}</b>
        </p>
      </Section>

      <Section title={t('section.motion')}>
        <div className="shq-row">
          <div className="shq-row-copy">
            <span className="shq-row-label">{t('row.farmer')}</span>
            <small>{t('hint.farmer')}</small>
          </div>
          <Switch
            checked={prefs.farmer}
            disabled={disabled}
            label={t('row.farmer')}
            onChange={value => void controller.write('farmer', value)}
          />
        </div>
        <div className="shq-row">
          <div className="shq-row-copy">
            <span className="shq-row-label">{t('row.ambient')}</span>
            <small>{t('hint.ambient')}</small>
          </div>
          <Switch
            checked={prefs.ambient}
            disabled={disabled}
            label={t('row.ambient')}
            onChange={value => void controller.write('ambient', value)}
          />
        </div>
        <p className="shq-farmer-state" data-working={prefs.farmer && state.working}>
          <i aria-hidden="true" />
          {farmerState}
        </p>
      </Section>

      <Section title={t('section.host')}>
        <div className="shq-row shq-row-readonly">
          <div className="shq-row-copy">
            <span className="shq-row-label">{t('row.appearance')}</span>
            <small>{t('hint.appearance')}</small>
          </div>
          <span className="shq-readonly-value">{t(`appearance.${state.scheme}` as MessageKey)}</span>
        </div>
        <div className="shq-row shq-row-readonly">
          <div className="shq-row-copy">
            <span className="shq-row-label">{t('row.fontSize')}</span>
            <small>{t('hint.fontSize')}</small>
          </div>
          <span className="shq-readonly-value">{state.fontSize}px</span>
        </div>
      </Section>

      <div className="shq-actions">
        <button type="button" className="shq-button" disabled={disabled} onClick={() => void controller.reset()}>
          {t('action.reset')}
        </button>
        {active ? (
          <button type="button" className="shq-button shq-button-primary" disabled={disabled} onClick={() => void controller.disable()}>
            {t('action.disable')}
          </button>
        ) : (
          <button type="button" className="shq-button shq-button-primary" disabled={disabled} onClick={() => void controller.enable()}>
            {t('action.enable')}
          </button>
        )}
      </div>

      <div className="shq-status" role={error ? 'alert' : 'status'} data-error={error}>
        {status || t('status.saved')}
      </div>
    </section>
  );
}
