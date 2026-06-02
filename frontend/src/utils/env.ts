/**
 * HBuilderX 5+ App 环境检测
 * 在浏览器中返回 false，在 HBX 打包的 App 中返回 true
 */
export function is5Plus(): boolean {
  return typeof window !== 'undefined' && 'plus' in window && (window as any).plus !== undefined;
}

/**
 * 获取 plus 对象（仅在 5+ 环境下可用）
 * 使用前请先检查 is5Plus()
 */
export function getPlus(): any {
  if (is5Plus()) return (window as any).plus;
  return null;
}
