import prisma from '../utils/prisma';

export interface PermissionResult {
  ok: boolean;
  code?: string;
  message?: string;
  isFriend?: boolean;
  relation?: any | null;
}

/**
 * 统一判断私聊消息权限
 * 判断顺序: 自己发给自己 → 双向拉黑 → 好友关系 → 陌生人开关
 */
export async function canSendPrivateMessage(senderId: string, receiverId: string): Promise<PermissionResult> {
  // 1. 不能给自己发
  if (senderId === receiverId) {
    return { ok: false, code: 'SELF_MESSAGE', message: '不能给自己发消息' };
  }

  // 2. 双向拉黑检查
  const blockedByReceiver = await prisma.blockList.findUnique({
    where: { blockerId_blockedId: { blockerId: receiverId, blockedId: senderId } },
  });
  if (blockedByReceiver) {
    return { ok: false, code: 'BLOCKED_BY_RECEIVER', message: '消息已发出，但被对方拒收了' };
  }

  const blockedBySender = await prisma.blockList.findUnique({
    where: { blockerId_blockedId: { blockerId: senderId, blockedId: receiverId } },
  });
  if (blockedBySender) {
    return { ok: false, code: 'BLOCKED_BY_SENDER', message: '你已拉黑对方，请先取消拉黑' };
  }

  // 3. 好友关系检查
  const relation = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId: senderId, friendId: receiverId },
        { userId: receiverId, friendId: senderId },
      ],
    },
  });

  if (relation) {
    if (relation.status === 'accepted') {
      return { ok: true, isFriend: true, relation };
    }

    if (relation.status === 'blocked') {
      return { ok: false, code: 'RELATION_BLOCKED', message: '无法发送消息', relation };
    }

    if (relation.status === 'deleted') {
      // 对方删除了我 → 拒收
      if (relation.deletedBy === receiverId) {
        return { ok: false, code: 'FRIEND_REQUIRED', message: '对方开启了好友验证，你还不是他（她）好友', relation };
      }
      // 我删除了对方 → 也拒绝，需要重新加好友
      return { ok: false, code: 'RELATION_DELETED', message: '你们已不是好友，请重新添加', relation };
    }

    if (relation.status === 'pending') {
      return { ok: false, code: 'FRIEND_PENDING', message: '好友申请待通过', relation };
    }

    if (relation.status === 'rejected') {
      // rejected 按陌生人逻辑处理
    }
  }

  // 4. 没有 accepted 关系 → 检查陌生人开关
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { allowStrangerMessage: true },
  });

  if (!receiver || !receiver.allowStrangerMessage) {
    return { ok: false, code: 'FRIEND_REQUIRED', message: '对方开启了好友验证，你还不是他（她）好友', relation: relation || null };
  }

  // 5. 允许陌生人消息
  return { ok: true, isFriend: false, relation: relation || null };
}

/**
 * 判断是否可以访问聊天历史
 */
export async function canAccessConversation(userId: string, peerId: string): Promise<boolean> {
  // 拉黑检查
  const blocked = await prisma.blockList.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: peerId },
        { blockerId: peerId, blockedId: userId },
      ],
    },
  });
  if (blocked) return false;

  // 关系检查
  const relation = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId, friendId: peerId },
        { userId: peerId, friendId: userId },
      ],
    },
  });

  if (relation) {
    // 对方删除了我 → 不能访问
    if (relation.status === 'deleted' && relation.deletedBy === peerId) return false;
    if (relation.status === 'blocked') return false;
  }

  return true;
}

/**
 * 判断是否可以触发 typing/call 等交互
 */
export async function canInteractWithUser(userId: string, peerId: string): Promise<boolean> {
  const result = await canSendPrivateMessage(userId, peerId);
  return result.ok;
}
