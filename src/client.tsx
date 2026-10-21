/**
 * 客户端入口：注册样式、主题设置、场景运行时与任务联动。
 * 所有资源都在 apply 的生命周期内登记，卸载时完整释放。
 */
import { useEffect, type ReactElement } from 'react';
import type { ClientContext, WorkingBridgeProps } from './contracts';
import { ENTRY_ID, DISPLAY_NAME, PACKAGE_ID } from './config';
import { createController } from './controller';
import { createVisualRuntime } from './runtime';
import { en, NS, zh } from './locale';
import { SettingsPanel } from './settings';
import { WorkingHub } from './working';
import styles from './styles.css';

export const inject = ['theme', 'slots', 'configForms', 'locale', 'sessions'];

function WorkingBridge({ hub, sessionId }: { hub: WorkingHub; sessionId?: string }): ReactElement {
  useEffect(() => {
    if (!sessionId) return undefined;
    const token = hub.attach(sessionId);
    return () => hub.detach(token);
  }, [hub, sessionId]);
  return <span className="shq-bridge" data-shq-working-bridge="" aria-hidden="true" />;
}

export function apply(ctx: ClientContext): void {
  const controller = createController(ctx.configForms.get(ENTRY_ID), ctx.theme);
  const runtime = createVisualRuntime(ctx.theme);
  const hub = new WorkingHub(ctx.sessions);

  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.shqStyle = '';
    style.setAttribute('data-plugin', PACKAGE_ID);
    style.textContent = styles;
    document.head.appendChild(style);

    const offZh = ctx.locale.register(NS, 'zh', { ...zh });
    const offEn = ctx.locale.register(NS, 'en', { ...en });
    const offTheme = ctx.on('theme/change', () => controller.themeChanged());
    const offWorking = hub.subscribe(working => runtime.setWorking(working));
    controller.attach(runtime);

    return () => {
      offWorking();
      offTheme();
      offEn();
      offZh();
      controller.dispose();
      runtime.dispose();
      hub.dispose();
      style.remove();
    };
  }, '山栖：主题生命周期');

  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      { name: 'settings.section', id: 'shanqi-theme', order: 40, label: () => DISPLAY_NAME, locale: NS },
      () => <SettingsPanel controller={controller} locale={ctx.locale} />,
    ),
  );

  ctx.slots.inject('conversation.composer.dock', () =>
    ctx.slots.register(
      { name: 'conversation.composer.dock', id: 'shanqi-working', order: -100, locale: NS },
      (props: WorkingBridgeProps) => <WorkingBridge hub={hub} sessionId={props.sessionId} />,
    ),
  );

  // 连接中断时先收起农人；重连后按当前 Session 的 running 状态重新同步。
  ctx.inject?.(['connection'], child => {
    child.effect(() => {
      const source = child.connection?.state;
      if (!source) return () => undefined;
      const sync = (): void => {
        const state = source.getSnapshot();
        const online = state === 'connected' || state === undefined;
        runtime.setConnected(online);
        if (online) hub.resync();
      };
      const off = source.subscribe(sync);
      sync();
      return off;
    }, '山栖：连接状态');
  });
}
