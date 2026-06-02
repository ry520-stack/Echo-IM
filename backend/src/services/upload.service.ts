import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// Ensure upload dirs exist
['avatars', 'backgrounds', 'emojis', 'voices', 'videos'].forEach(sub => {
  const dir = path.join(UPLOAD_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片、音频或视频文件'));
  }
};

// 视频专用上传（更大文件限制）
export const videoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB (清晰图片/GIF/音频)
});

export const ringtoneUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 80 * 1024 * 1024 }, // 80MB for custom call ringtones
});

export function getUploadUrl(filename: string): string {
  return `/uploads/${filename}`;
}

export function deleteUploadFile(filename: string) {
  const safeFilename = path.basename(filename);
  const filepath = path.join(UPLOAD_DIR, safeFilename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
}
