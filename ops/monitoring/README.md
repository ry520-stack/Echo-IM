# Echo IM 监控平台

基于 Docker Compose 的服务监控与日志告警平台，为 Echo IM 即时通讯项目提供全方位的运维监控能力。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Echo IM 监控平台                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Grafana    │    │  Prometheus  │    │ Alertmanager │  │
│  │  :3000       │◄───│  :9091       │───►│  :9093       │  │
│  │  可视化仪表盘 │    │  指标采集存储  │    │  告警路由通知  │  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘  │
│         ▲                   │                               │
│         │                   ▼                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    Loki      │    │ Node Exporter│    │   cAdvisor   │  │
│  │  :3100       │    │  :9100       │    │  :8085       │  │
│  │  日志聚合存储  │    │  主机指标采集  │    │  容器指标采集  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         ▲                                                   │
│         │                                                   │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │  Promtail    │    │ pg-exporter  │                      │
│  │  :9080       │    │  :9187       │                      │
│  │  日志采集代理  │    │ 数据库指标采集 │                      │
│  └──────────────┘    └──────────────┘                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    Echo IM 业务层                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Frontend    │    │   Backend    │    │  PostgreSQL  │  │
│  │  :8080       │    │  :9090       │    │  :5433       │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 组件说明

| 组件 | 作用 | 端口 | 内存占用 |
|------|------|------|---------|
| **Prometheus** | 时序数据库 + 指标采集引擎，Pull 模型采集各 Exporter | 9091 | ~200MB |
| **Grafana** | 可视化仪表盘，支持 Prometheus/Loki 多数据源 | 3000 | ~80MB |
| **Alertmanager** | 告警路由与通知，接收 Prometheus 告警并发送通知 | 9093 | ~30MB |
| **Node Exporter** | Linux 主机指标采集（CPU/内存/磁盘/网络） | 9100 | ~15MB |
| **cAdvisor** | Docker 容器指标采集（容器 CPU/内存/网络/IO） | 8085 | ~30MB |
| **PostgreSQL Exporter** | 数据库指标采集（连接数/查询性能/缓存命中率） | 9187 | ~10MB |
| **Loki** | 日志聚合存储，类似 Prometheus 但用于日志 | 3100 | ~100MB |
| **Promtail** | 日志采集代理，采集 Nginx/Docker/系统日志 | 9080 | ~30MB |

## 监控指标

### 主机指标（Node Exporter）
- CPU 使用率（整体 + 每核心）
- 内存使用率（已用/可用/缓存）
- 磁盘空间（根分区使用率）
- 磁盘 IO（读写速率）
- 网络流量（入站/出站）
- 系统负载（1/5/15 分钟）

### 容器指标（cAdvisor）
- 每个容器的 CPU 使用率
- 每个容器的内存使用量
- 每个容器的网络收发流量
- 容器运行状态和重启次数

### 数据库指标（PostgreSQL Exporter）
- 当前连接数
- 数据库大小
- 缓存命中率
- 事务提交/回滚速率

### 日志采集（Promtail + Loki）
- Docker 容器日志（stdout/stderr）
- Nginx 访问日志
- Nginx 错误日志
- 系统日志

## 告警规则

| 告警名称 | 条件 | 等级 | 说明 |
|---------|------|------|------|
| HighCpuUsage | CPU > 85% 持续 5m | warning | CPU 过载 |
| HighMemoryUsage | 内存 > 90% 持续 5m | warning | 内存紧张 |
| DiskSpaceLow | 根分区 < 20% | warning | 磁盘预警 |
| DiskSpaceCritical | 根分区 < 10% | critical | 磁盘危险 |
| HostDown | Node Exporter 无响应 1m | critical | 主机宕机 |
| EchoContainerDown | Echo 容器停止 1m | critical | 业务中断 |
| ContainerHighCpu | 容器 CPU > 80% | warning | 容器过载 |
| ContainerRestartLoop | 5m 内重启 > 2 次 | warning | 容器异常 |
| PostgresqlHighConnections | 连接数 > 80 | warning | 连接池紧张 |
| PostgresqlExporterDown | Exporter 无响应 2m | critical | 数据库监控中断 |

## 快速部署

### 前置条件
- Docker 20.10+ 和 Docker Compose v2
- Echo IM 业务容器已运行
- 确保 `echo_default` Docker 网络存在

### 部署步骤

