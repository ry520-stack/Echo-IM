import prisma from '../utils/prisma';
import { getIO } from './socket.service';
import { canAccessConversation } from './messagePermission.service';

export async function getMessages(
  userId: string,
  peerId: string,
  before?: string,
  limit = 50,
) {
  if (!await canAccessConversation(userId, peerId)) {
    throw new Error('No permission to access this conversation');
  }

  // Get the conversation clear time for this user-peer pair
  const clearRecord = await prisma.userConversationClear.findUnique({
    where: { userId_peerId: { userId, peerId } },
    select: { clearedAt: true },
  });

  // Get hidden message IDs for this user
  const hiddenIds = await prisma.messageHidden.findMany({
    where: { userId },
    select: { messageId: true },
  });
  const hiddenSet = new Set(hiddenIds.map(h => h.messageId));

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: peerId },
        { senderId: peerId, receiverId: userId },
      ],
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: { select: { id: true, username: true, nickname: true, avatar: true } },
      replyTo: {
        select: { id: true, content: true, type: true, sender: { select: { id: true, username: true, nickname: true } } },
      },
      readReceipts: { select: { userId: true, readAt: true } },
    },
  });

  // Filter out hidden messages and those before conversation clear
  const filtered = messages.filter(m => {
    if (hiddenSet.has(m.id)) return false;
    if (clearRecord && m.createdAt <= clearRecord.clearedAt) return false;
    return true;
  });

  return filtered.reverse();
}

export async function getGroupMessages(
  userId: string,
  groupId: string,
  before?: string,
  limit = 50,
) {
  // 校验用户是否为群成员
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!isMember) throw new Error('No permission to access this group');

  // Get the group conversation clear time
  const clearRecord = await prisma.groupConversationClear.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { clearedAt: true },
  });

  // Get hidden message IDs for this user
  const hiddenIds = await prisma.messageHidden.findMany({
    where: { userId },
    select: { messageId: true },
  });
  const hiddenSet = new Set(hiddenIds.map(h => h.messageId));

  const messages = await prisma.message.findMany({
    where: {
      groupId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: { select: { id: true, username: true, nickname: true, avatar: true } },
      replyTo: {
        select: { id: true, content: true, type: true, sender: { select: { id: true, username: true, nickname: true } } },
      },
    },
  });

  // Filter out hidden messages and those before group conversation clear
  const filtered = messages.filter(m => {
    if (hiddenSet.has(m.id)) return false;
    if (clearRecord && m.createdAt <= clearRecord.clearedAt) return false;
    return true;
  });

  return filtered.reverse();
}

