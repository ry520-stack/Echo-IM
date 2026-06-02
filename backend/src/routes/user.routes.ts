import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

router.use(authenticate);
router.get('/me', userController.getMe);
router.put('/me', userController.updateMe);
router.get('/search', userController.search);

export default router;
