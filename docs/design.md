# 设计说明

## 分层

| 文件 | 职责 | 不做什么 |
|---|---|---|
| `src/index.ts` | 声明 `Config` Schema，调用 `settings.configure({ auto: false })` 登记可配置实例 | 不挂 UI、不读客户端状态 |
| `src/client.tsx` | 注入 `theme/slots/configForms/locale/sessions`，注册样式、locale、设置页、任务桥、连接状态 | 不重建聊天/设置业务 |
| `src/config.ts` | 包名、入口 ID、偏好类型、默认值、校正、小时与时段 | 不访问 DOM |
| `src/contracts.ts` | 只声明实际用到的 DSH 0.2.1-rc.2 公开接口 | 不复制宿主类型源码 |
| `src/controller.ts` | 表单快照、乐观草稿、异步保存、冲突重试、失败回退、恢复默认、销毁 | 不直接操作场景 |
| `src/runtime.ts` | 定位真实 conversation、令牌覆盖、场景时间、可见性/焦点、生命周期 | 不扫描界面文案、不判断回答阶段 |
| `src/scene.ts` | 构图、缓存图层、昼夜插值、窗灯遮罩、农人状态机与路径 | 不访问网络、不定时器 |
| `src/palette.ts` | 浅/深两套 `--dsw-*` 令牌 | 不改注册表、不写用户偏好 |
| `src/settings.tsx` | `settings.section` 页面、控件状态 | 不另建字号系统 |
| `src/working.ts` | `SessionSnapshot.running` → 任务工作布尔值、会话栈、恢复重算 | 不读思考正文、不猜回答阶段 |

## 配置与保存

- 宿主 Config 是唯一持久化来源。客户端通过 `configForms.get('ui-shanqi-theme')` 读取已接受值和 revision。
- 单字段用 `form.set`；预设时刻用一次 `form.mutate` 原子写 `previewHour + timeMode`。
- 写入前记录 revision；若宿主拒绝且 revision 已前进，重试一次。
- 每次写入带 generation，旧结果不会覆盖新结果；并发保存用计数显示“正在保存…”。
- 失败时移除乐观草稿，回到宿主已接受值，并显示“保存失败，已回到上次保存的设置。”
- `previewHour` 的 Schema 步长为 0.1（此前 0.25 会拒绝 17.7，已由真实宿主验证）。

## 时间模型

```text
hour   = localHour(Date)          // 不累计
night  = 0                        // 05:00–08:00 与 17:00–21:00 平滑过渡
gold   = 晨/昏两个高斯峰
颜色    = mix(day→dusk, gold) → mix(→night, night)
```

- 场景颜色是 `hour` 的连续函数；`periodOf()` 只用于文案和 `data-shq-period`。
- 页面不可见时停止 1 秒时钟；恢复可见/窗口聚焦立即 `applyScene(true)`。
- 手动预览只把 `previewHour` 作为输入，不写系统时间；切回 `system` 立即恢复真实时刻。
- 时区/DST 由 `Date` 的本地 getter 处理，不缓存时区偏移。

## 任务工作状态映射

数据源：`SessionBinding.session` 的 `SessionSnapshot`。

| 快照 | 动作 |
|---|---|
| `running === true` | 任务在工作：农人留在田间 |
| `running === false` | 整轮任务结束：收锄离场 |
| `removed === true` / `openState === 'error'` / `lastAgentError` | 视为任务结束 |
| 断连 | 立即收起；重连后按当前 `running` 重算 |

- 不订阅 `eventSource`，不做步骤/正文/工具阶段判定；`running` 覆盖模型思考、工具调用与回答流式输出。
- 初始挂载、恢复可见、重连、切回会话都调用 `resync()` 读取当前快照，不补播旧过程。
- 会话栈：后挂载的会话为当前；卸载只移除自己的 token，不会误删后来者。
- 同一快照的重复通知只产生一次 true/false 转换（`WorkingHub` 去重）。

## 农人状态机

```text
off → entering → preparing → working → packing → leaving → off
```

- `setThinking(true)`：`off/leaving` → `entering`；`packing` → 按进度回 `entering` 或 `preparing`。
- `setThinking(false)`：`entering` → 直接 `leaving`（锄已在肩）；`preparing/working` → `packing`（收锄 0.9 s）→ `leaving`。
- 只在 `phase !== off` 时运行 `requestAnimationFrame`，两次渲染至少间隔 30 ms；不可见时取消帧。
- 路径为三次贝塞尔采样 200 点，按弧长推进；进场起点跟随当前 viewBox 右边界，田间落脚点随窄屏内移。
- 行进时长按路径长度限制在 2.4–7.5 s（进场）与 2.4–6.5 s（离场）。
- 绘制顺序：腿 → 远侧手臂 → 锄 → 远侧握点 → 躯干/头部 → 近侧手臂 → 近侧握点 → 土屑。身体遮住远侧右手与部分锄柄。
- 耕作双手固定在刚性锄柄的不同位置；肩膀、肘、腕随握点解算。

