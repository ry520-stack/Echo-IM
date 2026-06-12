import prisma from '../utils/prisma';
import { getIO } from './socket.service';
import { pushToUsers } from './push.service';

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
  if (!bond || !['active', 'pending-unbind'].includes(bond.status)) throw new Error('鎯呬荆鍏崇郴灏氭湭鐢熸晥');
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
  if (!friend) throw new Error('鍙湁濂藉弸鎵嶈兘鐢宠缁戝畾鎯呬荆');
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
  if (occupied) throw new Error('浣犳垨瀵规柟宸叉湁寰呭鐞嗘垨鐢熸晥涓殑鎯呬荆鍏崇郴');
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
  if (!bond || bond.status !== 'pending' || bond.requestedBy === userId) throw new Error('娌℃湁鍙鐞嗙殑鎯呬荆璇锋眰');
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
  if (bond.status === 'pending-unbind') throw new Error('瑙ｇ粦璇锋眰姝ｅ湪绛夊緟瀵规柟澶勭悊');
  const bondedAt = (bond as any).bondedAt || (bond as any).boundAt;
  const unlockAt = bondedAt ? bondedAt.getTime() + UNBIND_LOCK_MS : Infinity;
  if (Date.now() < unlockAt) throw new Error(`缁戝畾鍚?90 澶╁唴涓嶅彲涓诲姩瑙ｉ櫎锛岃В閿佹椂闂达細${new Date(unlockAt).toLocaleString('zh-CN')}`);
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
    title: 'Echo 鎯呬荆绌洪棿',
    body: '瀵规柟鐢宠瑙ｉ櫎鎯呬荆绌洪棿缁戝畾',
    payload: { type: 'couple-unbind-request', chatId: userId },
  }).catch(() => {});
  notify(updated, 'unbind-request');
  return getSummary(userId);
}

export async function respondUnbind(userId: string, accept: boolean) {
  const bond = await findMine(userId);
  if (!bond || bond.status !== 'pending-unbind' || bond.requestedBy === userId) throw new Error('娌℃湁鍙鐞嗙殑瑙ｇ粦璇锋眰');
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
  const bond = await requireActiveBond(userId);
  const item = await (prisma as any).coupleItem.findFirst({ where: { id, coupleId: bond.id } });
  if (!item) throw new Error('记录不存在');
  if (item.createdBy !== userId) throw new Error('只能删除自己创建的记录');
  const updated = await (prisma as any).coupleItem.update({ where: { id }, data: { archived: true } });
  notify(bond, 'item');
  return updated;
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
      { key: 'classic', name: '缁忓吀浼欎即', unlocked: true },
      { key: 'starlight', name: '鏄熷厜闄愬畾', unlocked: false },
    ],
  };
}

export async function updatePetSkin(userId: string, skin: string) {
  const bond = await requireActiveBond(userId);
  const pet = await prisma.petBond.findUnique({ where: { userAId_userBId: { userAId: bond.userAId, userBId: bond.userBId } } });
  if (!pet) throw new Error('璇峰厛棰嗗吇鍏卞悓瀹犵墿');
  return prisma.petBond.update({ where: { id: pet.id }, data: { skin: skin || 'classic' } as any });
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value || '') as T;
  } catch {
    return fallback;
  }
}

function albumCoupleKey(bond: { userAId: string; userBId: string }) {
  return `${bond.userAId}_${bond.userBId}`;
}

