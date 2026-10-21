# 性能测量

## 条件

- Windows x64，DSH 0.2.1-rc.2，Edge 155 headless。
- 页面：临时 Web profile 的 1440×900 视图，主题启用，系统时间/手动预览均可。
- 采样：CDP `Performance.getMetrics`，同一页面连续采样；`TaskBusy` = `TaskDuration` 增量 / 墙钟时间，`ScriptBusy` = `ScriptDuration` 增量 / 墙钟，`LayoutBusy`、`StyleBusy` 同理。
- JS 堆：`Runtime.getHeapUsage` 的 `usedSize`。
- 场景节点：`document.querySelectorAll('.shq-stage *').length`。
- 人物活动：本机 mock provider 产生真实 reasoning 流，农人进入 `working` 后采样 4 秒。

## 页面主线程（同一页面）

| 状态 | 采样 | 主线程 TaskBusy | 脚本 ScriptBusy | 布局 LayoutBusy | 样式 StyleBusy | JS 堆 | DOM 节点 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 主题开启、静止（无任务） | 6.0 s | **1.78%** | 0.01% | 0.06% | 0.50% | 30.05 MiB | 1208 |
| 农人耕作（任务运行中） | 4.0 s | **15.75%** | 3.18% | 1.66% | 2.67% | 40.46 MiB | 1321 |
| 主题暂停 | 6.0 s | **0.64%** | 0 | 0 | 0 | 28.83 MiB | 892 |

说明：

- 场景静止时只有每秒一次的系统时间读取与低频 CSS 动画，主线程占用约 1.8%；主题暂停后低于 1%。
- 农人活动时最高约 30 fps，主线程约 15.8%，其中脚本 3.2%、布局 1.7%、样式 2.7%，其余为合成/绘制等任务。该状态只在当前对话 `running` 期间出现，整轮任务结束立即停止。
- JS 堆在农人/新消息活动时增加约 10 MiB，包含新会话消息节点与 Person 动画状态，不能全部归因于场景；主题暂停后回落到约 28.8 MiB。
- DOM 节点数不是内存占用的线性度量。场景 SVG 约 334 个节点（星点、图层、窗灯、炊烟、萤火、农人），整页约 873 个节点；资源包优化说明中的“约两万节点”是原始矢量，本项目未挂入。

## 进程级补充（测试浏览器）

在同一个专用 Edge 测试 profile 上，用 `Win32_Process` 汇总所有 `_edgecdp` 相关进程的 `UserModeTime + KernelModeTime` 与 `WorkingSetSize`：

| 状态 | 进程数 | 单核 CPU 占比 | 工作集 |
|---|---:|---:|---:|
| 静止 | 8 | 0%（8 秒内低于 0.01%） | 386 MiB |
| 农人活动（含新建页面/目标） | 9 | 8.84% | 715 MiB |

这组数字**不是** DSH 整机占用，也不能用来推断主题的总内存增幅：活动采样时多了一个完整的测试页面目标，工作集增加主要来自新页面、消息内容与浏览器自身。它只用于说明主线程之外的进程确实存在 CPU 消耗；真正的整机 CPU、GPU 与总内存未测量。

## 设计上的性能约束

- 静态绘景使用资源包已缓存的 4 张透明图层；原始 SVG 只用于编辑/导出。
- 静态绘景与动态人物、炊烟分离；人物关闭时不启动 `requestAnimationFrame`。
- 农人最高约 30 fps；系统时间每秒读取、颜色只在值变化时写入。
- 页面不可见时停止时钟与人物帧，恢复时重读系统时间与当前任务工作状态。
- 主题变量、DOM 属性（`data-shq-period`/`data-shq-ink`/`data-shq-working` 等）只在值变化时写入。
- 不使用全屏实时噪声滤镜、大面积 `backdrop-filter`；菜单明确设置 `--dsw-menu-backdrop-filter: none`。
- 流式消息更新不会重建背景、重新解码图片或重复初始化动画；`MutationObserver` 只观察 `[data-slot="main"]` 的直接子节点。
- 关闭主题会释放 stage、令牌层、`ResizeObserver`、`MutationObserver`、时钟、动画帧、连接订阅与任务订阅。

## 未测量

- GPU 内存、浏览器合成器内存、DSH Desktop 主进程/渲染进程总内存。
- 数小时连续运行的内存增长曲线。
- 低端设备、集成显卡或高 DPI 下的帧时间分布。
