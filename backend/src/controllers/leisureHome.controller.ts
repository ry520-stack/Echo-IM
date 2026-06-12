import { Request, Response } from 'express';
import * as leisureHomeService from '../services/leisureHome.service';

export async function getHome(req: Request, res: Response) {
  try {
    res.json(await leisureHomeService.getHome(req.userId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function initHome(req: Request, res: Response) {
  try {
    res.status(201).json(await leisureHomeService.getHome(req.userId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getLayout(req: Request, res: Response) {
  try {
    const home = await leisureHomeService.getHome(req.userId);
    res.json({ home: home.home, placed: home.placed, placementLimit: home.placementLimit });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function saveLayout(req: Request, res: Response) {
  try {
    res.json(await leisureHomeService.saveLayout(req.userId, req.body || {}));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function cleanHome(req: Request, res: Response) {
  try {
    res.json(await leisureHomeService.cleanHome(req.userId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function upgradeHome(req: Request, res: Response) {
  try {
    res.json(await leisureHomeService.upgradeHome(req.userId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
