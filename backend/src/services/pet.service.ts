import prisma from '../utils/prisma';
import { getIO } from './socket.service';
import { isFriend } from './block.service';

function pair(userId: string, peerId: string) {
  return userId < peerId ? { userAId: userId, userBId: peerId } : { userAId: peerId, userBId: userId };
}

function todayKey() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function educationForLevel(level: number) {
  if (level >= 12) return '大学';
  if (level >= 8) return '高中';
  if (level >= 5) return '初中';
  if (level >= 3) return '小学';
  return '幼儿园';
}

function jobForLevel(level: number) {
  if (level >= 12) return '创意研究员';
  if (level >= 8) return '咖啡店主理人';
  if (level >= 5) return '见习设计师';
  if (level >= 3) return '校园小助手';
  return '还没有工作';
}

async function createPetNotice(senderId: string, receiverId: string, event: 'requested' | 'adopted' | 'rejected') {
  const content = JSON.stringify({ event });
  const message = await prisma.message.create({
    data: { senderId, receiverId, content, type: 'pet-adopt' },
    include: { sender: { select: { id: true, username: true, nickname: true, avatar: true } } },
  });
  getIO()?.to(`user:${senderId}`).emit('message:receive', message);
  getIO()?.to(`user:${receiverId}`).emit('message:receive', message);
  return message;
}

const DAILY_TASKS = [
  { target: 5, label: '互相问候', bonusExperience: 3 },
  { target: 15, label: '陪伴升温', bonusExperience: 5 },
  { target: 30, label: '今日默契', bonusExperience: 8 },
];

function parseCallSeconds(content: string) {
  const parts = content.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!parts) return 0;
  return parts[3]
    ? Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3])
    : Number(parts[1]) * 60 + Number(parts[2]);
}

function chinaDayStart(daysAgo = 0) {
  const now = new Date();
  const chinaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  chinaNow.setUTCHours(0, 0, 0, 0);
  return new Date(chinaNow.getTime() - 8 * 60 * 60 * 1000 - daysAgo * 24 * 60 * 60 * 1000);
}

async function getGrowthSummary(userId: string, peerId: string) {
  const [messages, achievementMessages] = await Promise.all([prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: peerId },
        { senderId: peerId, receiverId: userId },
      ],
      type: { notIn: ['pet', 'pet-adopt', 'call'] },
      createdAt: { gte: chinaDayStart(30) },
    },
    select: { senderId: true, createdAt: true },
  }), prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: peerId },
        { senderId: peerId, receiverId: userId },
      ],
      type: { in: ['image', 'call'] },
    },
    select: { senderId: true, type: true, content: true },
  })]);
  const dayMap = new Map<string, { count: number; senders: Set<string> }>();
  messages.forEach(message => {
    const key = new Date(message.createdAt.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const day = dayMap.get(key) || { count: 0, senders: new Set<string>() };
    day.count += 1;
    day.senders.add(message.senderId);
    dayMap.set(key, day);
  });
  const keyFor = (date: Date) => new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayKey = keyFor(new Date());
  const today = dayMap.get(todayKey) || { count: 0, senders: new Set<string>() };
  const bond = await prisma.petBond.findUnique({ where: { userAId_userBId: pair(userId, peerId) } });
  const repairedDays = new Set<string>(JSON.parse(bond?.repairedDays || '[]'));
  let streakDays = 0;
  for (let daysAgo = today.senders.size >= 2 ? 0 : 1; daysAgo <= 30; daysAgo += 1) {
    const key = keyFor(chinaDayStart(daysAgo));
    const day = dayMap.get(key);
    if ((!day || day.senders.size < 2) && !repairedDays.has(key)) break;
    streakDays += 1;
  }
  const startDaysAgo = today.senders.size >= 2 ? 0 : 1;
  let repairableDay: string | null = null;
  for (let daysAgo = startDaysAgo; daysAgo <= 30; daysAgo += 1) {
    const key = keyFor(chinaDayStart(daysAgo));
    const day = dayMap.get(key);
    if ((!day || day.senders.size < 2) && !repairedDays.has(key)) {
      const previousKey = keyFor(chinaDayStart(daysAgo + 1));
      const previousDay = dayMap.get(previousKey);
      if (previousDay?.senders.size && previousDay.senders.size >= 2) repairableDay = key;
      break;
    }
  }
  const hoursSinceLastSpoke = bond?.lastSpokeAt ? (Date.now() - bond.lastSpokeAt.getTime()) / 3600000 : 0;
  const imageSenders = new Set(achievementMessages.filter(message => message.type === 'image').map(message => message.senderId));
  const imageCount = achievementMessages.filter(message => message.type === 'image').length;
  const callMinutes = Math.floor(achievementMessages
    .filter(message => message.type === 'call')
    .reduce((total, message) => total + parseCallSeconds(message.content), 0) / 60);
  return {
    todayMessageCount: today.count,
    todayMutual: today.senders.size >= 2,
    streakDays,
    repairCards: bond?.repairCards || 0,
    repairableDay,
    mood: hoursSinceLastSpoke >= 72 ? 'sick' : hoursSinceLastSpoke >= 24 ? 'sad' : 'happy',
    dailyTasks: DAILY_TASKS.map(task => ({ ...task, completed: today.count >= task.target })),
    achievementTasks: [
      { key: 'mutual-images', label: '互相分享图片', progress: imageSenders.size, target: 2, unit: '人', completed: imageSenders.size >= 2 },
      { key: 'image-album', label: '共同相册起步', progress: imageCount, target: 10, unit: '张', completed: imageCount >= 10 },
      { key: 'call-hours', label: '陪伴通话', progress: callMinutes, target: 180, unit: '分钟', completed: callMinutes >= 180 },
    ],
  };
}