export async function getConversations(userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [sentMessages, receivedMessages, allHiddenIds] = await Promise.all([
    prisma.message.findMany({
      where: { senderId: userId, receiverId: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'desc' },
      select: { receiverId: true, createdAt: true },
      distinct: ['receiverId'],
      take: 100,
    }),
    prisma.message.findMany({
      where: { receiverId: userId, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'desc' },
      select: { senderId: true, createdAt: true },
      distinct: ['senderId'],
      take: 100,
    }),
    prisma.messageHidden.findMany({
      where: { userId },
      select: { messageId: true },
    }),
  ]);

  const hiddenSet = new Set(allHiddenIds.map(h => h.messageId));
  const peerMap = new Map<string, Date>();
  for (const m of sentMessages) {
    if (m.receiverId && (!peerMap.has(m.receiverId) || peerMap.get(m.receiverId)! < m.createdAt)) {
      peerMap.set(m.receiverId, m.createdAt);
    }
  }
  for (const m of receivedMessages) {
    if (!peerMap.has(m.senderId) || peerMap.get(m.senderId)! < m.createdAt) {
      peerMap.set(m.senderId, m.createdAt);
    }
  }

  let peerIds = Array.from(peerMap.keys());
  if (peerIds.length > 0) {
    const [blocks, relations] = await Promise.all([
      prisma.blockList.findMany({
        where: {
          OR: [
            { blockerId: userId, blockedId: { in: peerIds } },
            { blockerId: { in: peerIds }, blockedId: userId },
          ],
        },
      }),
      prisma.friend.findMany({
        where: {
          OR: [
            { userId, friendId: { in: peerIds } },
            { userId: { in: peerIds }, friendId: userId },
          ],
        },
      }),
    ]);

    const blockedPeerIds = new Set<string>();
    for (const b of blocks) {
      blockedPeerIds.add(b.blockerId === userId ? b.blockedId : b.blockerId);
    }

    const deletedByPeerIds = new Set<string>();
    for (const r of relations) {
      if (r.status === 'blocked') {
        const peerId = r.userId === userId ? r.friendId : r.userId;
        blockedPeerIds.add(peerId);
      }
      if (r.status === 'deleted' && r.deletedBy !== userId) {
        const peerId = r.userId === userId ? r.friendId : r.userId;
        deletedByPeerIds.add(peerId);
      }
    }
    peerIds = peerIds.filter(id => !blockedPeerIds.has(id) && !deletedByPeerIds.has(id));
  }

  const conversations: any[] = [];
  if (peerIds.length > 0) {
    const [peers, friendRecords, allUserClears] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: peerIds } },
        select: { id: true, username: true, nickname: true, avatar: true, digitalId: true, lastSeenAt: true, status: true },
      }),
      prisma.friend.findMany({
        where: {
          OR: [
            { userId, friendId: { in: peerIds } },
            { userId: { in: peerIds }, friendId: userId },
          ],
        },
        select: { userId: true, friendId: true, alias: true },
      }),
      prisma.userConversationClear.findMany({
        where: { userId },
        select: { peerId: true, clearedAt: true },
      }),
    ]);

    const aliasMap = new Map<string, string>();
    for (const f of friendRecords) {
      const peerId = f.userId === userId ? f.friendId : f.userId;
      if (f.alias) aliasMap.set(peerId, f.alias);
    }
    const userClearMap = new Map(allUserClears.map(c => [c.peerId, c.clearedAt]));

    const userConversations = await Promise.all(peers.map(async (peer) => {
      const clearTime = userClearMap.get(peer.id);
      const lastMsg = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: peer.id },
            { senderId: peer.id, receiverId: userId },
          ],
          ...(clearTime ? { createdAt: { gt: clearTime } } : {}),
          id: { notIn: [...hiddenSet] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, content: true, type: true, createdAt: true, senderId: true },
      });
      if (!lastMsg) return null;

      const unreadCount = await prisma.message.count({
        where: {
          senderId: peer.id,
          receiverId: userId,
          isRecalled: false,
          ...(clearTime ? { createdAt: { gt: clearTime } } : {}),
          id: { notIn: [...hiddenSet] },
          NOT: { readReceipts: { some: { userId } } },
        },
      });

      return {
        type: 'user',
        peer: { ...peer, alias: aliasMap.get(peer.id) || '', isGroup: false },
        lastMessage: lastMsg,
        unreadCount,
        lastTime: lastMsg.createdAt.toISOString(),
      };
    }));
    conversations.push(...userConversations.filter(Boolean));
  }

  const [groupClears, memberships] = await Promise.all([
    prisma.groupConversationClear.findMany({
      where: { userId },
      select: { groupId: true, clearedAt: true },
    }),
    prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: { _count: { select: { members: true } } },
        },
      },
    }),
  ]);
  const groupClearMap = new Map(groupClears.map(c => [c.groupId, c.clearedAt]));

  const groupConversations = await Promise.all(memberships.map(async (membership) => {
    const clearTime = groupClearMap.get(membership.groupId);
    const lastMsg = await prisma.message.findFirst({
      where: {
        groupId: membership.groupId,
        ...(clearTime ? { createdAt: { gt: clearTime } } : {}),
        id: { notIn: [...hiddenSet] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, type: true, createdAt: true, senderId: true },
    });

    const unreadCount = await prisma.message.count({
      where: {
        groupId: membership.groupId,
        senderId: { not: userId },
        isRecalled: false,
        ...(clearTime ? { createdAt: { gt: clearTime } } : {}),
        id: { notIn: [...hiddenSet] },
        readReceipts: { none: { userId } },
      },
    });

    return {
      type: 'group',
      peer: {
        id: membership.groupId,
        username: membership.group.name,
        nickname: membership.group.name,
        avatar: membership.group.avatar || '',
        digitalId: 0,
        lastSeenAt: membership.joinedAt,
        status: `${membership.group._count.members} members`,
        alias: membership.remark || membership.alias || '',
        isGroup: true,
        memberCount: membership.group._count.members,
      },
      lastMessage: lastMsg,
      unreadCount,
      lastTime: (lastMsg?.createdAt || membership.group.createdAt).toISOString(),
    };
  }));

  conversations.push(...groupConversations);
  conversations.sort((a, b) => String(b.lastTime || '').localeCompare(String(a.lastTime || '')));
  return conversations;
}
export async function recallMessage(messageId: string, userId: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.senderId !== userId) throw new Error('No permission to recall this message');

  const elapsed = Date.now() - msg.createdAt.getTime();
  if (elapsed > 2 * 60 * 1000) throw new Error('Cannot recall after 2 minutes');

  return prisma.message.update({ where: { id: messageId }, data: { isRecalled: true } });
}

