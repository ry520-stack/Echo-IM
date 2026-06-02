import prisma from '../utils/prisma';
import { getIO } from './socket.service';

const SOS_COOLDOWN_MS = 30 * 60 * 1000;
const UNBIND_LOCK_MS = 90 * 24 * 60 * 60 * 1000;
const WEATHER_CACHE_MS = 30 * 60 * 1000;
const weatherCache = new Map<string, { expiresAt: number; value: any }>();
const ITEM_TYPES = ['photo', 'footprint', 'song', 'praise', 'grudge'];
const PET_SKINS = [
  { key: 'classic', name: '经典伙伴', limited: false },
  { key: 'starlight', name: '星光限定', limited: true },
  { key: 'summer', name: '夏日海盐', limited: true },
];
const EVENTS = [
  { key: 'starlight-week', title: '星光陪伴周', description: '连续互动可解锁限定宠物装扮。', endsAt: '2026-12-31T23:59:59+08:00' },
  { key: 'summer-memories', title: '夏日回忆季', description: '记录共同足迹和照片，收藏这个夏天。', endsAt: '2026-08-31T23:59:59+08:00' },
];

function pair(userId: string, peerId: string) {
  return userId < peerId ? [userId, peerId] : [peerId, userId];
}

function peerId(bond: any, userId: string) {
  return bond.userAId === userId ? bond.userBId : bond.userAId;
}

async function requireFriend(userId: string, otherId: string) {
  const friend = await prisma.friend.findFirst({
    where: { status: 'accepted', OR: [{ userId, friendId: otherId }, { userId: otherId, friendId: userId }] },
  });
  if (!friend) throw new Error('只有好友才能申请绑定情侣');
}

async function findCurrent(userId: string) {
  return prisma.coupleBond.findFirst({
    where: { status: { in: ['pending', 'active'] }, OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { updatedAt: 'desc' },
  });
}

function notify(bond: any, event = 'couple:updated') {
  getIO()?.to(`user:${bond.userAId}`).emit(event, { peerId: bond.userBId });
  getIO()?.to(`user:${bond.userBId}`).emit(event, { peerId: bond.userAId });
}

async function weather(cityCode: string) {
  if (!cityCode) return null;
  const cached = weatherCache.get(cityCode);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const key = process.env.AMAP_WEB_SERVICE_KEY;
  if (!key) return null;
  const response = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?key=${encodeURIComponent(key)}&city=${encodeURIComponent(cityCode)}&extensions=base`);
  const data: any = await response.json();
  const live = data?.status === '1' ? data.lives?.[0] || null : null;
  weatherCache.set(cityCode, { expiresAt: Date.now() + WEATHER_CACHE_MS, value: live });
  return live;
}

async function geocode(cityName: string) {
  const key = process.env.AMAP_WEB_SERVICE_KEY;
  if (!key || !cityName.trim()) throw new Error('请填写城市名称');
  const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?key=${encodeURIComponent(key)}&address=${encodeURIComponent(cityName.trim())}`);
  const data: any = await response.json();
  const geo = data?.status === '1' ? data.geocodes?.[0] : null;
  if (!geo?.adcode || !geo?.location) throw new Error('未找到该城市，请填写市级名称，例如：杭州市');
  const [lng, lat] = String(geo.location).split(',').map(Number);
  return { cityCode: String(geo.adcode), cityName: String(geo.city || geo.district || cityName).replace(/市$/, '') + '市', lat, lng };
}

