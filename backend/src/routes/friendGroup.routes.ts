import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as groupController from '../controllers/friendGroup.controller';

const router = Router();
router.use(authenticate);

router.get('/', groupController.getMyGroups);
router.post('/', groupController.createGroup);
router.patch('/:id', groupController.updateGroup);
router.delete('/:id', groupController.deleteGroup);
router.post('/:id/members', groupController.addMember);
router.delete('/:id/members/:peerId', groupController.removeMember);

export default router;
