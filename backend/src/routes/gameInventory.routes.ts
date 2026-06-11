import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as gameInventoryController from '../controllers/gameInventory.controller';

const router = Router();
router.use(authenticate);
router.get('/', gameInventoryController.getInventory);

export default router;