function notifyPetUpdated(userId: string, peerId: string, action: string) {
  const io = getIO();
  if (!io) return;
  io.to(`user:${userId}`).emit('pet:updated', { peerId, action });
  io.to(`user:${peerId}`).emit('pet:updated', { peerId: userId, action });
}

async function requireFriend(userId: string, peerId: string) {
  if (userId === peerId) throw new Error('Cannot adopt a pet with yourself');
  if (!await isFriend(userId, peerId)) throw new Error('Only friends can adopt a pet together');
}

export async function getPet(userId: string, peerId: string) {
  const bond = await prisma.petBond.findUnique({ where: { userAId_userBId: pair(userId, peerId) } });
  if (!bond) return null;
  const activity = bond.activityUntil && bond.activityUntil > new Date() ? bond.activity : 'idle';
  return {
    ...bond,
    activity,
    education: educationForLevel(bond.level),
    job: jobForLevel(bond.level),
    pendingForMe: bond.status === 'pending' && bond.requestedBy !== userId,
    ...(bond.status === 'active' ? await getGrowthSummary(userId, peerId) : {}),
  };
}

export async function adoptPet(userId: string, peerId: string) {
  await requireFriend(userId, peerId);
  const key = pair(userId, peerId);
  const existing = await prisma.petBond.findUnique({ where: { userAId_userBId: key } });
  if (!existing) {
    const bond = await prisma.petBond.create({ data: { ...key, requestedBy: userId } });
    await createPetNotice(userId, peerId, 'requested');
    notifyPetUpdated(userId, peerId, 'requested');
    return { ...bond, pendingForMe: false };
  }
  if (existing.status === 'active') return { ...existing, pendingForMe: false };
  if (existing.status === 'rejected') {
    const bond = await prisma.petBond.update({ where: { id: existing.id }, data: { status: 'pending', requestedBy: userId } });
    await createPetNotice(userId, peerId, 'requested');
    notifyPetUpdated(userId, peerId, 'requested');
    return { ...bond, pendingForMe: false };
  }
  if (existing.requestedBy === userId) throw new Error('Waiting for your friend to confirm adoption');
  const bond = await prisma.petBond.update({
    where: { id: existing.id },
    data: { status: 'active' },
  });
  await createPetNotice(userId, peerId, 'adopted');
  notifyPetUpdated(userId, peerId, 'adopted');
  return { ...bond, pendingForMe: false };
}

export async function rejectPet(userId: string, peerId: string) {
  await requireFriend(userId, peerId);
  const existing = await prisma.petBond.findUnique({ where: { userAId_userBId: pair(userId, peerId) } });
  if (!existing || existing.status !== 'pending' || existing.requestedBy === userId) throw new Error('当前没有待处理的领养邀请');
  const bond = await prisma.petBond.update({ where: { id: existing.id }, data: { status: 'rejected' } });
  await createPetNotice(userId, peerId, 'rejected');
  notifyPetUpdated(userId, peerId, 'rejected');
  return { ...bond, pendingForMe: false };
}

export async function updatePet(userId: string, peerId: string, data: { name?: string; avatar?: string }) {
  await requireFriend(userId, peerId);
  const existing = await prisma.petBond.findUnique({ where: { userAId_userBId: pair(userId, peerId) } });
  if (!existing || existing.status !== 'active') throw new Error('Adopt a pet together first');
  const name = data.name?.trim();
  const bond = await prisma.petBond.update({
    where: { id: existing.id },
    data: {
      ...(name !== undefined ? { name: name.slice(0, 20) || 'Echo' } : {}),
      ...(data.avatar !== undefined ? { avatar: data.avatar } : {}),
    },
  });
  notifyPetUpdated(userId, peerId, 'profile-updated');
  return { ...bond, pendingForMe: false };
}

