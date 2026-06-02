import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as emojiController from '../controllers/emoji.controller';

const router = Router();

router.use(authenticate);
router.get('/', emojiController.getEmojis);
router.post('/', emojiController.createEmoji);
router.put('/order', emojiController.reorderEmojis);
router.delete('/batch', emojiController.batchDeleteEmojis);
router.delete('/:id', emojiController.deleteEmoji);

export default router;
