import prisma from '../utils/prisma';

export async function getBackgrounds(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bgConversation: true, bgGravity: true, bgChat: true },
  });
  if (!user) throw new Error('用户不存在');

  // 获取所有好友的聊天背景
  const friendships = await prisma.friend.findMany({
    where: {
      OR: [{ userId }, { friendId: userId }],
      status: 'accepted',
    },
    select: { id: true, userId: true, friendId: true, chatBackground: true, chatBackgroundUser: true, chatBackgroundFriend: true },
  });

  const chatBackgrounds: Record<string, string> = {};
  for (const f of friendships) {
    const peerId = f.userId === userId ? f.friendId : f.userId;
    const ownBackground = f.userId === userId ? f.chatBackgroundUser : f.chatBackgroundFriend;
    if (ownBackground || f.chatBackground) {
      chatBackgrounds[peerId] = ownBackground || f.chatBackground;
    }
  }

  return {
    conversation: user.bgConversation,
    gravity: user.bgGravity,
    chat: user.bgChat,
    chatBackgrounds,
  };
}

export async function updateBackground(
  userId: string,
  page: 'conversation' | 'gravity' | 'chat',
  imageUrl: string,
) {
  const field = `bg${page.charAt(0).toUpperCase() + page.slice(1)}` as 'bgConversation' | 'bgGravity' | 'bgChat';
  const user = await prisma.user.update({
    where: { id: userId },
    data: { [field]: imageUrl },
    select: { bgConversation: true, bgGravity: true, bgChat: true },
  });
  return user;
}

export async function updateChatBackground(
  userId: string,
  peerId: string,
  imageUrl: string,
) {
  // 找到好友关系
  const friendship = await prisma.friend.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { userId, friendId: peerId },
        { userId: peerId, friendId: userId },
      ],
    },
  });

  if (!friendship) throw new Error('好友关系不存在');

  await prisma.friend.update({
    where: { id: friendship.id },
    data: friendship.userId === userId
      ? { chatBackgroundUser: imageUrl }
      : { chatBackgroundFriend: imageUrl },
  });

  return { peerId, imageUrl };
}
