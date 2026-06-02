import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, videoUpload, ringtoneUpload } from '../services/upload.service';
import * as uploadController from '../controllers/upload.controller';

const router = Router();

router.use(authenticate);
router.post('/avatar', upload.single('file'), uploadController.uploadAvatar);
router.post('/background', upload.single('file'), uploadController.uploadBackground);
router.post('/chat-image', upload.single('file'), uploadController.uploadChatImage);
router.post('/voice', upload.single('file'), uploadController.uploadVoice);
router.post('/ringtone', ringtoneUpload.single('file'), uploadController.uploadRingtone);
router.post('/video', videoUpload.single('file'), uploadController.uploadVideo);
router.post('/emoji', upload.single('file'), uploadController.uploadEmoji);

export default router;
