/**
 * 宿主半侧：声明插件配置 Schema，并把本实例登记为可配置条目。
 * 客户端通过 configForms.get('ui-shanqi-theme') 读取同一份已接受的值。
 */
import z from '@deepseek-ai/schemastery';
import type { HostContext } from './contracts';

export const Config = z
  .object({
    enabled: z.boolean().default(true).description('启用山栖主题').volatile(),
    timeMode: z.union(['system', 'preview']).default('system').description('场景时间来源').volatile(),
    previewHour: z.number().min(0).max(24).step(0.1).default(17.5).description('手动预览时刻（0–24 小时）').volatile(),
    farmer: z.boolean().default(true).description('农人任务联动').volatile(),
    ambient: z.boolean().default(true).description('炊烟、星光与萤火等环境微动').volatile(),
  })
  .description('山栖田园主题');

export function apply(ctx: HostContext): void {
  ctx.inject(['settings'], child => {
    child.effect(() => {
      // auto:false：设置页由本插件的 settings.section 提供，不生成默认表单。
      const dispose = child.settings?.configure({ auto: false }, ctx.fiber);
      return typeof dispose === 'function' ? dispose : undefined;
    });
  });
}
