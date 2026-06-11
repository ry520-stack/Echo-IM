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
export async function getItems(req: Request, res: Response) {
  try { res.json(await coupleService.getItems(req.userId, String(req.query.type || ''))); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function createItem(req: Request, res: Response) {
  try { res.status(201).json(await coupleService.createItem(req.userId, req.body || {})); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function updateItem(req: Request, res: Response) {
  try { res.json(await coupleService.updateItem(req.userId, req.params.itemId, req.body || {})); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function archiveItem(req: Request, res: Response) {
  try { res.json(await coupleService.archiveItem(req.userId, req.params.itemId)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function getAlbumGroups(req: Request, res: Response) {
  try { res.json(await coupleService.getAlbumGroups(req.userId)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function createAlbumGroup(req: Request, res: Response) {
  try { res.status(201).json(await coupleService.createAlbumGroup(req.userId, req.body || {})); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function updateAlbumGroup(req: Request, res: Response) {
  try { res.json(await coupleService.updateAlbumGroup(req.userId, req.params.groupId, req.body || {})); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function deleteAlbumGroup(req: Request, res: Response) {
  try { res.json(await coupleService.deleteAlbumGroup(req.userId, req.params.groupId)); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function addAlbumPhotos(req: Request, res: Response) {
  try { res.json(await coupleService.addAlbumPhotos(req.userId, req.params.groupId, Array.isArray(req.body?.photos) ? req.body.photos : [])); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function deleteAlbumPhotos(req: Request, res: Response) {
  try { res.json(await coupleService.deleteAlbumPhotos(req.userId, req.params.groupId, Array.isArray(req.body?.photoIds) ? req.body.photoIds : [])); } catch (e: any) { res.status(400).json({ error: e.message }); }
}
