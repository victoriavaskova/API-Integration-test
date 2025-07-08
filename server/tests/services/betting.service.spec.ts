import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BettingServiceImpl } from '@/services/betting.service';
import { SERVICE_ERROR_CODES } from '@/services/base.service';
import { decrypt } from '@/utils/crypto.helper';
import { Decimal } from '@prisma/client/runtime/library';

jest.mock('@/utils/crypto.helper', () => ({
  decrypt: jest.fn().mockImplementation(key => {
    if (key === 'enc_secret_key') return 'decrypted_secret_key';
    return `decrypted_${key}`;
  }),
}));

const mockRepositories = {
  user: {
    findUserWithExternalAccount: jest.fn(),
  },
  bet: {
    create: jest.fn(),
    findPendingBets: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
  },
  balance: {
    findByUserId: jest.fn(),
    updateExternalBalance: jest.fn(),
    update: jest.fn()
  },
  transaction: {
    create: jest.fn(),
  },
  apiLog: {
    create: jest.fn(),
  },
  idempotency: {
    find: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  }
};

const mockExternalApiClient = {
  authenticate: jest.fn(),
  getBalance: jest.fn(),
  getRecommendedBet: jest.fn(),
  placeBet: jest.fn(),
  getWin: jest.fn(),
};

const userWithAccount = {
  id: 1,
  username: 'test',
  externalApiAccounts: [{
    id: 1,
    userId: 1,
    externalUserId: 'ext-user-1',
    externalSecretKey: 'enc_secret_key'
  }]
};

describe('BettingServiceImpl', () => {
  let bettingService: BettingServiceImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    bettingService = new BettingServiceImpl(mockRepositories as any, mockExternalApiClient as any);

    (bettingService as any).getUserWithExternalAccount = jest.fn().mockResolvedValue({
        success: true,
        data: userWithAccount
      });
  });

  describe('placeBet', () => {
    it('should place a bet successfully', async () => {
      mockExternalApiClient.getBalance.mockResolvedValue({ success: true, data: { balance: 100 } });
      mockExternalApiClient.authenticate.mockResolvedValue({ success: true });
      mockExternalApiClient.placeBet.mockResolvedValue({ success: true, data: { bet_id: 'ext-bet-1' } });
      mockRepositories.bet.create.mockResolvedValue({ id: 123, userId: 1, externalBetId: 'ext-bet-1', amount: new Decimal(5), status: 'pending' } as any);
      mockRepositories.balance.findByUserId.mockResolvedValue({ balance: new Decimal(100) } as any);
      mockRepositories.transaction.create.mockResolvedValue({} as any);
      
      const result = await bettingService.placeBet(1, 5);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(5);
      expect(result.data?.external_bet_id).toBe('ext-bet-1');
      expect(mockRepositories.bet.create).toHaveBeenCalled();
      expect(mockRepositories.transaction.create).toHaveBeenCalled();
      expect(decrypt).toHaveBeenCalledWith('enc_secret_key');
    });

    it('should return insufficient balance error', async () => {
        (bettingService as any).getUserWithExternalAccount.mockResolvedValue({ success: true, data: userWithAccount});
        mockExternalApiClient.getBalance.mockResolvedValue({ success: true, data: { balance: 3 } });
        
        const result = await bettingService.placeBet(1, 5);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.INSUFFICIENT_BALANCE);
    });

    it('should fail if external API authentication fails', async () => {
        (bettingService as any).getUserWithExternalAccount.mockResolvedValue({ success: true, data: userWithAccount });
        mockExternalApiClient.getBalance.mockResolvedValue({ success: true, data: { balance: 100 } });
        mockExternalApiClient.authenticate.mockResolvedValue({ success: false, error: 'Auth failed' });

        const result = await bettingService.placeBet(1, 5);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.EXTERNAL_API_ERROR);
    });
  });

  describe('getRecommendedBet', () => {
    it('should get recommended bet from external api', async () => {
      mockExternalApiClient.authenticate.mockResolvedValue({ success: true });
      mockExternalApiClient.getRecommendedBet.mockResolvedValue({ success: true, data: { bet: 4 } });
      mockExternalApiClient.getBalance.mockResolvedValue({ success: true, data: { balance: 50 } });

      const result = await bettingService.getRecommendedBet(1);
      
      expect(result.success).toBe(true);
      expect(result.data?.recommended_amount).toBe(4);
      expect(result.data?.user_balance).toBe(50);
      expect(result.data?.can_place_bet).toBe(true);
    });

    it('should use fallback if external api for recommendation fails', async () => {
        mockExternalApiClient.authenticate.mockResolvedValue({ success: true });
        mockExternalApiClient.getRecommendedBet.mockResolvedValue({ success: false });
        mockExternalApiClient.getBalance.mockResolvedValue({ success: true, data: { balance: 50 } });
  
        const result = await bettingService.getRecommendedBet(1);
        
        expect(result.success).toBe(true);
        expect(result.data?.recommended_amount).toBe(3); // Default fallback value
    });
  });

  describe('processAllPendingBets', () => {
    it('should process pending bets and update status', async () => {
        const pendingBets = [
            { id: 1, userId: 1, externalBetId: 'ext-1', amount: new Decimal(5) },
            { id: 2, userId: 1, externalBetId: 'ext-2', amount: new Decimal(3) },
        ];
        mockRepositories.bet.findPendingBets.mockResolvedValue(pendingBets);
        (bettingService as any).getUserWithExternalAccount.mockResolvedValue({ success: true, data: userWithAccount });
        mockExternalApiClient.authenticate.mockResolvedValue({ success: true });
        mockExternalApiClient.getWin
            .mockResolvedValueOnce({ success: true, data: { win: 10 } }) // Bet 1 wins
            .mockResolvedValueOnce({ success: true, data: { win: 0 } });  // Bet 2 loses
        mockRepositories.balance.findByUserId.mockResolvedValue({ balance: new Decimal(100) });
      
        const result = await bettingService.processAllPendingBets();

        expect(result.success).toBe(true);
        expect(result.data?.processed_count).toBe(2);
        expect(result.data?.successful_count).toBe(2);
        expect(mockRepositories.bet.update).toHaveBeenCalledTimes(2);
        expect(mockRepositories.transaction.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBetResult', () => {
    it('should return the result of a specific bet', async () => {
        const bet = { id: 1, userId: 1, status: 'completed', winAmount: new Decimal(10) };
        mockRepositories.bet.findById.mockResolvedValue(bet as any);

        const result = await bettingService.getBetResult(1, 1);

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('completed');
        expect(result.data?.win_amount).toBe(10);
    });

    it('should return error if bet not found', async () => {
        mockRepositories.bet.findById.mockResolvedValue(null);
        const result = await bettingService.getBetResult(1, 999);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.BET_NOT_FOUND);
    });
  });
}); 