function normalizeAlbumGroup(group: any, photos: any[] = []) {
  const normalizedPhotos = photos.map(photo => ({
    id: photo.id,
    url: photo.url || photo.previewUrl || photo.originalUrl || photo.thumbUrl || '',
    originalUrl: photo.originalUrl || photo.url || '',
    previewUrl: photo.previewUrl || photo.url || '',
    thumbUrl: photo.thumbUrl || photo.previewUrl || photo.url || '',
    type: photo.type || 'image',
    width: photo.width || 0,
    height: photo.height || 0,
    duration: photo.duration || 0,
    size: photo.size || 0,
    description: photo.description || '',
    createdAt: photo.createdAt,
  }));
  return {
    id: group.id,
    title: group.title || '日常碎片',
    date: group.date || '',
    location: group.location || '',
    description: group.description || '',
    coverUrl: group.coverUrl || normalizedPhotos[0]?.thumbUrl || normalizedPhotos[0]?.previewUrl || normalizedPhotos[0]?.url || '',
    photos: normalizedPhotos,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

function albumPhotoData(groupId: string, photo: any, sortOrder: number) {
  return {
    groupId,
    url: photo.url || photo.previewUrl || photo.originalUrl || photo.thumbUrl || '',
    originalUrl: photo.originalUrl || photo.url || '',
    previewUrl: photo.previewUrl || photo.url || '',
    thumbUrl: photo.thumbUrl || photo.previewUrl || photo.url || '',
    type: photo.type || 'image',
    width: Number(photo.width) || null,
    height: Number(photo.height) || null,
    duration: Number(photo.duration) || null,
    size: Number(photo.size) || null,
    sortOrder,
    description: photo.description || '',
  };
}

export async function getAlbumGroups(userId: string) {
  const bond = await requireActiveBond(userId);
  const groups = await (prisma as any).albumGroup.findMany({
    where: { coupleId: albumCoupleKey(bond), type: 'couple' },
    orderBy: { updatedAt: 'desc' },
  });
  const photos = groups.length ? await (prisma as any).albumPhoto.findMany({
    where: { groupId: { in: groups.map((group: any) => group.id) } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  }) : [];
  const photoMap = new Map<string, any[]>();
  for (const photo of photos) {
    const list = photoMap.get(photo.groupId) || [];
    list.push(photo);
    photoMap.set(photo.groupId, list);
  }
  return groups.map((group: any) => normalizeAlbumGroup(group, photoMap.get(group.id) || []));
}

export async function createAlbumGroup(userId: string, data: any) {
  const bond = await requireActiveBond(userId);
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const group = await (prisma as any).albumGroup.create({
    data: {
      userId,
      coupleId: albumCoupleKey(bond),
      type: 'couple',
      title: String(data.title || '日常碎片').trim() || '日常碎片',
      date: data.date || null,
      location: data.location || null,
      description: data.description || null,
      coverUrl: data.coverUrl || photos[0]?.thumbUrl || photos[0]?.previewUrl || photos[0]?.url || null,
    },
  });
  if (photos.length) {
    await (prisma as any).albumPhoto.createMany({ data: photos.map((photo: any, index: number) => albumPhotoData(group.id, photo, index)) });
  }
  notify(bond, 'album');
  return normalizeAlbumGroup(group, photos);
}

export async function updateAlbumGroup(userId: string, groupId: string, data: any) {
  const bond = await requireActiveBond(userId);
  const group = await (prisma as any).albumGroup.findFirst({ where: { id: groupId, coupleId: albumCoupleKey(bond), type: 'couple' } });
  if (!group) throw new Error('相册标签不存在');
  const updated = await (prisma as any).albumGroup.update({
    where: { id: groupId },
    data: {
      title: data.title !== undefined ? String(data.title || '').trim() || '日常碎片' : undefined,
      date: data.date !== undefined ? data.date || null : undefined,
      location: data.location !== undefined ? data.location || null : undefined,
      description: data.description !== undefined ? data.description || null : undefined,
      coverUrl: data.coverUrl !== undefined ? data.coverUrl || null : undefined,
    },
  });
  notify(bond, 'album');
  const photos = await (prisma as any).albumPhoto.findMany({ where: { groupId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  return normalizeAlbumGroup(updated, photos);
}

export async function deleteAlbumGroup(userId: string, groupId: string) {
  const bond = await requireActiveBond(userId);
  const group = await (prisma as any).albumGroup.findFirst({ where: { id: groupId, coupleId: albumCoupleKey(bond), type: 'couple' } });
  if (!group) throw new Error('相册标签不存在');
  await prisma.$transaction(async tx => {
    await (tx as any).albumPhoto.deleteMany({ where: { groupId } });
    await (tx as any).albumGroup.delete({ where: { id: groupId } });
  });
  notify(bond, 'album');
  return { ok: true };
}

export async function addAlbumPhotos(userId: string, groupId: string, photos: any[]) {
  const bond = await requireActiveBond(userId);
  const group = await (prisma as any).albumGroup.findFirst({ where: { id: groupId, coupleId: albumCoupleKey(bond), type: 'couple' } });
  if (!group) throw new Error('相册标签不存在');
  const count = await (prisma as any).albumPhoto.count({ where: { groupId } });
  if (photos.length) {
    await (prisma as any).albumPhoto.createMany({ data: photos.map((photo: any, index: number) => albumPhotoData(groupId, photo, count + index)) });
  }
  if (!group.coverUrl && photos[0]) {
    await (prisma as any).albumGroup.update({
      where: { id: groupId },
      data: { coverUrl: photos[0].thumbUrl || photos[0].previewUrl || photos[0].url || null },
    });
  }
  notify(bond, 'album');
  const [updated, nextPhotos] = await Promise.all([
    (prisma as any).albumGroup.findUnique({ where: { id: groupId } }),
    (prisma as any).albumPhoto.findMany({ where: { groupId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
  ]);
  return normalizeAlbumGroup(updated, nextPhotos);
}

export async function deleteAlbumPhotos(userId: string, groupId: string, photoIds: string[]) {
  const bond = await requireActiveBond(userId);
  const group = await (prisma as any).albumGroup.findFirst({ where: { id: groupId, coupleId: albumCoupleKey(bond), type: 'couple' } });
  if (!group) throw new Error('相册标签不存在');
  await (prisma as any).albumPhoto.deleteMany({ where: { groupId, id: { in: photoIds } } });
  const photos = await (prisma as any).albumPhoto.findMany({ where: { groupId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  const coverStillExists = photos.some((photo: any) => [photo.url, photo.previewUrl, photo.thumbUrl, photo.originalUrl].includes(group.coverUrl));
  const updated = await (prisma as any).albumGroup.update({
    where: { id: groupId },
    data: { coverUrl: coverStillExists ? group.coverUrl : photos[0]?.thumbUrl || photos[0]?.previewUrl || photos[0]?.url || null },
  });
  notify(bond, 'album');
  return normalizeAlbumGroup(updated, photos);
}
export function startWeeklyReportScheduler() {
  return undefined;
}


