import { api } from './client';

export interface GameInventoryItem {
  id: string;
  userId: string;
  itemType: string;
  itemId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export function getGameInventory(itemType?: string) {
  return api<GameInventoryItem[]>('GET', `/api/game-inventory${itemType ? `?itemType=${encodeURIComponent(itemType)}` : ''}`);
}
