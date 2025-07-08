import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for development logs
const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
  ),
  transports: [
    // In development, we log to the console with a simple, colorful format
    new winston.transports.Console({
      format: combine(
        colorize(),
        devFormat
      )
    })
  ],
});

// In production, we add file transports and use JSON format
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: json(),
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    format: json(),
  }));
}

export default logger; 