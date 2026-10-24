# 验证记录

记录时间：2026-10-20（Asia/Shanghai）。目标宿主：DeepSeek Harness **0.2.1-rc.2**，Windows x64。

## 环境与方法

- 源代码与构建：本仓库 `dsh-shanqi-theme` 0.1.9。
- 外部收录：Awesome DSH Plugin 的收录 PR [#8456](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/8456) 已于 2026-10-23 由维护者合并，条目位于 `Themes & Appearance`，中英文 README 均已生成。
- Web 验收：使用独立的临时 `DSH_HOME`（`_audit_home` / `_card_home` / `_diff_home` / `_preview_home` / `_work_home`）创建 `web` profile，安装本插件，通过 `dsh web --no-open --port 53170/53171/53172/53190/53200` 启动；用 Edge 155 headless + CDP 打开页面，读取真实 DOM、计算样式与截图。任务联动复测使用本机 mock provider `127.0.0.1:19091`（`openai-completions`）。没有使用演示 HTML，也没有在插件内伪造聊天或设置。
- 缩略图验收：设置页 `.shq-mini-scene` 内为真实场景，回读 333 个节点、4 张缓存图层，`--shq-sky-top/#10253e` 与聊天背景一致；`data-shq-ambient=off`、`data-shq-reduced=on`、`data-shq-paused=on`，不运行农人与环境动画。
- 夜间配色专项：`ui-theme.preference=light` + 主题手动预览 `22:00`，逐项审计侧栏、欢迎页、设置弹窗、菜单、输入卡、开关、滑杆、发送按钮、present 交付卡、文件变更卡、文件/代码 diff 与代码阅读面；低对比文字 0 项，浅色自带背景仅剩品牌色主按钮/开关/滑杆等有意强调控件。present 交付卡与文件变更卡使用宿主 `--dsw-static-neutral-50/100` 写死纸面，已改为主题纸面（昼 `#fffdf4` / 夜 `#1c2d25`）；夜间实测卡底 `rgb(28,45,37)`、文字 `rgb(255,249,234)`。
- diff 配色：宿主用未注册的 `--dsw-alias-code-diff-added/deleted` 与 `--dsw-alias-file-diff-*` 控制行底色。主题补齐两套值：夜间代码行 `rgba(34,197,94,.12)` / `rgba(242,90,90,.12)`，文件行 `#1f3124` / `#3c1f1b`，行文字继承 `#9ed18a` / `#f09a8e`；实测浅色行底不再出现。
- 任务联动验收：临时 profile 中加入本机 OpenAI-compatible mock provider（`127.0.0.1:19090`，仅测试用，不随包发布），让 DSH 走真实的 Agent/Session 事件、工具与聊天渲染；插件侧只读取公开的 `SessionSnapshot.running`。真实 DeepSeek 请求在该临时 profile 中因凭据不可用返回 `AUTH`，因此模型内容来自 mock，但消息/任务生命周期与 DSH 的真实链路一致。
- Desktop 验收：通过 `plugin_manager` 把本插件安装进用户的 `desktop` profile，确认 Host Config、`settings.section`、`conversation.composer.dock` 的插件条目活动。由于测试时会话处于 Windows 锁屏，无法截取 Desktop 目视画面；不宣称 Desktop 视觉验收通过。
- 窄屏：CDP 设备指标 390×844。长对话与代码块使用真实会话/真实 DOM 检查。

## 构建与自动化

| 项目 | 结果 | 证据 |
|---|---|---|
| `tsc --noEmit` | 通过 | 无类型错误 |
| `node --test tests/*.test.mjs` | 通过 | 39 项测试全部通过 |
| `node scripts/build.mjs` | 通过 | `lib/index.js`、`lib/client.js`、`docs/preview.html` |
| `pnpm pack` | 通过 | `dsh-shanqi-theme-0.1.9.tgz`；在全新 Web profile 中安装该 tgz 后 stage、主题样式与“山栖”设置页均加载 |
| 客户端模块语法 | 通过 | `node --check lib/client.js` |
| 宿主模块语法 | 通过 | `node --check lib/index.js` |

### 单元测试覆盖

- 配置校正、小时格式、时段边界。
- 浅色/深色正文、次要文字、强调色与实色底板对比度 ≥ 4.8:1。
- 夜间强度连续、昼夜配色、聊天墨色在整天的湖天混合背景上 ≥ 4.4:1、气泡与阅读面昼夜极性。
- 窄屏 viewBox、动态进场起点、农人路线端点。
- 农人：入场、耕作、收锄、离场、短任务转身、离场中反向、重复事件不重置、总开关。
- 任务联动：`running=true` 进入、`running=false` 结束、报错/移除/错误状态视为结束、错过通知后 resync、释放后不再发布、会话栈切换、绑定延迟建立；并在真实 mock 会话里复测整轮流式回答期间持续在场与“停止生成”立即收场。
- 控制器：成功、失败回退、并发保存计数、原子预览、恢复默认、attach/dispose。
- 运行时：挂载、令牌只覆盖一次、布局适配、系统/预览时间、隐藏暂停、连接断开与恢复、完整释放。
- diff：夜间代码/文件 diff 行底与状态文字对比度 ≥ 4.8:1，浅色行文字 ≥ 4.5:1，八个 diff 令牌均提供浅/深值。
- 弹窗光晕：浮动层阴影只使用中性黑；遮罩/面板禁用 `backdrop-filter`、`filter` 与 `background-image`。夜间实测设置弹窗 `box-shadow: rgba(0,0,0,.38) 0 18px 50px`，遮罩 `rgba(0,0,0,.24)`，无磨砂与渐变。
- 设置缩略图：复用 `createSceneView` 与 `computeScene`，与聊天背景同图层、同昼夜令牌；关闭农人与环境动画，没有常驻 rAF。
- 市场截图：仓库根 `screenshots.json` 声明 8 张 1440×900 截图（晨/昼/暮/夜、聊天、夜间设置、任务运行中的农人），均为仓库内相对路径；dsh-market 下一次 nightly 构建读取。

## 真实 Web 界面验收

| 场景 | 结果 | 说明 |
|---|---|---|
| 欢迎主页（晨/昼/暮/夜） | 通过 | 场景、标题、输入卡、快捷入口、侧栏 |
| 真实聊天 | 通过 | 用户气泡靠右；助手回答透明；无聊天底板、无雾化/模糊 |
| 代码块 | 通过 | 昼夜独立底色与文字色；`pre` 不再叠加实色 |
| 工具调用/处理行 | 通过（真实会话观察） | 工具卡片保留独立阅读面，正文仍透明 |
| 侧栏/工作区/会话列表 | 通过 | 夜间随场景沉色，选中态与悬停可见 |
| 菜单 | 通过 | 独立底色，`backdrop-filter` 已关闭 |
| 设置页（浅/深） | 通过 | 真实 settings.section，卡片、分段选择、滑杆、开关、保存状态 |
| 昼夜切换 | 通过 | 跟随系统与手动预览；退出预览回到真实时间 |
| 启停 | 通过 | 暂停后 stage 0、body 主题属性移除；重新启用后只有一个 stage、令牌层只重建一次 |
| 窄屏 390×844 | 通过 | 无横向溢出；侧栏收起；场景取景内移；农人落脚点随取景调整 |
| 连接中断 | 通过 | 任务运行中杀掉 web 进程，农人立即 off，`data-shq-working` 变为 off，主题与 stage 保留 |
| 控制台错误 | 未发现插件错误 | 断开连接测试中仅出现宿主 `[connection] connection lost` 警告 |

### 关键实测值

- Web stage 区域：1440×900 视口下 `main.conversation` 为 1160×900，stage 精确覆盖该矩形。
- `data-shq-mode`、`data-shq-period`、`data-shq-ink` 随设置和系统时间更新；预览黄昏为 `17.7 / dusk / dark`，静夜为 `22 / night / light`。
- 设置保存：`previewHour=17.7` 成功写入并显示“设置已保存”；早期使用 0.25 步长时 17.7 被宿主拒绝，界面显示“保存失败，已回到上次保存的设置”，证明失败回退路径可用；随后把步长改为 0.1 修复。
- 任务联动真实会话复测（本机 mock provider `127.0.0.1:19091`，慢速流式回答约 16 秒）：
  - 进入：发出消息后约 0.4 秒 `data-shq-working=on`，`#shq-farmer-mover` 为 `display:inline`。
  - 回答期间：文本从 131 字增长到 206 字（约 16.5 秒）的所有采样均为 `working=on`；回答开始后 7.5 秒截图 `farmer-working-answer.png`，农人正持锄在田间耕作。
  - 结束：回答结算（文本 267 字）时 `working=off`，农人进入 packing → leaving。
  - 取消：流式输出中点“停止生成”，约 0.4 秒内 `working=off`，界面显示“已停止”。
  - 单元测试另覆盖 `running=false`、`removed`、`openState=error`、`lastAgentError`、错过通知后 `resync()`、释放后不再发布、会话栈切换与延迟绑定。
  - 断连：任务运行中杀 web 进程，农人立即 off，`data-shq-working` 变为 off（沿用早前断连测试，属性名已更新）。
  - 早期按 reasoning/text/tool 阶段离场的采样属于旧语义，已被本次修正取代；农人动画状态机本身未变。

## 未完成或未宣称的项目

- **Desktop 目视验收**：只确认了插件安装、配置入口和槽位注册活动；锁屏期间无法截图，未宣称视觉、动画或设置页在 Desktop 上通过。
- **真实 DeepSeek 模型输出**：临时 profile 的凭据不可用，模型请求返回 `AUTH`；截图中的回答来自本机 mock provider。真实 Session 事件链路已验收，但未用真实模型账号复测。
- **远程 Web/鉴权代理**：只在 `127.0.0.1` 本地回环验收，未测试非 loopback、`--trusted-host`、反向代理或 HTTPS。
- **进程总内存与 GPU 内存**：只记录页面 JS 堆与测试浏览器的进程工作集，不能代表 DSH Desktop/Web 整机占用；未测 GPU 内存。
- **长对话压力极限**：检查了当前长会话、滚动与代码块，未做 10 万条消息或长时间（小时级）泄漏曲线。
- **无障碍完整审计**：检查了键盘焦点、`aria-pressed`/`role=switch`/`aria-checked` 与减少动态效果；未做完整 WCAG 审计。

## 截图

`docs/screenshots/`：

- `home-dawn.png`、`home-day.png`、`home-dusk.png`、`home-night.png`
- `chat-day.png`、`chat-night.png`
- `farmer-working.png`、`farmer-mobile.png`、`farmer-working-answer.png`（整轮流式回答期间农人持续耕作）
- `settings-light.png`、`settings-dark.png`、`settings-night.png`（浅色宿主 + 夜景，夜间界面随场景转深）、`settings-night-general.png`
- `present-cards-night.png`（夜间 present 交付卡）
- `dialog-night.png`（夜间设置弹窗：中性暗阴影，无光晕/磨砂）
- `settings-preview-scene.png`（设置页缩略图复用真实背景场景）
- `menu-night.png`、`mobile-night.png`
- `preview.png`（独立场景预览）

截图来自临时 Web profile 与本机 mock provider，不包含用户真实会话内容。
