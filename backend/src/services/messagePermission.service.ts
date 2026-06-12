import prisma from '../utils/prisma';

export interface PermissionResult {
  ok: boolean;
  code?: string;
  message?: string;
  isFriend?: boolean;
  relation?: any | null;
}

export async function canSendPrivateMessage(senderId: string, receiverId: string): Promise<PermissionResult> {
  if (senderId === receiverId) {
    return { ok: false, code: 'SELF_MESSAGE', message: '不能给自己发消息' };
  }

  const relation = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId: senderId, friendId: receiverId },
        { userId: receiverId, friendId: senderId },
      ],
    },
  });

  if (relation) {
    if (relation.status === 'pending') {
      return { ok: false, code: 'FRIEND_PENDING', message: '好友申请待通过', relation };
    }

    if (relation.status === 'rejected') {
      return { ok: false, code: 'FRIEND_REQUIRED', message: '需要重新添加好友', relation };
    }

    // accepted / blocked / deleted 都允许继续发送。
    // blocked 只影响双方展示过滤，deleted 只影响好友列表，不再让历史会话发送失败。
    return { ok: true, isFriend: relation.status === 'accepted' || relation.status === 'blocked', relation };
  }

  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { allowStrangerMessage: true },
  });

  if (!receiver || !receiver.allowStrangerMessage) {
    return { ok: false, code: 'FRIEND_REQUIRED', message: '对方未开启陌生人消息', relation: null };
  }

  return { ok: true, isFriend: false, relation: null };
}

export async function canAccessConversation(userId: string, peerId: string): Promise<boolean> {
  if (userId === peerId) return false;
  return true;
}

export async function canInteractWithUser(userId: string, peerId: string): Promise<boolean> {
  const result = await canSendPrivateMessage(userId, peerId);
  return result.ok;
}
