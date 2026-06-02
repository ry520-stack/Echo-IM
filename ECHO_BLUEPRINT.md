# Echo 蓝图 (ECHO BLUEPRINT)

## 定位
Echo — 星际与共鸣（Space & Resonance）。极简、沉浸、反臃肿的私人社交宇宙。

## 设计语言
- 深空背景（OLED black `#05050A`）、品牌蓝紫色 `#6366f1`
- Glassmorphism 毛玻璃 `backdrop-blur-xl`
- Framer Motion 弹簧物理 `spring stiffness:150-300 damping:20-25`
- 命名体系：引力圈(Gravity Zone)、星轨(Orbit)、回声胶囊(Time Capsule)

## 技术栈
```
前端: React 19 + TypeScript + Tailwind CSS 3 + Vite 8 + Framer Motion 12
后端: Node.js + Express + Prisma + PostgreSQL 16
实时: Socket.IO (WebSocket + polling)
部署: Docker Compose 三容器 + Nginx + 阿里云 ECS
```

## 性能红线
1. 所有图片上传必须经过压缩管线（`compressImage.ts`），上限 2.5MB / 3200px
2. 移动端容器必须使用 `dvh` 动态视口高度，禁止 `h-screen`
3. 滚动容器必须加 `transform-gpu` 开启硬件加速
4. 长列表不做虚拟滚动，但必须控制 DOM 数量（FloatingStack 最多同时渲染 3 层）

## 手势公约
- 首页左滑 `dx<-50` → 引力圈
- 引力圈右滑 `dx>40` → 返回首页
- 聊天室右滑 `dx>50` → 退出聊天
- 聊天室左滑 `dx<-50` → 个人星轨
- 侧边栏：仅左边缘 `x<20%屏幕宽` + 右滑 `dx>40` 触发

## 模块架构
```
frontend/src/
├── components/   # 独立UI组件（每个文件只做一个组件）
├── pages/        # 页面级组件
├── hooks/        # 自定义Hook
├── contexts/     # React Context（Auth/Socket/Theme/Toast）
├── styles/       # 非Tailwind的CSS动画
├── utils/        # 工具函数
└── api/          # API客户端
```
