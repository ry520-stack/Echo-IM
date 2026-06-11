import { Request, Response } from 'express';
import * as gameInventoryService from '../services/gameInventory.service';

export async function getInventory(req: Request, res: Response) {
  try {
    res.json(await gameInventoryService.getInventory(req.userId, req.query.itemType ? String(req.query.itemType) : undefined));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
