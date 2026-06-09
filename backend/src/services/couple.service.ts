import prisma from '../utils/prisma';
import { getIO } from './socket.service';
import { pushToUsers } from './push.service';

const SOS_COOLDOWN_MS = 60 * 1000;
const UNBIND_LOCK_MS = 90 * 24 * 60 * 60 * 1000;

function pair(userId: string, peerId: string) {
  return userId < peerId ? { userAId: userId, userBId: peerId } : { userAId: peerId, userBId: userId };
}

function peerId(bond: any, userId: string) {
  return bond.userAId === userId ? bond.userBId : bond.userAId;
}

function notify(bond: any, action = 'updated') {
  getIO()?.to(`user:${bond.userAId}`).emit('couple:updated', { peerId: bond.userBId, action });
  getIO()?.to(`user:${bond.userBId}`).emit('couple:updated', { peerId: bond.userAId, action });
}

async function findMine(userId: string) {
  return prisma.coupleBond.findFirst({
    where: { status: { in: ['pending', 'active', 'pending-unbind'] }, OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { updatedAt: 'desc' },
  });
}

async function requireActiveBond(userId: string) {
  const bond = await findMine(userId);
  if (!bond || !['active', 'pending-unbind'].includes(bond.status)) throw new Error('情侣关系尚未生效');
  return bond;
}

async function requireFriend(userId: string, otherId: string) {
  const friend = await prisma.friend.findFirst({
    where: {
      status: 'accepted',
      deletedAt: null,
      blockedAt: null,
      OR: [
        { userId, friendId: otherId },
        { userId: otherId, friendId: userId },
      ],
    },
  });
  if (!friend) throw new Error('只有好友才能申请绑定情侣');
}

export async function getSummary(userId: string) {
  const bond = await findMine(userId);
  if (!bond) return { status: 'none' };

  const otherId = peerId(bond, userId);
  const mineIsA = bond.userAId === userId;
  const [peer, pet] = await Promise.all([
    prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, digitalId: true, username: true, nickname: true, avatar: true },
    }),
    prisma.petBond.findUnique({ where: { userAId_userBId: { userAId: bond.userAId, userBId: bond.userBId } } }).catch(() => null),
  ]);
  const bondedAt = (bond as any).bondedAt || (bond as any).boundAt;
  const unlockAt = bondedAt ? new Date(bondedAt.getTime() + UNBIND_LOCK_MS) : null;

  return {
    ...bond,
    peer,
    pendingForMe: bond.status === 'pending' && bond.requestedBy !== userId,
    unbindPending: bond.status === 'pending-unbind',
    unbindPendingForMe: bond.status === 'pending-unbind' && bond.requestedBy !== userId,
    bondedAt,
    myCityName: mineIsA ? ((bond as any).userACityName || (bond as any).userACity || '') : ((bond as any).userBCityName || (bond as any).userBCity || ''),
    peerCityName: mineIsA ? ((bond as any).userBCityName || (bond as any).userBCity || '') : ((bond as any).userACityName || (bond as any).userACity || ''),
    myWeather: null,
    peerWeather: null,
    pet,
    unlockAt,
    canUnbind: !!unlockAt && unlockAt.getTime() <= Date.now(),
  };
}

export const getMine = getSummary;

export async function requestBond(userId: string, otherId: string) {
  if (!otherId || otherId === userId) throw new Error('请选择正确的情侣对象');
  await requireFriend(userId, otherId);
  const occupied = await prisma.coupleBond.findFirst({
    where: {
      status: { in: ['pending', 'active'] },
      OR: [{ userAId: { in: [userId, otherId] } }, { userBId: { in: [userId, otherId] } }],
    },
  });
  if (occupied) throw new Error('你或对方已有待处理或生效中的情侣关系');
  const ids = pair(userId, otherId);
  const updateData: any = { requestedBy: userId, status: 'pending', endedAt: null };
  updateData.bondedAt = null;
  const bond = await prisma.coupleBond.upsert({
    where: { userAId_userBId: ids },
    create: { ...ids, requestedBy: userId },
    update: updateData,
  });
  notify(bond, 'request');
  return getSummary(userId);
}

export async function respond(userId: string, accept: boolean) {
  const bond = await findMine(userId);
  if (!bond || bond.status !== 'pending' || bond.requestedBy === userId) throw new Error('没有可处理的情侣请求');
  const acceptData: any = accept ? { status: 'active', bondedAt: new Date() } : { status: 'rejected', endedAt: new Date() };
  const updated = await prisma.coupleBond.update({
    where: { id: bond.id },
    data: acceptData,
  });
  notify(updated, accept ? 'accepted' : 'rejected');
  return accept ? getSummary(userId) : { status: 'none' };
}

