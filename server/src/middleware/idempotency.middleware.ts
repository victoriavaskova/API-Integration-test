import type { Response, NextFunction } from 'express';
import type { IdempotencyKeyRepository } from '../repositories/idempotency.repository.js';
import type { AuthenticatedRequest } from './auth.middleware.js';

export function idempotencyMiddleware(idempotencyRepo: IdempotencyKeyRepository) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.method !== 'POST' && req.method !== 'PATCH') {
      return next();
    }

    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    if (!idempotencyKey) {
      // Можно либо пропускать, либо возвращать ошибку, если ключ обязателен
      // В данном случае, пропускаем, если ключ не предоставлен
      return next();
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated for idempotency check' });
    }

    try {
      // Проверяем, заблокирован ли ключ (обрабатывается другим запросом)
      if (await idempotencyRepo.isLocked(idempotencyKey)) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Request with this Idempotency-Key is already being processed.',
        });
      }

      // Ищем существующий ключ
      const existingKey = await idempotencyRepo.find(idempotencyKey);

      if (existingKey) {
        // Ключ найден, возвращаем сохраненный ответ
        return res
          .status(existingKey.statusCode)
          .json(existingKey.responseBody);
      }

      // Ключ не найден, создаем новую запись, чтобы заблокировать его
      await idempotencyRepo.create({
        key: idempotencyKey,
        userId: userId,
        endpoint: req.path,
        requestBody: req.body,
      });

      // Перехватываем ответ, чтобы сохранить его
      const originalJson = res.json;
      res.json = (body) => {
        // Сохраняем результат перед отправкой
        idempotencyRepo.update(idempotencyKey, {
          responseBody: body,
          statusCode: res.statusCode,
        });
        return originalJson.call(res, body);
      };

      return next();
    } catch (error) {
      console.error('Idempotency middleware error:', error);
      return next(error);
    }
  };
} 