function distanceKm(aLat?: number | null, aLng?: number | null, bLat?: number | null, bLng?: number | null) {
  if ([aLat, aLng, bLat, bLng].some(value => typeof value !== 'number')) return null;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat! - aLat!);
  const dLng = rad(bLng! - aLng!);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat!)) * Math.cos(rad(bLat!)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

function weatherAlert(live: any) {
  const value = String(live?.weather || '');
  return /雨|雪|雷/.test(value) ? `${live.city || '对方城市'}当前${value}，记得提醒对方注意天气` : '';
}

function cycleSummary(start?: Date | null, cycleLength = 28, periodLength = 5) {
  if (!start) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsedDays = Math.floor((Date.now() - start.getTime()) / dayMs);
  const normalized = ((elapsedDays % cycleLength) + cycleLength) % cycleLength;
  const nextPeriodAt = new Date(start.getTime() + (elapsedDays < 0 ? 0 : Math.floor(elapsedDays / cycleLength + 1)) * cycleLength * dayMs);
  return { periodStart: start, cycleLength, periodLength, isPeriodActive: normalized < periodLength, nextPeriodAt };
}

export async function getSummary(userId: string) {
  const bond = await findCurrent(userId);
  if (!bond) return { status: 'none' };
  const otherId = peerId(bond, userId);
  const other = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true, username: true, nickname: true, avatar: true, digitalId: true } });
  const mineIsA = bond.userAId === userId;
  const myCityCode = mineIsA ? bond.userACityCode : bond.userBCityCode;
  const myCityName = mineIsA ? bond.userACityName : bond.userBCityName;
  const peerCityCode = mineIsA ? bond.userBCityCode : bond.userACityCode;
  const peerCityName = mineIsA ? bond.userBCityName : bond.userACityName;
  const [myWeather, peerWeather, pet] = await Promise.all([
    weather(myCityCode).catch(() => null),
    weather(peerCityCode).catch(() => null),
    prisma.petBond.findUnique({ where: { userAId_userBId: { userAId: bond.userAId, userBId: bond.userBId } } }),
  ]);
  const unlockAt = bond.bondedAt ? new Date(bond.bondedAt.getTime() + UNBIND_LOCK_MS) : null;
  const myCycle = mineIsA
    ? cycleSummary(bond.userAPeriodStart, bond.userACycleLength, bond.userAPeriodLength)
    : cycleSummary(bond.userBPeriodStart, bond.userBCycleLength, bond.userBPeriodLength);
  const peerCycleDetails = mineIsA
    ? (bond.userBShareCycle ? cycleSummary(bond.userBPeriodStart, bond.userBCycleLength, bond.userBPeriodLength) : null)
    : (bond.userAShareCycle ? cycleSummary(bond.userAPeriodStart, bond.userACycleLength, bond.userAPeriodLength) : null);
  const peerCycle = peerCycleDetails ? {
    isPeriodActive: peerCycleDetails.isPeriodActive,
    nextPeriodAt: peerCycleDetails.nextPeriodAt,
  } : null;
  const {
    userAPeriodStart, userACycleLength, userAPeriodLength, userAShareCycle,
    userBPeriodStart, userBCycleLength, userBPeriodLength, userBShareCycle,
    userALat, userALng, userBLat, userBLng,
    ...publicBond
  } = bond;
  return {
    ...publicBond,
    peer: other,
    pendingForMe: bond.status === 'pending' && bond.requestedBy !== userId,
    myCityCode,
    myCityName,
    peerCityCode,
    peerCityName,
    myWeather,
    peerWeather,
    weatherAlert: weatherAlert(peerWeather),
    distanceKm: distanceKm(bond.userALat, bond.userALng, bond.userBLat, bond.userBLng),
    pet,
    unlockAt,
    canUnbind: !!unlockAt && unlockAt.getTime() <= Date.now(),
    myCycle: { ...myCycle, shareWithPartner: mineIsA ? bond.userAShareCycle : bond.userBShareCycle },
    peerCycle,
  };
}

export async function requestBond(userId: string, otherId: string) {
  if (!otherId || otherId === userId) throw new Error('请选择正确的情侣对象');
  await requireFriend(userId, otherId);
  const occupied = await prisma.coupleBond.findFirst({
    where: { status: { in: ['pending', 'active'] }, OR: [{ userAId: { in: [userId, otherId] } }, { userBId: { in: [userId, otherId] } }] },
  });
  if (occupied) throw new Error('你或对方已有待处理或生效中的情侣关系');
  const [userAId, userBId] = pair(userId, otherId);
  const bond = await prisma.coupleBond.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId, requestedBy: userId },
    update: { requestedBy: userId, status: 'pending', bondedAt: null, endedAt: null },
  });
  notify(bond);
  return getSummary(userId);
}

export async function respond(userId: string, accept: boolean) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'pending' || bond.requestedBy === userId) throw new Error('没有可处理的情侣申请');
  const updated = await prisma.coupleBond.update({
    where: { id: bond.id },
    data: accept ? { status: 'active', bondedAt: new Date() } : { status: 'rejected', endedAt: new Date() },
  });
  notify(updated);
  return accept ? getSummary(userId) : { status: 'none' };
}

