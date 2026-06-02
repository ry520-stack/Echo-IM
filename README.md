# Echo IM

Echo IM 是一个面向移动端体验的云端即时通讯项目，包含私聊、群聊、朋友圈、语音消息、语音通话、表情包、背景自定义、会话搜索、聊天记录搜索、来电铃声和关系型互动能力。项目已部署到 ECS，并通过 HTTPS 域名 `echo-im.cloud` 对外访问。

## 功能特色

- 账号体系：邮箱注册、登录、找回密码、Echo ID 搜索。
- 私聊：文本、图片、语音、视频、撤回、删除、清空会话、已读回执、在线状态。
- 群聊：创建群聊、拉人进群、群资料、成员管理、群内昵称和备注。
- 会话列表：好友/会话搜索、聊天记录搜索、置顶、隐藏、未读数。
- 语音能力：语音消息录制播放、WebRTC 语音通话、通话记录。
- 铃声设置：自定义来电铃声，呼出时可选择听对方铃声或自己的铃声。
- 表情包：上传、发送、批量管理、宫格排序、颜色高亮。
- 朋友圈：文字图片动态、点赞、评论、可见范围、封面图、宫格排序。
- 背景设置：会话列表、聊天界面、引力圈、好友专属聊天背景。
- 个性化：暗黑模式、通知开关、高亮颜色（紫色、蓝色、黑色）。
- Echo Pet：两人关系里的共同宠物，以第三个聊天成员的形式偶尔发言。

## 云端架构

生产环境使用 Docker Compose 部署：

- `frontend`：React + Vite + Nginx，提供 Web/App 静态资源。
- `backend`：Node.js + Express + Socket.IO，提供 API、实时消息和通话信令。
- `db`：PostgreSQL 16，保存用户、好友、群聊、消息、动态等数据。
- `nginx`：宿主机入口，负责 HTTPS、反向代理、WebSocket 转发和上传大小限制。

请求链路：

```text
用户 / App
  -> https://echo-im.cloud
  -> 宿主机 Nginx
  -> frontend:8080 / backend:9090
  -> PostgreSQL + uploads volume
```

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

部署：

- Alibaba Cloud ECS
- Docker Compose
- Nginx
- HTTPS/WSS

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

生产构建：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 上传与媒体

项目支持头像、聊天图片、语音、视频、表情包、朋友圈图片、背景图和来电铃声上传。当前文件保存在服务器 volume，后续适合迁移到对象存储，并接入 CDN。

铃声上传支持 `mp3/m4a/aac/wav`，应用层限制为 80MB，Nginx 入口需要配置 `client_max_body_size`。

## 文档

- [云端架构实践](docs/juejin-01-echo-cloud-architecture.md)
- [实时通信与 WebRTC](docs/juejin-02-echo-realtime-and-webrtc.md)
- [云端产品化与存储演进](docs/juejin-03-echo-cloud-storage-and-product.md)
- [抖音项目介绍文案](docs/douyin-echo-project-script.md)

## GitHub

当前仓库：

```text
https://github.com/ry520-stack/-Echo-IM
```
