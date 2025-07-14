import { PrismaClient } from '@prisma/client';
import type { Config } from '../types/config.js';

let prismaInstance: PrismaClient | null = null;

/**
 * Получает экземпляр Prisma Client (Singleton)
 * @returns Экземпляр Prisma Client
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
      errorFormat: 'colorless',
    });
  }
  return prismaInstance;
}

/**
 * Подключается к базе данных
 * @throws Error если не удалось подключиться
 */
export async function connectToDatabase(): Promise<void> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    console.log('✅ Connected to database');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Отключается от базы данных
 */
export async function disconnectFromDatabase(): Promise<void> {
  try {
    if (prismaInstance) {
      await prismaInstance.$disconnect();
      console.log('✅ Disconnected from database');
    }
  } catch (error) {
    console.error('❌ Failed to disconnect from database:', error);
    throw error;
  }
}

/**
 * Проверяет состояние подключения к базе данных
 * @returns true если подключение активно
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

/**
 * Выполняет миграции базы данных
 * @throws Error если миграции не удалось выполнить
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('ℹ️  Migrations should be run via CLI: npx prisma migrate dev');
  } catch (error) {
    console.error('❌ Failed to run migrations:', error);
    throw error;
  }
}

/**
 * Выполняет транзакцию в базе данных
 * @param callback - Функция для выполнения в транзакции
 * @returns Результат выполнения транзакции
 */
export async function executeTransaction<T>(
  callback: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  const client = getPrismaClient();
  return await client.$transaction(callback);
}

/**
 * Создает резервную копию базы данных (концептуально)
 * @param config - Конфигурация приложения
 * @returns Путь к файлу резервной копии
 */
export async function createBackup(_config: Config): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `backup_${timestamp}.sql`;
  
  console.log(`📦 Creating backup: ${backupPath}`);
  // Здесь должен быть код для создания резервной копии
  
  return backupPath;
}

/**
 * Восстанавливает базу данных из резервной копии (концептуально)
 * @param backupPath - Путь к файлу резервной копии
 * @param config - Конфигурация приложения
 */
export async function restoreFromBackup(
  backupPath: string,
  _config: Config
): Promise<void> {
  console.log(`📥 Restoring from backup: ${backupPath}`);
  // Здесь должен быть код для восстановления
}

/**
 * Получает статистику базы данных
 * @returns Объект со статистикой
 */
export async function getDatabaseStats(): Promise<{
  users: number;
  bets: number;
  transactions: number;
  apiLogs: number;
}> {
  const client = getPrismaClient();
  
  const [users, bets, transactions, apiLogs] = await Promise.all([
    client.user.count(),
    client.bet.count(),
    client.transaction.count(),
    client.apiLog.count(),
  ]);

  return {
    users,
    bets,
    transactions,
    apiLogs,
  };
}

/**
 * Очищает старые логи API (старше указанного количества дней)
 * @param daysToKeep - Количество дней для хранения логов
 * @returns Количество удаленных записей
 */
export async function cleanupOldApiLogs(daysToKeep: number = 30): Promise<number> {
  const client = getPrismaClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await client.apiLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`🧹 Cleaned up ${result.count} old API logs`);
  return result.count;
}

/**
 * Обработчик для graceful shutdown
 */
export async function gracefulShutdown(): Promise<void> {
  console.log('🔄 Shutting down database connection...');
  await disconnectFromDatabase();
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('exit', gracefulShutdown);

export { PrismaClient } from '@prisma/client';
export const prisma = getPrismaClient(); 