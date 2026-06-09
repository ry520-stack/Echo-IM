import { Request, Response } from 'express';
import * as petService from '../services/pet.service';

export async function getPet(req: Request, res: Response) {
  try {
    res.json(await petService.getPet(req.userId, req.params.peerId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function adoptPet(req: Request, res: Response) {
  try {
    res.json(await petService.adoptPet(req.userId, req.params.peerId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function updatePet(req: Request, res: Response) {
  try {
    res.json(await petService.updatePet(req.userId, req.params.peerId, req.body || {}));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function repairStreak(req: Request, res: Response) {
  try {
    res.json(await petService.repairStreak(req.userId, req.params.peerId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function rejectPet(req: Request, res: Response) {
  try {
    res.json(await petService.rejectPet(req.userId, req.params.peerId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function petAction(req: Request, res: Response) {
  try {
    res.json(await petService.petAction(req.userId, req.params.peerId, req.body?.action));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
