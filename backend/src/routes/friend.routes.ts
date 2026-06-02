import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as friendController from '../controllers/friend.controller';

const router = Router();

router.use(authenticate);
router.get('/', friendController.getFriends);
router.get('/pending', friendController.getPending);
router.get('/echo-rankings', friendController.getEchoRankings);
router.get('/relationship/:peerId', friendController.getRelationshipSummary);
router.patch('/relationship/:peerId', friendController.updateRelationshipSettings);
router.post('/request', friendController.sendRequest);
router.patch('/:id/accept', friendController.acceptRequest);
router.patch('/:id/reject', friendController.rejectRequest);
router.put('/:id/alias', friendController.updateAlias);
router.put('/:id/pin', friendController.togglePin);
router.put('/:id/background', friendController.setBackground);
router.put('/:id/mute', friendController.toggleMute);
router.put('/:id/hidden', friendController.toggleHidden);
router.delete('/:id', friendController.removeFriend);

export default router;
