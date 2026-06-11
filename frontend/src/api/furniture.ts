import { api } from './client';

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  price: number;
  width: number;
  height: number;
  imageUrl: string;
  icon: string;
  comfortValue: number;
  effectConfig: string;
  isLimited: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface UserFurnitureInventory {
  id: string;
  userId: string;
  furnitureId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export function getFurnitureCatalog(params: { type?: string; rarity?: string } = {}) {
  const query = new URLSearchParams();
  if (params.type) query.set('type', params.type);
  if (params.rarity) query.set('rarity', params.rarity);
  const suffix = query.toString() ? `?${query}` : '';
  return api<FurnitureCatalogItem[]>('GET', `/api/furniture/catalog${suffix}`);
}

export function getMyFurniture() {
  return api<UserFurnitureInventory[]>('GET', '/api/furniture/my');
}

export function buyFurniture(furnitureId: string, quantity = 1) {
  return api<{ furniture: FurnitureCatalogItem; inventory: UserFurnitureInventory }>('POST', '/api/furniture/buy', { furnitureId, quantity });
}
