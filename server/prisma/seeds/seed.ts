import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as dotenv from 'dotenv';
import { encrypt } from '../../src/utils/crypto.helper.js';
import logger from '../../src/config/logger.js';

// Загружаем переменные окружения
dotenv.config();

const prisma = new PrismaClient();
const NUMBER_OF_USERS = 5; // Количество обычных пользователей для создания

// Валидация переменных окружения
function validateEnvironmentVariables(): void {
  const requiredVars = [
    'EXTERNAL_USER_ID', 
    'EXTERNAL_SECRET_KEY',
    'ADMIN_USER_ID', 
    'ADMIN_USER_SECRET'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      logger.error(`   - ${varName}`);
    });
    logger.error('');
    logger.error('Please set these variables in your .env file');
    logger.error('Required format:');
    logger.error('EXTERNAL_USER_ID=5');
    logger.error('EXTERNAL_SECRET_KEY=your_real_secret_key');
    logger.error('ADMIN_USER_ID=99');
    logger.error('ADMIN_USER_SECRET=admin_secret_key');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  logger.info('🌱 Starting database seeding...');
  
  // Проверяем переменные окружения
  validateEnvironmentVariables();

  const usersData: Array<{
    username: string;
    email: string;
    externalUserId: string;
    externalSecretKey: string;
  }> = [];

  // Добавляем обычных пользователей
  for (let i = 1; i <= NUMBER_OF_USERS; i++) {
    usersData.push({
      username: `user${i}`,
      email: `user${i}@example.com`,
      externalUserId: process.env.EXTERNAL_USER_ID!,
      externalSecretKey: process.env.EXTERNAL_SECRET_KEY!,
    });
  }

  // Добавляем админа
  usersData.push({
    username: 'admin',
    email: 'admin@example.com',
    externalUserId: process.env.ADMIN_USER_ID!,
    externalSecretKey: process.env.ADMIN_USER_SECRET!,
  });

  logger.info(`👤 Creating ${usersData.length} users...`);
  
  for (const userData of usersData) {
    // Создаем пользователя
    const user = await prisma.user.upsert({
      where: { username: userData.username },
      update: {
        email: userData.email,
        lastLogin: new Date()
      },
      create: {
        username: userData.username,
        email: userData.email
      }
    });

    logger.debug(`✅ Created/Updated user: ${user.username} (ID: ${user.id})`);

    // Создаем внешний аккаунт для пользователя  
    // Проверяем, есть ли уже аккаунт для этого пользователя
    const existingAccount = await prisma.externalApiAccount.findFirst({
      where: { userId: user.id }
    });

    let externalAccount;
    if (existingAccount) {
      // Обновляем существующий аккаунт
      externalAccount = await prisma.externalApiAccount.update({
        where: { id: existingAccount.id },
        data: {
          externalUserId: userData.externalUserId,
          externalSecretKey: encrypt(userData.externalSecretKey),
          isActive: true
        }
      });
    } else {
      // Создаем новый аккаунт
      externalAccount = await prisma.externalApiAccount.create({
        data: {
          userId: user.id,
          externalUserId: userData.externalUserId,
          externalSecretKey: encrypt(userData.externalSecretKey),
          isActive: true
        }
      });
    }

    logger.debug(`🔑 Created/Updated external account for user ${user.username}`);

    // Создаем начальный баланс для пользователя
    const userBalance = await prisma.userBalance.upsert({
      where: { userId: user.id },
      update: {
        balance: new Decimal(1000), // Начальный баланс 1000
        lastCheckedAt: new Date()
      },
      create: {
        userId: user.id,
        balance: new Decimal(1000),
        lastCheckedAt: new Date()
      }
    });

    logger.debug(`💰 Created/Updated balance for user ${user.username}: ${userBalance.balance}`);
  }

  logger.info('🎯 Creating sample bets and transactions...');

  // Создаем примеры ставок для первого пользователя
  const firstUser = await prisma.user.findUnique({
    where: { username: 'user1' }
  });

  if (firstUser) {
    // Создаем несколько примеров ставок
    const sampleBets = [
      {
        externalBetId: 'bet-001',
        amount: new Decimal(5),
        status: 'COMPLETED' as const,
        winAmount: new Decimal(10),
        completedAt: new Date('2023-12-01T10:00:00Z')
      },
      {
        externalBetId: 'bet-002',
        amount: new Decimal(3),
        status: 'COMPLETED' as const,
        winAmount: new Decimal(0),
        completedAt: new Date('2023-12-01T11:00:00Z')
      },
      {
        externalBetId: 'bet-003',
        amount: new Decimal(2),
        status: 'PENDING' as const,
        winAmount: null,
        completedAt: null
      }
    ];

    for (const betData of sampleBets) {
      const bet = await prisma.bet.upsert({
        where: { externalBetId: betData.externalBetId },
        update: betData,
        create: {
          userId: firstUser.id,
          ...betData
        }
      });

      logger.debug(`🎲 Created/Updated bet: ${bet.externalBetId} (Status: ${bet.status})`);

      // Создаем транзакции для ставки
      if (bet.status === 'COMPLETED') {
        // Транзакция размещения ставки
        await prisma.transaction.upsert({
          where: { id: bet.id * 1000 }, // Используем уникальный ID
          update: {},
          create: {
            userId: firstUser.id,
            betId: bet.id,
            type: 'BET',
            amount: bet.amount.negated(),
            balanceBefore: new Decimal(1000),
            balanceAfter: new Decimal(1000).sub(bet.amount),
            description: `Bet placement #${bet.externalBetId}`
          }
        });

        // Транзакция выигрыша (если есть)
        if (bet.winAmount && bet.winAmount.gt(0)) {
          await prisma.transaction.upsert({
            where: { id: bet.id * 1000 + 1 },
            update: {},
            create: {
              userId: firstUser.id,
              betId: bet.id,
              type: 'WIN',
              amount: bet.winAmount,
              balanceBefore: new Decimal(1000).sub(bet.amount),
              balanceAfter: new Decimal(1000).sub(bet.amount).add(bet.winAmount),
              description: `Win amount for bet #${bet.externalBetId}`
            }
          });
        }
      }
    }
  }

  logger.info('🏥 Creating sample API logs...');

  // Создаем примеры API логов
  const sampleApiLogs = [
    {
      endpoint: '/api/auth',
      method: 'POST',
      requestBody: {},
      responseBody: { message: 'Successfully authenticated', user_id: '1' },
      statusCode: 200,
      requestDurationMs: 150,
      ipAddress: '127.0.0.1'
    },
    {
      endpoint: '/api/bets',
      method: 'POST',
      userId: 1,
      requestBody: { amount: 5 },
      responseBody: { bet_id: 'bet-001' },
      statusCode: 201,
      requestDurationMs: 250,
      ipAddress: '127.0.0.1'
    }
  ];

  for (const logData of sampleApiLogs) {
    await prisma.apiLog.create({
      data: logData as Prisma.ApiLogCreateInput
    });
  }

  logger.info(`📝 Created ${sampleApiLogs.length} sample API logs.`);

  logger.info('✅ Seeding finished successfully!');
  logger.info('');
  logger.info('📊 Summary:');
  logger.info(`👤 Users created: ${usersData.length}`);
  logger.info(`🔑 External accounts created: ${usersData.length}`);
  logger.info(`💰 User balances created: ${usersData.length}`);
  logger.info(`🎲 Sample bets created: 3`);
  logger.info(`📝 Sample API logs created: ${sampleApiLogs.length}`);
}

main()
  .catch((e) => {
    logger.error('❌ An error occurred during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    logger.info('🔌 Disconnected from database.');
  }); 