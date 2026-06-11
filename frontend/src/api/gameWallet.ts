import { api } from './client';

export interface GameWallet {
  id: string;
  userId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface GameCoinTransaction {
  id: string;
  userId: string;
  coupleId?: string | null;
  amount: number;
  type: string;
  source: string;
  description: string;
  refType: string;
  refId: string;
  createdAt: string;
}

export function getGameWallet() {
  return api<GameWallet>('GET', '/api/game-wallet');
}

export function getGameTransactions(limit = 50) {
  return api<GameCoinTransaction[]>('GET', `/api/game-wallet/transactions?limit=${limit}`);
}
