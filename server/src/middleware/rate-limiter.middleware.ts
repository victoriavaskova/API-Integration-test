import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible';
import { createClient } from 'redis';
import * as dotenv from 'dotenv';

dotenv.config();

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL,
  disableOfflineQueue: true,
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

// Connect to Redis only if REDIS_URL is provided
if (process.env.REDIS_URL) {
  redisClient.connect().catch(console.error);
}

const getLimiter = (opts: any): RateLimiterAbstract => {
  if (process.env.REDIS_URL && redisClient.isOpen) {
    return new RateLimiterRedis({ storeClient: redisClient, ...opts });
  }
  return new RateLimiterMemory(opts);
};

const TOO_MANY_REQUESTS_MESSAGE = {
  statusCode: 429,
  error: 'Too Many Requests',
  message: 'Слишком много запросов, попробуйте снова позже.',
};

const createRateLimiter = (opts: any) => {
  const limiter = getLimiter(opts);
  return (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const key = req.user ? req.user.userId : req.ip;
    limiter.consume(key)
      .then(() => {
        next();
      })
      .catch(() => {
        res.status(429).json({ ...TOO_MANY_REQUESTS_MESSAGE, ...opts.message });
      });
  };
};

export const globalLimiter = createRateLimiter({
  points: 100, // 100 requests
  duration: 15 * 60, // per 15 minutes
});

export const authLimiter = createRateLimiter({
  points: 10, // 10 requests
  duration: 15 * 60, // per 15 minutes
  message: {
    message: 'Слишком много попыток аутентификации. Пожалуйста, подождите.',
  }
});

export const apiLimiter = createRateLimiter({
  points: 20, // 20 requests
  duration: 60, // per 1 minute
  message: {
    message: 'Превышен лимит запросов для выполнения операций. Пожалуйста, подождите.',
  }
});

// Example of personalized limiter by user subscription plan
export const personalizedLimiter = (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  const user = req.user;
  let points = 50; // default points
  // Example: extend this logic to check user's subscription plan from the database
  // if (user && user.subscription === 'premium') {
  //   points = 100;
  // }

  const limiter = getLimiter({
    points,
    duration: 60,
  });

  limiter.consume(user ? user.userId : req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
        res.status(429).json(TOO_MANY_REQUESTS_MESSAGE);
    });
}; 