# 版权与来源说明

## 软件代码

本项目的软件代码与原创文档采用 MIT 许可，版权声明见 `LICENSE`。

插件架构参考了 [xikan0/dsh-outerwilds-theme](https://github.com/xikan0/dsh-outerwilds-theme)（MIT License，Copyright (c) 2026 dsh-outerwilds-theme contributors）。本项目按照参考仓库的插件分层、客户端模块加载方式与设置注册方式重新实现，未复制其系统音频捕获、波形、原生 exe、音频 RPC、字体包或美术素材。参考仓库的 MIT 许可文本：

```text
MIT License

Copyright (c) 2026 dsh-outerwilds-theme contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 美术素材

`assets/shq-terrain.png`、`assets/shq-lake.png`、`assets/shq-occluder.png`、`assets/shq-shore.png`、`assets/farmer-source.svg`、`assets/farmer-shoulder-source.svg`、`icon.svg`、`docs/screenshots/*` 以及场景 SVG 中的山体路径、窗灯、炊烟与农人造型，来自用户提供的 `harness-riverside-theme.zip` 资源包或在其基础上整理。这些素材**不包含在软件代码的 MIT 许可内**，本项目按资源包所有者的授权用于该主题，不主张对参考仓库美术素材的所有权。

资源包的 `riverside-landscape.svg`、`riverside-night.svg` 保留在原始资源包中，用于编辑和高分辨率导出；运行时使用其优化后的透明缓存图层，不把原始约两万节点挂入实时场景。

## 第三方依赖

- `@deepseek-ai/schemastery`：宿主自带依赖，按其自身许可使用。
- React 为 DSH 客户端提供的运行时，本包只声明 peer dependency。
- 构建期使用 esbuild、TypeScript、jsdom；它们不进入运行时产物。
- 不使用或分发任何第三方字体文件。
