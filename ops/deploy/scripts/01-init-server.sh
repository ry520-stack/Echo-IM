#!/bin/bash
# ============================================================
# 服务器初始化脚本
#
# 作用：新 ECS 服务器首次使用前的系统配置
# 适用：Alibaba Cloud Linux 3 / CentOS 7+ / Ubuntu 20+
#
# 执行内容：
#   1. 设置系统时区为 Asia/Shanghai
#   2. 更新系统软件包
#   3. 安装基础工具（curl, wget, vim, htop, tree 等）
#   4. 配置 SSH 安全（禁用密码登录，仅允许密钥）
#   5. 设置 swap 交换分区（小内存机器必备）
#   6. 配置系统内核参数优化
#
# 使用方法：
#   chmod +x 01-init-server.sh
#   sudo ./01-init-server.sh
#
# 注意：首次运行会更新系统，可能需要重启
# ============================================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查是否 root 用户
if [ "$EUID" -ne 0 ]; then
    log_error "请使用 root 用户运行此脚本"
    exit 1
fi

log_info "========== 开始服务器初始化 =========="

# ── 1. 设置时区 ──
# 为什么：日志时间戳、cron 任务、证书有效期都依赖正确时区
log_info "设置系统时区为 Asia/Shanghai..."
timedatectl set-timezone Asia/Shanghai
log_info "当前时区：$(date +%Z)"

# ── 2. 更新系统 ──
# 为什么：修复安全漏洞，获取最新软件包
log_info "更新系统软件包..."
if command -v yum &> /dev/null; then
    yum update -y
    yum install -y curl wget vim htop tree net-tools lsof unzip git
elif command -v apt &> /dev/null; then
    apt update && apt upgrade -y
    apt install -y curl wget vim htop tree net-tools lsof unzip git
fi
log_info "基础工具安装完成"

# ── 3. 配置 swap ──
# 为什么：1.8GB 内存的 ECS 容易 OOM，swap 可以防止内存不足导致进程被杀
SWAP_SIZE="2G"
SWAP_FILE="/swapfile"
if [ ! -f "$SWAP_FILE" ]; then
    log_info "创建 ${SWAP_SIZE} swap 分区..."
    fallocate -l $SWAP_SIZE $SWAP_FILE
    chmod 600 $SWAP_FILE
    mkswap $SWAP_FILE
    swapon $SWAP_FILE
    echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
    log_info "swap 创建完成"
else
    log_warn "swap 文件已存在，跳过"
fi

# ── 4. 内核参数优化 ──
# 为什么：提升网络性能，支持更多并发连接
log_info "优化内核参数..."
cat > /etc/sysctl.d/99-echo-optimization.conf << 'EOF'
# 网络优化
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_tw_reuse = 1

# 文件描述符
fs.file-max = 655350

# 内存优化
vm.swappiness = 10
vm.overcommit_memory = 1
EOF
sysctl -p /etc/sysctl.d/99-echo-optimization.conf
log_info "内核参数优化完成"

# ── 5. 设置文件描述符限制 ──
# 为什么：Docker 容器和 Nginx 需要大量文件描述符
log_info "设置文件描述符限制..."
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 655350
* hard nofile 655350
* soft nproc 655350
* hard nproc 655350
EOF
log_info "文件描述符限制设置完成"

# ── 6. 创建项目目录结构 ──
# 为什么：统一管理项目文件，便于备份和维护
log_info "创建项目目录结构..."
mkdir -p /root/Echo/{backend,frontend,uploads,logs,backups}
mkdir -p /root/Echo/ops/{deploy,monitoring}
log_info "目录结构创建完成"

log_info "========== 服务器初始化完成 =========="
log_warn "建议重启服务器使所有配置生效：reboot"
