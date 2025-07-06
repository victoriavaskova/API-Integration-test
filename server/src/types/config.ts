// Типы для конфигурации приложения
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  clientUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Типы для конфигурации базы данных
export interface DatabaseConfig {
  url: string;
}

// Типы для конфигурации JWT
export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

// Типы для конфигурации внешнего API
export interface ExternalApiConfig {
  baseUrl: string;
  userId: number;
  secretKey: string;
  endpoints: {
    health: string;
    auth: string;
    balance: string;
    checkBalance: string;
    bet: string;
    win: string;
  };
  rateLimits: {
    global: string;
    auth: string;
    betting: string;
  };
}

// Типы для административной конфигурации
export interface AdminConfig {
  token: string;
}

// Основная конфигурация приложения
export interface Config {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  externalApi: ExternalApiConfig;
  admin: AdminConfig;
}

// Типы для переменных окружения
export interface EnvironmentVariables {
  PORT?: string;
  NODE_ENV?: string;
  CLIENT_URL?: string;
  LOG_LEVEL?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
  EXTERNAL_API_URL?: string;
  EXTERNAL_USER_ID?: string;
  EXTERNAL_SECRET_KEY?: string;
  ADMIN_TOKEN?: string;
}

// Функция для валидации переменных окружения
export function validateEnvironmentVariables(env: EnvironmentVariables): void {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'EXTERNAL_API_URL',
    'EXTERNAL_USER_ID', 
    'EXTERNAL_SECRET_KEY',
    'ADMIN_TOKEN'
  ] as const;

  const missingVars = requiredVars.filter(
    (varName) => !env[varName] || env[varName] === ''
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
}

// Функция для создания конфигурации из переменных окружения
export function createConfig(env: EnvironmentVariables): Config {
  validateEnvironmentVariables(env);

  const config: Config = {
    app: {
      port: parseInt(env.PORT || '3003', 10),
      nodeEnv: (env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
      clientUrl: env.CLIENT_URL || 'http://localhost:5173',
      logLevel: (env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error'
    },
    database: {
      url: env.DATABASE_URL!
    },
    jwt: {
      secret: env.JWT_SECRET!,
      expiresIn: env.JWT_EXPIRES_IN || '24h'
    },
    externalApi: {
      baseUrl: env.EXTERNAL_API_URL!,
      userId: parseInt(env.EXTERNAL_USER_ID!, 10),
      secretKey: env.EXTERNAL_SECRET_KEY!,
      endpoints: {
        health: '/health',
        auth: '/auth',
        balance: '/balance',
        checkBalance: '/check-balance',
        bet: '/bet',
        win: '/win'
      },
      rateLimits: {
        global: '100 requests per 15 minutes',
        auth: '10 requests per 15 minutes',
        betting: '20 requests per minute'
      }
    },
    admin: {
      token: env.ADMIN_TOKEN!
    }
  };

  return config;
}

// Экспорт конфигурации по умолчанию
export const config = createConfig(process.env as EnvironmentVariables);

// Типы для настроек безопасности
export interface SecurityConfig {
  corsOrigins: string[];
  rateLimitWindows: {
    global: {
      windowMs: number;
      maxRequests: number;
    };
    auth: {
      windowMs: number;
      maxRequests: number;
    };
    betting: {
      windowMs: number;
      maxRequests: number;
    };
  };
}

// Настройки безопасности по умолчанию
export const securityConfig: SecurityConfig = {
  corsOrigins: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080'
  ],
  rateLimitWindows: {
    global: {
      windowMs: 15 * 60 * 1000, // 15 минут
      maxRequests: 100
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 минут
      maxRequests: 10
    },
    betting: {
      windowMs: 60 * 1000, // 1 минута
      maxRequests: 20
    }
  }
}; 