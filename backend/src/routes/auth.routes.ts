import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as verificationController from '../controllers/verification.controller';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/reset-password', authController.resetPassword);
router.get('/captcha', verificationController.getCaptcha);
router.post('/send-code', verificationController.sendCode);

export default router;
