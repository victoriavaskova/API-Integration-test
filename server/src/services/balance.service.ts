import { Decimal } from '@prisma/client/runtime/library';
import { BaseServiceImpl, type ServiceResult, SERVICE_ERROR_CODES } from './base.service.js';
import { decrypt } from '../utils/crypto.helper.js';
import { TransactionType } from '../types/database.js';

export interface BalanceService {
  getCurrentBalance(userId: number): Promise<ServiceResult<BalanceResult>>;
  initializeBalance(userId: number, initialAmount: number): Promise<ServiceResult<BalanceResult>>;
  syncWithExternalApi(userId: number): Promise<ServiceResult<BalanceSyncResult>>;
  addFunds(userId: number, amount: number, description?: string): Promise<ServiceResult<TransactionResult>>;
  withdrawFunds(userId: number, amount: number, description?: string): Promise<ServiceResult<TransactionResult>>;
  getBalanceHistory(userId: number): Promise<ServiceResult<BalanceHistoryResult>>;
  getTransactions(userId: number, page?: number, limit?: number): Promise<ServiceResult<TransactionsResult>>;
  checkBalanceConsistency(userId: number): Promise<ServiceResult<BalanceConsistencyResult>>;
}

export interface BalanceResult {
  balance: number;
  external_balance: number | null;
  last_updated: string;
  is_synced: boolean;
  difference: number | null;
}

export interface BalanceSyncResult {
  internal_balance: number;
  external_balance: number;
  was_synced: boolean;
  difference: number;
  sync_timestamp: string;
}

export interface TransactionResult {
  transaction_id: number;
  amount: number;
  type: TransactionType;
  balance_before: number;
  balance_after: number;
  timestamp: string;
  description?: string;
}

export interface BalanceHistoryResult {
  current_balance: number;
  history: BalanceHistoryItem[];
  total_deposits: number;
  total_withdrawals: number;
  total_bets: number;
  total_wins: number;
}

export interface BalanceHistoryItem {
  date: string;
  balance: number;
  external_balance: number | null;
  difference: number | null;
  transaction_type?: TransactionType;
}

export interface BalanceConsistencyResult {
  is_consistent: boolean;
  internal_balance: number;
  external_balance: number | null;
  difference: number | null;
  issues: string[];
  recommendations: string[];
}

export interface TransactionsResult {
  transactions: TransactionItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export class BalanceServiceImpl extends BaseServiceImpl implements BalanceService {

  /**
   * Получение текущего баланса пользователя
   */
  async getCurrentBalance(userId: number): Promise<ServiceResult<BalanceResult>> {
    try {
      await this.logOperation('get_current_balance', userId);

      // Получаем пользователя с внешним аккаунтом
      const userResult = await this.getUserWithExternalAccount(userId);
      if (!userResult.success) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.NOT_FOUND,
          'Failed to get user with external account',
          { userId },
          userResult.error?.originalError
        );
      }

      const user = userResult.data!;
      const externalAccount = user.externalApiAccounts?.[0];
      
      if (!externalAccount) {
        // Если нет внешнего аккаунта, возвращаем локальный баланс
        const balance = await this.repositories.balance.findByUserId(userId);
        if (!balance) {
          return this.createErrorResult(
            SERVICE_ERROR_CODES.BALANCE_NOT_FOUND,
            'Balance not found for user',
            { userId }
          );
        }

        const result: BalanceResult = {
          balance: Number(balance.balance),
          external_balance: null,
          last_updated: (balance.lastCheckedAt || new Date()).toISOString(),
          is_synced: false,
          difference: null
        };

        return this.createSuccessResult(result);
      }

      // Аутентификация в внешнем API
      const authResult = await this.externalApiClient.authenticate(
        externalAccount.externalUserId,
        decrypt(externalAccount.externalSecretKey),
        userId
      );

      if (!authResult.success) {
        console.warn('Failed to authenticate with external API for balance check:', (authResult as any).error);
      }

      // Получаем баланс от внешнего API (POST /api/balance без тела)
      const externalBalanceResult = await this.externalApiClient.getBalance(
        externalAccount.externalUserId,
        decrypt(externalAccount.externalSecretKey),
        userId
      );

      let externalBalance: number | null = null;
      if (externalBalanceResult.success) {
        externalBalance = externalBalanceResult.data.balance;
      } else {
        console.warn('Failed to get balance from external API:', (externalBalanceResult as any).error);
      }

      // Получаем локальный баланс
      const localBalance = await this.repositories.balance.findByUserId(userId);
      let internalBalance = 0;

      if (localBalance) {
        internalBalance = Number(localBalance.balance);
ё        if (externalBalanceResult.success && externalBalance !== null) {
          await this.repositories.balance.updateExternalBalance(userId, new Decimal(externalBalance));
        }
      } else if (externalBalanceResult.success && externalBalance !== null) {
        // Если локального баланса нет, но есть внешний - создаем локальный
        const createdBalance = await this.repositories.balance.create({
          userId,
          balance: new Decimal(externalBalance),
          externalBalance: new Decimal(externalBalance)
        });
        internalBalance = Number(createdBalance.balance);
      } else {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.BALANCE_NOT_FOUND,
          'Balance not found for user',
          { userId }
        );
      }

