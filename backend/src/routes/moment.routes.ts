import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as momentController from '../controllers/moment.controller';

const router = Router();

router.use(authenticate);
router.get('/', momentController.getMoments);
router.post('/', momentController.createMoment);
router.post('/:id/like', momentController.toggleLike);
router.get('/:id/comments', momentController.getComments);
router.delete('/:id', momentController.deleteMoment);
router.post('/:id/comments', momentController.addComment);
router.delete('/:id/comments/:commentId', momentController.deleteComment);

export default router;
