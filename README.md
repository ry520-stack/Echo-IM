# Echo IM

Echo IM 是一个面向移动端体验的实时通信与情侣空间项目。它不是单纯的聊天 Demo，而是围绕「聊天、关系、回忆、共同养成」做的一套完整应用：用户可以私聊、群聊、发动态、语音通话，也可以和绑定对象进入情侣空间，管理纪念日、天气关怀、共同相册、共同宠物和关系互动内容。

项目已部署在阿里云 ECS，使用 Docker Compose 管理前端、后端和 PostgreSQL 服务，并通过 HTTPS/WSS 对外提供访问。

**在线体验**：[https://echo-im.cloud](https://echo-im.cloud)

## 项目亮点

- **实时 IM**：支持私聊、群聊、未读数、已读回执、在线状态、忙碌/离开/请勿打扰、消息搜索和定位跳转。
- **音视频体验**：支持语音消息、WebRTC 语音通话、来电/呼出铃声、通话状态同步。
- **移动端交互**：适配手机端会话列表、聊天窗口、表情面板、长按菜单、背景壁纸和手势滑动。
- **情侣空间**：支持情侣绑定、纪念日、相识/相恋时长、城市天气、距离计算、SOS 想你、共同相册、城市足迹、情歌库、夸夸卡、记仇本、决定机器、爱情契约和周报。
- **共同宠物**：通过聊天卡片发起共同领养，双方共享宠物数据，包含等级、亲密度、金币、上学、工作、商店、背包、皮肤和任务体系。
- **隐私控制**：朋友圈评论/点赞按好友关系可见，情侣信息不向非好友暴露，生理期等敏感信息默认仅本人可见。
- **找回密码**：支持邮箱验证码找回密码，包含数学验证码防刷、60秒限频、5分钟有效期。
- **云端部署**：基于 ECS + Docker Compose + Nginx + PostgreSQL 部署，支持 HTTPS、WebSocket、上传文件和线上持续迭代。
- **监控运维**：集成 Grafana + Prometheus + Loki 监控栈，实时监控服务器资源、应用健康和日志。
- **AI 协同开发**：使用 AI 参与需求拆解、方案评审、代码审查、问题定位和回归清单整理，开发者负责产品判断、核心实现、联调验证和上线部署。

## 功能模块

### 账号与安全

- 邮箱注册、登录、验证码验证
- **找回密码**：邮箱验证码 + 数学验证码双重验证
- Echo ID 搜索用户
- 好友申请、同意、拒绝、删除、拉黑
- 好友备注、分组、聊天背景
- 在线、离线、忙碌、离开、请勿打扰状态

### 聊天系统

- 文本、图片、语音、视频、表情包消息
- 消息撤回、删除、清空会话
- 已读/未读状态
- 聊天记录搜索，点击结果跳转到对应消息
- 回复引用、表情面板、长按菜单
- 会话列表搜索、未读数、最近消息预览

### 语音通话

- Socket.IO 信令
- WebRTC 点对点语音通话
- 来电弹窗、拒绝、挂断、超时处理
- 呼出方和接收方铃声策略
- 自定义铃声上传

### 朋友圈

- 文字和图片动态
- 点赞、评论、封面图
- 好友可见、部分可见、不给谁看
- 非好友不可见对方评论和互动信息
- 图片排序和基础相册展示

### 星域管理

- 好友分组管理
- 自定义分组名称和颜色
- 分组成员管理
- 朋友圈可见性控制

### 回声排行

- 基于聊天、动态互动、通话等行为累积回声值
- 好友回声值排行榜
- 最近连接时间显示

### 情侣空间

- 情侣申请与确认
- 一人只能绑定一位情侣
- 绑定后支持 90 天锁定期规则
- 相识时长、相恋时长、倒计时和纪念日
- 双方城市天气和异常天气提醒
- 城市级地理信息和距离计算
- SOS 想你按钮，带限频机制
- 共同相册、城市足迹、情歌库、夸夸卡、记仇本、决定机器
- 爱情契约、生理期关怀、每周报告
- 情侣称呼支持同步配置

### 共同宠物

- 聊天内系统卡片发起共同领养
- 对方同意后生成共享宠物
- 双方立即看到同一只宠物
- 等级、经验、亲密度、金币
- 状态：清醒、睡觉、上学、工作、生病、沮丧、开心
- 上学、工作带冷却和时长限制
- 商店、背包、食物、玩具、药品、补签卡、限定皮肤
- 聊天、图片、通话和连续互动驱动成长

### 个人设置

- 头像上传与裁剪
- 昵称、状态、个性签名
- 深色/浅色主题切换
- 通知开关、已读回执开关
- 聊天背景自定义
- 自定义铃声上传
- 黑名单管理

## 技术栈

### 前端

- React 19
- TypeScript 5
- Vite 8
- Tailwind CSS
- React Router
- Socket.IO Client
- Framer Motion
- lucide-react

### 后端

- Node.js
- Express
- TypeScript
- Socket.IO
- Prisma
- PostgreSQL
- JWT
- Multer
- Zod
- Helmet / Rate Limit

### 部署与监控

- Alibaba Cloud ECS
- Docker Compose
- Nginx
- PostgreSQL 16
- HTTPS / WSS
- **Grafana**：可视化监控面板
- **Prometheus**：指标采集与存储
- **Loki + Promtail**：日志聚合与查询
- **Alertmanager**：告警通知
- **Node Exporter**：服务器资源监控
- **PostgreSQL Exporter**：数据库指标监控

## 云端架构

```text
Mobile Web / App
        |
        | HTTPS / WSS
        v
Host Nginx
        |
        +--> frontend container: React static assets
        |
        +--> backend container: Express API + Socket.IO
                    |
                    +--> PostgreSQL
                    |
                    +--> uploads volume

Monitoring Stack:
        |
        +--> Grafana (可视化面板)
        +--> Prometheus (指标采集)
        +--> Loki + Promtail (日志聚合)
        +--> Alertmanager (告警通知)
        +--> Node Exporter (系统监控)
        +--> PostgreSQL Exporter (数据库监控)
```

生产环境通过 Docker Compose 编排：

- `frontend`：构建 React 静态资源，并由 Nginx 容器提供访问。
- `backend`：提供 REST API、Socket.IO 实时通信、通话信令和上传接口。
- `db`：PostgreSQL 保存用户、好友、消息、动态、情侣空间和宠物数据。
- `uploads`：保存头像、聊天图片、语音、视频、表情包、相册和背景图。
- `grafana`：可视化监控面板，展示服务器和应用指标。
- `prometheus`：采集和存储时间序列指标数据。
- `loki`：聚合应用和系统日志。
- `promtail`：采集日志并推送到 Loki。
- `alertmanager`：处理告警规则并发送通知。
- `node-exporter`：采集服务器 CPU、内存、磁盘等指标。
- `postgres-exporter`：采集 PostgreSQL 数据库指标。

## 监控栈访问

| 服务 | 地址 | 说明 |
|------|------|------|
| Grafana | `http://8.140.194.214:3000` | 监控面板（演示账号：`demo` / `echo2026`）|
| Prometheus | `http://8.140.194.214:9091` | 指标查询 |
| Loki | `http://8.140.194.214:3100` | 日志查询 |
| Alertmanager | `http://8.140.194.214:9093` | 告警管理 |
| Node Exporter | `http://8.140.194.214:9100` | 系统指标 |
| PostgreSQL Exporter | `http://8.140.194.214:9187` | 数据库指标 |

## AI 协同方式

这个项目使用 AI 作为工程协作工具，而不是简单替代开发：

- **需求拆解**：把「情侣空间」「共同宠物」「隐私规则」拆成可落地的前后端任务。
- **方案评审**：在数据库模型、接口边界、实时事件、移动端交互上做设计对比。
- **代码辅助**：辅助生成局部实现、迁移脚本、类型修复和重复逻辑整理。
- **问题定位**：根据截图、日志和构建错误快速定位前端样式、状态同步和数据库问题。
- **回归验证**：整理测试清单，覆盖登录、好友、聊天、已读、在线状态、情侣空间和宠物流程。

最终的产品判断、代码取舍、线上联调、部署验证和数据处理由开发者完成。

## 本地开发

后端：

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

前端：

```bash
cd frontend
npm install
npm run dev
```

生产部署：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 环境变量

后端常用环境变量：

```env
DATABASE_URL=postgresql://user:password@db:5432/echo_db
JWT_SECRET=your-secret
FRONTEND_URL=https://your-domain.com
AMAP_WEB_SERVICE_KEY=your-amap-key
OFFLINE_PUSH_ENABLED=false

# 邮件服务（找回密码功能）
QQ_SMTP_USER=your-qq-email@qq.com
QQ_SMTP_PASS=your-qq-smtp-password
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
RESEND_API_KEY=your-resend-api-key
```

## 项目经验价值

这个项目覆盖了从产品设计到云端上线的完整链路：

- 前端页面和移动端交互实现
- 后端 API 与实时通信
- 数据库建模和隐私权限控制
- 文件上传与媒体处理
- Docker 化部署和服务器运维
- 线上问题排查、数据清理和持续迭代
- 监控告警体系搭建
- AI 辅助下的高频产品开发协作

## 后续计划

- 将上传文件迁移到对象存储并接入 CDN
- 对聊天和动态图片做更细的原图/缩略图策略
- 优化前端代码分包，降低首屏资源体积
- 增加更系统的自动化测试
- 完善情侣空间活动配置和宠物限定皮肤体系
- 接入 UniPush 实现 App 端离线推送

## License

MIT
