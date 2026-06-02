import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from './auth.service';
import prisma from '../utils/prisma';
import { canSendPrivateMessage, canInteractWithUser } from './messagePermission.service';
import { pushToUsers } from './push.service';

let io: Server | null = null;

interface OnlineUser {
  socketId: string;
  userId: string;
}

const onlineUsers: OnlineUser[] = [];

export function isUserOnline(userId: string) {
  return onlineUsers.some(u => u.userId === userId);
}

function previewMessage(type: string, content: string) {
  if (type === 'image') return '[\u56fe\u7247]';
  if (type === 'voice') return '[\u8bed\u97f3]';
  if (type === 'video') return '[\u89c6\u9891]';
  if (type === 'call') return content || '[\u901a\u8bdd]';
  if (type === 'pet-adopt') {
    try {
      const event = JSON.parse(content)?.event;
      if (event === 'requested') return '[\u5171\u540c\u5ba0\u7269] \u5171\u540c\u9886\u517b\u9080\u8bf7';
      if (event === 'accepted') return '[\u5171\u540c\u5ba0\u7269] \u5df2\u540c\u610f\u5171\u540c\u9886\u517b';
      if (event === 'rejected') return '[\u5171\u540c\u5ba0\u7269] \u5df2\u62d2\u7edd\u5171\u540c\u9886\u517b';
    } catch { /* fall through */ }
    return '[\u5171\u540c\u5ba0\u7269]';
  }
  return content.length > 60 ? content.slice(0, 60) + '...' : content;
}

function petMessageAction(content: string) {
  if (/晚安|good\s*night/i.test(content)) return 'sleep';
  if (/哈哈|笑死|hhh|😂|🤣/i.test(content)) return 'laugh';
  return '';
}

async function growPetFromMessage(params: { senderId: string; receiverId?: string; messageType?: string }) {
  if (!params.receiverId || ['call', 'pet', 'pet-adopt'].includes(params.messageType || '')) return;
  const [userAId, userBId] = params.senderId < params.receiverId
    ? [params.senderId, params.receiverId]
    : [params.receiverId, params.senderId];
  const bond = await prisma.petBond.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  if (!bond || bond.status !== 'active') return;
  const messageCount = await prisma.message.count({
    where: {
      OR: [
        { senderId: params.senderId, receiverId: params.receiverId },
        { senderId: params.receiverId, receiverId: params.senderId },
      ],
      type: { notIn: ['pet', 'pet-adopt', 'call'] },
    },
  });
  const now = new Date();
  const chinaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  chinaNow.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(chinaNow.getTime() - 8 * 60 * 60 * 1000);
  const todayMessageCount = await prisma.message.count({
    where: {
      OR: [
        { senderId: params.senderId, receiverId: params.receiverId },
        { senderId: params.receiverId, receiverId: params.senderId },
      ],
      type: { notIn: ['pet', 'pet-adopt', 'call'] },
      createdAt: { gte: todayStart },
    },
  });
  const dailyBonus = todayMessageCount === 5 ? 3 : todayMessageCount === 15 ? 5 : todayMessageCount === 30 ? 8 : 0;
  const experience = bond.experience + 1 + dailyBonus;
  const updated = await prisma.petBond.update({
    where: { id: bond.id },
    data: {
      experience,
      intimacy: bond.intimacy + (messageCount % 5 === 0 ? 1 : 0) + (dailyBonus ? 1 : 0),
      level: Math.max(bond.level, Math.floor(experience / 20) + 1),
      lastSpokeAt: now,
    },
  });
  const payload = { peerId: params.receiverId, action: 'grew', pet: updated };
  io?.to(`user:${params.senderId}`).emit('pet:updated', payload);
  io?.to(`user:${params.receiverId}`).emit('pet:updated', { ...payload, peerId: params.senderId });
}

function pushOfflineMessage(params: {
  receiverIds: string[];
  senderName: string;
  message: { id: string; type: string; content: string; senderId: string; receiverId?: string | null; groupId?: string | null };
}) {
  const offlineIds = params.receiverIds.filter(id => id !== params.message.senderId && !isUserOnline(id));
  if (offlineIds.length === 0) return;

  pushToUsers({
    userIds: offlineIds,
    title: params.senderName,
    body: previewMessage(params.message.type, params.message.content),
    payload: {
      type: params.message.groupId ? 'group-message' : 'private-message',
      chatId: params.message.groupId || params.message.senderId,
      messageId: params.message.id,
    },
  }).catch(() => {});
}

