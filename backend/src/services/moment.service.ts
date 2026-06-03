import prisma from '../utils/prisma';

const MAX_MOMENT_IMAGES = 18;

async function acceptedFriendIds(userId: string) {
  const friendships = await prisma.friend.findMany({
    where: { OR: [{ userId }, { friendId: userId }], status: 'accepted' },
    select: { userId: true, friendId: true },
  });
  return friendships.map(friend => friend.userId === userId ? friend.friendId : friend.userId);
}

async function canViewMoment(momentId: string, viewerId: string) {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    include: { permissions: true },
  });
  if (!moment) throw new Error('动态不存在');
  if (moment.userId === viewerId) return moment;

  const friendIds = await acceptedFriendIds(viewerId);
  if (!friendIds.includes(moment.userId)) throw new Error('无权查看该动态');

  const memberships = await prisma.friendGroupMember.findMany({
    where: { peerId: viewerId },
    select: { groupId: true },
  });
  const groupIds = new Set(memberships.map(item => item.groupId));
  const denied = moment.permissions.some(item => item.mode === 'DENY' && (item.userId === viewerId || (item.groupId && groupIds.has(item.groupId))));
  if (denied) throw new Error('无权查看该动态');
  if (moment.privacyType === 'PRIVATE') throw new Error('无权查看该动态');
  if (moment.privacyType === 'VISIBLE_TO') {
    const allowed = moment.permissions.some(item => item.mode === 'ALLOW' && (item.userId === viewerId || (item.groupId && groupIds.has(item.groupId))));
    if (!allowed) throw new Error('无权查看该动态');
  }
  return moment;
}

