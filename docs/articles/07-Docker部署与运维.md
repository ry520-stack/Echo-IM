# Echo 篇 7：Docker 部署与运维

## 三容器架构

```yaml
# docker-compose.prod.yml
services:
  db:
    image: postgres:16-alpine
    ports: ["5433:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: "pg_isready -U echo_user -d echo_db" }

  backend:
    build: ./backend
    ports: ["9090:3001"]
    depends_on: { db: { condition: service_healthy } }

  frontend:
    build: ./frontend
    ports: ["8080:80"]
    depends_on: [backend]
```

## Nginx 反向代理

```nginx
location /api/ { proxy_pass http://backend:3001; }
location /socket.io/ { proxy_pass http://backend:3001; proxy_set_header Upgrade $http_upgrade; }
location /uploads/ { proxy_pass http://backend:3001; }
location / { try_files $uri $uri/ /index.html; add_header Cache-Control "no-cache"; }
```

## 部署命令

```bash
# 本地打包（排除 node_modules, .git, dist, uploads）
tar -czf Echo.tar.gz .

# 上传 ECS
scp -i ~/.ssh/win_key Echo.tar.gz root@8.140.194.214:~/

# ECS 上部署
tar -xzf Echo.tar.gz -C ~/Echo
cat > ~/Echo/.env << EOF
DB_USER=your_db_user DB_PASSWORD=your_db_password DB_NAME=your_db_name
JWT_SECRET=your_jwt_secret JWT_EXPIRES_IN=7d
SMTP_USER=your_email@example.com SMTP_PASS=your_email_password
EOF
cd ~/Echo && docker compose -f docker-compose.prod.yml up -d --build
```

## 环境变量管理

- `DB_USER/PASSWORD/NAME`: 数据库配置
- `JWT_SECRET`: JWT 签名密钥
- `SMTP_USER/PASS`: Gmail/QQ 邮箱（邮件验证码）
- `RESEND_API_KEY`: 可选 Resend 邮件服务
- `.env` 不入 Git（`.gitignore` 已配置）

## Docker 常见问题

**构建缓存导致代码不更新**：`docker compose build --no-cache frontend`

**数据库迁移**：Dockerfile 中 `CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]`，每次启动自动同步 schema。

**磁盘清理**：`docker image prune -f` 清除旧镜像。

## 本地开发

```bash
# 后端
cd backend && npm install && npx prisma db push && npm run dev

# 前端
cd frontend && npm install && npm run dev
```

前端运行在 `localhost:5173`，后端在 `localhost:3001`。

## 运维备忘

- ECS IP: `8.140.194.214`（未绑 EIP，重启会变）
- SSH: `ssh -i ~/.ssh/win_key root@8.140.194.214`
- 安全组已开放端口: 22, 80, 3001, 8080, 9090
- 数据库数据持久化在 Docker volume `pgdata`

---

> 全系列完。
> Echo IM GitHub: https://github.com/ry520-stack/Echo-IM
> 开发者: ry520-stack
