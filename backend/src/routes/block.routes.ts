import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as blockService from '../services/block.service';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const list = await blockService.getBlockedUsers(req.userId);
    res.json(list);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:userId', async (req: Request, res: Response) => {
  try {
    await blockService.blockUser(req.userId, req.params.userId);
    res.json({ message: '已拉黑' });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/:userId', async (req: Request, res: Response) => {
  try {
    await blockService.unblockUser(req.userId, req.params.userId);
    res.json({ message: '已取消拉黑' });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

export default router;
