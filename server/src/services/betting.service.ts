import { Decimal } from '@prisma/client/runtime/library';
import { BaseServiceImpl, type ServiceResult, type PaginatedServiceResult, SERVICE_ERROR_CODES } from './base.service.js';
import { decrypt } from '../utils/crypto.helper.js';
import logger from '../config/logger.js';
// import { ExternalApiClient } from './external-api.client.js';
import type { Bet, BetStatus } from '../types/database.js';
// import type { PaginatedResult } from '../repositories/index.js';

export interface BettingService {
  getRecommendedBet(userId: number): Promise<ServiceResult<RecommendedBetResult>>;
  placeBet(userId: number, amount: number): Promise<ServiceResult<PlaceBetResult>>;
  getBetResult(userId: number, betId: number): Promise<ServiceResult<BetResultResponse>>;
  getUserBets(userId: number, page?: number, limit?: number): Promise<PaginatedServiceResult<Bet>>;
  getBetById(userId: number, betId: number): Promise<ServiceResult<Bet>>;
  getUserBetsStats(userId: number): Promise<ServiceResult<BetStatsResponse>>;
  processAllPendingBets(): Promise<ServiceResult<ProcessedBetsResult>>;
  getAppStatistics(): Promise<{ totalUsers: number; totalBets: number; totalTransactions: number }>;
}

export interface RecommendedBetResult {
  recommended_amount: number;
  user_balance: number;
  external_balance: number;
  can_place_bet: boolean;
}

export interface PlaceBetResult {
  id: number;
  amount: number;
  status: BetStatus;
  created_at: string;
  external_bet_id: string;
  balance_before: number;
  balance_after: number;
}

export interface BetResultResponse {
  id: number;
  amount: number;
  status: BetStatus;
  win_amount: number | null;
  result: 'win' | 'lose' | 'pending';
  created_at: string;
  completed_at: string | null;
  balance_before: number;
  balance_after: number;
}

export interface BetStatsResponse {
  total_bets: number;
  total_wagered: number;
  total_won: number;
  net_profit: number;
  win_rate: number;
  pending_bets: number;
  largest_win: number;
  largest_loss: number;
}

export interface ProcessedBetsResult {
  processed_count: number;
  successful_count: number;
  failed_count: number;
  details: ProcessedBetDetail[];
}

export interface ProcessedBetDetail {
  bet_id: number;
  external_bet_id: string;
  success: boolean;
  result?: 'win' | 'lose';
  win_amount?: number;
  error?: string;
}

export class BettingServiceImpl extends BaseServiceImpl implements BettingService {

