# Echo IM 项目记忆

最后更新：2026-06-13

## 用户核心诉求

- Echo IM 是移动端即时通讯 + 关系空间项目。
- 当前重点是把“情侣休闲小屋 / 情侣生活模拟 / 家园装修经营”融入 Echo 情侣空间。
- 参考方向：
  - “我的休闲时光”类型：小屋装修、家具商城、舒适度、做饭、宠物、任务、订单、打工、科技树、神秘商店、爱情银行。
  - “梦想城镇”类型：农场种植、作物、订单、建筑、加工、城镇经营、长期养成。
- 用户已购买素材包，有使用权：
  - `D:\临时\《咖啡物语》模拟经营餐厅类手游 餐具 食物 家具 桌椅 音效_爱给网_aigei_com (1).zip`
  - `D:\临时\农场养成类手游全套素材_爱给网_aigei_com.rar`
- 产品只给用户和女朋友使用，但开发仍尽量保持原创命名和 UI，不直接复制第三方游戏名称、文案和受保护设计。

## 本机与项目路径

- Windows 工作目录：`D:\DevelopAPP`
- Echo 项目仓库：`D:\DevelopAPP`
- GitHub：`https://github.com/ry520-stack/Echo-IM`
- 当前分支：`master`
- 另有未跟踪目录：`D:\DevelopAPP\echo-unicloud\`，目前不要动。

## ECS 服务器

- ECS IP：`8.140.194.214`
- SSH：`root@8.140.194.214`
- SSH key：`$HOME\.ssh\echo_deploy`
- 服务器项目目录：`/root/Echo`
- Docker Compose 文件：`/root/Echo/docker-compose.prod.yml`
- 服务：
  - frontend：`echo-frontend-1`，端口 `8080 -> 80`
  - backend：`echo-backend-1`，端口 `9090 -> 3001`
  - db：`echo-db-1`，PostgreSQL，端口 `5433 -> 5432`
- 健康检查：`http://8.140.194.214:9090/api/health`
- 前端：`http://8.140.194.214:8080`

## 常用部署命令

在 `D:\DevelopAPP` 执行：

```powershell
git archive --format=tar HEAD -o echo-deploy.tar
scp -i $HOME\.ssh\echo_deploy echo-deploy.tar root@8.140.194.214:/root/echo-deploy.tar
ssh -i $HOME\.ssh\echo_deploy root@8.140.194.214 "set -e; tar -xf /root/echo-deploy.tar -C /root/Echo; cd /root/Echo; docker compose -f docker-compose.prod.yml up -d --build; docker compose -f docker-compose.prod.yml ps"
```

如果 Docker 重建中偶发 `No such container`，通常重跑：

```powershell
ssh -i $HOME\.ssh\echo_deploy root@8.140.194.214 "cd /root/Echo && docker compose -f docker-compose.prod.yml up -d && docker compose -f docker-compose.prod.yml ps"
```

GitHub 推送如需要代理：

```powershell
$env:HTTP_PROXY='http://192.168.217.171:8080'
$env:HTTPS_PROXY='http://192.168.217.171:8080'
git push origin master
```

## 已完成的情侣小屋基础

后端已有并挂载：

- `/api/leisure-home`
- `/api/furniture`
- `/api/game-wallet`
- `/api/game-inventory`

已实现：

- `GameWallet` 钱包
- `GameCoinTransaction` 金币流水
- `CoupleLeisureHome` 小屋
- `FurnitureCatalog` 家具配置
- `UserFurnitureInventory` 家具库存
- `HomePlacedFurniture` 摆放家具
- `GameInventoryItem` 通用游戏背包
- 每日签到：`POST /api/game-wallet/signin`
- 小屋升级：`POST /api/leisure-home/upgrade`
- 家具商城购买，购买扣金币并写流水
- 小屋装修保存，校验边界、重叠、拥有数量、摆放上限