      const difference = externalBalance !== null ? internalBalance - externalBalance : null;
      const isSynced = difference !== null ? Math.abs(difference) < 0.01 : false;

      const result: BalanceResult = {
        balance: externalBalance !== null ? externalBalance : internalBalance, // Приоритет внешнему балансу
        external_balance: externalBalance,
        last_updated: new Date().toISOString(),
        is_synced: isSynced,
        difference
      };

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get current balance',
        { userId },
        error
      );
    }
  }

  /**
   * Инициализация баланса для нового пользователя
   */
  async initializeBalance(userId: number, initialAmount: number): Promise<ServiceResult<BalanceResult>> {
    try {
      // Валидация входных данных
      this.validateInput({ initialAmount }, {
        initialAmount: { required: true, type: 'number', min: 0 }
      });

      await this.logOperation('initialize_balance', userId, { initialAmount });

      // Проверяем, нет ли уже баланса
      const existingBalance = await this.repositories.balance.findByUserId(userId);
      if (existingBalance) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.VALIDATION_ERROR,
          'Balance already exists for user',
          { userId, currentBalance: Number(existingBalance.balance) }
        );
      }

      // Получаем пользователя с внешним аккаунтом
      const userResult = await this.getUserWithExternalAccount(userId);
      if (!userResult.success) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.USER_NOT_FOUND,
          'User not found'
        );
      }

      const user = userResult.data!;
      const externalAccount = user.externalApiAccounts?.[0];
      let externalBalance: number | null = null;

      // Если есть внешний аккаунт, устанавливаем баланс в внешнем API согласно README
      if (externalAccount) {
        // Аутентификация в внешнем API
        const authResult = await this.externalApiClient.authenticate(
          externalAccount.externalUserId,
          externalAccount.externalSecretKey,
          userId
        );

        if (!authResult.success) {
          console.warn('Failed to authenticate during balance initialization:', (authResult as any).error);
          return this.createErrorResult(
            SERVICE_ERROR_CODES.EXTERNAL_API_ERROR,
            'Failed to authenticate with external API',
            {},
            (authResult as any).error
          );
        }

        // Устанавливаем начальный баланс в внешнем API (POST /api/balance с { "balance": 1000 })
        const setBalanceResult = await this.externalApiClient.setBalance(
          externalAccount.externalUserId,
          externalAccount.externalSecretKey,
          initialAmount,
          userId
        );

        if (!setBalanceResult.success) {
          console.warn('Failed to set balance in external API:', (setBalanceResult as any).error);
          return this.createErrorResult(
            SERVICE_ERROR_CODES.EXTERNAL_API_ERROR,
            'Failed to set balance in external API',
            {},
            (setBalanceResult as any).error
          );
        }

        externalBalance = setBalanceResult.data.balance;
        console.log('Balance successfully set in external API:', externalBalance);
      }

      // Создаем локальный баланс
      const createdBalance = await this.repositories.balance.create({
        userId,
        balance: new Decimal(initialAmount),
        externalBalance: externalBalance ? new Decimal(externalBalance) : null,
      });

      // Создаем начальную транзакцию
      if (initialAmount > 0) {
        await this.repositories.transaction.create({
          userId,
          type: 'DEPOSIT',
          amount: new Decimal(initialAmount),
          balanceBefore: new Decimal(0),
          balanceAfter: new Decimal(initialAmount),
          description: 'Initial balance'
        });
      }

      const result: BalanceResult = {
        balance: initialAmount,
        external_balance: externalBalance,
        last_updated: createdBalance.lastCheckedAt!.toISOString(),
        is_synced: externalBalance ? Math.abs(initialAmount - externalBalance) < 0.01 : false,
        difference: externalBalance ? initialAmount - externalBalance : null
      };

      await this.logOperation('initialize_balance_success', userId, { initialAmount, finalBalance: Number(createdBalance.balance), externalBalance });

      return this.createSuccessResult(result);

    } catch (error) {
      await this.logOperation('initialize_balance_error', userId, { 
        initialAmount, 
        error: error instanceof Error ? error.message : String(error)
      });
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to initialize balance',
        { userId, initialAmount },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Синхронизация баланса с внешним API
   */
  async syncWithExternalApi(userId: number): Promise<ServiceResult<BalanceSyncResult>> {
    try {
      await this.logOperation('sync_with_external_api', userId);
      
      const user = await this.repositories.user.findWithExternalAccount(userId);
      if (!user) {
        return this.createErrorResult(SERVICE_ERROR_CODES.NOT_FOUND, 'User or external account not found');
      }

      const externalAccount = user.externalApiAccounts?.[0];
      if (!externalAccount) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.NOT_FOUND,
          'External account not found for user'
        );
      }

      // Получаем текущий внутренний баланс
      const currentBalance = await this.repositories.balance.findByUserId(userId);
      if (!currentBalance) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.BALANCE_NOT_FOUND,
          'Balance not found for user'
        );
      }

      const internalBalance = Number(currentBalance.balance);

      // Получаем баланс от внешнего API
      const balanceResult = await this.externalApiClient.getBalance(
        externalAccount.externalUserId,
        externalAccount.externalSecretKey
      );

      if (!balanceResult.success) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.EXTERNAL_API_ERROR,
          'Failed to get balance from external API',
          { external_error: (balanceResult as any).error }
        );
      }

      const externalBalance = balanceResult.data.balance;
      const difference = internalBalance - externalBalance;
      const wasSynced = Math.abs(difference) < 0.01;

      // Обновляем внешний баланс в нашей БД
      await this.repositories.balance.updateExternalBalance(
        userId,
        new Decimal(externalBalance)
      );

      const result: BalanceSyncResult = {
        internal_balance: internalBalance,
        external_balance: externalBalance,
        was_synced: wasSynced,
        difference,
        sync_timestamp: new Date().toISOString()
      };

      await this.logOperation('sync_with_external_api_success', userId, {
        internalBalance,
        externalBalance,
        difference,
        wasSynced
      });

      return this.createSuccessResult(result);

    } catch (error) {
      await this.logOperation('sync_with_external_api_error', userId, { 
        error: error instanceof Error ? error.message : String(error)
      });
      return this.createErrorResult(
        SERVICE_ERROR_CODES.BALANCE_SYNC_ERROR,
        'Failed to sync with external API',
        { userId },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Добавление средств к балансу
   */
  async addFunds(userId: number, amount: number, description?: string): Promise<ServiceResult<TransactionResult>> {
    try {
      // Валидация входных данных
      this.validateInput({ amount }, {
        amount: { required: true, type: 'number', min: 0.01 }
      });

      await this.logOperation('add_funds', userId, { amount, description });

      // Получаем текущий баланс
      const currentBalance = await this.repositories.balance.findByUserId(userId);
      if (!currentBalance) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.BALANCE_NOT_FOUND,
          'Balance not found for user'
        );
      }

      const balanceBefore = Number(currentBalance.balance);
      const newBalance = currentBalance.balance.add(new Decimal(amount));
      const balanceAfter = Number(newBalance);

      // Обновляем баланс
      await this.repositories.balance.updateBalance(userId, newBalance);

      // Создаем транзакцию
      const transaction = await this.repositories.transaction.create({
        userId,
        type: 'DEPOSIT',
        amount: new Decimal(amount),
        balanceBefore: currentBalance.balance,
        balanceAfter: newBalance,
        description: description || 'Funds added'
      });

      const result: TransactionResult = {
        transaction_id: transaction.id,
        amount,
        type: TransactionType.DEPOSIT,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        timestamp: transaction.createdAt.toISOString(),
        description: transaction.description || undefined
      };

      await this.logOperation('add_funds_success', userId, { 
        amount,
        balanceBefore,
        balanceAfter,
        transactionId: transaction.id
      });

      return this.createSuccessResult(result);

    } catch (error) {
      await this.logOperation('add_funds_error', userId, { 
        amount, 
        error: error instanceof Error ? error.message : String(error)
      });
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to add funds',
        { userId, amount },
        error
      );
    }
  }

  /**
   * Списание средств с баланса
   */
  async withdrawFunds(userId: number, amount: number, description?: string): Promise<ServiceResult<TransactionResult>> {
    try {
      // Валидация входных данных
      this.validateInput({ amount }, {
        amount: { required: true, type: 'number', min: 0.01 }
      });

      await this.logOperation('withdraw_funds', userId, { amount, description });

      const currentBalance = await this.repositories.balance.findByUserId(userId);
      if (!currentBalance) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.BALANCE_NOT_FOUND,
          'Balance not found for user'
        );
      }

      const balanceBefore = Number(currentBalance.balance);
      
      if (currentBalance.balance.lt(amount)) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.INSUFFICIENT_BALANCE,
          'Insufficient balance',
          { 
            required: amount, 
            available: balanceBefore 
          }
        );
      }

      const newBalance = currentBalance.balance.sub(new Decimal(amount));
      const balanceAfter = Number(newBalance);

      // Обновляем баланс
      await this.repositories.balance.updateBalance(userId, newBalance);

      // Создаем транзакцию
      const transaction = await this.repositories.transaction.create({
        userId,
        type: 'WITHDRAWAL',
        amount: new Decimal(amount),
        balanceBefore: currentBalance.balance,
        balanceAfter: newBalance,
        description: description || 'Funds withdrawn'
      });

      const result: TransactionResult = {
        transaction_id: transaction.id,
        amount: -amount, // Возвращаем отрицательное значение
        type: TransactionType.WITHDRAWAL,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        timestamp: transaction.createdAt.toISOString(),
        description: transaction.description || undefined
      };

      await this.logOperation('withdraw_funds_success', userId, { 
        amount,
        balanceBefore,
        balanceAfter,
        transactionId: transaction.id
      });

      return this.createSuccessResult(result);

    } catch (error) {
      await this.logOperation('withdraw_funds_error', userId, { 
        amount, 
        error: error instanceof Error ? error.message : String(error)
      });
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to withdraw funds',
        { userId, amount },
        error
      );
    }
  }

  /**
   * Получение истории баланса
   */
  async getBalanceHistory(userId: number): Promise<ServiceResult<BalanceHistoryResult>> {
    try {
      const [currentBalance, history, transactionStats] = await Promise.all([
        this.repositories.balance.findByUserId(userId),
        this.repositories.balance.getBalanceHistory(userId),
        this.repositories.transaction.getUserTransactionStats(userId)
      ]);

      if (!currentBalance) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.BALANCE_NOT_FOUND,
          'Balance not found for user'
        );
      }

      const historyItems: BalanceHistoryItem[] = history.map(item => ({
        date: item.date.toISOString(),
        balance: Number(item.balance),
        external_balance: item.externalBalance ? Number(item.externalBalance) : null,
        difference: item.difference ? Number(item.difference) : null
      }));

      const result: BalanceHistoryResult = {
        current_balance: Number(currentBalance.balance),
        history: historyItems,
        total_deposits: transactionStats.totalDeposits,
        total_withdrawals: transactionStats.totalWithdrawals,
        total_bets: transactionStats.totalBets,
        total_wins: transactionStats.totalWins
      };

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get balance history',
        { userId },
        error
      );
    }
  }

  /**
   * Получение транзакций пользователя
   */
  async getTransactions(userId: number, page: number = 1, limit: number = 10): Promise<ServiceResult<TransactionsResult>> {
    try {
      await this.logOperation('get_transactions', userId, { page, limit });

      // Валидация пагинации
      if (page < 1 || limit < 1 || limit > 50) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.VALIDATION_ERROR,
          'Invalid pagination parameters',
          { page, limit, constraints: 'page >= 1, 1 <= limit <= 50' }
        );
      }

      const paginatedResult = await this.repositories.transaction.findByUserIdPaginated(userId, page, limit);
      
      const transactions: TransactionItem[] = paginatedResult.data.map(transaction => ({
        id: transaction.id.toString(),
        type: this.mapTransactionType(transaction.type),
        amount: transaction.type === TransactionType.BET || transaction.type === TransactionType.WITHDRAWAL 
          ? -Math.abs(Number(transaction.amount)) 
          : Number(transaction.amount),
        balance_before: Number(transaction.balanceBefore),
        balance_after: Number(transaction.balanceAfter),
        description: transaction.description || this.getTransactionDescription(transaction.type, transaction.betId || undefined),
        created_at: transaction.createdAt.toISOString()
      }));

      const result: TransactionsResult = {
        transactions,
        pagination: paginatedResult.pagination
      };

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get transactions',
        { userId, page, limit },
        error
      );
    }
  }

  /**
   * Мапинг типов транзакций для API ответа
   */
  private mapTransactionType(type: TransactionType): string {
    switch (type) {
      case TransactionType.BET:
        return 'bet_place';
      case TransactionType.WIN:
        return 'bet_win';
      case TransactionType.DEPOSIT:
        return 'deposit';
      case TransactionType.WITHDRAWAL:
        return 'withdrawal';
      default:
        return String(type).toLowerCase();
    }
  }

  /**
   * Получение описания транзакции
   */
  private getTransactionDescription(type: TransactionType, betId?: number): string {
    switch (type) {
      case TransactionType.BET:
        return betId ? `Bet placement #${betId}` : 'Bet placement';
      case TransactionType.WIN:
        return betId ? `Win amount for bet #${betId}` : 'Bet win';
      case TransactionType.DEPOSIT:
        return 'Deposit';
      case TransactionType.WITHDRAWAL:
        return 'Withdrawal';
      default:
        return 'Transaction';
    }
  }

  /**
   * Проверка консистентности баланса
   */
  async checkBalanceConsistency(userId: number): Promise<ServiceResult<BalanceConsistencyResult>> {
    try {
      await this.logOperation('check_balance_consistency', userId);

      const currentBalance = await this.repositories.balance.findByUserId(userId);
      if (!currentBalance) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.BALANCE_NOT_FOUND,
          'Balance not found for user'
        );
      }

      const internalBalance = Number(currentBalance.balance);
      const externalBalance = currentBalance.externalBalance ? Number(currentBalance.externalBalance) : null;
      const difference = externalBalance !== null ? internalBalance - externalBalance : null;

      const issues: string[] = [];
      const recommendations: string[] = [];

      // Проверяем синхронизацию с внешним API
      if (externalBalance === null) {
        issues.push('External balance not synchronized');
        recommendations.push('Run sync with external API');
      } else if (difference !== null && Math.abs(difference) > 0.01) {
        issues.push(`Balance mismatch: difference of ${difference.toFixed(2)}`);
        recommendations.push('Investigate transaction history and resync');
      }

      // Проверяем транзакции
      const transactionStats = await this.repositories.transaction.getUserTransactionStats(userId);
      const calculatedBalance = transactionStats.totalDeposits + 
                               transactionStats.totalWithdrawals + 
                               transactionStats.totalBets + 
                               transactionStats.totalWins;

      if (Math.abs(internalBalance - calculatedBalance) > 0.01) {
        issues.push(`Transaction sum mismatch: expected ${calculatedBalance}, actual ${internalBalance}`);
        recommendations.push('Audit transaction history');
      }

      const isConsistent = issues.length === 0;

      const result: BalanceConsistencyResult = {
        is_consistent: isConsistent,
        internal_balance: internalBalance,
        external_balance: externalBalance,
        difference,
        issues,
        recommendations
      };

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to check balance consistency',
        { userId },
        error
      );
    }
  }
} 