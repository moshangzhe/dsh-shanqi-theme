/** esbuild 资源加载规则：样式与图片在构建时内联，运行时不需要网络或额外文件。 */
export const assetLoaders = {
  '.css': 'text',
  '.png': 'dataurl',
  '.svg': 'text',
};
