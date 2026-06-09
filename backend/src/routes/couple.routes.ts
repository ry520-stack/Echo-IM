import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as coupleController from '../controllers/couple.controller';

const router = Router();
router.use(authenticate);
router.get('/', coupleController.getMine);
router.post('/request', coupleController.requestBond);
router.post('/respond', coupleController.respond);
router.patch('/', coupleController.updateSpace);
router.post('/sos', coupleController.sendSos);
router.post('/unbind', coupleController.unbind);
router.post('/unbind/request', coupleController.requestUnbind);
router.post('/unbind/respond', coupleController.respondUnbind);
export default router;
