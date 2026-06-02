import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as messageController from '../controllers/message.controller';

const router = Router();

router.use(authenticate);
router.get('/conversations', messageController.getConversations);
router.get('/search', messageController.searchMessages);
router.get('/consecutive-days', messageController.consecutiveDays);
router.get('/context/:id', messageController.getMessageContext);
router.get('/group', messageController.getGroupMessages);
router.get('/', messageController.getMessages);
router.put('/read', messageController.markRead);
router.put('/:id/recall', messageController.recallMessage);
router.delete('/:id', messageController.deleteMessage);
router.post('/batch-delete', messageController.batchDelete);
router.post('/clear', messageController.clearConversation);

export default router;