export async function getConsecutiveDays(userId: string, peerId: string): Promise<number> {
  if (!await canAccessConversation(userId, peerId)) {
    throw new Error('No permission to access this conversation');
  }

  // 只查最�?65天的消息，避免全量加�?
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: peerId },
        { senderId: peerId, receiverId: userId },
      ],
      createdAt: { gte: oneYearAgo },
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
    take: 1000,
  });

  if (messages.length === 0) return 0;

  // Group by date (UTC day boundary)
  const activeDays = new Set<string>();
  for (const m of messages) {
    const d = new Date(m.createdAt);
    activeDays.add(d.toISOString().slice(0, 10));
  }

  // Count consecutive days going backwards from today
  let days = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const check = new Date(today);
    check.setDate(check.getDate() - i);
    const key = check.toISOString().slice(0, 10);
    if (activeDays.has(key)) {
      days++;
    } else if (i > 0) {
      break; // gap found
    }
    // i=0 (today) �?allow starting even if no message today
  }

  return days;
}

export async function searchMessages(
  userId: string,
  options: { query?: string; peerId?: string; groupId?: string; date?: string },
  limit = 60,
) {
  if (options.peerId && !await canAccessConversation(userId, options.peerId)) return [];

  const query = options.query?.trim();
  const dayStart = options.date ? new Date(`${options.date}T00:00:00+08:00`) : null;
  const dayEnd = dayStart ? new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) : null;

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  const groupIds = memberships.map(m => m.groupId);
  const accessibleGroupIds = new Set(groupIds);
  if (options.groupId && !groupIds.includes(options.groupId)) return [];

  const hiddenIds = await prisma.messageHidden.findMany({
    where: { userId },
    select: { messageId: true },
  });
  const hiddenSet = new Set(hiddenIds.map(h => h.messageId));

  const messages = await prisma.message.findMany({
    where: {
      ...(query ? { content: { contains: query } } : {}),
      ...(dayStart && dayEnd ? { createdAt: { gte: dayStart, lt: dayEnd } } : {}),
      isRecalled: false,
      ...(options.peerId
        ? {
            OR: [
              { senderId: userId, receiverId: options.peerId },
              { senderId: options.peerId, receiverId: userId },
            ],
          }
        : options.groupId
          ? { groupId: options.groupId }
          : {
              OR: [
                { senderId: userId },
                { receiverId: userId },
                ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
              ],
            }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: { select: { id: true, username: true, nickname: true, avatar: true } },
      group: { select: { id: true, name: true, avatar: true } },
    },
  });

  const privatePeerIds = [...new Set(messages.flatMap(message => {
    if (message.groupId) return [];
    return [message.senderId === userId ? message.receiverId : message.senderId].filter((id): id is string => !!id);
  }))];
  const accessiblePrivatePeers = new Set(
    (await Promise.all(privatePeerIds.map(async peerId => ({
      peerId,
      allowed: await canAccessConversation(userId, peerId),
    })))).filter(item => item.allowed).map(item => item.peerId),
  );

  return messages.filter(message => {
    if (hiddenSet.has(message.id)) return false;
    if (message.groupId) return accessibleGroupIds.has(message.groupId);
    const peerId = message.senderId === userId ? message.receiverId : message.senderId;
    return !!peerId && accessiblePrivatePeers.has(peerId);
  });
}

export async function getMessageContext(userId: string, messageId: string, radius = 25) {
  const target = await prisma.message.findUnique({ where: { id: messageId } });
  if (!target) throw new Error('Message not found');

  const groupMember = target.groupId
    ? await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: target.groupId, userId } } })
    : null;
  const peerId = target.senderId === userId ? target.receiverId : target.senderId;
  if (target.groupId ? !groupMember : !peerId || !await canAccessConversation(userId, peerId)) {
    throw new Error('No permission to access this conversation');
  }

  const [hiddenIds, userClear, groupClear] = await Promise.all([
    prisma.messageHidden.findMany({ where: { userId }, select: { messageId: true } }),
    peerId
      ? prisma.userConversationClear.findUnique({ where: { userId_peerId: { userId, peerId } }, select: { clearedAt: true } })
      : Promise.resolve(null),
    target.groupId
      ? prisma.groupConversationClear.findUnique({ where: { userId_groupId: { userId, groupId: target.groupId } }, select: { clearedAt: true } })
      : Promise.resolve(null),
  ]);
  const hiddenSet = new Set(hiddenIds.map(item => item.messageId));
  const clearedAt = userClear?.clearedAt || groupClear?.clearedAt;
  if (hiddenSet.has(target.id) || (clearedAt && target.createdAt <= clearedAt)) {
    throw new Error('Message is no longer available');
  }

  const conversationWhere = target.groupId
    ? { groupId: target.groupId }
    : {
        OR: [
          { senderId: userId, receiverId: peerId },
          { senderId: peerId!, receiverId: userId },
        ],
      };
  const include = {
    sender: { select: { id: true, username: true, nickname: true, avatar: true } },
    replyTo: {
      select: { id: true, content: true, type: true, sender: { select: { id: true, username: true, nickname: true } } },
    },
    readReceipts: { select: { userId: true, readAt: true } },
  };
  const [beforeAndTarget, after] = await Promise.all([
    prisma.message.findMany({
      where: { ...conversationWhere, createdAt: { lte: target.createdAt } },
      orderBy: { createdAt: 'desc' },
      take: radius + 1,
      include,
    }),
    prisma.message.findMany({
      where: { ...conversationWhere, createdAt: { gt: target.createdAt } },
      orderBy: { createdAt: 'asc' },
      take: radius,
      include,
    }),
  ]);

  return [...beforeAndTarget.reverse(), ...after].filter(message => {
    if (hiddenSet.has(message.id)) return false;
    return !clearedAt || message.createdAt > clearedAt;
  });
}

