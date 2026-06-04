import { Request, Response } from 'express';
import * as service from '../services/couple.service';

function handle(res: Response, action: Promise<any>) {
  action.then(value => res.json(value)).catch(error => res.status(400).json({ error: error.message }));
}

export function getSummary(req: Request, res: Response) { handle(res, service.getSummary(req.userId)); }
export function requestBond(req: Request, res: Response) { handle(res, service.requestBond(req.userId, req.body?.peerId)); }
export function respond(req: Request, res: Response) { handle(res, service.respond(req.userId, !!req.body?.accept)); }
export function updateSettings(req: Request, res: Response) { handle(res, service.updateSettings(req.userId, req.body || {})); }
export function sendSos(req: Request, res: Response) { handle(res, service.sendSos(req.userId)); }
export function unbind(req: Request, res: Response) { handle(res, service.unbind(req.userId)); }
export function forceUnbind(req: Request, res: Response) { handle(res, service.forceUnbind(req.userId)); }
export function getItems(req: Request, res: Response) { handle(res, service.getItems(req.userId, String(req.query.type || ''))); }
export function createItem(req: Request, res: Response) { handle(res, service.createItem(req.userId, req.body || {})); }
export function updateItem(req: Request, res: Response) { handle(res, service.updateItem(req.userId, req.params.id, req.body || {})); }
export function archiveItem(req: Request, res: Response) { handle(res, service.archiveItem(req.userId, req.params.id)); }
export function updateCycle(req: Request, res: Response) { handle(res, service.updateCycle(req.userId, req.body || {})); }
export function getContracts(req: Request, res: Response) { handle(res, service.getContracts(req.userId)); }
export function createContract(req: Request, res: Response) { handle(res, service.createContract(req.userId, req.body || {})); }
export function updateContract(req: Request, res: Response) { handle(res, service.updateContract(req.userId, req.params.id, req.body || {})); }
export function getWeeklyReport(req: Request, res: Response) { handle(res, service.getWeeklyReport(req.userId)); }
export function getActivityConfig(req: Request, res: Response) { handle(res, service.getActivityConfig(req.userId)); }
export function updatePetSkin(req: Request, res: Response) { handle(res, service.updatePetSkin(req.userId, String(req.body?.skin || ''))); }
