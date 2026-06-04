import prisma from '../utils/prisma';
import { getIO } from './socket.service';
import { pushToUsers } from './push.service';

const SOS_COOLDOWN_MS = 30 * 60 * 1000;
const UNBIND_LOCK_MS = 90 * 24 * 60 * 60 * 1000;
const WEATHER_CACHE_MS = 30 * 60 * 1000;
const weatherCache = new Map<string, { expiresAt: number; value: any }>();
let lastWeeklyReportKey = '';
const ITEM_TYPES = ['photo', 'footprint', 'song', 'praise', 'grudge'];
const PET_SKINS = [
  { key: 'classic', name: '\u7ecf\u5178\u4f19\u4f34', limited: false },
  { key: 'starlight', name: '\u661f\u5149\u9650\u5b9a', limited: true },
  { key: 'summer', name: '\u590f\u65e5\u6d77\u76d0', limited: true },
];
const EVENTS = [
  { key: 'starlight-week', title: '\u661f\u5149\u966a\u4f34\u5468', description: '\u8fde\u7eed\u4e92\u52a8\u53ef\u89e3\u9501\u9650\u5b9a\u5ba0\u7269\u88c5\u626e\u3002', endsAt: '2026-12-31T23:59:59+08:00' },
  { key: 'summer-memories', title: '\u590f\u65e5\u56de\u5fc6\u5b63', description: '\u8bb0\u5f55\u5171\u540c\u8db3\u8ff9\u548c\u7167\u7247\uff0c\u6536\u85cf\u8fd9\u4e2a\u590f\u5929\u3002', endsAt: '2026-08-31T23:59:59+08:00' },
];

function skinAccess(pet: { level: number; intimacy: number } | null, skin: string) {
  if (skin === 'classic') return { unlocked: true, requirement: '\u9ed8\u8ba4\u88c5\u626e' };
  if (!pet) return { unlocked: false, requirement: '\u8bf7\u5148\u9886\u517b\u5171\u540c\u5ba0\u7269' };
  if (skin === 'starlight') return { unlocked: pet.level >= 6 && pet.intimacy >= 15, requirement: '\u5ba0\u7269\u8fbe\u5230 6 \u7ea7\u4e14\u4eb2\u5bc6\u5ea6\u8fbe\u5230 15' };
  if (skin === 'summer') return { unlocked: pet.level >= 3 && Date.now() <= new Date('2026-08-31T23:59:59+08:00').getTime(), requirement: '\u6d3b\u52a8\u671f\u95f4\u5ba0\u7269\u8fbe\u5230 3 \u7ea7' };
  return { unlocked: false, requirement: '\u672a\u5f00\u653e' };
}

function pair(userId: string, peerId: string) {
  return userId < peerId ? [userId, peerId] : [peerId, userId];
}

function peerId(bond: any, userId: string) {
  return bond.userAId === userId ? bond.userBId : bond.userAId;
}

function defaultCoupleLabel(gender?: string) {
  if (gender === 'male') return '\u8001\u516c';
  if (gender === 'female') return '\u5ab3\u5987\u513f';
  return '\u4eb2\u7231\u7684';
}