## 宿主布局适配

- 只使用公开标记：`[data-slot="main.conversation"] [data-phase]`、`[data-shell-overlay]`、`[data-slot="main"]`、`[data-composer-card]`、`[data-code-block-content]` 等。
- stage 为 `position: fixed`、`pointer-events: none`、`z-index: 0`；`#root` 提升到 `z-index: 1`。
- 将 conversation、frame、center column 标记为透明，让场景从真实布局后方透出；设置/弹窗保持宿主底色。
- `ResizeObserver` 观察 conversation；`MutationObserver` 只观察 `[data-slot="main"]` 的直接子节点；另有 1 秒低频 ensure 作为兜底。
- 不使用 CSS Module 哈希做布局。

## 令牌与外观

- `theme.overrideTokens('dsh-shanqi-theme', tokens)` 只调用一次，同时提供 light/dark 两套值；宿主切换外观时无需重新叠加。
- 不调用 `theme.setTheme()`，不写 `preference`，不强制深色。
- `theme/change` 监听器经 `queueMicrotask` 合并，只刷新布局/状态，不重新覆盖令牌，避免递归。
- 对话内文字/气泡/阅读面使用 `--shq-*` 变量（由场景时间计算）。
- **场景入夜时**把 `darkTokenValues()` 以 body 内联变量覆盖到整页界面（侧栏、设置弹窗、菜单、输入卡、开关、滑杆、代码阅读面等），白昼或卸载时恢复原值；不修改宿主外观偏好，也不调用 `theme.setTheme`。这样宿主为浅色外观时，夜景不会出现亮白设置页或亮色菜单。
- 关闭时恢复这些内联变量；如果宿主本身就是深色，白昼移除覆盖后仍按宿主深色配色。
- 宿主的 present 交付卡、文件变更卡、计划卡把底色写死为 `--dsw-static-neutral-50/100`（近白）。主题把这两个静态中性色一并映射到纸面/夜色令牌，否则夜景会出现“纯白卡片 + 浅色文字”。
- 文件/代码 diff 的 `--dsw-alias-code-diff-*` 与 `--dsw-alias-file-diff-*` 不在 Theme Inspect 注册表里，但 Web 视图实际使用；主题显式提供浅/深两套值，夜间行底为深绿/深红，避免浅粉浅绿行配浅色字。
- 弹窗、菜单与输入卡的阴影固定使用中性黑（`rgba(0,0,0,…)`），不使用 `--dsw-alias-label-primary` 等前景色透明度；否则夜间前景变亮后，阴影会在弹窗外变成一圈光晕。遮罩与面板同时禁用 `backdrop-filter`、`filter` 与 `background-image`，只保留一层平暗遮罩。
- 设置页顶部缩略图不再使用简化 SVG，而是复用 `createSceneView(container, { reducedMotion: true, ambient: false })` + `computeScene(hour)`：与聊天背景共用同一份 4 张缓存图层和昼夜令牌，只关闭农人、萤火、炊烟与 rAF；拖动预览时刻时按当前小时重算。
- 对话内仍有作用域变量优先，保证透明回答、气泡和阅读卡片始终按场景墨色计算。

## 生命周期与释放

开启：覆盖令牌 → 创建 stage/scene → 定位 → 启动时钟。

关闭/卸载：

1. 停时钟、取消 rAF；
2. 断开 `ResizeObserver`/`MutationObserver`；
3. 移除 conversation/frame/column 标记与 stage；
4. `scene.dispose()`（农人、SVG、容器样式）；
5. 释放令牌层，恢复宿主令牌；
6. 移除 body 的 `data-shq-*` 与 `--shq-*`；
7. 客户端 effect 清理 locale、theme/change、连接订阅、任务 Hub、控制器与 `<style>`。

## 性能不变量

- 静态缓存图层 + 动态人物/炊烟分离。
- 主题变量与 DOM 属性只在值变化时写入。
- 人物关闭时不安排帧；时间静止且人物关闭时没有常驻 rAF。
- 流式消息更新不重建背景、不重新解码图片、不重复初始化动画。
- 不使用全屏噪声滤镜或大面积 `backdrop-filter`。
