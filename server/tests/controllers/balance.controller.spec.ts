import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { BalanceController } from '@/controllers/balance.controller';
import { BalanceService } from '@/services/balance.service';
import { SERVICE_ERROR_CODES } from '@/services/base.service';

const mockBalanceService: jest.Mocked<BalanceService> = {
    getCurrentBalance: jest.fn(),
    initializeBalance: jest.fn(),
    syncWithExternalApi: jest.fn(),
    addFunds: jest.fn(),
    withdrawFunds: jest.fn(),
    getBalanceHistory: jest.fn(),
    getTransactions: jest.fn(),
    checkBalanceConsistency: jest.fn(),
};

const app = express();
app.use(express.json());
const balanceController = new BalanceController(mockBalanceService);

const mockAuthMiddleware = (req: any, res: any, next: any) => {
    (req as any).user = { userId: 1, username: 'testuser' };
    next();
};

app.get('/api/balance', mockAuthMiddleware, balanceController.getCurrentBalance);
app.post('/api/balance/add', mockAuthMiddleware, balanceController.addFunds);
app.post('/api/balance/withdraw', mockAuthMiddleware, balanceController.withdrawFunds);

describe('BalanceController', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/balance', () => {
        it('should return user balance', async () => {
            mockBalanceService.getCurrentBalance.mockResolvedValue({
                success: true,
                data: { balance: 100, external_balance: 100, is_synced: true, difference: 0, last_updated: '' }
            });

            const response = await request(app).get('/api/balance');

            expect(response.status).toBe(200);
            expect(response.body.balance).toBe(100);
        });

        it('should return 404 if balance not found', async () => {
            mockBalanceService.getCurrentBalance.mockResolvedValue({
                success: false,
                data: null,
                error: { code: SERVICE_ERROR_CODES.BALANCE_NOT_FOUND, message: 'Not Found' }
            });

            const response = await request(app).get('/api/balance');
            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/balance/add', () => {
        it('should add funds and return 200', async () => {
            mockBalanceService.addFunds.mockResolvedValue({ success: true, data: {} as any });
            
            const response = await request(app).post('/api/balance/add').send({ amount: 50 });

            expect(response.status).toBe(200);
            expect(mockBalanceService.addFunds).toHaveBeenCalledWith(1, 50, undefined);
        });

        it('should return 400 for invalid amount', async () => {
            const response = await request(app).post('/api/balance/add').send({ amount: -50 });
            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/balance/withdraw', () => {
        it('should withdraw funds and return 200', async () => {
            mockBalanceService.withdrawFunds.mockResolvedValue({ success: true, data: {} as any });

            const response = await request(app).post('/api/balance/withdraw').send({ amount: 50 });

            expect(response.status).toBe(200);
            expect(mockBalanceService.withdrawFunds).toHaveBeenCalledWith(1, 50, undefined);
        });

        it('should return 400 for insufficient balance from service', async () => {
            mockBalanceService.withdrawFunds.mockResolvedValue({
                success: false,
                data: null,
                error: { code: SERVICE_ERROR_CODES.INSUFFICIENT_BALANCE, message: 'Not enough money' }
            });

            const response = await request(app).post('/api/balance/withdraw').send({ amount: 50 });
            expect(response.status).toBe(400);
        });
    });
}); 