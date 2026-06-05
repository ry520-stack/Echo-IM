# Echo IM 自动化部署脚本

基于阿里云 ECS 的 Web 项目自动化部署与运维实践。

## 目录结构

```
ops/deploy/
├── .env.template              # 环境变量模板
├── README.md                  # 本文档
└── scripts/
    ├── 01-init-server.sh      # 服务器初始化
    ├── 02-install-docker.sh   # 安装 Docker
    ├── 03-install-nginx.sh    # 安装 Nginx + SSL
    ├── 04-setup-project.sh    # 部署项目
    ├── service.sh             # 服务管理（启停/日志/健康检查）
    └── backup.sh              # 数据备份
```

## 脚本说明

### 01-init-server.sh — 服务器初始化

**作用**：新 ECS 首次使用前的系统配置

**执行内容**：
- 设置时区为 Asia/Shanghai
- 更新系统软件包
- 安装基础工具（curl, wget, vim, htop 等）
- 创建 2GB swap 分区（小内存机器必备）
- 优化内核参数（网络并发、文件描述符）
- 创建项目目录结构

**为什么需要**：
- 时区不对会导致日志时间混乱
- 没有 swap 的 1.8GB 机器容易 OOM
- 内核参数优化提升网络性能

### 02-install-docker.sh — 安装 Docker

**作用**：安装 Docker Engine 和 Docker Compose

**执行内容**：
- 卸载旧版本 Docker
- 安装 Docker CE + Compose 插件
- 配置国内镜像加速器
- 配置日志轮转（防止日志撑爆磁盘）
- 启动 Docker 并设置开机自启

**为什么需要**：
- Docker 是容器化部署的基础
- 国内不配镜像加速器基本拉不动镜像
- 日志轮转防止磁盘被撑满

### 03-install-nginx.sh — 安装 Nginx

**作用**：安装 Nginx 并配置反向代理 + HTTPS

**执行内容**：
- 安装 Nginx
- 配置反向代理（前端 :8080、后端 :9090）
- 配置 WebSocket/WSS 转发（Socket.IO 必需）
- 安装 Certbot 申请 Let's Encrypt 证书
- 配置证书自动续期

**为什么需要**：
- 统一入口，一个域名对外
- HTTPS 是现代 Web 必备
- WebSocket 需要特殊的 Nginx 配置

### 04-setup-project.sh — 部署项目

**作用**：拉取代码、配置环境变量、启动服务

**执行内容**：
- 克隆或更新项目代码
- 自动生成 .env 环境变量文件
- 创建必要目录（uploads、logs）
- Docker Compose 构建并启动服务
- 健康检查

**为什么需要**：
- 自动化部署，减少人工操作
- .env 文件包含敏感信息，不能提交到 Git

### service.sh — 服务管理

**作用**：统一管理所有服务的启停、日志、健康检查

**命令**：
```bash
./service.sh start      # 启动所有服务
./service.sh stop       # 停止所有服务
./service.sh restart    # 重启所有服务
./service.sh status     # 查看服务状态
./service.sh logs       # 查看所有日志
./service.sh logs backend  # 查看后端日志
./service.sh health     # 健康检查
./service.sh backup     # 备份数据库
./service.sh update     # 更新并重启服务
```

### backup.sh — 数据备份

**作用**：备份数据库和上传文件

**执行内容**：
- 备份 PostgreSQL 数据库（gzip 压缩）
- 备份上传文件目录
- 清理 7 天前的备份

**定时备份**：
```bash
# 每天凌晨 2 点自动备份
echo "0 2 * * * /root/Echo/ops/deploy/scripts/backup.sh >> /root/Echo/logs/backup.log 2>&1" | crontab -
```

## 快速部署（全新服务器）

```bash
# 1. 上传脚本到服务器
scp -r ops/deploy/scripts/* root@你的IP:/root/

# 2. 服务器初始化
chmod +x /root/scripts/01-init-server.sh
/root/scripts/01-init-server.sh

# 3. 安装 Docker
chmod +x /root/scripts/02-install-docker.sh
/root/scripts/02-install-docker.sh

# 4. 安装 Nginx（需要域名已解析）
chmod +x /root/scripts/03-install-nginx.sh
/root/scripts/03-install-nginx.sh echo-im.cloud your-email@example.com

# 5. 部署项目
chmod +x /root/scripts/04-setup-project.sh
/root/scripts/04-setup-project.sh

# 6. 编辑环境变量
vim /root/Echo/backend/.env

# 7. 重启服务
cd /root/Echo && docker compose -f docker-compose.prod.yml restart
```

## 日常运维

```bash
# 查看服务状态
./service.sh status

# 查看日志
./service.sh logs backend

# 健康检查
./service.sh health

# 更新部署
./service.sh update

# 备份数据
./service.sh backup
```

## 常见问题

### Q: Docker 镜像拉取超时？
A: 配置镜像加速器，编辑 `/etc/docker/daemon.json`

### Q: Nginx 502 Bad Gateway？
A: 检查后端容器是否运行：`docker ps | grep echo-backend`

### Q: WebSocket 连接失败？
A: 检查 Nginx 的 WebSocket 转发配置，确保有 `Upgrade` 和 `Connection` 头

### Q: 数据库连接失败？
A: 检查 .env 文件中的 `DATABASE_URL` 配置，确保密码正确

### Q: 磁盘空间不足？
A: 清理 Docker 资源：`docker system prune -f`

## 简历描述

**项目名称**：Echo IM 自动化部署与运维平台

**项目描述**：
为 Echo IM 即时通讯项目设计并实现基于阿里云 ECS 的自动化部署与运维体系，实现从服务器初始化到应用部署的全流程自动化。

**技术栈**：
Shell、Docker、Docker Compose、Nginx、Let's Encrypt、PostgreSQL、Git

**核心工作**：
- 编写 Shell 脚本实现服务器初始化、Docker 安装、Nginx 配置的自动化
- 设计 Docker Compose 编排文件，实现 frontend、backend、PostgreSQL 三容器架构
- 配置 Nginx 反向代理，实现 HTTPS 加密和 WebSocket/WSS 转发
- 实现数据库自动备份、日志轮转、健康检查等运维功能
- 编写服务管理脚本，统一管理服务的启停、日志查看、故障排查

**项目成果**：
- 部署时间从 2 小时缩短到 15 分钟
- 实现 10+ 运维脚本的标准化管理
- 支持一键部署、一键备份、一键更新