export async function createMoment(
  userId: string,
  content: string,
  images: string[] = [],
  privacyType: string = 'PUBLIC',
  targetGroupIds: string[] = [],
  hiddenUserIds: string[] = [],
  visibleUserIds: string[] = [],
  galleryMode: string = 'stack',
  coverIndex: number = 0,
) {
  if (images.length > MAX_MOMENT_IMAGES) {
    throw new Error(`动态图片最多 ${MAX_MOMENT_IMAGES} 张`);
  }

  const uniqueGroupIds = [...new Set(targetGroupIds.filter(Boolean))];
  const uniqueHiddenUserIds = [...new Set(hiddenUserIds.filter(Boolean))];
  const uniqueVisibleUserIds = [...new Set(visibleUserIds.filter(Boolean))];
  const finalGalleryMode = galleryMode === 'grid' ? 'grid' : 'stack';
  const finalCoverIndex = Number.isInteger(coverIndex) && coverIndex >= 0 && coverIndex < images.length ? coverIndex : 0;

  if (uniqueGroupIds.length > 0) {
    const ownedGroupCount = await prisma.friendGroup.count({
      where: { userId, id: { in: uniqueGroupIds } },
    });
    if (ownedGroupCount !== uniqueGroupIds.length) {
      throw new Error('星域权限无效');
    }
  }

  const permissionUserIds = [...new Set([...uniqueHiddenUserIds, ...uniqueVisibleUserIds])];
  if (permissionUserIds.length > 0) {
    const friendships = await prisma.friend.findMany({
      where: {
        status: 'accepted',
        OR: [
          { userId, friendId: { in: permissionUserIds } },
          { friendId: userId, userId: { in: permissionUserIds } },
        ],
      },
    });
    const acceptedIds = new Set(friendships.map(friend => friend.userId === userId ? friend.friendId : friend.userId));
    if (permissionUserIds.some(targetUserId => !acceptedIds.has(targetUserId))) {
      throw new Error('动态权限好友无效');
    }
  }

  const moment = await prisma.moment.create({
    data: { userId, content, images: JSON.stringify(images), privacyType, galleryMode: finalGalleryMode, coverIndex: finalCoverIndex },
    include: {
      user: { select: { id: true, username: true, nickname: true, avatar: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  const permissionRows = [
    ...uniqueGroupIds.map(groupId => ({
      momentId: moment.id,
      groupId,
      mode: privacyType === 'INVISIBLE_TO' ? 'DENY' : 'ALLOW',
    })),
    ...uniqueVisibleUserIds.map(targetUserId => ({ momentId: moment.id, userId: targetUserId, mode: 'ALLOW' })),
    ...uniqueHiddenUserIds.map(targetUserId => ({ momentId: moment.id, userId: targetUserId, mode: 'DENY' })),
  ];

  if ((privacyType === 'VISIBLE_TO' || privacyType === 'INVISIBLE_TO') && permissionRows.length > 0) {
    await prisma.momentPermission.createMany({ data: permissionRows });
  }

  return moment;
}

export async function getMoments(userId: string, page = 1, limit = 20, targetUserId?: string) {
  const friendIds = await acceptedFriendIds(userId);
  const visibleIds = [userId, ...friendIds];

  const myMemberships = await prisma.friendGroupMember.findMany({
    where: { peerId: userId },
    select: { groupId: true },
  });
  const myBelongedGroupIds = myMemberships.map(m => m.groupId);

  const finalScopeIds = targetUserId
    ? (visibleIds.includes(targetUserId) ? [targetUserId] : [])
    : visibleIds;

  const permissionFilter = {
    OR: [
      { userId },
      { privacyType: 'PUBLIC' },
      {
        privacyType: 'VISIBLE_TO',
        AND: [
          {
            OR: [
              { permissions: { some: { mode: 'ALLOW', groupId: { in: myBelongedGroupIds } } } },
              { permissions: { some: { mode: 'ALLOW', userId } } },
            ],
          },
          { permissions: { none: { mode: 'DENY', userId } } },
        ],
      },
      {
        privacyType: 'INVISIBLE_TO',
        AND: [
          { permissions: { none: { mode: 'DENY', groupId: { in: myBelongedGroupIds } } } },
          { permissions: { none: { mode: 'DENY', userId } } },
        ],
      },
    ],
  };

  const where = { userId: { in: finalScopeIds }, ...permissionFilter };

  const [moments, total] = await Promise.all([
    prisma.moment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, nickname: true, avatar: true } },
        likes: { select: { userId: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.moment.count({ where }),
  ]);

  const visibleInteractorIds = [...new Set([userId, ...friendIds])];
  const sanitizedMoments = await Promise.all(moments.map(async moment => {
    const visibleLikes = moment.likes.filter(like => visibleInteractorIds.includes(like.userId));
    const visibleComments = await prisma.momentComment.count({
      where: { momentId: moment.id, userId: { in: visibleInteractorIds } },
    });
    return {
      ...moment,
      likes: visibleLikes,
      _count: { likes: visibleLikes.length, comments: visibleComments },
    };
  }));

  return { moments: sanitizedMoments, total, hasMore: page * limit < total };
}

export async function toggleLike(momentId: string, userId: string) {
  await canViewMoment(momentId, userId);
  const existing = await prisma.momentLike.findUnique({
    where: { momentId_userId: { momentId, userId } },
  });
  if (existing) {
    await prisma.momentLike.delete({ where: { id: existing.id } });
    return { liked: false };
  }
  await prisma.momentLike.create({ data: { momentId, userId } });
  return { liked: true };
}

export async function addComment(momentId: string, userId: string, content: string) {
  await canViewMoment(momentId, userId);
  return prisma.momentComment.create({
    data: { momentId, userId, content },
    include: { user: { select: { id: true, username: true, nickname: true, avatar: true } } },
  });
}

export async function getComments(momentId: string, viewerId: string) {
  const moment = await canViewMoment(momentId, viewerId);
  const friendIds = new Set(await acceptedFriendIds(viewerId));

  return prisma.momentComment.findMany({
    where: {
      momentId,
      OR: [
        { userId: viewerId },
        { userId: moment.userId },
        { userId: { in: [...friendIds] } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, username: true, nickname: true, avatar: true } } },
  });
}

export async function deleteMoment(momentId: string, userId: string) {
  const moment = await prisma.moment.findUnique({ where: { id: momentId } });
  if (!moment || moment.userId !== userId) throw new Error('无权删除');
  return prisma.moment.delete({ where: { id: momentId } });
}

export async function deleteComment(commentId: string, userId: string) {
  const comment = await prisma.momentComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.userId !== userId) throw new Error('无权删除');
  return prisma.momentComment.delete({ where: { id: commentId } });
}
