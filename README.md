# Echo IM

<div align="center">
  <p><strong>移动优先的实时通信与关系空间应用</strong></p>
  <p>
    <a href="https://echo-im.cloud">在线体验</a>
    ·
    <a href="#快速开始">快速开始</a>
    ·
    <a href="#生产部署">生产部署</a>
    ·
    <a href="#项目文档">项目文档</a>
  </p>
</div>

Echo IM 不只是一个聊天 Demo。它把私聊、群聊、动态、语音通话与关系空间放在同一套移动端体验中，并加入回声排行、定时消息、共同宠物和情侣相册等长期互动能力。

线上版本运行在阿里云 ECS：宿主 Nginx 负责 HTTPS/WSS 与反向代理，React 前端、Node.js 后端和 PostgreSQL 由 Docker Compose 编排。

> 版本说明：线上实例使用不带 Git 元数据的独立发布包，和 GitHub 默认分支已存在明确差异。下方功能概览以线上发布包为准；直接克隆默认分支时，个别线上能力或文件可能尚未包含。

## 在线体验

- Web：[https://echo-im.cloud](https://echo-im.cloud)
- API 健康检查：[https://echo-im.cloud/api/health](https://echo-im.cloud/api/health)
- 主要面向移动浏览器，也兼容 HBuilderX 5+ App 容器

## 功能概览

| 模块 | 当前能力 |
| --- | --- |
| 账号与好友 | 邮箱注册与登录、Echo ID 搜索、好友申请/处理、备注、置顶、免打扰、隐藏会话、删除与黑名单 |
| 私聊与群聊 | 文本、图片、语音、视频、表情包、引用回复、撤回、单条删除、批量删除、清空会话、已读回执、输入状态与未读数 |
| 群组管理 | 创建群聊、邀请/移除成员、群资料、群内昵称、管理员角色、群主转让、退出与解散 |
| 搜索与定时消息 | 会话搜索、聊天记录搜索与上下文定位、回声胶囊定时发送 |
| 实时通信 | Socket.IO 在线状态与消息同步；WebRTC 点对点语音通话；支持自定义铃声和 STUN/TURN 配置 |
| 动态与隐私 | 文字/图片动态、点赞、评论、删除、好友分组、分组可见与指定用户可见性 |
| 关系空间 | 情侣绑定与解绑流程、纪念时间、倒计时、双方城市天气与距离、想念通知、共同相册、夸夸本、记仇本与日记 |
| Echo Pet | 双人共同领养、签到、聊天成长、连续互动与补签、金币商店，以及喂食、玩耍、散步、训练、学习、工作、睡觉等互动 |
| 个性化 | 深浅主题、头像、签名、在线状态、会话/聊天背景、好友专属背景、自定义铃声 |
| 移动与弱网体验 | 手机端布局、触摸手势、PWA 基础能力、请求缓存、断网写入队列与恢复后的同步 |
| 可选集成 | QQ/Gmail SMTP 或 Resend 验证邮件、高德地图服务、UniPush Webhook 离线推送；生产发布包另有独立监控配置 |

### 关系空间的数据边界

- 情侣关系、情侣相册、夸夸本、记仇本和日记由服务端保存并在双方之间同步。
- 情歌清单以及朋友/家人空间的成员与记录目前保存在浏览器 <code>localStorage</code>，不会跨设备同步。
- 情侣天气当前是按城市查询的天气卡片，不包含定时天气提醒。

## 技术架构

~~~mermaid
flowchart TB
    A[移动浏览器 / 5+ App] -->|HTTPS / WSS| N[宿主 Nginx]
    B[另一通话端] -->|HTTPS / WSS| N
    A <-->|WebRTC 音频| B

    N -->|静态资源| F[Frontend 容器<br/>React + Nginx]
    N -->|REST / Socket.IO / uploads| S[Backend 容器<br/>Express + Socket.IO]
    S --> D[(PostgreSQL 16)]
    S --> U[(Uploads Volume)]
    S -. 可选 .-> X[SMTP / Resend<br/>高德地图 / Push Webhook]
~~~

生产访问入口统一使用域名和 HTTPS/WSS。容器映射端口应只供宿主反向代理使用，并通过安全组或防火墙限制公网访问。生产发布包内的监控配置可独立部署，但尚未同步到 GitHub 默认分支，也不属于当前三个核心应用容器。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript 5、Vite 8、React Router、Tailwind CSS、Framer Motion、Socket.IO Client |
| 后端 | Node.js 20、Express、TypeScript、Socket.IO、Prisma、JWT、Multer、Zod |
| 数据 | SQLite（本地源码开发）、PostgreSQL 16（生产） |
| 实时通信 | Socket.IO 信令与状态同步、WebRTC 点对点语音 |
| 部署 | Docker Compose、Nginx、HTTPS/WSS、持久化上传卷 |
| 可选运维 | 生产发布包内提供 Prometheus、Grafana、Loki、Promtail、Alertmanager 与 Exporters 配置 |

## 快速开始

### 前置要求

- Node.js 20.19+，或 22.12+
- npm
- Docker 与 Docker Compose（使用容器方式时）

### 方式一：Docker 本地启动

~~~bash
git clone https://github.com/ry520-stack/Echo-IM.git
cd Echo-IM
docker compose up -d --build
docker compose ps
~~~

浏览器访问 [http://localhost](http://localhost)。停止服务：

~~~bash
docker compose down
~~~

根目录的 <code>docker-compose.yml</code> 使用开发配置和固定的本地数据库凭据，只适合本机体验，不应直接暴露到公网。

该 Compose 文件默认没有向后端传入邮件服务变量，所以可以启动服务，但使用全新数据库时无法通过注册页创建第一个账号。需要注册功能时，请先在 <code>backend.environment</code> 中映射下面任一邮件服务的变量，然后重新构建容器。

### 方式二：源码开发

后端本地使用 SQLite。先安装依赖，并在启动进程中提供环境变量。

Linux / macOS：

~~~bash
cd backend
npm ci

export DATABASE_URL='file:./dev.db'
export JWT_SECRET='replace-with-a-local-random-secret'
export FRONTEND_URL='http://localhost:5173'

npm run db:generate
npm run db:push
npm run dev
~~~

Windows PowerShell：

~~~powershell
cd backend
npm ci

$env:DATABASE_URL='file:./dev.db'
$env:JWT_SECRET='replace-with-a-local-random-secret'
$env:FRONTEND_URL='http://localhost:5173'

npm run db:generate
npm run db:push
npm run dev
~~~

在第二个终端启动前端：

~~~bash
cd frontend
npm ci
npm run dev
~~~

开发地址为 [http://localhost:5173](http://localhost:5173)。Vite 已将 <code>/api</code>、<code>/socket.io</code> 和 <code>/uploads</code> 代理到 <code>localhost:3001</code>，浏览器本地开发通常不需要设置 <code>VITE_API_BASE</code>。

> 注册页要求发送邮箱验证码。无论使用 Docker 还是源码启动，都需要至少配置 QQ SMTP、Gmail SMTP 或 Resend 中的一种；未配置邮件服务时，可运行项目，但无法通过当前注册页完成新账号注册。

## 环境变量

### 后端与 Compose

| 变量 | 必需性 | 用途 |
| --- | --- | --- |
| <code>DATABASE_URL</code> | 源码启动必需 | Prisma 数据库连接；本地可使用 <code>file:./dev.db</code> |
| <code>DB_USER</code> / <code>DB_PASSWORD</code> / <code>DB_NAME</code> | 生产必需 | PostgreSQL 与生产 Compose 配置 |
| <code>JWT_SECRET</code> | 生产必需 | JWT 签名密钥 |
| <code>JWT_EXPIRES_IN</code> | 可选 | Token 有效期，默认 7 天 |
| <code>FRONTEND_URL</code> | 生产必需 | CORS 与 Socket.IO 允许来源，多个地址用逗号分隔 |
| <code>QQ_SMTP_USER</code> / <code>QQ_SMTP_PASS</code> | 三选一 | QQ 邮箱验证码 |
| <code>SMTP_USER</code> / <code>SMTP_PASS</code> | 三选一 | Gmail 邮箱验证码 |
| <code>RESEND_API_KEY</code> | 三选一 | Resend 邮箱验证码 |
| <code>AMAP_WEB_SERVICE_KEY</code> | 可选 | 情侣天气与城市距离 |
| <code>OFFLINE_PUSH_ENABLED</code> | 可选 | 是否启用离线推送，默认 false |
| <code>UNIPUSH_WEBHOOK_URL</code> / <code>UNIPUSH_WEBHOOK_SECRET</code> | 可选 | UniPush Webhook 网关 |

### 前端构建

| 变量 | 用途 |
| --- | --- |
| <code>VITE_API_BASE</code> | App/独立部署时的 API 根地址；同域 Web 部署可留空 |
| <code>VITE_RTC_STUN_URLS</code> | 逗号分隔的 STUN 地址 |
| <code>VITE_RTC_TURN_URLS</code> | 逗号分隔的 TURN 地址 |
| <code>VITE_RTC_TURN_USERNAME</code> / <code>VITE_RTC_TURN_CREDENTIAL</code> | TURN 凭据 |
| <code>VITE_RTC_ICE_TRANSPORT_POLICY</code> | ICE 策略，生产通常使用 all |

公网语音通话建议配置自己的 TURN 服务。只依赖公共 STUN 时，部分 NAT 或运营商网络下可能无法建立连接。

## 生产部署

在项目根目录创建 <code>.env</code>，不要把它提交到 Git：

~~~env
DB_USER=echo_user
DB_PASSWORD=replace-with-a-strong-password
DB_NAME=echo_db
JWT_SECRET=replace-with-at-least-32-random-characters
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-domain.example
OFFLINE_PUSH_ENABLED=false
~~~

需要开放注册时，必须选择一组邮件变量并传入 <code>backend</code> 服务；地图与离线推送变量按需传入。前端的 API 与 TURN 配置应在镜像构建前写入 <code>frontend/.env.production</code>。

构建并启动核心服务：

~~~bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
~~~

还需要在宿主 Nginx 中完成：

- 域名与 TLS 证书；
- <code>/</code> 反向代理到宿主回环地址 <code>127.0.0.1:8080</code>；
- <code>/api</code>、<code>/socket.io</code> 和 <code>/uploads</code> 反向代理到宿主回环地址 <code>127.0.0.1:9090</code>；
- Socket.IO 所需的 WebSocket Upgrade 请求头；
- 数据库、上传卷和证书的备份策略。

当前生产 Compose 的端口映射默认监听所有网卡。公网部署前应将前端、后端映射改为 <code>127.0.0.1</code> 绑定，并取消 PostgreSQL 的公网端口映射，或至少用安全组/防火墙严格限制访问。

后端生产镜像会在启动时执行 <code>prisma db push</code>。正式环境升级前请先备份数据库，并检查 schema 变化。

## 目录结构

~~~text
.
├── backend/
│   ├── prisma/              # 本地与生产 schema、数据库变更
│   └── src/                 # REST API、Socket.IO 与业务服务
├── frontend/
│   ├── public/              # PWA 与静态资源
│   └── src/                 # 页面、组件、状态与 API 客户端
├── docs/                    # 架构、实时通信、推送与产品记录
├── docker-compose.yml       # 本地容器环境
└── docker-compose.prod.yml  # 生产容器环境
~~~

## 构建检查

~~~bash
cd backend
npm ci
npm run build

cd ../frontend
npm ci
npm run build
~~~

仓库当前没有统一的 <code>test</code> 或 <code>lint</code> 脚本，因此构建成功与线上健康检查是现阶段的基础校验，不等同于完整自动化测试。

## 当前边界

- 找回密码流程目前仍在修复，不应视为可稳定使用的线上能力。
- 朋友/家人空间和情歌清单尚未服务端同步。
- 公网 WebRTC 语音质量依赖正确的 TURN 部署与前端构建配置。
- 监控栈配置目前只存在于生产发布包，尚未同步到默认分支，也不会随三个核心应用容器一起启动。
- 生产发布包与 GitHub 默认分支仍需要进一步统一版本管理。

## 项目文档

- [云端架构实践](docs/juejin-01-echo-cloud-architecture.md)
- [实时通信与 WebRTC](docs/juejin-02-echo-realtime-and-webrtc.md)
- [云端产品化与存储演进](docs/juejin-03-echo-cloud-storage-and-product.md)
- [UniPush2 离线推送说明](docs/UNIPUSH2_OFFLINE_PUSH.md)
- [开发体验记录](DEV_EXPERIENCE.md)

## 安全提示

- 不要提交 <code>.env</code>、数据库密码、JWT 密钥、SMTP 密码或 TURN 凭据。
- 不要在 README 中公开监控账号、管理端口或内部服务地址。
- 生产环境应限制数据库与监控端口的公网访问，并定期轮换凭据。

## License

仓库当前未包含独立的 <code>LICENSE</code> 文件。在许可证明确前，请勿假定代码可按 MIT 或其他开源许可证自由使用。
