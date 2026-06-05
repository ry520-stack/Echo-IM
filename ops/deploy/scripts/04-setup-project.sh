#!/bin/bash
# ============================================================
# 项目部署脚本
#
# 作用：拉取代码、配置环境变量、启动服务
# 适用：首次部署或重新部署 Echo IM 项目
#
# 执行内容：
#   1. 克隆或更新项目代码
#   2. 生成 .env 环境变量文件（如不存在）
#   3. 创建必要目录（uploads、logs）
#   4. 使用 Docker Compose 构建并启动服务
#   5. 等待服务就绪并进行健康检查
#
# 使用方法：
#   chmod +x 04-setup-project.sh
#   sudo ./04-setup-project.sh
#
# 前置条件：
#   - Docker 和 Docker Compose 已安装
#   - Git 已安装
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

# 配置变量
PROJECT_DIR="/root/Echo"
REPO_URL="https://github.com/ry520-stack/Echo-IM.git"

log_info "========== 开始部署 Echo IM =========="

# ── 1. 克隆或更新代码 ──
# 为什么：首次部署克隆，后续部署 pull 更新
if [ -d "$PROJECT_DIR/.git" ]; then
    log_info "项目已存在，拉取最新代码..."
    cd $PROJECT_DIR
    git stash 2>/dev/null || true
    git pull origin master
    log_info "代码更新完成"
else
    log_info "克隆项目代码..."
    git clone $REPO_URL $PROJECT_DIR
    cd $PROJECT_DIR
    log_info "代码克隆完成"
fi

# ── 2. 生成 .env 文件 ──
# 为什么：环境变量不能写死在代码里，必须从 .env 读取
ENV_FILE="$PROJECT_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    log_info "生成 .env 环境变量文件..."
    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -base64 16)

    cat > "$ENV_FILE" << EOF
# ============================================================
# Echo IM 环境变量配置
# 生成时间：$(date '+%Y-%m-%d %H:%M:%S')
# ============================================================

# 数据库配置
DATABASE_URL=postgresql://echo_user:${DB_PASSWORD}@db:5432/echo_db
DB_USER=echo_user
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=echo_db

# JWT 配置
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# 服务端口
PORT=3001

# 前端地址（用于 CORS）
FRONTEND_URL=https://echo-im.cloud

# 邮件配置（可选）
RESEND_API_KEY=
SMTP_USER=
SMTP_PASS=
QQ_SMTP_USER=
QQ_SMTP_PASS=

# 推送配置（可选）
UNIPUSH_WEBHOOK_URL=
UNIPUSH_WEBHOOK_SECRET=
OFFLINE_PUSH_ENABLED=false

# 地图服务（可选）
AMAP_WEB_SERVICE_KEY=
EOF
    log_warn "请编辑 $ENV_FILE 填入实际配置"
    log_warn "特别注意：DB_PASSWORD、JWT_SECRET 已自动生成"
else
    log_info ".env 文件已存在，跳过生成"
fi

# ── 3. 创建必要目录 ──
# 为什么：Docker 挂载需要宿主机目录存在
log_info "创建必要目录..."
mkdir -p $PROJECT_DIR/uploads
mkdir -p $PROJECT_DIR/logs
mkdir -p $PROJECT_DIR/backend/uploads
chmod 755 $PROJECT_DIR/uploads

# ── 4. 启动服务 ──
# 为什么用 docker-compose.prod.yml：生产环境配置，包含健康检查和重启策略
log_info "启动 Docker 服务..."
cd $PROJECT_DIR
docker compose -f docker-compose.prod.yml up -d --build

# ── 5. 等待服务就绪 ──
log_info "等待服务就绪..."
sleep 10

# ── 6. 健康检查 ──
log_info "执行健康检查..."
echo ""
echo "=== 容器状态 ==="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep echo-

echo ""
echo "=== 服务端口检查 ==="
for port in 8080 9090 5433; do
    if ss -tlnp | grep -q ":${port}"; then
        log_info "端口 ${port} 正常监听"
    else
        log_error "端口 ${port} 未监听"
    fi
done

echo ""
echo "=== 应用检查 ==="
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200"; then
    log_info "前端服务正常"
else
    log_warn "前端服务异常，请检查日志"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/api/health 2>/dev/null | grep -q "200"; then
    log_info "后端服务正常"
else
    log_warn "后端服务异常，请检查日志"
fi

log_info "========== Echo IM 部署完成 =========="
log_info "前端地址：http://localhost:8080"
log_info "后端地址：http://localhost:9090"
log_info "数据库地址：localhost:5433"