async function requireFriend(userId: string, otherId: string) {
  const friend = await prisma.friend.findFirst({
    where: { status: 'accepted', OR: [{ userId, friendId: otherId }, { userId: otherId, friendId: userId }] },
  });
  if (!friend) throw new Error('\u53ea\u6709\u597d\u53cb\u624d\u80fd\u7533\u8bf7\u7ed1\u5b9a\u60c5\u4fa3');
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
  const query = cityName.trim();
  if (!key || !query) throw new Error('\u8bf7\u586b\u5199\u57ce\u5e02\u6216\u533a\u53bf\u540d\u79f0');
  const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?key=${encodeURIComponent(key)}&address=${encodeURIComponent(query)}`);
  const data: any = await response.json();
  const geo = data?.status === '1' ? data.geocodes?.[0] : null;
  if (!geo?.adcode || !geo?.location) throw new Error('\u672a\u627e\u5230\u8be5\u57ce\u5e02\u6216\u533a\u53bf\uff0c\u8bf7\u586b\u5199\u66f4\u660e\u786e\u7684\u540d\u79f0\uff0c\u4f8b\u5982\uff1a\u6c88\u5317\u65b0\u533a');
  const [lng, lat] = String(geo.location).split(',').map(Number);
  const district = String(geo.district || '').trim();
  const city = String(geo.city || '').trim();
  const province = String(geo.province || '').trim();
  const displayName = district || city || province || query;
  return { cityCode: String(geo.adcode), cityName: displayName, lat, lng };
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
  return /雨|雪|雷/.test(value) ? `${live.city || '\u5bf9\u65b9\u57ce\u5e02'}\u5f53\u524d${value}\uff0c\u8bb0\u5f97\u63d0\u9192\u5bf9\u65b9\u6ce8\u610f\u5929\u6c14` : '';
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
  const [other, me] = await Promise.all([
    prisma.user.findUnique({ where: { id: otherId }, select: { id: true, username: true, nickname: true, avatar: true, digitalId: true, gender: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { gender: true } }),
  ]);
  const mineIsA = bond.userAId === userId;
  const myCityCode = mineIsA ? bond.userACityCode : bond.userBCityCode;
  const myCityName = mineIsA ? bond.userACityName : bond.userBCityName;
  const peerCityCode = mineIsA ? bond.userBCityCode : bond.userACityCode;
  const peerCityName = mineIsA ? bond.userBCityName : bond.userACityName;
  const myLabel = (mineIsA ? bond.userALabel : bond.userBLabel) || defaultCoupleLabel(me?.gender);
  const peerLabel = (mineIsA ? bond.userBLabel : bond.userALabel) || defaultCoupleLabel(other?.gender);
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
    myGender: me?.gender || '',
    peerGender: other?.gender || '',
    myLabel,
    peerLabel,
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
  if (!otherId || otherId === userId) throw new Error('\u8bf7\u9009\u62e9\u6b63\u786e\u7684\u60c5\u4fa3\u5bf9\u8c61');
  await requireFriend(userId, otherId);
  const occupied = await prisma.coupleBond.findFirst({
    where: { status: { in: ['pending', 'active'] }, OR: [{ userAId: { in: [userId, otherId] } }, { userBId: { in: [userId, otherId] } }] },
  });
  if (occupied) throw new Error('\u4f60\u6216\u5bf9\u65b9\u5df2\u6709\u5f85\u5904\u7406\u6216\u751f\u6548\u4e2d\u7684\u60c5\u4fa3\u5173\u7cfb');
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
  if (!bond || bond.status !== 'pending' || bond.requestedBy === userId) throw new Error('\u6ca1\u6709\u53ef\u5904\u7406\u7684\u60c5\u4fa3\u7533\u8bf7');
  const updated = await prisma.coupleBond.update({
    where: { id: bond.id },
    data: accept ? { status: 'active', bondedAt: new Date() } : { status: 'rejected', endedAt: new Date() },
  });
  notify(updated);
  return accept ? getSummary(userId) : { status: 'none' };
}

export async function updateSettings(userId: string, data: any) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'active') throw new Error('\u60c5\u4fa3\u5173\u7cfb\u5c1a\u672a\u751f\u6548');
  const mineIsA = bond.userAId === userId;
  const update: any = {};
  for (const key of ['metAt', 'datingAt', 'countdownAt']) {
    if (key in data) update[key] = data[key] ? new Date(data[key]) : null;
  }
  if ('countdownTitle' in data) update.countdownTitle = String(data.countdownTitle || '').slice(0, 30);
  if ('myLabel' in data) update[mineIsA ? 'userALabel' : 'userBLabel'] = String(data.myLabel || '').slice(0, 12);
  if ('peerLabel' in data) update[mineIsA ? 'userBLabel' : 'userALabel'] = String(data.peerLabel || '').slice(0, 12);
  if ('gender' in data && ['male', 'female', 'other', ''].includes(String(data.gender || ''))) {
    await prisma.user.update({ where: { id: userId }, data: { gender: String(data.gender || '') } });
  }
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
  if (!bond || bond.status !== 'active') throw new Error('\u60c5\u4fa3\u5173\u7cfb\u5c1a\u672a\u751f\u6548');
  if (bond.lastSosAt && Date.now() - bond.lastSosAt.getTime() < SOS_COOLDOWN_MS) {
    throw new Error('SOS \u6bcf 30 \u5206\u949f\u6700\u591a\u53d1\u9001\u4e00\u6b21');
  }
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: { lastSosAt: new Date(), lastSosBy: userId } });
  const targetId = peerId(updated, userId);
  getIO()?.to(`user:${targetId}`).emit('couple:sos', { message: '\u5bf9\u65b9\u60f3\u4f60\u4e86\uff0c\u5feb\u53bb\u770b\u770b\u5427' });
  return { ok: true };
}

export async function unbind(userId: string) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'active') throw new Error('\u60c5\u4fa3\u5173\u7cfb\u5c1a\u672a\u751f\u6548');
  const unlockAt = bond.bondedAt ? bond.bondedAt.getTime() + UNBIND_LOCK_MS : Infinity;
  if (Date.now() < unlockAt) throw new Error(`缁戝畾鍚?90 澶╁唴涓嶅彲涓诲姩瑙ｉ櫎锛岃В閿佹椂闂达細${new Date(unlockAt).toLocaleString('zh-CN')}`);
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: { status: 'ended', endedAt: new Date() } });
  notify(updated);
  return { status: 'none' };
}

export async function forceUnbind(userId: string) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'active') throw new Error('\u60c5\u4fa3\u5173\u7cfb\u5c1a\u672a\u751f\u6548');
  const otherId = peerId(bond, userId);
  const [other, blocked] = await Promise.all([
    prisma.user.findUnique({ where: { id: otherId }, select: { id: true } }),
    prisma.blockList.findFirst({
      where: { OR: [{ blockerId: userId, blockedId: otherId }, { blockerId: otherId, blockedId: userId }] },
      select: { id: true },
    }),
  ]);
  if (other && !blocked) throw new Error('\u5f3a\u5236\u89e3\u9664\u4ec5\u9002\u7528\u4e8e\u5bf9\u65b9\u8d26\u53f7\u5df2\u6ce8\u9500\u6216\u53cc\u65b9\u5b58\u5728\u62c9\u9ed1\u5173\u7cfb');
  const updated = await prisma.coupleBond.update({ where: { id: bond.id }, data: { status: 'ended', endedAt: new Date() } });
  notify(updated);
  return { status: 'none' };
}

async function requireActive(userId: string) {
  const bond = await findCurrent(userId);
  if (!bond || bond.status !== 'active') throw new Error('\u60c5\u4fa3\u5173\u7cfb\u5c1a\u672a\u751f\u6548');
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
  if (!ITEM_TYPES.includes(type)) throw new Error('\u5185\u5bb9\u7c7b\u578b\u65e0\u6548');
  const item = await prisma.coupleItem.create({
    data: {
      coupleId: bond.id,
      createdBy: userId,
      type,
      title: String(data.title || '').slice(0, 80),
      content: String(data.content || '').slice(0, 1000),
      images: JSON.stringify(Array.isArray(data.images) ? data.images.slice(0, 80) : []),
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
  if (!item) throw new Error('\u5185\u5bb9\u4e0d\u5b58\u5728');
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
  if (!title) throw new Error('\u8bf7\u586b\u5199\u5951\u7ea6\u6807\u9898');
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
  if (!contract) throw new Error('\u5951\u7ea6\u4e0d\u5b58\u5728');
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
  const messages: Array<{ type: string; content: string; createdAt: Date }> = await prisma.message.findMany({
    where: { createdAt: { gte: since }, OR: [{ senderId: userId, receiverId: otherId }, { senderId: otherId, receiverId: userId }] },
    select: { type: true, content: true, createdAt: true },
  });
  const activeDays = new Set(messages.map(message => new Date(message.createdAt.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10))).size;
  return {
    since,
    activeDays,
    messageCount: messages.filter(message => !['call', 'pet', 'pet-adopt', 'emoji'].includes(message.type)).length,
    photoCount: messages.filter(message => message.type === 'image' && !/\/emojis?\//i.test(message.content)).length,
    callMinutes: Math.floor(messages.filter(message => message.type === 'call').reduce((sum, message) => sum + parseCallSeconds(message.content), 0) / 60),
    pet: await prisma.petBond.findUnique({ where: { userAId_userBId: { userAId: bond.userAId, userBId: bond.userBId } }, select: { name: true, level: true, experience: true, intimacy: true, coins: true, skin: true } }),
  };
}

export async function getActivityConfig(userId: string) {
  const bond = await requireActive(userId);
  const pet = await prisma.petBond.findUnique({ where: { userAId_userBId: { userAId: bond.userAId, userBId: bond.userBId } }, select: { level: true, intimacy: true } });
  return { events: EVENTS, skins: PET_SKINS.map(item => ({ ...item, ...skinAccess(pet, item.key) })) };
}

export async function updatePetSkin(userId: string, skin: string) {
  const bond = await requireActive(userId);
  if (!PET_SKINS.some(item => item.key === skin)) throw new Error('瀹犵墿鐨偆鏃犳晥');
  const pet = await prisma.petBond.findUnique({ where: { userAId_userBId: { userAId: bond.userAId, userBId: bond.userBId } } });
  if (!pet || pet.status !== 'active') throw new Error('璇峰厛棰嗗吇鍏卞悓瀹犵墿');
  const access = skinAccess(pet, skin);
  if (!access.unlocked) throw new Error(access.requirement);
  const updated = await prisma.petBond.update({ where: { id: pet.id }, data: { skin } });
  notify(bond);
  getIO()?.to(`user:${bond.userAId}`).emit('pet:updated', { peerId: bond.userBId, action: 'skin-updated' });
  getIO()?.to(`user:${bond.userBId}`).emit('pet:updated', { peerId: bond.userAId, action: 'skin-updated' });
  return updated;
}

async function sendWeeklyReportReminders() {
  const chinaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  if (chinaNow.getUTCDay() !== 1 || chinaNow.getUTCHours() !== 9) return;
  const weekKey = chinaNow.toISOString().slice(0, 10);
  if (lastWeeklyReportKey === weekKey) return;
  lastWeeklyReportKey = weekKey;
  const bonds = await prisma.coupleBond.findMany({ where: { status: 'active' }, select: { userAId: true, userBId: true } });
  for (const bond of bonds) {
    const userIds = [bond.userAId, bond.userBId];
    getIO()?.to(`user:${bond.userAId}`).emit('couple:weekly-report', { message: '浣犱滑鐨勬柊涓€鍛ㄥ叧绯诲懆鎶ュ凡鐢熸垚' });
    getIO()?.to(`user:${bond.userBId}`).emit('couple:weekly-report', { message: '浣犱滑鐨勬柊涓€鍛ㄥ叧绯诲懆鎶ュ凡鐢熸垚' });
    pushToUsers({ userIds, title: 'Echo 鍏崇郴绌洪棿', body: '浣犱滑鐨勬柊涓€鍛ㄥ叧绯诲懆鎶ュ凡鐢熸垚', payload: { type: 'couple-weekly-report' } }).catch(() => {});
  }
}

export function startWeeklyReportScheduler() {
  sendWeeklyReportReminders().catch(() => {});
  setInterval(() => sendWeeklyReportReminders().catch(() => {}), 30 * 60 * 1000);
}


