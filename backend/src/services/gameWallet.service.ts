import prisma from '../utils/prisma';
import { requireActiveCouple } from './coupleAccess.service';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type CoinChangeParams = {
  userId: string;
  amount: number;
  type: string;
  coupleId?: string;
  source?: string;
  description?: string;
  refType?: string;
  refId?: string;
};

export async function ensureWallet(userId: string, tx: TxClient | typeof prisma = prisma) {
  return (tx as any).gameWallet.upsert({
    where: { userId },
    create: { userId, balance: 100 },
    update: {},
  });
}

export async function getWallet(userId: string) {
  return ensureWallet(userId);
}

export async function getTransactions(userId: string, limit = 50) {
  await ensureWallet(userId);
  return (prisma as any).gameCoinTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });
}

export async function changeCoinsInTx(tx: TxClient, params: CoinChangeParams) {
  if (!Number.isInteger(params.amount) || params.amount === 0) throw new Error('金币数量不正确');

  const wallet = await ensureWallet(params.userId, tx);
  const nextBalance = wallet.balance + params.amount;
  if (nextBalance < 0) throw new Error('金币不足');

  const updated = await (tx as any).gameWallet.update({
    where: { userId: params.userId },
    data: { balance: nextBalance },
  });

  await (tx as any).gameCoinTransaction.create({
    data: {
      userId: params.userId,
      coupleId: params.coupleId || null,
      amount: params.amount,
      type: params.type,
      source: params.source || '',
      description: params.description || '',
      refType: params.refType || '',
      refId: params.refId || '',
    },
  });

  return updated;
}

export async function changeCoins(params: CoinChangeParams) {
  return prisma.$transaction(async tx => changeCoinsInTx(tx, params));
}

export async function transferCoins(params: {
  fromUserId: string;
  toUserId: string;
  amount: number;
  coupleId?: string;
  description?: string;
  refType?: string;
  refId?: string;
}) {
  if (!Number.isInteger(params.amount) || params.amount <= 0) throw new Error('转账金币数量不正确');

  return prisma.$transaction(async tx => {
    const from = await ensureWallet(params.fromUserId, tx);
    const to = await ensureWallet(params.toUserId, tx);
    if (from.balance < params.amount) throw new Error('金币不足');

    const [fromWallet, toWallet] = await Promise.all([
      (tx as any).gameWallet.update({
        where: { userId: params.fromUserId },
        data: { balance: from.balance - params.amount },
      }),
      (tx as any).gameWallet.update({
        where: { userId: params.toUserId },
        data: { balance: to.balance + params.amount },
      }),
    ]);

    await (tx as any).gameCoinTransaction.createMany({
      data: [
        {
          userId: params.fromUserId,
          coupleId: params.coupleId || null,
          amount: -params.amount,
          type: 'loan_out',
          source: 'transfer',
          description: params.description || '',
          refType: params.refType || '',
          refId: params.refId || '',
        },
        {
          userId: params.toUserId,
          coupleId: params.coupleId || null,
          amount: params.amount,
          type: 'loan_income',
          source: 'transfer',
          description: params.description || '',
          refType: params.refType || '',
          refId: params.refId || '',
        },
      ],
    });

    return { fromWallet, toWallet };
  });
}

export async function dailySignin(userId: string) {
  const { bond } = await requireActiveCouple(userId);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return prisma.$transaction(async tx => {
    const transaction = await (tx as any).gameCoinTransaction.findFirst({
      where: {
        userId,
        type: 'signin_income',
        source: 'daily-signin',
        createdAt: { gte: start, lt: end },
      },
    });

    if (transaction) {
      return { alreadySigned: true, wallet: await ensureWallet(userId, tx), transaction };
    }

    const wallet = await changeCoinsInTx(tx, {
      userId,
      coupleId: bond.id,
      amount: 20,
      type: 'signin_income',
      source: 'daily-signin',
      description: '情侣小屋每日签到',
    });

    return { alreadySigned: false, wallet };
  });
}
