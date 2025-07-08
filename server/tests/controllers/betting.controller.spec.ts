import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { BettingController } from '@/controllers/betting.controller';
import { BettingService, PlaceBetResult, RecommendedBetResult } from '@/services/betting.service';
import { ServiceResult, PaginatedServiceResult, SERVICE_ERROR_CODES } from '@/services/base.service';
import { Bet } from '@/types/database';

jest.mock('@/utils/crypto.helper', () => ({
  decrypt: jest.fn(key => `decrypted_${key}`),
}));

const mockBettingService: jest.Mocked<BettingService> = {
  getRecommendedBet: jest.fn(),
  placeBet: jest.fn(),
  getBetResult: jest.fn(),
  getUserBets: jest.fn(),
  getBetById: jest.fn(),
  getUserBetsStats: jest.fn(),
  processAllPendingBets: jest.fn(),
};

const app = express();
app.use(express.json());
const bettingController = new BettingController(mockBettingService);

const mockAuthMiddleware = (req: any, res: any, next: any) => {
    (req as any).user = { userId: 1, username: 'testuser' };
    next();
};

// Define routes for testing, using the base paths from README
app.get('/api/bets/recommended', mockAuthMiddleware, bettingController.getRecommendedBet);
app.post('/api/bets', mockAuthMiddleware, bettingController.placeBet);
app.get('/api/bets', mockAuthMiddleware, bettingController.getUserBets);

describe('BettingController', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/bets/recommended', () => {
    it('should return a recommended bet amount', async () => {
      mockBettingService.getRecommendedBet.mockResolvedValue({
        success: true,
        data: { recommended_amount: 3, can_place_bet: true, user_balance: 100 },
      });
      const response = await request(app).get('/api/bets/recommended');

      expect(response.status).toBe(200);
      expect(response.body.recommended_amount).toBe(3);
      expect(mockBettingService.getRecommendedBet).toHaveBeenCalledWith(1);
    });

    it('should return a 500 if the service fails', async () => {
      mockBettingService.getRecommendedBet.mockResolvedValue({
        success: false,
        data: null,
        error: { code: SERVICE_ERROR_CODES.INTERNAL_ERROR, message: 'Chaos' },
      });
      const response = await request(app).get('/api/bets/recommended');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toContain('Chaos');
    });
  });

  describe('POST /api/bets', () => {
    it('should place a bet and return 201', async () => {
        const betResult: ServiceResult<PlaceBetResult> = {
            success: true,
            data: { id: '123', amount: '5', status: 'pending', external_bet_id: 'ext-123' }
        };
        mockBettingService.placeBet.mockResolvedValue(betResult);

        const response = await request(app)
            .post('/api/bets')
            .send({ amount: 5 });

        expect(response.status).toBe(201);
        expect(response.body.id).toBe('123');
        expect(response.body.amount).toBe('5');
    });

    it('should return 400 for an invalid amount', async () => {
        const response = await request(app)
            .post('/api/bets')
            .send({ amount: 10 }); // amount > 5

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid bet amount');
        expect(mockBettingService.placeBet).not.toHaveBeenCalled();
    });

    it('should return 400 for insufficient balance', async () => {
        const serviceResult: ServiceResult<PlaceBetResult> = {
            success: false,
            error: {
                code: SERVICE_ERROR_CODES.INSUFFICIENT_BALANCE,
                message: 'Not enough money'
            }
        };
        mockBettingService.placeBet.mockResolvedValue(serviceResult);

        const response = await request(app)
            .post('/api/bets')
            .send({ amount: 5 });
        
        expect(response.status).toBe(400); 
        expect(response.body.error).toBe('Bad Request');
        expect(response.body.message).toContain('Invalid bet amount');
    });

    it('should return 400 for invalid input', async () => {
        const response = await request(app)
            .post('/api/bets')
            .send({ amount: -1 }); // Invalid amount
        expect(response.status).toBe(400);
    });
  });

  describe('GET /api/bets', () => {
    it('should return a list of user bets', async () => {
        const betsResult: PaginatedServiceResult<Bet> = {
            success: true,
            data: [{ id: '1' } as Bet, { id: '2' } as Bet],
            pagination: { total: 2, page: 1, limit: 10, hasNext: false, hasPrev: false }
        };
        mockBettingService.getUserBets.mockResolvedValue(betsResult);

        const response = await request(app).get('/api/bets?page=1&limit=10');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body[0].id).toBe('1');
    });
  });

}); 