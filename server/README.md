# 🔧 Betting Integration Server - Техническая документация

Полное техническое руководство по серверной части системы интеграции с внешним API платформы ставок.

## 📋 Содержание

- [Архитектура системы](#-архитектура-системы)
- [Схема базы данных](#-схема-базы-данных)
- [Компонентная диаграмма](#-компонентная-диаграмма)
- [Процесс деплоя](#-процесс-деплоя)
- [API эндпоинты](#-api-эндпоинты)
- [Конфигурация](#-конфигурация)
- [Безопасность](#-безопасность)
- [Мониторинг и логирование](#-мониторинг-и-логирование)
- [Тестирование](#-тестирование)
- [Troubleshooting](#-troubleshooting)

## 🏗️ Архитектура системы

### Общая схема архитектуры

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Client]
        MOBILE[Mobile App]
        API_CLIENT[API Client]
    end

    subgraph "Load Balancer"
        LB[nginx/ALB]
    end

    subgraph "Application Layer"
        subgraph "Express Server"
            MW[Middleware Layer]
            RT[Router Layer]
            CT[Controller Layer]
            SV[Service Layer]
            RP[Repository Layer]
        end
        
        subgraph "External Clients"
            EXT_API[External API Client]
            LOG[Logger Service]
        end
    end

    subgraph "Data Layer"
        DB[(PostgreSQL)]
        REDIS[(Redis Cache)]
    end

    subgraph "External Services"
        BETTING_API[Betting Provider API]
    end

    WEB --> LB
    MOBILE --> LB
    API_CLIENT --> LB
    
    LB --> MW
    MW --> RT
    RT --> CT
    CT --> SV
    SV --> RP
    SV --> EXT_API
    
    RP --> DB
    SV --> REDIS
    EXT_API --> BETTING_API
    
    MW --> LOG
    SV --> LOG
    EXT_API --> LOG
```

### Слоеная архитектура (Layered Architecture)

```mermaid
graph TD
    A[HTTP Request] --> B[Middleware Layer]
    B --> C[Controller Layer]
    C --> D[Service Layer]
    D --> E[Repository Layer]
    E --> F[Database Layer]
    
    D --> G[External API Client]
    G --> H[External Services]
    
    subgraph "Cross-cutting Concerns"
        I[Logging]
        J[Error Handling]
        K[Authentication]
        L[Validation]
    end
    
    B -.-> I
    C -.-> J
    D -.-> I
    E -.-> I
    B -.-> K
    C -.-> L
```

**Описание слоев:**

1. **Middleware Layer** - Аутентификация, валидация, rate limiting, CORS
2. **Controller Layer** - Обработка HTTP запросов/ответов, маршрутизация
3. **Service Layer** - Бизнес-логика, оркестрация операций
4. **Repository Layer** - Абстракция доступа к данным
5. **Database Layer** - Prisma ORM + PostgreSQL

## 🗄️ Схема базы данных

### ERD диаграмма

```mermaid
erDiagram
    User {
        int id PK
        string username UK
        string email UK
        boolean isAdmin
        datetime lastLogin
        datetime createdAt
        datetime updatedAt
    }
    
    ExternalApiAccount {
        int id PK
        int userId FK
        string externalUserId
        string externalSecretKey
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    Bet {
        int id PK
        int userId FK
        string externalBetId UK
        decimal amount
        enum status
        decimal winAmount
        datetime createdAt
        datetime updatedAt
        datetime completedAt
    }
    
    Transaction {
        int id PK
        int userId FK
        int betId FK
        enum type
        decimal amount
        decimal balanceBefore
        decimal balanceAfter
        datetime createdAt
        string description
    }
    
    UserBalance {
        int id PK
        int userId UK
        decimal balance
        decimal externalBalance
        datetime lastCheckedAt
    }
    
    ApiLog {
        int id PK
        int userId FK
        string endpoint
        string method
        json requestBody
        json responseBody
        int statusCode
        datetime createdAt
        int requestDurationMs
        string ipAddress
    }
    
    IdempotencyKey {
        string id PK
        int userId
        string endpoint
        string requestHash
        json responseBody
        int statusCode
        datetime createdAt
        datetime lockedAt
    }

    User ||--o{ ExternalApiAccount : has
    User ||--o{ Bet : places
    User ||--o{ Transaction : has
    User ||--|| UserBalance : has
    User ||--o{ ApiLog : generates
    Bet ||--o{ Transaction : generates
```

### Типы данных и индексы

```sql
-- Основные индексы для оптимизации запросов
CREATE INDEX idx_external_api_accounts_user_id ON external_api_accounts(user_id);
CREATE INDEX idx_external_api_accounts_external_user_id ON external_api_accounts(external_user_id);
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX idx_api_logs_endpoint ON api_logs(endpoint);
CREATE INDEX idx_api_logs_created_at ON api_logs(created_at);

-- Составные индексы для сложных запросов
CREATE INDEX idx_idempotency_composite ON idempotency_keys(user_id, endpoint, request_hash);
```

## 🔧 Компонентная диаграмма

### Детальная структура компонентов

```mermaid
graph TB
    subgraph "Controllers"
        AC[AuthController]
        BC[BettingController]
        BAC[BalanceController]
    end
    
    subgraph "Services"
        AS[AuthService]
        BS[BettingService]
        BAS[BalanceService]
        EAPI[ExternalApiClient]
    end
    
    subgraph "Repositories"
        UR[UserRepository]
        BR[BetRepository]
        TR[TransactionRepository]
        BLR[BalanceRepository]
        ALR[ApiLogRepository]
        IR[IdempotencyRepository]
    end
    
    subgraph "Middleware"
        AUTH[AuthMiddleware]
        RL[RateLimitMiddleware]
        EH[ErrorHandlerMiddleware]
        ID[IdempotencyMiddleware]
    end
    
    subgraph "Configuration"
        DC[DatabaseConfig]
        AC_CONF[ApiConfig]
        LC[LoggerConfig]
        SC[SwaggerConfig]
    end
    
    subgraph "External"
        LOGGER[Winston Logger]
        PRISMA[Prisma Client]
        EXT_API[External Betting API]
    end

    AC --> AS
    BC --> BS
    BAC --> BAS
    
    AS --> UR
    BS --> BR
    BS --> TR
    BAS --> BLR
    
    AS --> EAPI
    BS --> EAPI
    BAS --> EAPI
    
    EAPI --> ALR
    EAPI --> EXT_API
    
    UR --> PRISMA
    BR --> PRISMA
    TR --> PRISMA
    BLR --> PRISMA
    ALR --> PRISMA
    IR --> PRISMA
    
    AS --> LOGGER
    BS --> LOGGER
    BAS --> LOGGER
    EAPI --> LOGGER
```

### Последовательная диаграмма: Полный цикл размещения ставки

```mermaid
sequenceDiagram
    participant Client
    participant MW as Middleware
    participant Controller
    participant Service
    participant Repository
    participant ExtAPI as External API
    participant DB as Database
    participant Logger

    Client->>+MW: POST /api/bets {amount: 3}
    MW->>MW: Rate Limiting Check
    MW->>MW: JWT Token Validation
    MW->>MW: Idempotency Check
    MW->>+Controller: Forward Request
    
    Controller->>Controller: Input Validation
    Controller->>+Service: placeBet(userId, amount)
    
    Service->>+Repository: getUserWithExternalAccount(userId)
    Repository->>+DB: SELECT user with external account
    DB-->>-Repository: User data
    Repository-->>-Service: User with credentials
    
    Service->>+ExtAPI: authenticate(externalUserId, secretKey)
    ExtAPI->>ExtAPI: Create HMAC signature
    ExtAPI->>+Logger: Log API call start
    ExtAPI-->>+External: POST /api/auth
    External-->>-ExtAPI: Auth response
    ExtAPI->>-Logger: Log API call end
    ExtAPI-->>-Service: Authentication result
    
    Service->>+ExtAPI: getBalance(externalUserId)
    ExtAPI-->>+External: POST /api/balance
    External-->>-ExtAPI: Current balance
    ExtAPI-->>-Service: Balance data
    
    alt Balance sufficient
        Service->>+ExtAPI: placeBet(externalUserId, amount)
        ExtAPI-->>+External: POST /api/bet {bet: 3}
        External-->>-ExtAPI: {bet_id: "123"}
        ExtAPI-->>-Service: Bet placement result
        
        Service->>+Repository: createBet(userId, externalBetId, amount)
        Repository->>+DB: INSERT INTO bets
        DB-->>-Repository: Created bet record
        Repository-->>-Service: Bet entity
        
        Service->>+ExtAPI: getBetResult(externalUserId, betId)
        ExtAPI-->>+External: POST /api/win {bet_id: "123"}
        External-->>-ExtAPI: {win: 6}
        ExtAPI-->>-Service: Win result
        
        Service->>+Repository: updateBetResult(betId, winAmount)
        Repository->>+DB: UPDATE bets SET win_amount, status
        DB-->>-Repository: Updated bet
        Repository-->>-Service: Updated bet entity
        
        Service->>+Repository: createTransaction(userId, betId, amount, type)
        Repository->>+DB: INSERT INTO transactions
        DB-->>-Repository: Transaction record
        Repository-->>-Service: Transaction entity
        
        Service->>+Repository: updateUserBalance(userId, newBalance)
        Repository->>+DB: UPDATE user_balances
        DB-->>-Repository: Updated balance
        Repository-->>-Service: Balance entity
        
        Service-->>-Controller: Bet result with win amount
        Controller-->>-MW: HTTP 201 Response
        MW-->>-Client: {id: "123", amount: 3, status: "completed", win_amount: 6}
    
    else Insufficient balance
        Service-->>-Controller: Insufficient balance error
        Controller-->>-MW: HTTP 400 Response
        MW-->>-Client: {error: "Insufficient balance"}
    end
```

## 🚀 Процесс деплоя

### Production Deploy Pipeline

```mermaid
graph TD
    A[Code Push] --> B[GitHub Actions]
    B --> C[Run Tests]
    C --> D{Tests Pass?}
    D -->|No| E[Notify Developer]
    D -->|Yes| F[Build Docker Image]
    F --> G[Push to Registry]
    G --> H[Deploy to Staging]
    H --> I[Run Integration Tests]
    I --> J{Tests Pass?}
    J -->|No| K[Rollback]
    J -->|Yes| L[Deploy to Production]
    L --> M[Health Check]
    M --> N{Healthy?}
    N -->|No| O[Auto Rollback]
    N -->|Yes| P[Deployment Complete]
```

### Docker Multi-stage Build

```dockerfile
# Этап 1: Установка зависимостей и сборка
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Этап 2: Production image
FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Генерация Prisma Client для production
RUN npx prisma generate

# Настройка пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3003
CMD ["node", "dist/app.js"]
```

### Environment Configuration

```bash
# Production .env template
NODE_ENV=production
PORT=3003

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/betting_db"

# JWT Configuration
JWT_SECRET="your-super-secure-jwt-secret-256-bits"
JWT_EXPIRES_IN="24h"

# External API
EXTERNAL_API_URL="https://bets.tgapps.cloud/api"
EXTERNAL_USER_ID="your-user-id"
EXTERNAL_SECRET_KEY="your-secret-key"

# Admin
ADMIN_TOKEN="your-admin-token"

# Logging
LOG_LEVEL="info"

# Client URL for CORS
CLIENT_URL="https://your-frontend-domain.com"

# Redis (optional, for caching)
REDIS_URL="redis://localhost:6379"
```

### Health Checks

```typescript
// Health check endpoint implementation
export const healthCheck = {
  async checkDatabase(): Promise<HealthStatus> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', latency: Date.now() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  },

  async checkExternalAPI(): Promise<HealthStatus> {
    try {
      const start = Date.now();
      await fetch(`${config.externalApi.baseUrl}/health`);
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
};
```

## 📡 API эндпоинты

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | User authentication | No |
| POST | `/api/auth/refresh` | Token refresh | No |
| POST | `/api/auth/logout` | User logout | Yes |
| GET | `/api/auth/me` | Get current user | Yes |
| GET | `/api/auth/validate` | Validate token | No |

### Betting Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/bets` | Get user bets history | Yes |
| GET | `/api/bets/recommended` | Get recommended bet amount | Yes |
| GET | `/api/bets/:id` | Get specific bet | Yes |
| GET | `/api/bets/result/:id` | Check bet result | Yes |
| POST | `/api/bets` | Place new bet | Yes |

### Balance Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/balance` | Get current balance | Yes |
| GET | `/api/transactions` | Get transactions history | Yes |

### Internal/Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/internal/auth` | Test external auth | Admin |
| GET | `/api/internal/bet` | Test get recommended bet | Admin |
| POST | `/api/internal/bet` | Test place bet | Admin |
| POST | `/api/internal/win` | Test get bet result | Admin |
| POST | `/api/internal/balance` | Test balance operations | Admin |
| POST | `/api/internal/check-balance` | Test balance check | Admin |

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // UNAUTHORIZED, VALIDATION_ERROR, etc.
    message: string;        // Human-readable message
    details?: any;          // Additional error details
    timestamp: string;      // ISO timestamp
    requestId: string;      // Unique request identifier
  };
}
```

## ⚙️ Конфигурация

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": false,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Prisma Configuration

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Models with optimized indexes and constraints
model User {
  id         Int      @id @default(autoincrement())
  username   String   @unique
  email      String?  @unique
  // ... other fields
  
  @@map("users")
  @@index([username])
  @@index([email])
}
```

### Express Server Configuration

```typescript
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});
app.use('/api', limiter);
```

## 🔒 Безопасность

### JWT Token Security

```typescript
// JWT token configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET, // 256-bit key
  algorithm: 'HS256',
  expiresIn: '24h',
  issuer: 'betting-api',
  audience: 'betting-client'
};

// Token validation middleware
export const validateJWT = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    });
    return decoded as TokenPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid token');
  }
};
```

### HMAC Signature for External API

```typescript
// HMAC SHA-512 signature generation
export function createSignature(
  body: Record<string, any> | null,
  secretKey: string
): string {
  const payload = JSON.stringify(body || {});
  const hmac = crypto.createHmac('sha512', secretKey);
  hmac.update(payload);
  return hmac.digest('hex');
}

// Usage in API client
const headers = {
  'user-id': externalUserId,
  'x-signature': createSignature(requestBody, secretKey),
  'Content-Type': 'application/json'
};
```

### Input Validation

```typescript
// Express-validator schemas
export const betValidationSchema = [
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 1, max: 5 })
    .withMessage('Amount must be between 1 and 5'),
];

export const loginValidationSchema = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
];
```

### Rate Limiting Strategy

```typescript
// Different rate limits for different endpoints
export const rateLimiters = {
  // Global API rate limit
  global: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    message: 'Too many requests, please try again later',
  }),

  // Authentication endpoints (stricter)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // login attempts per window
    message: 'Too many login attempts, please try again later',
  }),

  // Betting endpoints
  betting: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // bets per minute
    message: 'Too many betting requests, please slow down',
  }),
};
```

## 📊 Мониторинг и логирование

### Winston Logger Configuration

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'betting-api' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({ filename: 'combined.log' }),
    
    // Console logging for development
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.simple()
      })
    ] : [])
  ],
});
```

### API Request Logging

```typescript
// Request logging middleware
export const requestLogger = morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
});

// Custom API operation logging
export class ApiLogger {
  static async logOperation(
    operation: string,
    userId?: number,
    details?: any,
    duration?: number
  ) {
    await prisma.apiLog.create({
      data: {
        userId,
        endpoint: operation,
        method: 'INTERNAL',
        requestBody: details,
        statusCode: 200,
        requestDurationMs: duration,
        createdAt: new Date()
      }
    });
  }
}
```

### Performance Monitoring

```typescript
// Performance monitoring middleware
export const performanceMonitor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }
    
    // Metrics collection (could integrate with Prometheus)
    metrics.requestDuration.observe(
      { method: req.method, route: req.route?.path },
      duration / 1000
    );
  });
  
  next();
};
```

## 🧪 Тестирование

### Test Configuration

```typescript
// jest.config.cjs
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

### Test Database Setup

```typescript
// tests/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL
    }
  }
});

beforeAll(async () => {
  // Setup test database
  await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
});

beforeEach(async () => {
  // Clean database before each test
  await prisma.transaction.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.userBalance.deleteMany();
  await prisma.externalApiAccount.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Example Integration Test

```typescript
// tests/controllers/betting.controller.spec.ts
describe('BettingController', () => {
  let app: Express;
  let authToken: string;
  let testUser: User;

  beforeAll(async () => {
    app = await createTestApp();
    testUser = await createTestUser();
    authToken = generateTestToken(testUser.id);
  });

  describe('POST /api/bets', () => {
    it('should place a bet successfully', async () => {
      // Mock external API
      nock('https://bets.tgapps.cloud')
        .post('/api/auth')
        .reply(200, { message: 'Auth success' })
        .post('/api/balance')
        .reply(200, { balance: 1000 })
        .post('/api/bet')
        .reply(200, { bet_id: 'test-bet-123' })
        .post('/api/win')
        .reply(200, { win: 6 });

      const response = await supertest(app)
        .post('/api/bets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 3 })
        .expect(201);

      expect(response.body).toMatchObject({
        amount: 3,
        status: 'completed',
        win_amount: 6
      });
    });

    it('should reject invalid bet amount', async () => {
      const response = await supertest(app)
        .post('/api/bets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 10 }) // Invalid amount
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

## 🔍 Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Issues

```typescript
// Check database connectivity
async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}
```

#### 2. External API Authentication Failures

```typescript
// Debug HMAC signature generation
function debugSignature(body: any, secretKey: string) {
  const payload = JSON.stringify(body || {});
  console.log('Payload:', payload);
  console.log('Secret Key (first 10 chars):', secretKey.substring(0, 10) + '...');
  
  const hmac = crypto.createHmac('sha512', secretKey);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  
  console.log('Generated signature:', signature);
  return signature;
}
```

#### 3. Memory Leaks in Production

```typescript
// Monitor memory usage
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const formatMemory = (bytes: number) => `${Math.round(bytes / 1024 / 1024 * 100) / 100} MB`;
  
  logger.info('Memory usage', {
    rss: formatMemory(memoryUsage.rss),
    heapTotal: formatMemory(memoryUsage.heapTotal),
    heapUsed: formatMemory(memoryUsage.heapUsed),
    external: formatMemory(memoryUsage.external)
  });
}, 30000); // Every 30 seconds
```

### Performance Optimization

#### Database Query Optimization

```typescript
// Use select to limit returned fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    username: true,
    email: true
  },
  where: {
    isAdmin: false
  },
  take: 100,
  skip: page * 100
});

// Use transactions for consistency
const result = await prisma.$transaction(async (tx) => {
  const bet = await tx.bet.create({ data: betData });
  const transaction = await tx.transaction.create({ data: transactionData });
  const balance = await tx.userBalance.update({
    where: { userId },
    data: { balance: newBalance }
  });
  
  return { bet, transaction, balance };
});
```

#### Caching Strategy

```typescript
// Redis caching for frequently accessed data
export class CacheService {
  private redis = new Redis(process.env.REDIS_URL);

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

// Usage in service
async getUserBalance(userId: number): Promise<UserBalance> {
  const cacheKey = `balance:${userId}`;
  let balance = await this.cache.get<UserBalance>(cacheKey);
  
  if (!balance) {
    balance = await this.balanceRepository.findByUserId(userId);
    await this.cache.set(cacheKey, balance, 60); // Cache for 1 minute
  }
  
  return balance;
}
```

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Monitoring tools setup (Grafana, Prometheus)
- [ ] Log aggregation configured (ELK Stack)
- [ ] Backup strategy implemented
- [ ] Rate limiting configured
- [ ] Health checks enabled
- [ ] Error tracking setup (Sentry)
- [ ] Performance monitoring active

### Scripts for Operations

```bash
#!/bin/bash
# deployment/deploy.sh

set -e

echo "🚀 Starting deployment..."

# Build and test
npm run build
npm run test

# Database migrations
npm run db:migrate

# Deploy with zero downtime
docker-compose -f docker-compose.prod.yml up -d --no-deps server
docker-compose -f docker-compose.prod.yml exec server npm run health-check

echo "✅ Deployment completed successfully"
```

---

## 📞 Поддержка

Для получения технической поддержки:

1. **Проверьте логи**: `docker-compose logs server`
2. **Мониторинг**: Grafana dashboard на `/monitoring`
3. **Health Check**: GET `/api/health`
4. **База данных**: Prisma Studio `npm run db:studio`

**Критичные проблемы**: Создайте issue с лейблом `critical` 