export async function repairStreak(userId: string, peerId: string) {
  await requireFriend(userId, peerId);
  const existing = await prisma.petBond.findUnique({ where: { userAId_userBId: pair(userId, peerId) } });
  if (!existing || existing.status !== 'active') throw new Error('Adopt a pet together first');
  if (existing.repairCards < 1) throw new Error('补签卡不足');
  const summary = await getGrowthSummary(userId, peerId);
  if (!summary.repairableDay) throw new Error('当前没有可补签的中断日期');
  const repairedDays = [...new Set([...JSON.parse(existing.repairedDays || '[]'), summary.repairableDay])];
  const bond = await prisma.petBond.update({
    where: { id: existing.id },
    data: { repairCards: { decrement: 1 }, repairedDays: JSON.stringify(repairedDays) },
  });
  notifyPetUpdated(userId, peerId, 'streak-repaired');
  return { ...bond, pendingForMe: false, ...(await getGrowthSummary(userId, peerId)) };
}

export async function petAction(userId: string, peerId: string, action?: string) {
  await requireFriend(userId, peerId);
  const existing = await prisma.petBond.findUnique({ where: { userAId_userBId: pair(userId, peerId) } });
  if (!existing || existing.status !== 'active') throw new Error('Adopt a pet together first');
  const now = new Date();
  if (action === 'check-in') {
    if (existing.lastCheckInDay === todayKey()) throw new Error('今天已经签到过了');
    const bond = await prisma.petBond.update({ where: { id: existing.id }, data: { coins: { increment: 8 }, lastCheckInDay: todayKey() } });
    notifyPetUpdated(userId, peerId, 'checked-in');
    return getPet(userId, peerId);
  }
  if (action === 'buy-biscuit') {
    if (existing.coins < 5) throw new Error('金币不足');
    await prisma.petBond.update({ where: { id: existing.id }, data: { coins: { decrement: 5 }, biscuits: { increment: 1 } } });
    notifyPetUpdated(userId, peerId, 'bought-biscuit');
    return getPet(userId, peerId);
  }
  if (action === 'buy-toy') {
    if (existing.coins < 12) throw new Error('金币不足');
    await prisma.petBond.update({ where: { id: existing.id }, data: { coins: { decrement: 12 }, toys: { increment: 1 } } });
    notifyPetUpdated(userId, peerId, 'bought-toy');
    return getPet(userId, peerId);
  }
  if (action === 'buy-medicine') {
    if (existing.coins < 15) throw new Error('金币不足');
    await prisma.petBond.update({ where: { id: existing.id }, data: { coins: { decrement: 15 }, medicines: { increment: 1 } } });
    notifyPetUpdated(userId, peerId, 'bought-medicine');
    return getPet(userId, peerId);
  }
  if (action === 'buy-repair-card') {
    if (existing.coins < 25) throw new Error('金币不足');
    await prisma.petBond.update({ where: { id: existing.id }, data: { coins: { decrement: 25 }, repairCards: { increment: 1 } } });
    notifyPetUpdated(userId, peerId, 'bought-repair-card');
    return getPet(userId, peerId);
  }
  if (action === 'feed') {
    if (existing.biscuits < 1) throw new Error('背包里没有饼干');
    await prisma.petBond.update({ where: { id: existing.id }, data: { biscuits: { decrement: 1 }, intimacy: { increment: 1 } } });
    notifyPetUpdated(userId, peerId, 'fed');
    return getPet(userId, peerId);
  }
  if (action === 'play') {
    if (existing.toys < 1) throw new Error('背包里没有玩具');
    await prisma.petBond.update({ where: { id: existing.id }, data: { toys: { decrement: 1 }, intimacy: { increment: 3 } } });
    notifyPetUpdated(userId, peerId, 'played');
    return getPet(userId, peerId);
  }
  if (action === 'heal') {
    if (existing.medicines < 1) throw new Error('背包里没有药品');
    await prisma.petBond.update({ where: { id: existing.id }, data: { medicines: { decrement: 1 }, lastSpokeAt: new Date() } });
    notifyPetUpdated(userId, peerId, 'healed');
    return getPet(userId, peerId);
  }
  if (existing.activityUntil && existing.activityUntil > now) throw new Error('宠物正在忙，稍后再试');
  if (action === 'study') {
    const experience = existing.experience + 4;
    await prisma.petBond.update({
      where: { id: existing.id },
      data: { activity: 'study', activityUntil: new Date(now.getTime() + 30 * 60 * 1000), experience, level: Math.max(existing.level, Math.floor(experience / 20) + 1) },
    });
    notifyPetUpdated(userId, peerId, 'studying');
    return getPet(userId, peerId);
  }
  if (action === 'work') {
    if (existing.level < 3) throw new Error('宠物达到 3 级后才能工作');
    await prisma.petBond.update({
      where: { id: existing.id },
      data: { activity: 'work', activityUntil: new Date(now.getTime() + 60 * 60 * 1000), coins: { increment: 10 + existing.level } },
    });
    notifyPetUpdated(userId, peerId, 'working');
    return getPet(userId, peerId);
  }
  if (action === 'sleep') {
    await prisma.petBond.update({ where: { id: existing.id }, data: { activity: 'sleep', activityUntil: new Date(now.getTime() + 8 * 60 * 60 * 1000) } });
    notifyPetUpdated(userId, peerId, 'sleeping');
    return getPet(userId, peerId);
  }
  throw new Error('未知宠物操作');
}