export async function updateSettings(userId: string, data: any) {
  const bond = await requireActiveBond(userId);
  const mineIsA = bond.userAId === userId;
  const update: any = {};
  for (const key of ['metAt', 'datingAt', 'countdownAt']) {
    if (key in data) update[key] = data[key] ? new Date(data[key]) : null;
  }
  if ('loveAt' in data && !('datingAt' in data)) update.datingAt = data.loveAt ? new Date(data.loveAt) : null;
  if ('countdownTitle' in data) update.countdownTitle = String(data.countdownTitle || '').trim().slice(0, 30);
  if ('cityName' in data || 'city' in data) {
    const city = String(data.cityName || data.city || '').trim().slice(0, 40);
    update[mineIsA ? 'userACityName' : 'userBCityName'] = city;
    update[mineIsA ? 'userACityCode' : 'userBCityCode'] = city;
  }
  if ('myLabel' in data) update[mineIsA ? 'userALabel' : 'userBLabel'] = String(data.myLabel || '').slice(0, 12);
  if ('peerLabel' in data) update[mineIsA ? 'userBLabel' : 'userALabel'] = String(data.peerLabel || '').slice(0, 12);
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: update });
  notify(updated, 'settings');
  return getSummary(userId);
}

export const updateSpace = updateSettings;

export async function sendSos(userId: string) {
  const bond = await requireActiveBond(userId);
  if (bond.lastSosAt && Date.now() - bond.lastSosAt.getTime() < SOS_COOLDOWN_MS) {
    throw new Error('我想你了每 1 分钟最多发送一次');
  }
  const targetId = peerId(bond, userId);
  const sender = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true, username: true } });
  await prisma.coupleBond.update({ where: { id: bond.id }, data: { lastSosAt: new Date(), lastSosBy: userId } });
  const name = sender?.nickname || sender?.username || '对方';
  getIO()?.to(`user:${targetId}`).emit('couple:sos', { peerId: userId, message: `${name} 想你了` });
  pushToUsers({ userIds: [targetId], title: 'Echo 情侣空间', body: `${name} 想你了`, payload: { type: 'couple-sos', chatId: userId } }).catch(() => {});
  notify(bond, 'sos');
  return { ok: true };
}

export async function unbind(userId: string) {
  const bond = await requireActiveBond(userId);
  if (bond.status === 'pending-unbind') throw new Error('解绑请求正在等待对方处理');
  const bondedAt = (bond as any).bondedAt || (bond as any).boundAt;
  const unlockAt = bondedAt ? bondedAt.getTime() + UNBIND_LOCK_MS : Infinity;
  if (Date.now() < unlockAt) throw new Error(`绑定后 90 天内不可主动解除，解锁时间：${new Date(unlockAt).toLocaleString('zh-CN')}`);
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: { status: 'ended', endedAt: new Date() } as any });
  notify(updated, 'unbind');
  return { status: 'none' };
}

export async function forceUnbind(userId: string) {
  const bond = await requireActiveBond(userId);
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: { status: 'ended', endedAt: new Date() } as any });
  notify(updated, 'force-unbind');
  return { status: 'none' };
}

export async function requestUnbind(userId: string) {
  const bond = await requireActiveBond(userId);
  if (bond.status === 'pending-unbind') return getSummary(userId);
  const bondedAt = (bond as any).bondedAt || (bond as any).boundAt;
  const unlockAt = bondedAt ? bondedAt.getTime() + UNBIND_LOCK_MS : Infinity;
  if (Date.now() >= unlockAt) return unbind(userId);
  const updated = await prisma.coupleBond.update({
    where: { id: bond.id },
    data: { status: 'pending-unbind', requestedBy: userId },
  });
  const targetId = peerId(updated, userId);
  getIO()?.to(`user:${targetId}`).emit('couple:unbind-request', { peerId: userId });
  pushToUsers({
    userIds: [targetId],
    title: 'Echo 情侣空间',
    body: '对方申请解除情侣空间绑定',
    payload: { type: 'couple-unbind-request', chatId: userId },
  }).catch(() => {});
  notify(updated, 'unbind-request');
  return getSummary(userId);
}

export async function respondUnbind(userId: string, accept: boolean) {
  const bond = await findMine(userId);
  if (!bond || bond.status !== 'pending-unbind' || bond.requestedBy === userId) throw new Error('没有可处理的解绑请求');
  const updated = await prisma.coupleBond.update({
    where: { id: bond.id },
    data: accept ? ({ status: 'ended', endedAt: new Date() } as any) : { status: 'active' },
  });
  notify(updated, accept ? 'unbind-accepted' : 'unbind-rejected');
  return accept ? { status: 'none' } : getSummary(userId);
}

