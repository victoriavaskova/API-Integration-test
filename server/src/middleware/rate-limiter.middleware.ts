import rateLimit from 'express-rate-limit';

/**
 * Опции по умолчанию для всех лимитеров
 */
const defaultOptions = {
  standardHeaders: true, // Включить стандартные заголовки `RateLimit-*`
  legacyHeaders: false, // Отключить заголовки `X-RateLimit-*`
  message: {
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Слишком много запросов с вашего IP, попробуйте снова позже.',
  },
};

/**
 * @description 100 запросов в 15 минут на IP-адрес
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов
  ...defaultOptions,
});

/**
 * @description 10 запросов в 15 минут на IP-адрес
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // 10 запросов
  ...defaultOptions,
  message: {
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Слишком много попыток аутентификации. Пожалуйста, подождите.',
  },
});

/**
 * @description 20 запросов в минуту на IP-адрес
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 20, // 20 запросов
  ...defaultOptions,
  message: {
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Превышен лимит запросов для выполнения операций. Пожалуйста, подождите.',
  },
}); 