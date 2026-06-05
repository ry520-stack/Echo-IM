#!/bin/bash
# ============================================================
# Echo IM 数据备份脚本
#
# 作用：备份 PostgreSQL 数据库和上传文件
#
# 执行内容：
#   1. 备份 PostgreSQL 数据库（压缩）
#   2. 备份上传文件目录
#   3. 清理过期备份（默认保留 7 天）
#   4. 显示备份统计信息
#
# 使用方法：
#   chmod +x backup.sh
#   ./backup.sh
#
# 定时备份（每天凌晨 2 点）：
#   echo "0 2 * * * /root/Echo/ops/deploy/scripts/backup.sh >> /root/Echo/logs/backup.log 2>&1" | crontab -
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 配置
PROJECT_DIR="/root/Echo"
BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS=7

mkdir -p $BACKUP_DIR

log_info "========== 开始备份 =========="
log_info "备份时间：$(date '+%Y-%m-%d %H:%M:%S')"

# ── 1. 备份数据库 ──
DB_BACKUP="$BACKUP_DIR/echo_db_$(date +%Y%m%d_%H%M%S).sql.gz"
log_info "备份数据库..."
docker exec echo-db-1 pg_dump -U echo_user echo_db | gzip > "$DB_BACKUP"
log_info "数据库备份完成：$(du -h $DB_BACKUP | cut -f1)"

# ── 2. 备份上传文件 ──
UPLOADS_BACKUP="$BACKUP_DIR/uploads_$(date +%Y%m%d_%H%M%S).tar.gz"
if [ -d "$PROJECT_DIR/uploads" ] && [ "$(ls -A $PROJECT_DIR/uploads 2>/dev/null)" ]; then
    log_info "备份上传文件..."
    tar -czf "$UPLOADS_BACKUP" -C $PROJECT_DIR uploads/
    log_info "上传文件备份完成：$(du -h $UPLOADS_BACKUP | cut -f1)"
else
    log_warn "上传目录为空，跳过备份"
fi

# ── 3. 清理过期备份 ──
log_info "清理 ${RETENTION_DAYS} 天前的备份..."
DELETED=$(find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
DELETED=$((DELETED + $(find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)))
log_info "已清理 ${DELETED} 个过期备份"

# ── 4. 显示备份统计 ──
echo ""
log_info "========== 备份统计 =========="
echo "备份目录：$BACKUP_DIR"
echo "备份文件数：$(ls -1 $BACKUP_DIR | wc -l)"
echo "备份总大小：$(du -sh $BACKUP_DIR | cut -f1)"
echo ""
echo "最近备份："
ls -lh $BACKUP_DIR | tail -5