async function saveMessage(data: {
  senderId: string;
  receiverId?: string;
  groupId?: string;
  content: string;
  type: string;
  replyToId?: string;
}) {
  const msg = await prisma.message.create({ data });
  return prisma.message.findUnique({
    where: { id: msg.id },
    include: {
      sender: { select: { id: true, username: true, nickname: true, avatar: true, digitalId: true } },
      replyTo: {
        select: { id: true, content: true, type: true, sender: { select: { id: true, username: true, nickname: true } } },
      },
    },
  });
}

export function initSocket(httpServer: HttpServer) {
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')
    : ['http://localhost:5173', 'http://localhost:8080', 'http://8.140.194.214:8080', 'http://echo-im.cloud', 'https://echo-im.cloud'];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (origin.endsWith('.trycloudflare.com')) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = verifyToken(token);
      (socket as any).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId as string;

    const existingIdx = onlineUsers.findIndex(u => u.userId === userId);
    if (existingIdx !== -1) {
      const old = onlineUsers.splice(existingIdx, 1)[0];
      io?.to(old.socketId).emit('force:logout', { message: 'account logged in elsewhere' });
      io?.sockets.sockets.get(old.socketId)?.disconnect(true);
    }

    onlineUsers.push({ socketId: socket.id, userId });
    io?.emit('online:update', { userId, online: true });
    socket.emit('online:list', { userIds: onlineUsers.map(u => u.userId) });

    prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});

    socket.join(`user:${userId}`);

    const memberships = await prisma.groupMember.findMany({ where: { userId } });
    memberships.forEach(m => socket.join(`group:${m.groupId}`));

    // --- message:send ---
    socket.on('message:send', async (data: {
      receiverId?: string;
      groupId?: string;
      content: string;
      type?: string;
      replyToId?: string;
    }, ack?: (res: any) => void) => {
      try {
        // 基础校验
        if (!data.content?.trim() && data.type !== 'image' && data.type !== 'voice' && data.type !== 'video') {
          return ack?.({ error: 'EMPTY_MESSAGE', message: '消息内容不能为空' });
        }
        if (data.content && data.content.length > 3000) {
          return ack?.({ error: 'MESSAGE_TOO_LONG', message: '消息内容超出最大限制' });
        }

        // 私聊：统一权限判断
        if (data.receiverId) {
          const perm = await canSendPrivateMessage(userId, data.receiverId);
          if (!perm.ok) {
            return ack?.({ error: perm.code, message: perm.message });
          }

        }

        // 群聊：校验群成员
        if (data.groupId) {
          const membership = await prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId: data.groupId, userId } },
          });
          if (!membership) {
            return ack?.({ error: 'NOT_MEMBER', message: '你不是该群成员' });
          }
        }

        // 创建消息
        const msg = await saveMessage({
          senderId: userId,
          receiverId: data.receiverId,
          groupId: data.groupId,
          content: data.content,
          type: data.type || 'text',
          replyToId: data.replyToId,
        });

        if (msg) {
          if (data.receiverId) {
            socket.to(`user:${data.receiverId}`).emit('message:receive', msg);
            pushOfflineMessage({
              receiverIds: [data.receiverId],
              senderName: msg.sender.nickname || msg.sender.username,
              message: msg,
            });
          } else if (data.groupId) {
            socket.to(`group:${data.groupId}`).emit('message:receive', msg);
            const members = await prisma.groupMember.findMany({
              where: { groupId: data.groupId, userId: { not: userId } },
              select: { userId: true, group: { select: { name: true } } },
            });
            pushOfflineMessage({
              receiverIds: members.map(m => m.userId),
              senderName: members[0]?.group.name || '群聊消息',
              message: msg,
            });
          }
          ack?.({ ok: true, message: msg });
          growPetFromMessage({ senderId: userId, receiverId: data.receiverId, messageType: data.type || 'text' }).catch(() => {});
          const petAction = data.receiverId ? petMessageAction(data.content) : '';
          if (petAction && data.receiverId) {
            io?.to(`user:${userId}`).emit('pet:interaction', { peerId: data.receiverId, action: petAction });
            io?.to(`user:${data.receiverId}`).emit('pet:interaction', { peerId: userId, action: petAction });
          }
        }
      } catch (e: any) {
        ack?.({ error: 'INTERNAL_ERROR', message: e.message || 'send failed' });
      }
    });

    // --- typing ---
    socket.on('typing:start', async (data: { receiverId: string }) => {
      const ok = await canInteractWithUser(userId, data.receiverId);
      if (ok) socket.to(`user:${data.receiverId}`).emit('typing:update', { userId, typing: true });
    });
    socket.on('typing:stop', async (data: { receiverId: string }) => {
      const ok = await canInteractWithUser(userId, data.receiverId);
      if (ok) socket.to(`user:${data.receiverId}`).emit('typing:update', { userId, typing: false });
    });

    // --- WebRTC signaling ---
    socket.on('call:request', async (data: { receiverId: string; callerName: string; callerAvatar: string }, ack?: (res: any) => void) => {
      const perm = await canSendPrivateMessage(userId, data.receiverId);
      if (!perm.ok || !perm.isFriend) {
        return ack?.({ ok: false, code: perm.code || 'FRIEND_REQUIRED', message: perm.message || '只有好友才能语音通话' });
      }
      const [caller, receiver] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { callRingtoneUrl: true, callRingtoneMode: true } }),
        prisma.user.findUnique({ where: { id: data.receiverId }, select: { callRingtoneUrl: true } }),
      ]);
      socket.to(`user:${data.receiverId}`).emit('call:invite', {
        senderId: userId,
        callerName: data.callerName,
        callerAvatar: data.callerAvatar,
        receiverRingtoneUrl: receiver?.callRingtoneUrl || '',
        callerRingtoneUrl: caller?.callRingtoneUrl || '',
      });
      ack?.({
        ok: true,
        receiverRingtoneUrl: receiver?.callRingtoneUrl || '',
        callerRingtoneUrl: caller?.callRingtoneUrl || '',
        callerRingtoneMode: caller?.callRingtoneMode || 'peer',
      });
    });

    socket.on('pet:interact', async (data: { peerId: string; action: 'poke' | 'feed' }) => {
      if (!data.peerId || !['poke', 'feed'].includes(data.action)) return;
      const [userAId, userBId] = userId < data.peerId ? [userId, data.peerId] : [data.peerId, userId];
      const bond = await prisma.petBond.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
      if (!bond || bond.status !== 'active' || !await canInteractWithUser(userId, data.peerId)) return;
      const payload = { peerId: data.peerId, action: data.action, actorId: userId };
      io?.to(`user:${userId}`).emit('pet:interaction', payload);
      io?.to(`user:${data.peerId}`).emit('pet:interaction', { ...payload, peerId: userId });
    });

    socket.on('call:accept', async (data: { targetId: string }) => {
      const ok = await canInteractWithUser(userId, data.targetId);
      if (ok) socket.to(`user:${data.targetId}`).emit('call:accepted');
    });

    socket.on('call:reject', async (data: { targetId: string }) => {
      const ok = await canInteractWithUser(userId, data.targetId);
      if (ok) socket.to(`user:${data.targetId}`).emit('call:rejected');
    });

    socket.on('call:hangup', async (data: { targetId: string }) => {
      const ok = await canInteractWithUser(userId, data.targetId);
      if (ok) socket.to(`user:${data.targetId}`).emit('call:hangedup');
    });

    socket.on('webrtc:signal', async (data: { targetId: string; signal: any }) => {
      const ok = await canInteractWithUser(userId, data.targetId);
      if (ok) socket.to(`user:${data.targetId}`).emit('webrtc:signal', { senderId: userId, signal: data.signal });
    });

    // --- read receipt ---
    socket.on('message:read', async (data: { messageId: string }) => {
      try {
        // 检查用户是否关闭了已读回执
        const me = await prisma.user.findUnique({
          where: { id: userId },
          select: { readReceiptsEnabled: true },
        });
        if (me?.readReceiptsEnabled === false) return;

        // 校验消息确实属于当前用户（receiverId === userId）
        const msg = await prisma.message.findUnique({
          where: { id: data.messageId },
          select: { senderId: true, receiverId: true },
        });
        if (!msg || msg.receiverId !== userId) return; // 不是自己的消息，忽略

        const receipt = await prisma.readReceipt.upsert({
          where: { messageId_userId: { messageId: data.messageId, userId } },
          create: { messageId: data.messageId, userId },
          update: { readAt: new Date() },
        });
        if (msg.senderId) {
          socket.to(`user:${msg.senderId}`).emit('read:update', {
            messageId: data.messageId, readBy: userId, readAt: receipt.readAt,
          });
        }
      } catch { /* ignore */ }
    });

    socket.on('disconnect', () => {
      const idx = onlineUsers.findIndex(u => u.socketId === socket.id);
      if (idx !== -1) {
        onlineUsers.splice(idx, 1);
        io?.emit('online:update', { userId, online: false });
      }
    });
  });

  return io;
}

export function getIO(): Server | null { return io; }
