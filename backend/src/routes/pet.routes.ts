import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as petController from '../controllers/pet.controller';

const router = Router();
router.use(authenticate);
router.get('/:peerId', petController.getPet);
router.post('/:peerId/adopt', petController.adoptPet);
router.post('/:peerId/reject', petController.rejectPet);
router.post('/:peerId/repair', petController.repairStreak);
router.post('/:peerId/action', petController.petAction);
router.patch('/:peerId', petController.updatePet);

export default router;
