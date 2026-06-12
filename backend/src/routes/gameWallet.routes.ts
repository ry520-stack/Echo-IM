import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as gameWalletController from '../controllers/gameWallet.controller';

const router = Router();
router.use(authenticate);
router.get('/', gameWalletController.getWallet);
router.get('/transactions', gameWalletController.getTransactions);
router.post('/signin', gameWalletController.dailySignin);

export default router;
