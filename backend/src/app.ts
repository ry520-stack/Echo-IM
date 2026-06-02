import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import messageRoutes from './routes/message.routes';
import friendRoutes from './routes/friend.routes';
import groupRoutes from './routes/group.routes';
import emojiRoutes from './routes/emoji.routes';
import momentRoutes from './routes/moment.routes';
import uploadRoutes from './routes/upload.routes';
import delayedRoutes from './routes/delayed.routes';
import blockRoutes from './routes/block.routes';
import backgroundRoutes from './routes/background.routes';
import friendGroupRoutes from './routes/friendGroup.routes';
import pushRoutes from './routes/push.routes';
import petRoutes from './routes/pet.routes';
import coupleRoutes from './routes/couple.routes';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS 限制
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : [
      'http://localhost:5173',
      'http://localhost:8080',
      'http://8.140.194.214:8080',
      'http://echo-im.cloud',
      'https://echo-im.cloud',
    ];
// 支持 Cloudflare 临时隧道
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // 允许无 origin 的请求（如 curl、Postman）
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // 允许 Cloudflare 隧道域名
    if (origin.endsWith('.trycloudflare.com')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
app.use(cors(corsOptions));

// JSON 大小限制
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// 全局速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: '请求过于频繁，请稍后再试' },
});

// 鉴权路由严苛限制
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '尝试次数过多，请 1 分钟后再试' },
});

// 静态文件服务
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  setHeaders: (res) => { res.setHeader('Cache-Control', 'public, max-age=604800'); },
}));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 路由挂载
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/emojis', emojiRoutes);
app.use('/api/moments', momentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/delayed', delayedRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/backgrounds', backgroundRoutes);
app.use('/api/friend-groups', friendGroupRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/couples', coupleRoutes);

// Multer 文件上传错误处理
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '文件太大' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// 全局异常兜底
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Express Error]:', err);
  const message = process.env.NODE_ENV === 'production'
    ? '服务器内部错误'
    : err.message || '未知错误';
  res.status(500).json({ error: message });
});

export default app;
