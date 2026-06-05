#!/bin/bash
# ============================================================
# Nginx 安装与配置脚本
#
# 作用：安装 Nginx 并配置反向代理
# 适用：Alibaba Cloud Linux 3 / CentOS 7+ / Ubuntu 20+
#
# 执行内容：
#   1. 安装 Nginx
#   2. 配置反向代理（HTTP → HTTPS 重定向）
#   3. 配置 WebSocket/WSS 转发（Socket.IO 必需）
#   4. 配置 SSL 证书（Let's Encrypt）
#   5. 设置 Nginx 日志轮转
#   6. 启动 Nginx 并设置开机自启
#
# 使用方法：
#   chmod +x 03-install-nginx.sh
#   sudo ./03-install-nginx.sh
#
# 前置条件：
#   - 域名已解析到服务器 IP
#   - 端口 80/443 已开放
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

# 配置变量（根据实际情况修改）
DOMAIN="${1:-echo-im.cloud}"
EMAIL="${2:-admin@echo-im.cloud}"
FRONTEND_PORT=8080
BACKEND_PORT=9090

log_info "========== 开始安装 Nginx =========="
log_info "域名：$DOMAIN"

# ── 1. 安装 Nginx ──
log_info "安装 Nginx..."
if command -v yum &> /dev/null; then
    yum install -y nginx
elif command -v apt &> /dev/null; then
    apt install -y nginx
fi

# ── 2. 安装 Certbot（Let's Encrypt 证书工具） ──
# 为什么用 Let's Encrypt：免费、自动续期、行业标准
log_info "安装 Certbot..."
if command -v yum &> /dev/null; then
    yum install -y epel-release
    yum install -y certbot python3-certbot-nginx
elif command -v apt &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
fi

# ── 3. 配置 Nginx 反向代理 ──
# 为什么需要反向代理：
#   - 统一入口，一个域名对外
#   - HTTPS 终止在 Nginx 层
#   - WebSocket 升级转发
#   - 静态文件缓存
log_info "配置 Nginx 反向代理..."
cat > /etc/nginx/conf.d/${DOMAIN}.conf << EOF
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\${domain}\$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl;
    server_name ${DOMAIN};
    client_max_body_size 100m;

    # SSL 证书（Certbot 会自动配置）
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # 前端静态文件
    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # WebSocket 转发（Socket.IO 必需）
    # 为什么单独配置：WebSocket 需要 HTTP/1.1 升级头
    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # API 接口
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
log_info "Nginx 配置完成"

# ── 4. 申请 SSL 证书 ──
# 为什么用 Let's Encrypt：免费、自动续期、浏览器信任
log_info "申请 SSL 证书..."
systemctl start nginx
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL || {
    log_warn "证书申请失败，可能需要先配置 DNS 解析"
    log_warn "请确保 ${DOMAIN} 已解析到本服务器 IP"
}

# ── 5. 配置证书自动续期 ──
# 为什么：Let's Encrypt 证书有效期 90 天，必须自动续期
log_info "配置证书自动续期..."
echo "0 3 * * * certbot renew --quiet && systemctl reload nginx" | crontab -
log_info "证书自动续期已配置（每天凌晨 3 点检查）"

# ── 6. 启动 Nginx ──
log_info "启动 Nginx..."
systemctl enable nginx
systemctl restart nginx

log_info "========== Nginx 安装完成 =========="
log_info "访问地址：https://${DOMAIN}"