export async function markAllRead(userId: string, peerId?: string, groupId?: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { readReceiptsEnabled: true },
  });
  if (groupId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) throw new Error('NOT_GROUP_MEMBER');

    const unreadMessages = await prisma.message.findMany({
      where: {
        groupId,
        senderId: { not: userId },
        isRecalled: false,
        readReceipts: { none: { userId } },
      },
      select: { id: true },
    });

    if (unreadMessages.length === 0) return 0;
    await prisma.$transaction(
      unreadMessages.map(msg =>
        prisma.readReceipt.upsert({
          where: { messageId_userId: { messageId: msg.id, userId } },
          create: { messageId: msg.id, userId, readAt: new Date() },
          update: { readAt: new Date() },
        })
      )
    );
    return unreadMessages.length;
  }

  if (!peerId) throw new Error('peerId or groupId required');
  if (!await canAccessConversation(userId, peerId)) {
    throw new Error('No permission to access this conversation');
  }
  const unreadMessages = await prisma.message.findMany({
    where: {
      senderId: peerId,
      receiverId: userId,
      isRecalled: false,
      readReceipts: { none: { userId } },
    },
    select: { id: true },
  });

  if (unreadMessages.length === 0) return 0;

  await prisma.$transaction(
    unreadMessages.map(msg =>
      prisma.readReceipt.upsert({
        where: { messageId_userId: { messageId: msg.id, userId } },
        create: { messageId: msg.id, userId, readAt: new Date() },
        update: { readAt: new Date() },
      })
    )
  );

  const io = getIO();
  if (io && me?.readReceiptsEnabled !== false) {
    io.to(`user:${peerId}`).emit('read:update_batch', {
      messageIds: unreadMessages.map(m => m.id),
      readBy: userId,
      readAt: new Date().toISOString(),
    });
  }

  return unreadMessages.length;
}
// ——�?Message hiding (soft-delete for the requesting user only) ——�?

export async function hideMessage(userId: string, messageId: string) {
  // Verify the message involves this user
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Message not found');
  const groupMember = msg.groupId
    ? await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: msg.groupId, userId } } })
    : null;
  const involved = msg.senderId === userId || msg.receiverId === userId || !!groupMember;
  if (!involved) throw new Error('No permission to modify this message');

  await prisma.messageHidden.upsert({
    where: { userId_messageId: { userId, messageId } },
    create: { userId, messageId },
    update: {},
  });
}

export async function batchHideMessages(userId: string, messageIds: string[]) {
  const uniqueIds = [...new Set(messageIds)];
  const memberships = await prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } });
  const groupIds = memberships.map(membership => membership.groupId);
  const messages = await prisma.message.findMany({
    where: {
      id: { in: uniqueIds },
      OR: [
        { senderId: userId },
        { receiverId: userId },
        ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
      ],
    },
    select: { id: true },
  });
  await prisma.$transaction(messages.map(message => prisma.messageHidden.upsert({
    where: { userId_messageId: { userId, messageId: message.id } },
    create: { userId, messageId: message.id },
    update: {},
  })));
  return messages.length;
}

export async function clearUserConversation(userId: string, peerId: string) {
  // Verify the peer exists
  const peer = await prisma.user.findUnique({ where: { id: peerId } });
  if (!peer) throw new Error('User not found');

  await prisma.userConversationClear.upsert({
    where: { userId_peerId: { userId, peerId } },
    create: { userId, peerId, clearedAt: new Date() },
    update: { clearedAt: new Date() },
  });
}

export async function clearGroupConversation(userId: string, groupId: string) {
  // Verify user is a group member
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member) throw new Error('No permission to clear this group conversation');

  await prisma.groupConversationClear.upsert({
    where: { userId_groupId: { userId, groupId } },
    create: { userId, groupId, clearedAt: new Date() },
    update: { clearedAt: new Date() },
  });
}
