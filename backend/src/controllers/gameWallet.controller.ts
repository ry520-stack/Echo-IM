import { Request, Response } from 'express';
import * as gameWalletService from '../services/gameWallet.service';

export async function getWallet(req: Request, res: Response) {
  try {
    res.json(await gameWalletService.getWallet(req.userId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getTransactions(req: Request, res: Response) {
  try {
    res.json(await gameWalletService.getTransactions(req.userId, Number(req.query.limit || 50)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function dailySignin(req: Request, res: Response) {
  try {
    res.json(await gameWalletService.dailySignin(req.userId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
