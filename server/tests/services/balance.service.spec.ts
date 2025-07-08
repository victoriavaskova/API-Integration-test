import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BalanceServiceImpl } from '@/services/balance.service';
import { SERVICE_ERROR_CODES } from '@/services/base.service';
import { Decimal } from '@prisma/client/runtime/library';

jest.mock('@/utils/crypto.helper', () => ({
  decrypt: jest.fn(key => `decrypted_${key}`),
}));

const mockRepositories = {
  user: {
    findUserWithExternalAccount: jest.fn(),
  },
  balance: {
    findByUserId: jest.fn(),
    updateExternalBalance: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  transaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
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

describe('BalanceServiceImpl', () => {
  let balanceService: BalanceServiceImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    balanceService = new BalanceServiceImpl(mockRepositories as any, mockExternalApiClient as any);
    // Mock the inherited method correctly on the prototype for all tests
    jest.spyOn(BalanceServiceImpl.prototype as any, 'getUserWithExternalAccount');
  });

  describe('getCurrentBalance', () => {
    it('should return local balance if no external account exists', async () => {
        const user = { id: 1, externalApiAccounts: [] };
        const balance = { balance: new Decimal(100), lastCheckedAt: new Date() };

        (balanceService as any).getUserWithExternalAccount.mockResolvedValue({ success: true, data: user });
        mockRepositories.balance.findByUserId.mockResolvedValue(balance);

        const result = await balanceService.getCurrentBalance(1);

        expect(result.success).toBe(true);
        expect(result.data?.balance).toBe(100);
        expect(result.data?.external_balance).toBeNull();
        expect(mockExternalApiClient.getBalance).not.toHaveBeenCalled();
    });

    it('should return synced balance if external account exists', async () => {
        const user = { id: 1, externalApiAccounts: [{ externalUserId: 'ext-1', externalSecretKey: 'key' }] };
        const localBalance = { balance: new Decimal(100) };

        (balanceService as any).getUserWithExternalAccount.mockResolvedValue({ success: true, data: user });
        mockRepositories.balance.findByUserId.mockResolvedValue(localBalance);
        mockExternalApiClient.authenticate.mockResolvedValue({ success: true });
        mockExternalApiClient.getBalance.mockResolvedValue({ success: true, data: { balance: 105 } });

        const result = await balanceService.getCurrentBalance(1);

        expect(result.success).toBe(true);
        expect(result.data?.balance).toBe(105); // Priority to external
        expect(result.data?.external_balance).toBe(105);
        expect(result.data?.is_synced).toBe(false);
        expect(result.data?.difference).toBe(-5);
        expect(mockRepositories.balance.updateExternalBalance).toHaveBeenCalledWith(1, new Decimal(105));
    });

    it('should create local balance if it does not exist but external does', async () => {
        const user = { id: 1, externalApiAccounts: [{ externalUserId: 'ext-1', externalSecretKey: 'key' }] };

        (balanceService as any).getUserWithExternalAccount.mockResolvedValue({ success: true, data: user });
        mockRepositories.balance.findByUserId.mockResolvedValue(null); // No local balance
        mockExternalApiClient.authenticate.mockResolvedValue({ success: true });
        mockExternalApiClient.getBalance.mockResolvedValue({ success: true, data: { balance: 200 } });
        mockRepositories.balance.create.mockResolvedValue({ balance: new Decimal(200) });

        const result = await balanceService.getCurrentBalance(1);

        expect(result.success).toBe(true);
        expect(result.data?.balance).toBe(200);
        expect(mockRepositories.balance.create).toHaveBeenCalledWith({
            userId: 1,
            balance: new Decimal(200),
            externalBalance: new Decimal(200)
        });
    });

    it('should return an error if user is not found', async () => {
        (balanceService as any).getUserWithExternalAccount = jest.fn().mockResolvedValue({ success: false, error: { code: SERVICE_ERROR_CODES.NOT_FOUND }});

        const result = await balanceService.getCurrentBalance(1);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.NOT_FOUND);
    });

     it('should return an error if local balance is not found and external fails', async () => {
        const user = { id: 1, externalApiAccounts: [{ externalUserId: 'ext-1', externalSecretKey: 'key' }] };

        (balanceService as any).getUserWithExternalAccount = jest.fn().mockResolvedValue({ success: true, data: user });
        mockRepositories.balance.findByUserId.mockResolvedValue(null);
        mockExternalApiClient.authenticate.mockResolvedValue({ success: true });
        mockExternalApiClient.getBalance.mockResolvedValue({ success: false }); // External fails

        const result = await balanceService.getCurrentBalance(1);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.BALANCE_NOT_FOUND);
    });
  });

  describe('addFunds', () => {
    it('should add funds to user balance and create a transaction', async () => {
      const initialBalance = { id: 1, userId: 1, balance: new Decimal(100) };
      const updatedBalance = { ...initialBalance, balance: new Decimal(150) };
      
      mockRepositories.balance.findByUserId.mockResolvedValue(initialBalance);
      mockRepositories.balance.update.mockResolvedValue(updatedBalance);
      mockRepositories.transaction.create.mockResolvedValue({ id: 1, createdAt: new Date() } as any);

      const result = await balanceService.addFunds(1, 50, 'Test Deposit');

      expect(result.success).toBe(true);
      expect(result.data?.balance_after).toBe(150);
      expect(mockRepositories.balance.update).toHaveBeenCalledWith(1, new Decimal(150));
      expect(mockRepositories.transaction.create).toHaveBeenCalled();
    });

    it('should return error if balance not found', async () => {
        mockRepositories.balance.findByUserId.mockResolvedValue(null);
        const result = await balanceService.addFunds(1, 50);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.BALANCE_NOT_FOUND);
    });
  });

  describe('withdrawFunds', () => {
    it('should withdraw funds and create a transaction', async () => {
        const initialBalance = { id: 1, userId: 1, balance: new Decimal(100) };
        const updatedBalance = { ...initialBalance, balance: new Decimal(50) };
        
        mockRepositories.balance.findByUserId.mockResolvedValue(initialBalance);
        mockRepositories.balance.update.mockResolvedValue(updatedBalance);
        mockRepositories.transaction.create.mockResolvedValue({ id: 1, createdAt: new Date() } as any);
  
        const result = await balanceService.withdrawFunds(1, 50, 'Test Withdrawal');
  
        expect(result.success).toBe(true);
        expect(result.data?.balance_after).toBe(50);
        expect(mockRepositories.balance.update).toHaveBeenCalledWith(1, new Decimal(50));
        expect(mockRepositories.transaction.create).toHaveBeenCalled();
    });

    it('should return insufficient funds error', async () => {
        const initialBalance = { id: 1, userId: 1, balance: new Decimal(40) };
        mockRepositories.balance.findByUserId.mockResolvedValue(initialBalance);

        const result = await balanceService.withdrawFunds(1, 50);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.INSUFFICIENT_BALANCE);
    });
  });

  describe('initializeBalance', () => {
    it('should initialize balance for a new user', async () => {
        const user = { id: 1, externalApiAccounts: [] };
        (balanceService as any).getUserWithExternalAccount.mockResolvedValue({ success: true, data: user });
        mockRepositories.balance.findByUserId.mockResolvedValue(null);
        mockRepositories.balance.create.mockResolvedValue({ balance: new Decimal(1000), lastCheckedAt: new Date() } as any);

        const result = await balanceService.initializeBalance(1, 1000);

        expect(result.success).toBe(true);
        expect(result.data?.balance).toBe(1000);
        expect(mockRepositories.balance.create).toHaveBeenCalledWith({
            userId: 1,
            balance: new Decimal(1000),
            externalBalance: null
        });
    });

    it('should return error if balance already exists', async () => {
        mockRepositories.balance.findByUserId.mockResolvedValue({} as any);
        const result = await balanceService.initializeBalance(1, 1000);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('syncWithExternalApi', () => {
    it('should sync internal balance with external API', async () => {
        const user = { id: 1, externalApiAccounts: [{ externalUserId: 'ext-1', externalSecretKey: 'key' }] };
        const localBalance = { balance: new Decimal(100) };

        (balanceService as any).getUserWithExternalAccount.mockResolvedValue({ success: true, data: user });
        mockRepositories.balance.findByUserId.mockResolvedValue(localBalance);
        mockExternalApiClient.authenticate.mockResolvedValue({ success: true });
        mockExternalApiClient.getBalance.mockResolvedValue({ success: true, data: { balance: 150 }});
        mockRepositories.balance.update.mockResolvedValue({} as any);

        const result = await balanceService.syncWithExternalApi(1);

        expect(result.success).toBe(true);
        expect(result.data?.was_synced).toBe(true);
        expect(result.data?.internal_balance).toBe(150);
        expect(mockRepositories.balance.update).toHaveBeenCalledWith(1, new Decimal(150));
    });
  });

  describe('getTransactions', () => {
    it('should return a paginated list of transactions', async () => {
        const transactions = [{ id: 1, type: 'DEPOSIT', amount: new Decimal(100), createdAt: new Date() }];
        mockRepositories.transaction.findMany.mockResolvedValue(transactions as any);
        mockRepositories.transaction.count.mockResolvedValue(1);

        const result = await balanceService.getTransactions(1, 1, 10);

        expect(result.success).toBe(true);
        expect(result.data?.transactions).toHaveLength(1);
        expect(result.data?.pagination.total).toBe(1);
        expect(mockRepositories.transaction.findMany).toHaveBeenCalledWith({
            where: { userId: 1 },
            orderBy: { createdAt: 'desc' },
            skip: 0,
            take: 10,
        });
    });
  });
}); 