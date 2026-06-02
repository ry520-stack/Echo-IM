import prisma from '../utils/prisma';

interface RegisterDeviceInput {
  userId: string;
  clientId: string;
  platform?: string;
  appId?: string;
}

interface PushMessageInput {
  userIds: string[];
  title: string;
  body: string;
  payload: Record<string, unknown>;
}

export async function registerDevice(input: RegisterDeviceInput) {
  const clientId = input.clientId.trim();
  if (!clientId) throw new Error('clientId 不能为空');

  return prisma.pushDevice.upsert({
    where: { clientId },
    create: {
      userId: input.userId,
      clientId,
      platform: input.platform || 'android',
      appId: input.appId || '',
      enabled: true,
    },
    update: {
      userId: input.userId,
      platform: input.platform || 'android',
      appId: input.appId || '',
      enabled: true,
    },
  });
}

export async function unregisterDevice(userId: string, clientId: string) {
  await prisma.pushDevice.updateMany({
    where: { userId, clientId },
    data: { enabled: false },
  });
}

export async function pushToUsers(input: PushMessageInput) {
  if (process.env.OFFLINE_PUSH_ENABLED !== 'true') {
    return { skipped: true, reason: 'offline push disabled' };
  }
  const webhookUrl = process.env.UNIPUSH_WEBHOOK_URL;
  if (!webhookUrl) return { skipped: true, reason: 'UNIPUSH_WEBHOOK_URL not configured' };

  const userIds = [...new Set(input.userIds)].filter(Boolean);
  if (userIds.length === 0) return { skipped: true, reason: 'empty userIds' };

  const devices = await prisma.pushDevice.findMany({
    where: { userId: { in: userIds }, enabled: true },
    select: { clientId: true },
  });
  const cids = [...new Set(devices.map(d => d.clientId).filter(Boolean))];
  if (cids.length === 0) return { skipped: true, reason: 'no devices' };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.UNIPUSH_WEBHOOK_SECRET
          ? { 'X-Echo-Push-Secret': process.env.UNIPUSH_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        cids,
        title: input.title,
        content: input.body,
        payload: input.payload,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[UniPush webhook failed]', res.status, text.slice(0, 300));
      return { ok: false, status: res.status };
    }

    return { ok: true, count: cids.length };
  } catch (err) {
    console.error('[UniPush webhook error]', err);
    return { ok: false };
  }
}
