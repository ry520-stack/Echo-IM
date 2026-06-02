# Echo 稀土掘金篇 4：星轨图片画廊 — 悬浮堆叠与宫格分页

## 两种画廊模式

Echo 的"星轨"（朋友圈）拥有两种颠覆性的图片展示模式：

### 模式 1：悬浮循环堆叠 (FloatingStackGallery)

**视觉效果**：
- 第 1 张在最顶层（Scale 1，无位移）
- 第 2 张在下面（Scale 0.95，Y 轴向下 12px）
- 第 3 张在更下面（Scale 0.90，Y 轴向下 24px，opacity 0）
- 最多露出下面 2 层

**手势循环**：
顶层图片支持 Framer Motion `drag="x"`。向左滑动超过 50px 松手，该图片绕到数组末尾，第 2 张浮现成为新顶层。

**10秒时空倒放**（核心难点）：
```typescript
useEffect(() => {
  if (offset > 0) {
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setOffset(prev => {
          if (prev <= 1) { clearInterval(intervalRef.current!); return 0; }
          return prev - 1;
        });
      }, 250); // 每张 250ms 倒放
    }, 10000); // 10秒无操作触发
  }
  return () => { clearTimeout(timerRef.current); clearInterval(intervalRef.current); };
}, [offset]);
```

### 模式 2：宫格横滑分页 (PaginatedGridGallery)

- 使用 CSS Grid `grid-cols-3`，每页最多 9 张
- 超过 9 张时自动分页
- 整体 `drag="x"` 横向滑动手势切换页面
- 底部圆点指示器显示当前页码

```typescript
const pages = Array.from({ length: Math.ceil(images.length / 9) }, (_, i) =>
  images.slice(i * 9, i * 9 + 9)
);
```

### 使用规则

```typescript
{imgs.length <= 3
  ? <FloatingStackGallery images={imgs} />
  : <PaginatedGridGallery images={imgs} />
}
```

## 下一篇文章

[篇5: 移动端工程化](./Echo稀土掘金篇5-移动端工程化.md)
