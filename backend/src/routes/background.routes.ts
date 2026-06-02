import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as backgroundController from '../controllers/background.controller';

const router = Router();

router.use(authenticate);
router.get('/', backgroundController.getBackgrounds);
router.put('/', backgroundController.updateBackground);
router.put('/chat', backgroundController.updateChatBackground);

export default router;