export async function updateSettings(userId: string, data: any) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'active') throw new Error('情侣关系尚未生效');
  const mineIsA = bond.userAId === userId;
  const update: any = {};
  for (const key of ['metAt', 'datingAt', 'countdownAt']) {
    if (key in data) update[key] = data[key] ? new Date(data[key]) : null;
  }
  if ('countdownTitle' in data) update.countdownTitle = String(data.countdownTitle || '').slice(0, 30);
  if ('cityName' in data) {
    if (String(data.cityName || '').trim()) {
      const city = await geocode(String(data.cityName));
      update[mineIsA ? 'userACityCode' : 'userBCityCode'] = city.cityCode;
      update[mineIsA ? 'userACityName' : 'userBCityName'] = city.cityName;
      update[mineIsA ? 'userALat' : 'userBLat'] = city.lat;
      update[mineIsA ? 'userALng' : 'userBLng'] = city.lng;
    } else {
      update[mineIsA ? 'userACityCode' : 'userBCityCode'] = '';
      update[mineIsA ? 'userACityName' : 'userBCityName'] = '';
      update[mineIsA ? 'userALat' : 'userBLat'] = null;
      update[mineIsA ? 'userALng' : 'userBLng'] = null;
    }
  }
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: update });
  notify(updated);
  return getSummary(userId);
}

export async function sendSos(userId: string) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'active') throw new Error('情侣关系尚未生效');
  if (bond.lastSosAt && Date.now() - bond.lastSosAt.getTime() < SOS_COOLDOWN_MS) {
    throw new Error('SOS 每 30 分钟最多发送一次');
  }
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: { lastSosAt: new Date(), lastSosBy: userId } });
  const targetId = peerId(updated, userId);
  getIO()?.to(`user:${targetId}`).emit('couple:sos', { message: '对方想你了，快去看看吧' });
  return { ok: true };
}

export async function unbind(userId: string) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'active') throw new Error('情侣关系尚未生效');
  const unlockAt = bond.bondedAt ? bond.bondedAt.getTime() + UNBIND_LOCK_MS : Infinity;
  if (Date.now() < unlockAt) throw new Error(`绑定后 90 天内不可主动解除，解锁时间：${new Date(unlockAt).toLocaleString('zh-CN')}`);
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: { status: 'ended', endedAt: new Date() } });
  notify(updated);
  return { status: 'none' };
}

export async function forceUnbind(userId: string) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'active') throw new Error('情侣关系尚未生效');
  const otherId = peerId(bond, userId);
  const [other, blocked] = await Promise.all([
    prisma.user.findUnique({ where: { id: otherId }, select: { id: true } }),
    prisma.blockList.findFirst({
      where: { OR: [{ blockerId: userId, blockedId: otherId }, { blockerId: otherId, blockedId: userId }] },
      select: { id: true },
    }),
  ]);
  if (other && !blocked) throw new Error('强制解除仅适用于对方账号已注销或双方存在拉黑关系');
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: { status: 'ended', endedAt: new Date() } });
  notify(updated);
  return { status: 'none' };
}

async function requireActive(userId: string) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'active') throw new Error('情侣关系尚未生效');
  return bond;
}

