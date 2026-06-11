import { api } from './client';
import type { GameWallet } from './gameWallet';

export interface LeisureHome {
  id: string;
  coupleId: string;
  level: number;
  theme: string;
  comfortScore: number;
  cleanliness: number;
  backgroundId: string;
  wallpaperId: string;
  floorId: string;
  layoutJson: string;
  frozen: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlacedFurniture {
  id?: string;
  homeId?: string;
  userId?: string;
  furnitureId: string;
  x: number;
  y: number;
  rotation: number;
  layer: number;
}

export interface LeisureHomeBundle {
  home: LeisureHome;
  placed: PlacedFurniture[];
  placementLimit: number;
  myWallet: GameWallet;
  peerWallet: GameWallet;
  peer?: { id: string; username: string; nickname: string; avatar: string; digitalId: number } | null;
  pet?: { id: string; name: string; level: number; mood?: string; activity?: string; avatar?: string } | null;
}

export function getLeisureHome() {
  return api<LeisureHomeBundle>('GET', '/api/leisure-home');
}

export function initLeisureHome() {
  return api<LeisureHomeBundle>('POST', '/api/leisure-home/init');
}

export function saveLeisureLayout(items: PlacedFurniture[]) {
  return api<{ home: LeisureHome; placed: PlacedFurniture[] }>('POST', '/api/leisure-home/layout/save', { items });
}

export function cleanLeisureHome() {
  return api<{ home: LeisureHome }>('POST', '/api/leisure-home/clean');
}
