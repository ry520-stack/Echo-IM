import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as delayedController from '../controllers/delayed.controller';

const router = Router();

router.use(authenticate);
router.post('/', delayedController.schedule);
router.get('/', delayedController.getScheduled);
router.delete('/:id', delayedController.cancel);

export default router;
