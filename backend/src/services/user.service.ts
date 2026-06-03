import prisma from '../utils/prisma';
import { getIO } from './socket.service';

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');
  const { password, autoReply, ...safe } = user;
  getIO()?.emit('user:updated', { userId, presence: user.presence, status: user.status });
  return safe;
}

export async function updateUser(
  userId: string,
  data: { nickname?: string; avatar?: string; status?: string; presence?: string; allowStrangerMessage?: boolean; readReceiptsEnabled?: boolean; callRingtoneUrl?: string; callRingtoneMode?: string }
) {
  if (data.callRingtoneMode && !['peer', 'mine'].includes(data.callRingtoneMode)) {
    throw new Error('Invalid ringtone mode');
  }
  if (data.presence && !['online', 'busy', 'away', 'dnd'].includes(data.presence)) {
    throw new Error('Invalid presence');
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });
  const { password, autoReply, ...safe } = user;
  return safe;
}

export async function searchUsers(query: string) {
  const isNumber = /^\d{6}$/.test(query);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
  const users = await prisma.user.findMany({
    where: isNumber
      ? { digitalId: parseInt(query) }
      : isUuid
        ? { id: query }
        : {
            OR: [
              { username: { contains: query } },
              { nickname: { contains: query } },
            ],
          },
    take: 10,
    select: {
      id: true, username: true, digitalId: true,
      nickname: true, avatar: true, status: true, presence: true, lastSeenAt: true,
      allowStrangerMessage: true, readReceiptsEnabled: true,
      callRingtoneUrl: true, callRingtoneMode: true,
      bgConversation: true, bgGravity: true, bgChat: true,
    },
  });
  return users;
}
