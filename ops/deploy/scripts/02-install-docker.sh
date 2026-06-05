#!/bin/bash
# ============================================================
# Docker 安装脚本
#
# 作用：安装 Docker Engine 和 Docker Compose
# 适用：Alibaba Cloud Linux 3 / CentOS 7+ / Ubuntu 20+
#
# 执行内容：
#   1. 卸载旧版本 Docker（如果有）
#   2. 安装 Docker Engine
#   3. 安装 Docker Compose 插件
#   4. 配置 Docker 镜像加速器（国内必备）
#   5. 配置 Docker 日志轮转（防止日志撑爆磁盘）
#   6. 启动 Docker 并设置开机自启
#
# 使用方法：
#   chmod +x 02-install-docker.sh
#   sudo ./02-install-docker.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ "$EUID" -ne 0 ]; then
    log_error "请使用 root 用户运行此脚本"
    exit 1
fi

log_info "========== 开始安装 Docker =========="

# ── 1. 卸载旧版本 ──
# 为什么：避免旧版本冲突
log_info "卸载旧版本 Docker..."
yum remove -y docker docker-client docker-client-latest docker-common \
    docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true

# ── 2. 安装依赖 ──
log_info "安装依赖包..."
yum install -y yum-utils device-mapper-persistent-data lvm2

# ── 3. 添加 Docker 官方仓库 ──
# 为什么：官方仓库版本最新、最稳定
log_info "添加 Docker 官方仓库..."
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# ── 4. 安装 Docker Engine ──
log_info "安装 Docker Engine..."
yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# ── 5. 配置镜像加速器 ──
# 为什么：国内访问 Docker Hub 极慢，必须用镜像
log_info "配置 Docker 镜像加速器..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF
log_info "镜像加速器配置完成"

# ── 6. 启动 Docker ──
log_info "启动 Docker 服务..."
systemctl daemon-reload
systemctl enable docker
systemctl start docker

# ── 7. 验证安装 ──
log_info "验证 Docker 安装..."
docker --version
docker compose version

log_info "========== Docker 安装完成 =========="
log_info "Docker 版本：$(docker --version)"
log_info "Compose 版本：$(docker compose version)"
