# Echo 篇 4：GooeySwipe — 流体滑动语音

## 概念

按住麦克风 → 输入框化为流体轨道 → 向右拖动发送语音 → 松手果冻回弹取消。

这不是普通的录音按钮。它用的是 SVG 滤镜 + Framer Motion 物理引擎的**流体粘连效果**。

## 核心技术：SVG Gooey Filter

```xml
<filter id="goo">
  <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
  <feColorMatrix in="blur" mode="matrix"
    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
    result="goo" />
  <feBlend in="SourceGraphic" in2="goo" />
</filter>
```

`feColorMatrix` 的 Alpha 通道值 **18 -7** 是实现"果冻断开"效果的黄金参数。stdDeviation 控制融合半径。

## 避坑

- `filter:url(#goo)` 容器内**不能**用 `box-shadow`，会被滤镜算成黑色流体
- 发光用外层 `drop-shadow` 替代
- `dragConstraints.right` 必须通过 `ref` 动态计算：`containerWidth - knobWidth - padding`

## Framer Motion 拖拽

```typescript
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: maxDrag.current }}
  dragElastic={0.1}
  dragMomentum={false}
  onDragEnd={(_, info) => {
    if (info.offset.x > maxDrag.current * 0.6) onSend();
    else onCancel();
  }}
  transition={{ type: 'spring', stiffness: 300, damping: 20, mass: 1 }}
/>
```

## FluidVoiceInput 重构

后期用 Pointer Events 替代了 Mouse/Touch 混用，解决了移动端事件冲突：

```typescript
onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startRecording(); }}
onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); stopRecording(); }}
```

3 个状态：idle（按住说话）→ recording（正在录音...青色发光）→ sending（麦克风滑到右侧，弹簧回弹）。

## 语音回放

VoiceBubble 组件内嵌 HTML5 `<audio>` 元素，点击播放/暂停，显示进度和波形动画。语音消息的 blob 先上传到服务器，再通过 WebSocket 发送 URL。

下一篇：[星轨图片画廊：悬浮堆叠与10秒倒放](05-星轨图片画廊悬浮堆叠与10秒倒放.md)
