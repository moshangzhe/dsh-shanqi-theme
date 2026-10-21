// src/index.ts
import z from "@deepseek-ai/schemastery";
var Config = z.object({
  enabled: z.boolean().default(true).description("\u542F\u7528\u5C71\u6816\u4E3B\u9898").volatile(),
  timeMode: z.union(["system", "preview"]).default("system").description("\u573A\u666F\u65F6\u95F4\u6765\u6E90").volatile(),
  previewHour: z.number().min(0).max(24).step(0.1).default(17.5).description("\u624B\u52A8\u9884\u89C8\u65F6\u523B\uFF080\u201324 \u5C0F\u65F6\uFF09").volatile(),
  farmer: z.boolean().default(true).description("\u519C\u4EBA\u4EFB\u52A1\u8054\u52A8").volatile(),
  ambient: z.boolean().default(true).description("\u708A\u70DF\u3001\u661F\u5149\u4E0E\u8424\u706B\u7B49\u73AF\u5883\u5FAE\u52A8").volatile()
}).description("\u5C71\u6816\u7530\u56ED\u4E3B\u9898");
function apply(ctx) {
  ctx.inject(["settings"], (child) => {
    child.effect(() => {
      const dispose = child.settings?.configure({ auto: false }, ctx.fiber);
      return typeof dispose === "function" ? dispose : void 0;
    });
  });
}
export {
  Config,
  apply
};
