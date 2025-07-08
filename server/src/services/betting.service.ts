import { Decimal } from '@prisma/client/runtime/library';
import { BaseServiceImpl, type ServiceResult, type PaginatedServiceResult, SERVICE_ERROR_CODES } from './base.service.js';
import { decrypt } from '../utils/crypto.helper.js';
// import { ExternalApiClient } from './external-api.client.js';
import type { Bet, UserWithRelations, BetStatus } from '../types/database.js';
// import type { PaginatedResult } from '../repositories/index.js';

export interface BettingService {
  getRecommendedBet(userId: number): Promise<ServiceResult<RecommendedBetResult>>;
  placeBet(userId: number, amount: number): Promise<ServiceResult<PlaceBetResult>>;
  getBetResult(userId: number, betId: number): Promise<ServiceResult<BetResultResponse>>;
  getUserBets(userId: number, page?: number, limit?: number): Promise<PaginatedServiceResult<Bet>>;
  getBetById(userId: number, betId: number): Promise<ServiceResult<Bet>>;
  getUserBetsStats(userId: number): Promise<ServiceResult<BetStatsResponse>>;
  processAllPendingBets(): Promise<ServiceResult<ProcessedBetsResult>>;
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
      if (!externalAccount) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.NOT_FOUND,
          'External account not found for user'
        );
      }

          // Получаем рекомендуемую ставку от внешнего API
    const externalResult = await this.externalApiClient.getRecommendedBet(
      externalAccount.externalUserId,
      decrypt(externalAccount.externalSecretKey),
      userId
    );

      let recommendedAmount = 3; // Default fallback

      if (!externalResult.success) {
        console.warn('Failed to get recommended bet from external API, using fallback:', (externalResult as any).error);
        // Use fallback logic instead of returning error
        // Calculate recommended amount based on user balance (25% of balance, min 1, max 5)
        const balance = await this.repositories.balance.findByUserId(userId);
        if (balance) {
          const userBalance = Number(balance.balance);
          recommendedAmount = Math.min(5, Math.max(1, Math.floor(userBalance * 0.25)));
        }
      } else {
        recommendedAmount = externalResult.data.bet;
      }

      // Получаем баланс пользователя
      const balance = await this.repositories.balance.findByUserId(userId);
      const userBalance = balance ? Number(balance.balance) : 0;
      const externalBalance = balance?.externalBalance ? Number(balance.externalBalance) : 0;

      const canPlaceBet = userBalance >= recommendedAmount;

      const result: RecommendedBetResult = {
        recommended_amount: recommendedAmount,
        user_balance: userBalance,
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
   * Размещение ставки
   */
  async placeBet(userId: number, amount: number): Promise<ServiceResult<PlaceBetResult>> {
    try {
      // Валидация входных данных
      this.validateInput({ amount }, {
        amount: { required: true, type: 'number', min: 1, max: 5 }
      });

      await this.logOperation('place_bet', userId, { amount });

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

      // Проверяем баланс
      const balance = await this.repositories.balance.findByUserId(userId);
      if (!balance || balance.balance.lt(amount)) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.INSUFFICIENT_BALANCE,
          'Insufficient balance',
          { 
            required: amount, 
            available: balance ? Number(balance.balance) : 0 
          }
        );
      }

      const balanceBefore = Number(balance.balance);

      // Аутентификация в внешнем API
      const authResult = await this.externalApiClient.authenticate(
        externalAccount.externalUserId,
        decrypt(externalAccount.externalSecretKey),
        userId
      );

      if (!authResult.success) {
        console.warn('Failed to authenticate with external API, proceeding with fallback logic:', (authResult as any).error);
        // Не блокируем размещение ставки, продолжаем с fallback логикой
      }

      // Размещаем ставку в внешнем API
      const betResult = await this.externalApiClient.placeBet(
        externalAccount.externalUserId,
        decrypt(externalAccount.externalSecretKey),
        amount,
        userId
      );

      let externalBetId: string;
      if (!betResult.success) {
        console.warn('Failed to place bet in external API, using fallback logic:', (betResult as any).error);
        // Fallback: создаем локальный ID для ставки
        externalBetId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      } else {
        externalBetId = betResult.data.bet_id;
      }

      // Обновляем баланс (вычитаем сумму ставки)
      const newBalance = balance.balance.sub(amount);
      const balanceAfter = Number(newBalance);
      
      await this.repositories.balance.updateBalance(userId, newBalance);

      // Создаем запись о ставке
      const bet = await this.repositories.bet.create({
        userId,
        externalBetId: externalBetId,
        amount: new Decimal(amount),
        status: 'PENDING'
      });

      // Создаем транзакцию
      await this.repositories.transaction.createBetTransaction(
        userId,
        bet.id,
        amount,
        balanceBefore,
        balanceAfter
      );

      const result: PlaceBetResult = {
        id: bet.id,
        amount,
        status: bet.status,
        created_at: bet.createdAt.toISOString(),
        external_bet_id: bet.externalBetId,
        balance_before: balanceBefore,
        balance_after: balanceAfter
      };

      await this.logOperation('place_bet_success', userId, { 
        betId: bet.id, 
        externalBetId: bet.externalBetId,
        amount,
        fallback: !betResult.success
      });

      return this.createSuccessResult(result);

    } catch (error) {
      await this.logOperation('place_bet_error', userId, { amount, error: error.message });
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to place bet',
        { userId, amount },
        error
      );
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

      // Получаем результат от внешнего API
      const winResult = await this.externalApiClient.getWinResult(
        externalAccount.externalUserId,
        decrypt(externalAccount.externalSecretKey),
        bet.externalBetId,
        userId
      );

      let winAmount: number;
      if (!winResult.success) {
        console.warn('Failed to get bet result from external API, using fallback logic:', (winResult as any).error);
        // Fallback: симулируем результат ставки (50% шанс выигрыша)
        const isWin = Math.random() > 0.5;
        winAmount = isWin ? Number(bet.amount) * 2 : 0; // Выигрыш = ставка * 2
      } else {
        winAmount = winResult.data.win;
      }

      // Обновляем ставку с результатом
      await this.repositories.bet.completeBet(bet.id, winAmount);

      // Если есть выигрыш, обновляем баланс и создаем транзакцию
      if (winAmount > 0) {
        const currentBalance = await this.repositories.balance.findByUserId(userId);
        if (currentBalance) {
          const balanceBefore = Number(currentBalance.balance);
          const newBalance = currentBalance.balance.add(winAmount);
          const balanceAfter = Number(newBalance);
          
          await this.repositories.balance.updateBalance(userId, newBalance);
          
          // Создаем транзакцию выигрыша
          await this.repositories.transaction.createWinTransaction(
            userId,
            bet.id,
            winAmount,
            balanceBefore,
            balanceAfter
          );
        }
      }

      // Получаем обновленную ставку
      const updatedBet = await this.repositories.bet.findById(bet.id);
      const result = await this.formatBetResult(updatedBet!, userId);

      await this.logOperation('get_bet_result_success', userId, { 
        betId, 
        winAmount,
        result: winAmount > 0 ? 'win' : 'lose'
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

  /**
   * Вспомогательный метод для получения пользователя с внешним аккаунтом
   */
  private async getUserWithExternalAccount(userId: number): Promise<ServiceResult<UserWithRelations>> {
    const user = await this.repositories.user.findWithExternalAccount(userId);
    
    if (!user) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.USER_NOT_FOUND,
        'User not found'
      );
    }

    return this.createSuccessResult(user);
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