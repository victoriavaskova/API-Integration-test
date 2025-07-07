import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const prisma = new PrismaClient();

// Валидация переменных окружения
function validateEnvironmentVariables(): void {
  const requiredVars = [
    'TEST_USER_1_ID', 'TEST_USER_1_SECRET',
    'TEST_USER_2_ID', 'TEST_USER_2_SECRET', 
    'TEST_USER_3_ID', 'TEST_USER_3_SECRET',
    'ADMIN_USER_ID', 'ADMIN_USER_SECRET'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('');
    console.error('Please set these variables in your .env file');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('🌱 Starting database seeding...');
  
  // Проверяем переменные окружения
  validateEnvironmentVariables();

  // Создаем тестовых пользователей с данными из переменных окружения
  const users = [
    {
      username: 'user1',
      email: 'user1@example.com',
      externalUserId: process.env.TEST_USER_1_ID!,
      externalSecretKey: process.env.TEST_USER_1_SECRET!
    },
    {
      username: 'user2',
      email: 'user2@example.com',
      externalUserId: process.env.TEST_USER_2_ID!,
      externalSecretKey: process.env.TEST_USER_2_SECRET!
    },
    {
      username: 'user3',
      email: 'user3@example.com',
      externalUserId: process.env.TEST_USER_3_ID!,
      externalSecretKey: process.env.TEST_USER_3_SECRET!
    },
    {
      username: 'admin',
      email: 'admin@example.com',
      externalUserId: process.env.ADMIN_USER_ID!,
      externalSecretKey: process.env.ADMIN_USER_SECRET!
    }
  ];

  console.log('👤 Creating users...');
  
  for (const userData of users) {
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

    console.log(`✅ Created/Updated user: ${user.username} (ID: ${user.id})`);

    // Создаем внешний аккаунт для пользователя
    const externalAccount = await prisma.externalApiAccount.upsert({
      where: {
        userId_externalUserId: {
          userId: user.id,
          externalUserId: userData.externalUserId
        }
      },
      update: {
        externalSecretKey: userData.externalSecretKey,
        isActive: true
      },
      create: {
        userId: user.id,
        externalUserId: userData.externalUserId,
        externalSecretKey: userData.externalSecretKey,
        isActive: true
      }
    });

    console.log(`🔑 Created/Updated external account for user ${user.username}`);

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

    console.log(`💰 Created/Updated balance for user ${user.username}: ${userBalance.balance}`);
  }

  console.log('🎯 Creating sample bets and transactions...');

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

      console.log(`🎲 Created/Updated bet: ${bet.externalBetId} (Status: ${bet.status})`);

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

  console.log('🏥 Creating sample API logs...');

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
      endpoint: '/api/balance',
      method: 'POST',
      requestBody: { balance: 1000 },
      responseBody: { balance: 1000, message: 'Balance set successfully' },
      statusCode: 200,
      requestDurationMs: 85,
      ipAddress: '127.0.0.1'
    },
    {
      endpoint: '/api/bet',
      method: 'GET',
      requestBody: Prisma.JsonNull,
      responseBody: { bet: 3 },
      statusCode: 200,
      requestDurationMs: 120,
      ipAddress: '127.0.0.1'
    }
  ];

  for (const logData of sampleApiLogs) {
    await prisma.apiLog.create({
      data: {
        userId: firstUser?.id || null,
        ...logData
      }
    });
  }

  console.log('✅ Database seeding completed successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`👤 Users created: ${users.length}`);
  console.log(`🔑 External accounts created: ${users.length}`);
  console.log(`💰 User balances created: ${users.length}`);
  console.log(`🎲 Sample bets created: 3`);
  console.log(`📝 Sample API logs created: ${sampleApiLogs.length}`);
  console.log('');
  console.log('🎯 Test credentials:');
  console.log('Username: user1, user2, user3, user4, user5, admin');
  console.log('Initial balance: 1000 for all users');
  console.log('');
  console.log('🚀 You can now start the server and test the API!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e);
    await prisma.$disconnect();
    throw e;
  }); 