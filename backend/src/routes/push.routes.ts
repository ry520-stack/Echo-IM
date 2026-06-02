import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as pushController from '../controllers/push.controller';

const router = Router();
router.use(authenticate);

router.post('/devices', pushController.registerDevice);
router.delete('/devices', pushController.unregisterDevice);

export default router;
