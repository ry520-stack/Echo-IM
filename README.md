# Echo IM

Echo IM 是一个面向移动端体验的即时通讯与关系空间项目。项目核心是聊天、语音通话、好友/群聊和动态，同时扩展了共同宠物、情侣空间、朋友空间、家人空间、情侣相册、天气提醒、聊天记录搜索等互动能力。

生产环境部署在阿里云 ECS，前端通过 Nginx 提供静态资源，后端基于 Node.js/Express/Socket.IO 提供 API、实时消息和通话信令，数据存储使用 PostgreSQL。

## 功能特性

- 账号系统：邮箱注册、登录、找回密码、Echo ID 搜索。
- 私聊：文本、图片、语音、视频、表情、撤回、删除、清空会话、已读回执、在线状态。
- 群聊：创建群聊、邀请成员、群资料、成员管理、群内昵称、群聊搜索。
- 语音通话：WebRTC 语音通话、来电通知、通话记录、自定义铃声。
- 会话列表：好友/群聊聚合、置顶、隐藏、未读数、聊天记录搜索、定位到指定消息。
- 动态：文字图片动态、点赞、评论、可见范围、封面图。
- 关系空间：情侣空间、朋友空间、家人空间。
- 情侣空间：相识/相恋时间、天气提醒、情侣相册、情歌、夸夸本、记账本、想念通知、解绑流程。
- 情侣相册：按标签分组、上传照片、封面、备注、详情瀑布流、大图预览、管理删除。
- Echo Pet：双人共同宠物、签到、喂养、背包、补签卡、宠物商店、学习/工作/睡觉/散步/训练等玩法。
- 个性化：暗黑模式、聊天背景、会话背景、好友专属背景、主题色。
- 运维监控：可接入独立的 Grafana/Prometheus/Loki 监控栈。

## 技术栈

前端：

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Socket.IO Client
- lucide-react

后端：

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Socket.IO
- Multer
- JWT

部署与运维：

- Alibaba Cloud ECS
- Docker Compose
- Nginx
- HTTPS/WSS
- Grafana / Prometheus / Loki / Promtail

## 云端架构

```text
用户 / App
  -> Nginx / HTTPS
  -> frontend:80
  -> backend:3001 / Socket.IO
  -> PostgreSQL
  -> uploads volume
```

生产 Compose 服务：

- `frontend`：React/Vite 构建后的静态资源，由 Nginx 提供访问。
- `backend`：Express + Socket.IO API 服务。
- `db`：PostgreSQL 16 数据库。

监控栈独立维护在：

```text
https://github.com/ry520-stack/Monitoring-Stack
```

## 本地开发

后端：

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

前端：

```bash
cd frontend
npm install
npm run dev
```

## 生产构建

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

常用检查：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

## 目录结构

```text
.
├── backend/               # Express / Socket.IO / Prisma 后端
├── frontend/              # React / Vite 前端
├── docs/                  # 项目文章与说明
├── ops/                   # 部署和运维相关配置
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

## 文档

- [云端架构实践](docs/juejin-01-echo-cloud-architecture.md)
- [实时通信与 WebRTC](docs/juejin-02-echo-realtime-and-webrtc.md)
- [云端产品化与存储演进](docs/juejin-03-echo-cloud-storage-and-product.md)
- [抖音项目介绍文案](docs/douyin-echo-project-script.md)

## 仓库

```text
https://github.com/ry520-stack/Echo-IM
```