export async function getItems(userId: string, type: string) {
  const bond = await requireActiveBond(userId);
  return (prisma as any).coupleItem.findMany({
    where: { coupleId: bond.id, archived: false, ...(type ? { type } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createItem(userId: string, data: any) {
  const bond = await requireActiveBond(userId);
  const item = await (prisma as any).coupleItem.create({
    data: {
      coupleId: bond.id,
      createdBy: userId,
      type: String(data.type || 'note'),
      title: String(data.title || '').slice(0, 80),
      content: String(data.content || ''),
      images: JSON.stringify(data.images || []),
      cityName: String(data.cityName || data.location || ''),
      happenedAt: data.happenedAt || data.time ? new Date(data.happenedAt || data.time) : null,
    },
  });
  notify(bond, 'item');
  return item;
}

export async function updateItem(userId: string, id: string, data: any) {
  const bond = await requireActiveBond(userId);
  const item = await (prisma as any).coupleItem.findFirst({ where: { id, coupleId: bond.id } });
  if (!item) throw new Error('记录不存在');
  const updated = await (prisma as any).coupleItem.update({
    where: { id },
    data: {
      title: 'title' in data ? String(data.title || '').slice(0, 80) : undefined,
      content: 'content' in data ? String(data.content || '') : undefined,
      images: 'images' in data ? JSON.stringify(data.images || []) : undefined,
      cityName: 'cityName' in data || 'location' in data ? String(data.cityName || data.location || '') : undefined,
      happenedAt: 'happenedAt' in data || 'time' in data ? (data.happenedAt || data.time ? new Date(data.happenedAt || data.time) : null) : undefined,
      archived: 'archived' in data ? !!data.archived : undefined,
    },
  });
  notify(bond, 'item');
  return updated;
}

export async function archiveItem(userId: string, id: string) {
  return updateItem(userId, id, { archived: true });
}

export async function updateCycle(userId: string, data: any) {
  const bond = await requireActiveBond(userId);
  const mineIsA = bond.userAId === userId;
  const update: any = {};
  if ('periodStart' in data) update[mineIsA ? 'userAPeriodStart' : 'userBPeriodStart'] = data.periodStart ? new Date(data.periodStart) : null;
  if ('cycleLength' in data) update[mineIsA ? 'userACycleLength' : 'userBCycleLength'] = Number(data.cycleLength) || 28;
  if ('periodLength' in data) update[mineIsA ? 'userAPeriodLength' : 'userBPeriodLength'] = Number(data.periodLength) || 5;
  if ('shareWithPartner' in data) update[mineIsA ? 'userAShareCycle' : 'userBShareCycle'] = !!data.shareWithPartner;
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: update });
  notify(updated, 'cycle');
  return getSummary(userId);
}

export async function getContracts(userId: string) {
  const bond = await requireActiveBond(userId);
  return (prisma as any).coupleContract.findMany({ where: { coupleId: bond.id }, orderBy: { createdAt: 'desc' } });
}

export async function createContract(userId: string, data: any) {
  const bond = await requireActiveBond(userId);
  return (prisma as any).coupleContract.create({
    data: {
      coupleId: bond.id,
      createdBy: userId,
      title: String(data.title || '').slice(0, 80),
      content: String(data.content || ''),
      deadline: data.deadline ? new Date(data.deadline) : null,
      penalty: String(data.penalty || ''),
    },
  });
}

export async function updateContract(userId: string, id: string, data: any) {
  const bond = await requireActiveBond(userId);
  const contract = await (prisma as any).coupleContract.findFirst({ where: { id, coupleId: bond.id } });
  if (!contract) throw new Error('契约不存在');
  return (prisma as any).coupleContract.update({
    where: { id },
    data: {
      title: 'title' in data ? String(data.title || '').slice(0, 80) : undefined,
      content: 'content' in data ? String(data.content || '') : undefined,
      deadline: 'deadline' in data ? (data.deadline ? new Date(data.deadline) : null) : undefined,
      penalty: 'penalty' in data ? String(data.penalty || '') : undefined,
      status: 'status' in data ? String(data.status || 'active') : undefined,
    },
  });
}

export async function getWeeklyReport(userId: string) {
  const bond = await requireActiveBond(userId);
  const itemCount = await ((prisma as any).coupleItem?.count?.({ where: { coupleId: bond.id, archived: false } }) || 0);
  return { coupleId: bond.id, itemCount, generatedAt: new Date() };
}

export async function getActivityConfig(_userId?: string) {
  return {
    events: [],
    petSkins: [
      { key: 'classic', name: '经典伙伴', unlocked: true },
      { key: 'starlight', name: '星光限定', unlocked: false },
    ],
  };
}

export async function updatePetSkin(userId: string, skin: string) {
  const bond = await requireActiveBond(userId);
  const pet = await prisma.petBond.findUnique({ where: { userAId_userBId: { userAId: bond.userAId, userBId: bond.userBId } } });
  if (!pet) throw new Error('请先领养共同宠物');
  return prisma.petBond.update({ where: { id: pet.id }, data: { skin: skin || 'classic' } as any });
}

export function startWeeklyReportScheduler() {
  return undefined;
}
