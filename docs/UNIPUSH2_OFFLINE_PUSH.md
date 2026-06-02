# Echo UniPush 2.0 离线推送接入

更新时间：2026-05-26

## 当前已完成

Echo 项目已经接好以下链路：

1. 5+App 登录后读取 `plus.push.getClientInfo().clientid`
2. 前端把 `clientId` 上传到后端 `/api/push/devices`
3. 后端新增 `PushDevice` 表，保存 `userId -> clientId`
4. 私聊/群聊发消息时，如果接收者不在线，后端会调用 `UNIPUSH_WEBHOOK_URL`
5. 通知 payload 中带 `chatId`，App 点击通知后进入对应聊天

## 为什么还需要云函数

UniPush 2.0 官方推荐的服务端发送方式是通过 uniCloud：

```js
uniCloud.getPushManager().sendMessage(...)
```

所以 Echo 自己的 ECS 后端不能只靠“DCloud 后台开通”就自动推送，需要一个 uniCloud HTTP 云函数作为桥：

```text
Echo 后端 -> uniCloud HTTP 云函数 -> UniPush 2.0 -> 手机通知栏
```

## 云函数示例

在 DCloud/uniCloud 里创建一个 HTTP 云函数，比如 `echo-send-push`。

```js
'use strict';

exports.main = async (event, context) => {
  const secret = process.env.ECHO_PUSH_SECRET;
  const headerSecret =
    event.headers?.['x-echo-push-secret'] ||
    event.headers?.['X-Echo-Push-Secret'];

  if (secret && headerSecret !== secret) {
    return { code: 401, message: 'unauthorized' };
  }

  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
  const { cids, title, content, payload } = body;

  if (!Array.isArray(cids) || cids.length === 0) {
    return { code: 400, message: 'empty cids' };
  }

  const pushManager = uniCloud.getPushManager({ appId: '__UNI__YOUR_APPID' });

  const result = await pushManager.sendMessage({
    push_clientid: cids,
    title: title || 'Echo',
    content: content || '你收到一条新消息',
    payload: payload || {},
    request_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    options: {
      android: {
        channel: 'default',
        sound: 'system'
      }
    }
  });

  return {
    code: 0,
    result
  };
};
```

把 `__UNI__YOUR_APPID` 替换成 DCloud 平台显示的 UniApp AppID。

## Echo 后端需要配置的环境变量

在 ECS `/root/Echo/backend/.env` 或 compose 环境变量里添加：

```env
UNIPUSH_WEBHOOK_URL=https://你的云函数HTTP地址
UNIPUSH_WEBHOOK_SECRET=你自己设置的一串密钥
```

`UNIPUSH_WEBHOOK_SECRET` 要和云函数里的 `ECHO_PUSH_SECRET` 一致。

## 测试步骤

1. 重新打包安装 5+App
2. 登录账号 A，让 App 成功上报 `clientId`
3. 账号 B 给账号 A 发消息
4. 如果 A 在线但 App 在后台：本地通知会弹
5. 如果 A 被系统杀掉或 socket 断开：后端会通过 UniPush 2.0 发离线通知

## 当前限制

- 如果云函数 URL 没配置，后端会跳过离线推送，不影响聊天。
- 如果 DCloud 厂商通道没配置，部分国产系统可能只能在 App 存活时收到，杀进程后不稳定。
- 上架级别的稳定通知，需要继续配置各厂商推送通道。
