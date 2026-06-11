import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as leisureHomeController from '../controllers/leisureHome.controller';

const router = Router();
router.use(authenticate);
router.get('/', leisureHomeController.getHome);
router.post('/init', leisureHomeController.initHome);
router.get('/layout', leisureHomeController.getLayout);
router.post('/layout/save', leisureHomeController.saveLayout);
router.post('/clean', leisureHomeController.cleanHome);

export default router;