```bash
# 1. 进入监控目录
cd /root/Echo/ops/monitoring

# 2. 创建环境变量文件并修改密码/数据库连接
cp .env.example .env
vim .env

# 3. 创建 Docker 网络（如果不存在）
docker network ls | grep echo_default || echo "echo_default 网络不存在"

# 4. 拉取所有镜像
docker compose -f docker-compose.monitoring.yml pull

# 5. 启动监控栈
docker compose -f docker-compose.monitoring.yml up -d

# 6. 检查所有容器状态
docker compose -f docker-compose.monitoring.yml ps

# 7. 查看日志（如有问题）
docker compose -f docker-compose.monitoring.yml logs -f
```

### 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| Grafana | http://localhost:3000 | 登录：见 `.env` 中的 `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` |
| Prometheus | http://localhost:9091 | 指标查询界面 |
| Alertmanager | http://localhost:9093 | 告警管理界面 |
| cAdvisor | http://localhost:8085 | 容器详情界面 |
| Loki | http://localhost:3100 | 日志 API |

## 常用排查命令

```bash
# 查看所有监控容器状态
docker compose -f docker-compose.monitoring.yml ps

# 查看 Prometheus 采集目标状态
curl -s http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# 查看 Prometheus 告警规则
curl -s http://localhost:9091/api/v1/rules | jq '.data.groups[].rules[] | {name: .name, state: .state}'

# 查看 Grafana 数据源
curl -s http://localhost:3000/api/datasources -u "$GRAFANA_ADMIN_USER:$GRAFANA_ADMIN_PASSWORD"

# 查看 Loki 日志
curl -s "http://localhost:3100/loki/api/v1/query?query={job=~\".+\"}" | jq '.data.result[0].values[:5]'

# 重启单个服务
docker compose -f docker-compose.monitoring.yml restart prometheus

# 查看容器资源使用
docker stats --no-stream echo-prometheus echo-grafana echo-node-exporter

# 检查磁盘空间（监控数据会占用磁盘）
du -sh /var/lib/docker/volumes/monitoring_*

# 清理旧数据（如果磁盘紧张）
docker system prune -f
docker volume prune -f
```

## 目录结构

```
ops/monitoring/
├── docker-compose.monitoring.yml    # 监控栈 Compose 配置
├── prometheus/
│   ├── prometheus.yml               # Prometheus 采集配置
│   └── alert.rules.yml              # 告警规则
├── alertmanager/
│   └── alertmanager.yml             # 告警路由配置
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasources.yml      # 数据源自动配置
│   │   └── dashboards/
│   │       └── dashboards.yml       # Dashboard 导入配置
│   └── dashboards/
│       └── echo-monitoring.json     # 监控大盘 JSON
├── loki/
│   └── loki-config.yml              # Loki 配置
├── promtail/
│   └── promtail-config.yml          # Promtail 日志采集配置
└── README.md                        # 本文档
```

## 扩展建议

### 添加自定义告警
编辑 `prometheus/alert.rules.yml`，添加新的告警规则后重启 Prometheus：
```bash
docker compose -f docker-compose.monitoring.yml restart prometheus
```

### 添加钉钉/企微告警
编辑 `alertmanager/alertmanager.yml`，在 `webhook_configs` 中填入机器人 Webhook URL。

### 添加更多 Dashboard
在 Grafana 界面导入 Dashboard ID：
- Node Exporter Full: ID 1860
- Docker 容器监控: ID 893
- PostgreSQL 监控: ID 9628

## 简历描述

**项目名称**：Echo IM 云原生监控平台

**项目描述**：
为 Echo IM 即时通讯项目设计并实现基于 Docker Compose 的服务监控与日志告警平台，实现对 Linux 主机、Docker 容器、PostgreSQL 数据库的全方位监控。

**技术栈**：
Docker Compose、Prometheus、Grafana、Alertmanager、Node Exporter、cAdvisor、PostgreSQL Exporter、Loki、Promtail

**核心工作**：
- 使用 Prometheus + Exporter 采集主机 CPU/内存/磁盘/网络及容器资源指标
- 配置 Grafana Dashboard 实现监控数据可视化，包含主机概览、容器资源、数据库状态等多个面板
- 设计 Alertmanager 告警规则，实现服务宕机、资源过载、数据库异常等场景的自动告警
- 集成 Loki + Promtail 实现 Docker 容器日志、Nginx 访问日志的集中采集与查询
- 通过 Docker 网络隔离实现监控栈与业务栈的解耦，确保监控不影响业务稳定性

**项目成果**：
- 实现 15+ 监控指标的实时采集与可视化
- 配置 10+ 告警规则覆盖主机/容器/数据库等核心场景
- 日志采集覆盖所有 Docker 容器和 Nginx 访问日志
- 监控平台内存占用 < 500MB，适合小规格 ECS 部署