前端页面：

- `frontend/src/pages/couple/LeisureHomePage.tsx`
- `frontend/src/pages/couple/HomeDecoratePage.tsx`
- `frontend/src/pages/couple/FurnitureShopPage.tsx`
- `frontend/src/pages/couple/GameInventoryPage.tsx`
- `frontend/src/pages/couple/CookingPage.tsx`
- `frontend/src/pages/couple/GardenPage.tsx`
- `frontend/src/pages/couple/WorkOrderPage.tsx`

路由：

- `/couple/leisure-home`
- `/couple/leisure-home/decorate`
- `/couple/leisure-home/shop`
- `/couple/leisure-home/inventory`
- `/couple/leisure-home/cooking`
- `/couple/leisure-home/garden`
- `/couple/leisure-home/work`

## 已接入素材

已从咖啡物语素材包抽取一批 PNG 到：

- `frontend/public/leisure/cafe/assets/bg/...`
- `frontend/public/leisure/cafe/assets/deco/...`

当前用途：

- 小屋画布背景：`/leisure/cafe/assets/bg/day/BG_D01.png`
- 家具商城和小屋摆放优先使用 `FurnitureCatalog.imageUrl`
- `backend/src/services/leisureSeed.service.ts` 已扩展咖啡圆桌、餐椅、柜台、甜品柜、咖啡机、绿植、沙发椅、收银台、料理台等种子家具

农场素材包：

- 路径：`D:\临时\农场养成类手游全套素材_爱给网_aigei_com.rar`
- 当前环境可用 `tar -tf` 读取目录，但没有独立 `7z/rar/unrar` 命令。
- 后续应分批抽取农田、作物、建筑、订单 UI、仓库图标素材，避免一次性把 500MB 全塞进仓库。

## 当前阶段进度

阶段 1：代码审查和方案落地，已完成。

阶段 2：数据库和基础服务，已完成主要基础：

- Prisma 模型已存在
- 钱包、流水、情侣关系校验、小屋初始化已接
- seed 家具数据已接

阶段 3：情侣小屋和家具，进行中：

- 已有商城、背包、装修、摆放、升级
- 需要继续做：
  - 装修页拖拽摆放，而不是按钮上下左右
  - 家具商城筛选更细：推荐、桌椅、厨房、装饰、植物、限定、稀有度
  - 家具详情页
  - 小屋等级扩建更明显
  - 小屋场景更像游戏，而不是普通卡片

阶段 4 以后：

- 做饭：当前是前端 MVP，本地倒计时，还没接后端背包和金币流水
- 种植：当前是前端 MVP，本地地块和倒计时，还没接后端 GardenPlot
- 打工订单：当前是前端 MVP，本地倒计时和提示，还没接后端 WorkJob / Order
- 爱情银行、科技树、神秘商店未正式实现

## 下一步建议

1. 把做饭、种植、打工订单从本地 MVP 改成后端模型和接口。
2. 抽取农场素材包中小批量作物/建筑/农田图片，接入种植和城镇页。
3. 新增“情侣城镇”页，作为梦想城镇类玩法入口：
   - 农田
   - 工坊
   - 订单板
   - 仓库
   - 建筑商店
   - 城镇等级
4. 装修页改成移动端拖拽网格。
5. 做统一游戏货币展示，不要宠物金币和小屋金币让用户混淆。
6. 对 ECS 做一次资源评估：镜像大小、磁盘、内存、Postgres 数据量、上传文件目录。

## 注意事项

- 不要删除用户数据，尤其是情侣相册、聊天记录、好友关系。
- 不要动未跟踪 `echo-unicloud/`。
- 文件编辑优先用 `apply_patch`。
- 构建命令：
  - 前端：`cd frontend && npm run build`
  - 后端：`cd backend && npm run build`
- 部署前最好提交 Git。
- 如果用户让“读记忆文件”，先读本文件再继续。
