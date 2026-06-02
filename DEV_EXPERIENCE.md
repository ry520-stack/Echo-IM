# Echo 开发经验日志 (DEV EXPERIENCE)

## 🐛 手势穿透与事件冒泡

**现象**: 首页左滑进引力圈时，侧边栏也被拖出。聊天中右滑退出时，侧边栏被误触。

**根因**: 侧边栏唤出监听在 ChatPage 根 div，内层组件的触摸事件向上冒泡。

**解决**:
```
ConversationList: dx<-50 → e.stopPropagation() + onOpenGravity()
ChatPage 侧边栏: 仅 startX < 20%屏幕宽 + dx>40 → open
聊天中/引力圈中: 直接 return 不处理侧边栏手势
```

## 🐛 深色模式光晕穿透 (Harsh Halo)

**现象**: Gravity Zone 深色模式边缘出现巨大白色光圈。

**根因**: `radial-gradient` 写死浅色终点 `rgba(249,250,251,1)`，Tailwind `dark:` 变体在 `fixed` 定位元素上不生效。

**解决**: 放弃 Tailwind `dark:` 类，改为 JS 条件 `style={{ background: isDark ? '#000' : '...' }}`。

## 🐛 手机端布局黑屏/键盘遮挡

**现象**: 发星轨页面键盘弹出时底部黑屏，图片预览撑破布局。

**根因**: 外层容器 `fixed inset-0 flex flex-col` 导致键盘无法避让。

**解决**: `h-[100dvh] overflow-y-auto`（动态视口高度）+ 图片 `aspect-square max-h-48` 限高。

## 🐛 首页空状态不显示

**现象**: 会话为空时页面空白，欢迎组件未渲染。

**根因**: 判断 `conversations.length===0` 但被隐藏/归档的旧会话使 length > 0。

**解决**: `visibleCount = conversations.filter(c => !archived.has(c.peer.id)).length`。

## 🐛 聊天气泡右侧截断

**现象**: 手机端己方消息气泡被屏幕右边缘截断。

**根因**: 回复按钮 `group-hover:inline-block` 在气泡右侧额外占用空间。

**解决**: 己方消息回复按钮移至左侧，气泡 `max-w-[80%] + mr-1`。

## 🐛 Gooey 流体滤镜失效

**现象**: 输入框点击后无流体效果，文字模糊。

**根因**: `filter: url(#goo)` 加在 `<motion.form>` 上，影响了文字和图标的渲染。

**解决**: 滤镜必须隔离到独立 div（仅包含背景色块+流体球），textarea 用 `bg-transparent` 叠在上层。

## 🐛 Framer Motion Layout 动画残留撑爆卡片

**现象**: 星轨帖子的宫格展开/收起后，卡片底部出现巨大白屏。

**根因**: `AnimatePresence` + `motion.div` 的 `height: 'auto'` → `height: 0` 动画退出时 DOM 残留占位。

**解决**: 去掉 height 动画，仅用 `opacity` 淡入。

## 🐛 移动端视口坍塌

**现象**: 上传图片后页面下半部分白屏，切后台再切回来恢复正常。

**根因**: `#root { height: 100% }` 在键盘/文件选择器弹出时高度卡死。

**解决**: `height: 100dvh` + 滚动容器 `transform-gpu` 强制 GPU 重绘。

## ✅ Pointer Events 取代 Mouse/Touch 混用

**现象**: 录音按钮在某些手机上无响应。

**根因**: `onMouseDown` + `onTouchStart` 混用导致事件冲突。

**解决**: `FluidVoiceInput` 使用 `onPointerDown/onPointerUp` + `setPointerCapture`。

## ✅ 乐观更新防卡顿

**现象**: 弱网/VPN 下发送消息界面卡死。

**解决**: 消息发送→立即本地渲染，失败标红 ❌。发布动态→☄️ 毛玻璃遮罩 `z-[9999] pointer-events-auto` 不可穿透。
