import { Request, Response } from 'express';
import * as coupleService from '../services/couple.service';

export async function getMine(req: Request, res: Response) {
  try { res.json(await coupleService.getMine(req.userId)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function requestBond(req: Request, res: Response) {
  try { res.json(await coupleService.requestBond(req.userId, req.body?.peerId)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function respond(req: Request, res: Response) {
  try { res.json(await coupleService.respond(req.userId, !!req.body?.accept)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function updateSpace(req: Request, res: Response) {
  try { res.json(await coupleService.updateSpace(req.userId, req.body || {})); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function sendSos(req: Request, res: Response) {
  try { res.json(await coupleService.sendSos(req.userId)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function unbind(req: Request, res: Response) {
  try { res.json(await coupleService.unbind(req.userId)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function requestUnbind(req: Request, res: Response) {
  try { res.json(await coupleService.requestUnbind(req.userId)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function respondUnbind(req: Request, res: Response) {
  try { res.json(await coupleService.respondUnbind(req.userId, !!req.body?.accept)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
