#!/bin/bash
# ============================================================
# Echo IM 服务管理脚本
#
# 作用：统一管理 Echo IM 所有服务的启停、重启、日志查看
#
# 使用方法：
#   ./service.sh start      # 启动所有服务
#   ./service.sh stop       # 停止所有服务
#   ./service.sh restart    # 重启所有服务
#   ./service.sh status     # 查看服务状态
#   ./service.sh logs       # 查看所有日志
#   ./service.sh logs backend  # 查看后端日志
#   ./service.sh health     # 健康检查
#   ./service.sh backup     # 备份数据库
#   ./service.sh update     # 更新并重启服务
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 项目配置
PROJECT_DIR="/root/Echo"
COMPOSE_FILE="docker-compose.prod.yml"
MONITORING_COMPOSE="/root/Echo/ops/monitoring/docker-compose.monitoring.yml"

# 辅助函数
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# ── 启动服务 ──
do_start() {
    log_step "启动 Echo IM 服务..."
    cd $PROJECT_DIR
    docker compose -f $COMPOSE_FILE up -d
    log_info "服务启动完成"
    do_status
}

# ── 停止服务 ──
do_stop() {
    log_step "停止 Echo IM 服务..."
    cd $PROJECT_DIR
    docker compose -f $COMPOSE_FILE down
    log_info "服务已停止"
}

# ── 重启服务 ──
do_restart() {
    log_step "重启 Echo IM 服务..."
    cd $PROJECT_DIR
    docker compose -f $COMPOSE_FILE restart
    log_info "服务重启完成"
    do_status
}

# ── 查看状态 ──
do_status() {
    log_step "服务状态："
    echo ""
    echo "=== Echo IM 业务服务 ==="
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E "(NAMES|echo-frontend|echo-backend|echo-db)"
    echo ""
    echo "=== 监控平台服务 ==="
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E "(NAMES|echo-prometheus|echo-grafana|echo-alertmanager|echo-node-exporter|echo-pg-exporter|echo-loki|echo-promtail)"
    echo ""
    echo "=== 端口占用 ==="
    ss -tlnp | grep -E ":(80|443|3000|5433|8080|9090|9091|9093|9100|9187|3100|9080)" | awk '{print $4, $6}' | column -t
}

# ── 查看日志 ──
do_logs() {
    local service=$1
    cd $PROJECT_DIR
    if [ -z "$service" ]; then
        docker compose -f $COMPOSE_FILE logs --tail=50 -f
    else
        docker compose -f $COMPOSE_FILE logs --tail=50 -f "echo-${service}"
    fi
}

# ── 健康检查 ──
do_health() {
    log_step "执行健康检查..."
    echo ""

    # 检查容器状态
    echo "=== 容器状态检查 ==="
    for container in echo-frontend-1 echo-backend-1 echo-db-1; do
        if docker ps --format '{{.Names}}' | grep -q "$container"; then
            log_info "$container 运行中"
        else
            log_error "$container 未运行"
        fi
    done

    echo ""
    echo "=== 端口检查 ==="
    for port in 8080 9090 5433; do
        if ss -tlnp | grep -q ":${port}"; then
            log_info "端口 ${port} 正常"
        else
            log_error "端口 ${port} 异常"
        fi
    done

    echo ""
    echo "=== 服务检查 ==="
    # 前端
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        log_info "前端服务正常 (HTTP $HTTP_CODE)"
    else
        log_warn "前端服务异常 (HTTP $HTTP_CODE)"
    fi

    # 后端
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/api/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        log_info "后端服务正常 (HTTP $HTTP_CODE)"
    else
        log_warn "后端服务异常 (HTTP $HTTP_CODE)"
    fi

    # 数据库
    if docker exec echo-db-1 pg_isready -U echo_user -d echo_db > /dev/null 2>&1; then
        log_info "PostgreSQL 正常"
    else
        log_error "PostgreSQL 异常"
    fi

    echo ""
    echo "=== 资源使用 ==="
    docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' \
        echo-frontend-1 echo-backend-1 echo-db-1 2>/dev/null || true

    echo ""
    echo "=== 磁盘使用 ==="
    df -h / | tail -1 | awk '{printf "根分区: %s 已用 / %s 总计 (%s)\n", $3, $2, $5}'
}

# ── 备份数据库 ──
do_backup() {
    log_step "备份 PostgreSQL 数据库..."
    BACKUP_DIR="$PROJECT_DIR/backups"
    mkdir -p $BACKUP_DIR
    BACKUP_FILE="$BACKUP_DIR/echo_db_$(date +%Y%m%d_%H%M%S).sql.gz"

    docker exec echo-db-1 pg_dump -U echo_user echo_db | gzip > "$BACKUP_FILE"
    log_info "备份完成：$BACKUP_FILE"
    log_info "备份大小：$(du -h $BACKUP_FILE | cut -f1)"

    # 清理 7 天前的备份
    find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
    log_info "已清理 7 天前的备份"
}

# ── 更新服务 ──
do_update() {
    log_step "更新 Echo IM 服务..."
    cd $PROJECT_DIR

    # 拉取最新代码
    log_info "拉取最新代码..."
    git stash 2>/dev/null || true
    git pull origin master

    # 重新构建并启动
    log_info "重新构建并启动服务..."
    docker compose -f $COMPOSE_FILE up -d --build

    log_info "更新完成"
    do_status
}

# ── 主入口 ──
case "${1:-help}" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_restart
        ;;
    status)
        do_status
        ;;
    logs)
        do_logs $2
        ;;
    health)
        do_health
        ;;
    backup)
        do_backup
        ;;
    update)
        do_update
        ;;
    help|*)
        echo "Echo IM 服务管理脚本"
        echo ""
        echo "用法：$0 <命令>"
        echo ""
        echo "命令："
        echo "  start     启动所有服务"
        echo "  stop      停止所有服务"
        echo "  restart   重启所有服务"
        echo "  status    查看服务状态"
        echo "  logs      查看日志（可指定服务名）"
        echo "  health    健康检查"
        echo "  backup    备份数据库"
        echo "  update    更新并重启服务"
        echo ""
        echo "示例："
        echo "  $0 start"
        echo "  $0 logs backend"
        echo "  $0 health"
        ;;
esac
