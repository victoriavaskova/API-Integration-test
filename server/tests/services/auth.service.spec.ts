import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { AuthServiceImpl, type AuthConfig } from '@/services/auth.service';
import { SERVICE_ERROR_CODES } from '@/services/base.service';

const mockRepositories = {
  user: {
    findByUsername: jest.fn(),
    updateLastLogin: jest.fn(),
    updateEmail: jest.fn(),
    findById: jest.fn(),
    findUserWithExternalAccount: jest.fn(),
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

const mockExternalApiClient = {};

const config: AuthConfig = {
  jwtSecret: 'test-secret',
  jwtExpiresIn: '1h',
  adminToken: 'admin-token',
};

describe('AuthServiceImpl', () => {
  let authService: AuthServiceImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthServiceImpl(mockRepositories, mockExternalApiClient, config);
  });

  describe('login', () => {
    it('should login a user and return a token', async () => {
      const user = { id: 1, username: 'testuser', email: 'test@test.com' };
      mockRepositories.user.findByUsername.mockResolvedValue(user);

      const result = await authService.login('testuser');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('token');
      expect(result.data?.user.id).toBe(user.id);
      expect(mockRepositories.user.findByUsername).toHaveBeenCalledWith('testuser');
      expect(mockRepositories.user.updateLastLogin).toHaveBeenCalledWith(user.id);
    });

    it('should return USER_NOT_FOUND error for non-existing user', async () => {
      mockRepositories.user.findByUsername.mockResolvedValue(null);

      const result = await authService.login('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SERVICE_ERROR_CODES.USER_NOT_FOUND);
      expect(mockRepositories.user.updateLastLogin).not.toHaveBeenCalled();
    });

    it('should update email if provided', async () => {
        const user = { id: 1, username: 'testuser', email: 'old@test.com' };
        mockRepositories.user.findByUsername.mockResolvedValue(user);

        await authService.login('testuser', 'new@test.com');

        expect(mockRepositories.user.updateEmail).toHaveBeenCalledWith(1, 'new@test.com');
    });

    it('should handle internal errors', async () => {
      const error = new Error('Database error');
      mockRepositories.user.findByUsername.mockRejectedValue(error);

      const result = await authService.login('testuser');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SERVICE_ERROR_CODES.INTERNAL_ERROR);
      expect(result.error?.originalError).toBe(error);
    });
  });

  describe('validateToken', () => {
    it('should validate a correct token', async () => {
      const user = { id: 1, username: 'testuser' };
      const token = jwt.sign({ userId: user.id, username: user.username }, config.jwtSecret);
      mockRepositories.user.findById.mockResolvedValue(user);

      const result = await authService.validateToken(token);

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe(user.id);
      expect(mockRepositories.user.findById).toHaveBeenCalledWith(user.id);
    });

    it('should return error for invalid token', async () => {
      const result = await authService.validateToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SERVICE_ERROR_CODES.UNAUTHORIZED);
    });
    
    it('should return error if user not found', async () => {
        const user = { id: 1, username: 'testuser' };
        const token = jwt.sign({ userId: user.id, username: user.username }, config.jwtSecret);
        mockRepositories.user.findById.mockResolvedValue(null);
  
        const result = await authService.validateToken(token);
  
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.USER_NOT_FOUND);
      });

    it('should correctly validate the admin token', async () => {
      const result = await authService.validateToken(config.adminToken);

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe(0);
      expect(result.data?.username).toBe('admin');
      expect(mockRepositories.user.findById).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh a valid token', async () => {
        (authService as any).validateToken = jest.fn().mockResolvedValue({ success: true, data: { userId: 1, username: 'testuser' } });
        mockRepositories.user.findById.mockResolvedValue({ id: 1, username: 'testuser', email: 'test@test.com' });
        const result = await authService.refreshToken('valid-token');
        expect(result.success).toBe(true);
        expect(result.data?.token).toBeDefined();
        expect(result.data?.user.id).toBe(1);
    });
  });

  describe('logout', () => {
    it('should always succeed', async () => {
        const result = await authService.logout(1);
        expect(result.success).toBe(true);
    });
  });

  describe('getCurrentUser', () => {
    it('should return user for a valid id', async () => {
        const user = { id: 1, username: 'testuser' };
        mockRepositories.user.findById.mockResolvedValue(user);
        const result = await authService.getCurrentUser(1);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(user);
    });

    it('should return error for an invalid id', async () => {
        mockRepositories.user.findById.mockResolvedValue(null);
        const result = await authService.getCurrentUser(999);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SERVICE_ERROR_CODES.USER_NOT_FOUND);
    });
  });
}); 