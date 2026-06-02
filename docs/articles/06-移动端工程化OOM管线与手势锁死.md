# Echo 篇 6：移动端工程化 — OOM 管线与手势锁死

## 图片压缩管线

手机原图 8-12MB，直接上传 → 浏览器 OOM + 请求超时。

```typescript
import imageCompression from 'browser-image-compression';

export async function compressImage(file: File): Promise<File> {
  return await imageCompression(file, {
    maxSizeMB: 2.5,
    maxWidthOrHeight: 3200,
    useWebWorker: true,  // 不阻塞主线程
    fileType: 'image/webp',
    initialQuality: 0.95,
  });
}
```

效果：10MB → ~800KB，清晰度接近原图。

## 键盘避让

传统 `h-screen` 在键盘弹出时高度卡死，下半屏变黑。

```css
html, body, #root {
  height: 100dvh;  /* 动态视口高度 */
}
```

发布器容器 `min-h-[100dvh] overflow-y-auto pb-32`。

## GPU 硬件加速

Feed 滚动容器加 `transform-gpu` + `will-change: transform`，强制浏览器在 DOM 变更时正确重绘。

```jsx
<div className="flex-1 overflow-y-auto transform-gpu" style={{ willChange: 'transform' }}>
```

## 手势锁死机制

### 事件冒泡拦截

| 场景 | 冲突 | 解决 |
|------|------|------|
| 左滑进引力圈 vs 侧边栏弹出 | 同时触发 | `stopPropagation` + 阈值 |
| 聊天中右滑 vs 侧边栏 | 穿透 | 聊天中 `return` 不处理 |
| 引力圈卡片长按 vs 原生菜单 | 系统弹出 | `select-none touch-callout-none` + `preventDefault` |

### 长按防误触

`isLongPressing` ref 锁：长按 500ms 触发后，`onClick` 检测锁状态，不执行点击逻辑。

### Pointer Events

FluidVoiceInput 用 `onPointerDown/onPointerUp` + `setPointerCapture` 替代 Mouse/Touch 混用，彻底解决移动端事件冲突。

## 乐观更新

弱网/VPN 下发送消息 → 立即本地渲染 → 失败标红 ❌。

```typescript
const tempId = 'temp-' + Date.now();
setMessages(prev => [...prev, optimisticMsg]);
socket.emit('message:send', ..., (res) => {
  if (res?.error) setMessages(prev => prev.map(m => m.id === tempId ? {...m, content: m.content + ' ❌'} : m));
  else setMessages(prev => prev.map(m => m.id === tempId ? res.message : m));
});
```

## 深色模式全局过渡

```css
*, *::before, *::after {
  transition: background-color .7s ease-in-out, border-color .7s ease-in-out, color .5s ease-in-out;
}
```

GooeyToggle 开关 `spring(80,15)` 极慢粘滞，切换瞬间全局背景缓慢褪色。

下一篇：[Docker部署与运维](07-Docker部署与运维.md)
