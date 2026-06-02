import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as groupController from '../controllers/group.controller';

const router = Router();

router.use(authenticate);
router.get('/', groupController.getMyGroups);
router.get('/:id', groupController.getGroupDetail);
router.post('/', groupController.createGroup);
router.put('/:id/name', groupController.renameGroup);
router.patch('/:id/profile', groupController.updateGroupProfile);
router.patch('/:id/my-profile', groupController.updateMyGroupProfile);
router.post('/:id/members', groupController.addMembers);
router.delete('/:id/members/:userId', groupController.removeMember);
router.patch('/:id/members/:userId/role', groupController.updateMemberRole);
router.post('/:id/transfer-owner', groupController.transferOwner);
router.post('/:id/leave', groupController.leaveGroup);
router.delete('/:id', groupController.dismissGroup);

export default router;