  /**
   * Получение рекомендуемой ставки от внешнего API
   */
  async getRecommendedBet(userId: number): Promise<ServiceResult<RecommendedBetResult>> {
    try {
      await this.logOperation('get_recommended_bet', userId);

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
      
      let recommendedAmount = 3; // Fallback значение

      if (externalAccount) {
        // Аутентификация в внешнем API
        const authResult = await this.externalApiClient.authenticate(
          externalAccount.externalUserId,
          decrypt(externalAccount.externalSecretKey),
          userId
        );

        if (authResult.success) {
          // Получаем рекомендуемую ставку от внешнего API (GET /api/bet)
          const betResult = await this.externalApiClient.getRecommendedBet(
            externalAccount.externalUserId,
            decrypt(externalAccount.externalSecretKey),
            userId
          );

          if (betResult.success) {
            recommendedAmount = betResult.data.bet;
          } else {
            logger.warn('Failed to get recommended bet from external API, using fallback', { error: (betResult as any).error });
          }
        } else {
          logger.warn('Failed to authenticate for recommended bet, using fallback', { error: (authResult as any).error });
        }
      }

      // Получаем баланс пользователя из внешнего API
      const balanceResult = await this.repositories.balance.findByUserId(userId);
      let userBalance = 0;
      let externalBalance = 0;

      if (balanceResult) {
        userBalance = Number(balanceResult.balance);
        externalBalance = balanceResult.externalBalance ? Number(balanceResult.externalBalance) : userBalance;
      }

      // Если есть внешний аккаунт, получаем актуальный баланс
      if (externalAccount) {
        const currentBalanceResult = await this.externalApiClient.getBalance(
          externalAccount.externalUserId,
          decrypt(externalAccount.externalSecretKey),
          userId
        );

        if (currentBalanceResult.success) {
          externalBalance = currentBalanceResult.data.balance;
          // Обновляем внешний баланс в БД
          await this.repositories.balance.updateExternalBalance(userId, new Decimal(externalBalance));
        }
      }

      const actualBalance = externalBalance > 0 ? externalBalance : userBalance;
      const canPlaceBet = actualBalance >= recommendedAmount;

      const result: RecommendedBetResult = {
        recommended_amount: recommendedAmount,
        user_balance: actualBalance,
        external_balance: externalBalance,
        can_place_bet: canPlaceBet
      };

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get recommended bet',
        { userId },
        error
      );
    }
  }

  /**
   * Размещение ставки с полным циклом взаимодействия с внешним API
   */
  async placeBet(userId: number, amount: number): Promise<ServiceResult<PlaceBetResult>> {
    try {
      this.validateInput({ amount }, {
        amount: { required: true, type: 'number', min: 1, max: 5 }
      });

      await this.logOperation('place_bet_start', userId, { amount });

      // 1. Получаем пользователя и его внешний аккаунт
      const userResult = await this.getUserWithExternalAccount(userId);
      if (!userResult.success) {
        return this.createErrorResult(userResult.error!.code, userResult.error!.message, userResult.error!.details);
      }
      const user = userResult.data!;
      const externalAccount = user.externalApiAccounts?.[0];
      if (!externalAccount) {
        return this.createErrorResult(SERVICE_ERROR_CODES.NOT_FOUND, 'External account not found for user');
      }
      
      const { externalUserId, externalSecretKey } = externalAccount;
      const decryptedSecretKey = decrypt(externalSecretKey);

      // 2. Аутентификация
      const authResult = await this.externalApiClient.authenticate(externalUserId, decryptedSecretKey, userId);
      if (!authResult.success) {
        return this.createErrorResult(SERVICE_ERROR_CODES.AUTHENTICATION_FAILED, 'External API authentication failed');
      }

      // 3. Получение и установка начального баланса
      let balanceBefore = 0;
      const initialBalanceResult = await this.externalApiClient.getBalance(externalUserId, decryptedSecretKey, userId);

      if (initialBalanceResult.success) {
        balanceBefore = initialBalanceResult.data.balance;
        if (balanceBefore === 0) {
          const setBalanceResult = await this.externalApiClient.setBalance(externalUserId, decryptedSecretKey, 1000, userId);
          if (setBalanceResult.success) {
            balanceBefore = setBalanceResult.data.balance;
          }
        }
      } else {
        return this.createErrorResult(SERVICE_ERROR_CODES.BALANCE_SYNC_ERROR, 'Failed to retrieve initial balance');
      }

      // 4. Проверка баланса
      if (balanceBefore < amount) {
        return this.createErrorResult(SERVICE_ERROR_CODES.INSUFFICIENT_BALANCE, 'Insufficient balance', { required: amount, available: balanceBefore });
      }

      // 5. Размещение ставки
      const placeBetResult = await this.externalApiClient.placeBet(externalUserId, decryptedSecretKey, amount, userId);
      if (!placeBetResult.success) {
        return this.createErrorResult(SERVICE_ERROR_CODES.EXTERNAL_API_ERROR, 'Failed to place bet');
      }
      const externalBetId = String(placeBetResult.data.bet_id);
      
      // 6. Получение результата ставки
      const winResult = await this.externalApiClient.getWinResult(externalUserId, decryptedSecretKey, externalBetId, userId);
      if (!winResult.success) {
        return this.createErrorResult(SERVICE_ERROR_CODES.EXTERNAL_API_ERROR, 'Failed to get bet result');
      }
      const winAmount = new Decimal(winResult.data.win || 0);

      // 7. Получение финального баланса
      const finalBalanceResult = await this.externalApiClient.getBalance(externalUserId, decryptedSecretKey, userId);
      if (!finalBalanceResult.success) {
        return this.createErrorResult(SERVICE_ERROR_CODES.BALANCE_SYNC_ERROR, 'Failed to retrieve final balance');
      }
      const balanceAfter = new Decimal(finalBalanceResult.data.balance);
      
      // 8. Обновление локальной БД
      await this.repositories.balance.updateBalance(userId, balanceAfter);
      
      // Сначала создаем ставку
      const bet = await this.repositories.bet.create({
        userId,
        externalBetId,
        amount: new Decimal(amount),
      });

      // Затем обновляем ее до завершенного состояния
      const completedBet = await this.repositories.bet.completeBet(bet.id, winAmount.toNumber());

      // Транзакция списания
      await this.repositories.transaction.create({
        userId,
        betId: completedBet.id,
        type: 'BET',
        amount: new Decimal(amount).negated(),
        balanceBefore: new Decimal(balanceBefore),
        balanceAfter: new Decimal(balanceBefore).sub(amount),
        description: `Bet placement #${completedBet.id}`
      });
      
      // Транзакция начисления (если есть выигрыш)
      if (winAmount.gt(0)) {
        await this.repositories.transaction.create({
          userId,
          betId: completedBet.id,
          type: 'WIN',
          amount: winAmount,
          balanceBefore: new Decimal(balanceBefore).sub(amount),
          balanceAfter: balanceAfter,
          description: `Win for bet #${completedBet.id}`
        });
      }

      const result: PlaceBetResult = {
        id: completedBet.id,
        amount: amount,
        status: completedBet.status,
        created_at: completedBet.createdAt.toISOString(),
        external_bet_id: completedBet.externalBetId,
        balance_before: balanceBefore,
        balance_after: balanceAfter.toNumber(),
      };

      await this.logOperation('place_bet_success', userId, { betId: completedBet.id, amount, winAmount: winAmount.toNumber() });

      return this.createSuccessResult(result);

    } catch (error) {
      await this.logOperation('place_bet_error', userId, { amount, error: error.message });
      return this.createErrorResult(SERVICE_ERROR_CODES.INTERNAL_ERROR, 'Failed to place bet', { amount }, error);
    }
  }

  /**
   * Получение результата ставки
   */
  async getBetResult(userId: number, betId: number): Promise<ServiceResult<BetResultResponse>> {
    try {
      await this.logOperation('get_bet_result', userId, { betId });

      // Находим ставку
      const bet = await this.repositories.bet.findById(betId);
      if (!bet || bet.userId !== userId) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.BET_NOT_FOUND,
          'Bet not found'
        );
      }

      // Если ставка уже завершена, возвращаем сохраненный результат
      if (bet.status === 'COMPLETED') {
        const result = await this.formatBetResult(bet, userId);
        return this.createSuccessResult(result);
      }

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
        return this.createErrorResult(
          SERVICE_ERROR_CODES.NOT_FOUND,
          'External account not found for user'
        );
      }

      // Получаем баланс ДО получения результата
      const currentBalanceResult = await this.externalApiClient.getBalance(
        externalAccount.externalUserId,
        decrypt(externalAccount.externalSecretKey),
        userId
      );

      let balanceBefore = 0;
      if (currentBalanceResult.success) {
        balanceBefore = currentBalanceResult.data.balance;
      }

      // Получаем результат от внешнего API (POST /api/win с { "bet_id": "externalBetId" })
      const winResult = await this.externalApiClient.getWinResult(
        externalAccount.externalUserId,
        decrypt(externalAccount.externalSecretKey),
        bet.externalBetId,
        userId
      );

      if (!winResult.success) {
        logger.warn('Failed to get win result from external API:', (winResult as any).error);
        return this.createErrorResult(
          SERVICE_ERROR_CODES.EXTERNAL_API_ERROR,
          'Failed to get bet result from external API',
          {},
          (winResult as any).error
        );
      }

      const winAmount = winResult.data.win || 0;
      const isWin = winAmount > 0;

      // Получаем обновленный баланс ПОСЛЕ получения результата
      const updatedBalanceResult = await this.externalApiClient.getBalance(
        externalAccount.externalUserId,
        decrypt(externalAccount.externalSecretKey),
        userId
      );

      let balanceAfter = balanceBefore;
      if (updatedBalanceResult.success) {
        balanceAfter = updatedBalanceResult.data.balance;
      } else if (isWin) {
        balanceAfter = balanceBefore + winAmount; // Fallback расчет
      }

      // Обновляем локальный баланс
      await this.repositories.balance.updateBalance(userId, new Decimal(balanceAfter));
      await this.repositories.balance.updateExternalBalance(userId, new Decimal(balanceAfter));

      // Обновляем ставку
      const updatedBet = await this.repositories.bet.completeBet(bet.id, winAmount);

      // Создаем транзакцию для выигрыша (если есть)
      if (isWin) {
        await this.repositories.transaction.create({
          userId,
          betId: bet.id,
          type: 'WIN',
          amount: new Decimal(winAmount),
          balanceBefore: new Decimal(balanceBefore),
          balanceAfter: new Decimal(balanceAfter),
          description: `Win amount for bet #${bet.id}`
        });
      }

      const result = await this.formatBetResult(updatedBet, userId);

      await this.logOperation('get_bet_result_success', userId, {
        betId,
        externalBetId: bet.externalBetId,
        winAmount,
        isWin,
        balanceBefore,
        balanceAfter
      });

      return this.createSuccessResult(result);

    } catch (error) {
      await this.logOperation('get_bet_result_error', userId, { betId, error: error.message });
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get bet result',
        { userId, betId },
        error
      );
    }
  }

  /**
   * Получение списка ставок пользователя
   */
  async getUserBets(userId: number, page: number = 1, limit: number = 10): Promise<PaginatedServiceResult<Bet>> {
    try {
      const result = await this.repositories.bet.findByUserIdPaginated(userId, page, limit);
      
      return this.createPaginatedResult(result.data, result.pagination);

    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'get user bets')
      };
    }
  }

  /**
   * Получение конкретной ставки пользователя
   */
  async getBetById(userId: number, betId: number): Promise<ServiceResult<Bet>> {
    try {
      const bet = await this.repositories.bet.findById(betId);
      
      if (!bet || bet.userId !== userId) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.BET_NOT_FOUND,
          'Bet not found'
        );
      }

      return this.createSuccessResult(bet);

    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get bet',
        { userId, betId },
        error
      );
    }
  }

  /**
   * Получение статистики ставок пользователя
   */
  async getUserBetsStats(userId: number): Promise<ServiceResult<BetStatsResponse>> {
    try {
      const stats = await this.repositories.bet.getUserBetsStats(userId);
      
      // Получаем дополнительную информацию для статистики
      const completedBets = await this.repositories.bet.findByUserId(userId, {
        where: { status: 'COMPLETED' }
      });

      const wins = completedBets.filter(bet => bet.winAmount && Number(bet.winAmount) > 0);
      const losses = completedBets.filter(bet => !bet.winAmount || Number(bet.winAmount) === 0);

      const largestWin = wins.length > 0 
        ? Math.max(...wins.map(bet => Number(bet.winAmount || 0)))
        : 0;

      const largestLoss = losses.length > 0
        ? Math.max(...losses.map(bet => Number(bet.amount)))
        : 0;

      const result: BetStatsResponse = {
        total_bets: stats.totalBets,
        total_wagered: stats.totalWagered,
        total_won: stats.totalWon,
        net_profit: stats.totalWon - stats.totalWagered,
        win_rate: stats.winRate,
        pending_bets: stats.pendingBets,
        largest_win: largestWin,
        largest_loss: largestLoss
      };

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get bet stats',
        { userId },
        error
      );
    }
  }

  /**
   * Обработка всех ожидающих ставок (для cron job)
   */
  async processAllPendingBets(): Promise<ServiceResult<ProcessedBetsResult>> {
    try {
      const pendingBets = await this.repositories.bet.findPendingBets();
      
      const details: ProcessedBetDetail[] = [];
      let successfulCount = 0;
      let failedCount = 0;

      for (const bet of pendingBets) {
        try {
          const result = await this.getBetResult(bet.userId, bet.id);
          
          if (result.success) {
            const betResult = result.data!;
            successfulCount++;
            details.push({
              bet_id: bet.id,
              external_bet_id: bet.externalBetId,
              success: true,
              result: betResult.win_amount && betResult.win_amount > 0 ? 'win' : 'lose',
              win_amount: betResult.win_amount || 0
            });
          } else {
            failedCount++;
            details.push({
              bet_id: bet.id,
              external_bet_id: bet.externalBetId,
              success: false,
              error: result.error?.message
            });
          }
        } catch (error) {
          failedCount++;
          details.push({
            bet_id: bet.id,
            external_bet_id: bet.externalBetId,
            success: false,
            error: error.message
          });
        }
      }

      const result: ProcessedBetsResult = {
        processed_count: pendingBets.length,
        successful_count: successfulCount,
        failed_count: failedCount,
        details
      };

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to process pending bets',
        {},
        error
      );
    }
  }

  async getAppStatistics() {
    return this.repositories.bet.getAppStatistics();
  }


  /**
   * Форматирование результата ставки
   */
  private async formatBetResult(bet: Bet, _userId: number): Promise<BetResultResponse> {
    // Получаем транзакции для определения баланса до и после
    const transactions = await this.repositories.transaction.findByBetId(bet.id);
    const betTransaction = transactions.find(t => t.type === 'BET');
    const winTransaction = transactions.find(t => t.type === 'WIN');

    const balanceBefore = betTransaction ? Number(betTransaction.balanceBefore) : 0;
    const balanceAfter = winTransaction 
      ? Number(winTransaction.balanceAfter)
      : (betTransaction ? Number(betTransaction.balanceAfter) : 0);

    return {
      id: bet.id,
      amount: Number(bet.amount),
      status: bet.status,
      win_amount: bet.winAmount ? Number(bet.winAmount) : null,
      result: bet.status === 'PENDING' 
        ? 'pending' 
        : (bet.winAmount && Number(bet.winAmount) > 0 ? 'win' : 'lose'),
      created_at: bet.createdAt.toISOString(),
      completed_at: bet.completedAt ? bet.completedAt.toISOString() : null,
      balance_before: balanceBefore,
      balance_after: balanceAfter
    };
  }
} 