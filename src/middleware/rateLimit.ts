import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

const WINDOW_MS = 60 * 1000; // 1 phút
const MAX_REQUESTS = 10;     // 10 requests / 1 phút / IP

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch((err) => console.error('[REDIS_CONNECT_ERROR]', err));

export const bookingIpRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  message: { code: 429, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
});

const MAX_PER_EMAIL = 1;

export const bookingEmailRateLimit = rateLimit({
  windowMs: 2_000,
  max: MAX_PER_EMAIL,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  keyGenerator: (req: Request) => {
    const email = (req.body?.userEmail || '').toString().toLowerCase().trim();
    // Nếu có email thì rate-limit theo email; nếu không thì fallback IP đã được normalize (IPv6-safe)
    return email || ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? '');
  },
  message: { code: 429, message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' },
});