export async function getItems(userId: string, type?: string) {
  const bond = await requireActive(userId);
  return prisma.coupleItem.findMany({
    where: { coupleId: bond.id, archived: false, ...(type && ITEM_TYPES.includes(type) ? { type } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createItem(userId: string, data: any) {
  const bond = await requireActive(userId);
  const type = String(data.type || '');
  if (!ITEM_TYPES.includes(type)) throw new Error('内容类型无效');
  const item = await prisma.coupleItem.create({
    data: {
      coupleId: bond.id,
      createdBy: userId,
      type,
      title: String(data.title || '').slice(0, 80),
      content: String(data.content || '').slice(0, 1000),
      images: JSON.stringify(Array.isArray(data.images) ? data.images.slice(0, 9) : []),
      cityName: String(data.cityName || '').slice(0, 40),
      happenedAt: data.happenedAt ? new Date(data.happenedAt) : null,
    },
  });
  notify(bond);
  return item;
}

export async function archiveItem(userId: string, itemId: string) {
  const bond = await requireActive(userId);
  const item = await prisma.coupleItem.findFirst({ where: { id: itemId, coupleId: bond.id } });
  if (!item) throw new Error('内容不存在');
  await prisma.coupleItem.update({ where: { id: item.id }, data: { archived: true } });
  notify(bond);
  return { ok: true };
}

export async function updateCycle(userId: string, data: any) {
  const bond = await requireActive(userId);
  const mineIsA = bond.userAId === userId;
  const cycleLength = Math.max(20, Math.min(45, Number(data.cycleLength) || 28));
  const periodLength = Math.max(1, Math.min(10, Number(data.periodLength) || 5));
  const update = mineIsA ? {
    userAPeriodStart: data.periodStart ? new Date(data.periodStart) : null,
    userACycleLength: cycleLength,
    userAPeriodLength: periodLength,
    userAShareCycle: !!data.shareWithPartner,
  } : {
    userBPeriodStart: data.periodStart ? new Date(data.periodStart) : null,
    userBCycleLength: cycleLength,
    userBPeriodLength: periodLength,
    userBShareCycle: !!data.shareWithPartner,
  };
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: update });
  notify(updated);
  return getSummary(userId);
}

export async function getContracts(userId: string) {
  const bond = await requireActive(userId);
  return prisma.coupleContract.findMany({ where: { coupleId: bond.id, status: { not: 'archived' } }, orderBy: { createdAt: 'desc' } });
}

export async function createContract(userId: string, data: any) {
  const bond = await requireActive(userId);
  const title = String(data.title || '').trim().slice(0, 80);
  if (!title) throw new Error('请填写契约标题');
  const contract = await prisma.coupleContract.create({ data: {
    coupleId: bond.id, createdBy: userId, title, content: String(data.content || '').slice(0, 1000),
    deadline: data.deadline ? new Date(data.deadline) : null, penalty: String(data.penalty || '').slice(0, 300),
  } });
  notify(bond);
  return contract;
}

export async function updateContract(userId: string, contractId: string, data: any) {
  const bond = await requireActive(userId);
  const contract = await prisma.coupleContract.findFirst({ where: { id: contractId, coupleId: bond.id } });
  if (!contract) throw new Error('契约不存在');
  const status = ['active', 'completed', 'archived'].includes(data.status) ? data.status : contract.status;
  const updated = await prisma.coupleContract.update({ where: { id: contract.id }, data: { status } });
  notify(bond);
  return updated;
}

function parseCallSeconds(content: string) {
  const parts = content.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!parts) return 0;
  return parts[3] ? Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]) : Number(parts[1]) * 60 + Number(parts[2]);
}

export async function getWeeklyReport(userId: string) {
  const bond = await requireActive(userId);
  const otherId = peerId(bond, userId);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const messages = await prisma.message.findMany({
    where: { createdAt: { gte: since }, OR: [{ senderId: userId, receiverId: otherId }, { senderId: otherId, receiverId: userId }] },
    select: { type: true, content: true, createdAt: true },
  });
  const activeDays = new Set(messages.map(message => new Date(message.createdAt.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10))).size;
  return {
    since,
    activeDays,
    messageCount: messages.filter(message => !['call', 'pet', 'pet-adopt'].includes(message.type)).length,
    photoCount: messages.filter(message => message.type === 'image').length,
    callMinutes: Math.floor(messages.filter(message => message.type === 'call').reduce((sum, message) => sum + parseCallSeconds(message.content), 0) / 60),
    pet: await prisma.petBond.findUnique({ where: { userAId_userBId: { userAId: bond.userAId, userBId: bond.userBId } }, select: { name: true, level: true, experience: true, intimacy: true, coins: true, skin: true } }),
  };
}

export async function getActivityConfig(userId: string) {
  await requireActive(userId);
  return { events: EVENTS, skins: PET_SKINS };
}

export async function updatePetSkin(userId: string, skin: string) {
  const bond = await requireActive(userId);
  if (!PET_SKINS.some(item => item.key === skin)) throw new Error('宠物皮肤无效');
  const pet = await prisma.petBond.findUnique({ where: { userAId_userBId: { userAId: bond.userAId, userBId: bond.userBId } } });
  if (!pet || pet.status !== 'active') throw new Error('请先领养共同宠物');
  const updated = await prisma.petBond.update({ where: { id: pet.id }, data: { skin } });
  notify(bond);
  getIO()?.to(`user:${bond.userAId}`).emit('pet:updated', { peerId: bond.userBId, action: 'skin-updated' });
  getIO()?.to(`user:${bond.userBId}`).emit('pet:updated', { peerId: bond.userAId, action: 'skin-updated' });
  return updated;
}
