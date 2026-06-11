import { Request, Response } from 'express';
import * as furnitureService from '../services/furniture.service';

export async function getCatalog(req: Request, res: Response) {
  try {
    res.json(await furnitureService.getCatalog({
      type: req.query.type ? String(req.query.type) : undefined,
      rarity: req.query.rarity ? String(req.query.rarity) : undefined,
    }));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getMyFurniture(req: Request, res: Response) {
  try {
    res.json(await furnitureService.getMyFurniture(req.userId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function buyFurniture(req: Request, res: Response) {
  try {
    res.status(201).json(await furnitureService.buyFurniture(req.userId, req.body || {}));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
