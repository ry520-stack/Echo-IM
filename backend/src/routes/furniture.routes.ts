import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as furnitureController from '../controllers/furniture.controller';

const router = Router();
router.use(authenticate);
router.get('/catalog', furnitureController.getCatalog);
router.get('/my', furnitureController.getMyFurniture);
router.post('/buy', furnitureController.buyFurniture);

export default router;
