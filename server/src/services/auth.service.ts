import jwt from 'jsonwebtoken';
import { BaseServiceImpl, type ServiceResult, SERVICE_ERROR_CODES } from './base.service.js';
import type { User, UserWithRelations } from '../types/database.js';

export interface AuthService {
  login(username: string): Promise<ServiceResult<LoginResult>>;
  validateToken(token: string): Promise<ServiceResult<TokenPayload>>;
  refreshToken(token: string): Promise<ServiceResult<LoginResult>>;
  logout(userId: number): Promise<ServiceResult<void>>;
  getCurrentUser(userId: number): Promise<ServiceResult<User>>;
}

export interface LoginResult {
  token: string;
  expiresIn: number;
  user: {
    id: number;
    username: string;
    email: string | null;
  };
}

export interface TokenPayload {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  adminToken: string;
}

export class AuthServiceImpl extends BaseServiceImpl implements AuthService {
  private config: AuthConfig;

  constructor(repositories: any, externalApiClient: any, config: AuthConfig) {
    super(repositories, externalApiClient);
    this.config = config;
  }

  /**
   * Аутентификация пользователя по username
   */
  async login(username: string): Promise<ServiceResult<LoginResult>> {
    try {
      // Валидация входных данных
      this.validateInput({ username }, {
        username: { required: true, type: 'string', pattern: /^[a-zA-Z0-9_]{3,20}$/ }
      });

      await this.logOperation('login_attempt', undefined, { username });

      // Поиск пользователя
      const user = await this.repositories.user.findByUsername(username);
      if (!user) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.USER_NOT_FOUND,
          'User not found',
          { username }
        );
      }

      // Обновляем время последнего входа
      await this.repositories.user.updateLastLogin(user.id);

      // Создаем JWT токен
      const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
        userId: user.id,
        username: user.username
      };

      const token = jwt.sign(
        tokenPayload, 
        this.config.jwtSecret, 
        {
          expiresIn: this.config.jwtExpiresIn
        } as jwt.SignOptions
      );

      // Получаем время истечения токена
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      const expiresIn = decoded.exp! - decoded.iat!;

      const result: LoginResult = {
        token,
        expiresIn,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      };

      await this.logOperation('login_success', user.id, { username });

      return this.createSuccessResult(result);

    } catch (error) {
      await this.logOperation('login_error', undefined, { username, error: error instanceof Error ? error.message : String(error) });
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Login failed',
        { username },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Валидация JWT токена
   */
  async validateToken(token: string): Promise<ServiceResult<TokenPayload>> {
    try {
      if (!token) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.UNAUTHORIZED,
          'Token is required'
        );
      }

      // Проверяем, не является ли это админским токеном
      if (token === this.config.adminToken) {
        // Создаем специальный payload для админа
        const adminPayload: TokenPayload = {
          userId: 0, // Специальный ID для админа
          username: 'admin',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400 // 24 часа
        };
        return this.createSuccessResult(adminPayload);
      }

      const decoded = jwt.verify(token, this.config.jwtSecret) as TokenPayload;
      
      // Проверяем, существует ли пользователь
      const user = await this.repositories.user.findById(decoded.userId);
      if (!user) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.USER_NOT_FOUND,
          'User not found'
        );
      }

      return this.createSuccessResult(decoded);

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.UNAUTHORIZED,
          'Invalid token',
          { reason: error.message }
        );
      }

      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Token validation failed',
        {},
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Обновление токена (выдача нового)
   */
  async refreshToken(token: string): Promise<ServiceResult<LoginResult>> {
    try {
      const validationResult = await this.validateToken(token);
      if (!validationResult.success) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.UNAUTHORIZED,
          'Token validation failed',
          {},
          validationResult.error?.originalError
        );
      }

      const payload = validationResult.data!;
      const user = await this.repositories.user.findById(payload.userId);
      
      if (!user) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.USER_NOT_FOUND,
          'User not found'
        );
      }

      // Создаем новый токен
      const newTokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
        userId: user.id,
        username: user.username
      };

      const newToken = jwt.sign(
        newTokenPayload, 
        this.config.jwtSecret, 
        {
          expiresIn: this.config.jwtExpiresIn
        } as jwt.SignOptions
      );

      const decoded = jwt.decode(newToken) as jwt.JwtPayload;
      const expiresIn = decoded.exp! - decoded.iat!;

      const result: LoginResult = {
        token: newToken,
        expiresIn,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      };

      await this.logOperation('token_refresh', user.id);

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Token refresh failed',
        {},
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Выход пользователя из системы
   */
  async logout(userId: number): Promise<ServiceResult<void>> {
    try {
      // В JWT нет server-side состояния, поэтому просто логируем
      await this.logOperation('logout', userId);
      
      return this.createSuccessResult(undefined);
      
    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Logout failed',
        { userId },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Получение информации о текущем пользователе
   */
  async getCurrentUser(userId: number): Promise<ServiceResult<User>> {
    try {
      const user = await this.repositories.user.findById(userId);
      
      if (!user) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.USER_NOT_FOUND,
          'User not found',
          { userId }
        );
      }

      return this.createSuccessResult(user);
      
    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get current user',
        { userId },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Проверка, является ли пользователь администратором
   */
  async isAdmin(userId: number): Promise<boolean> {
    return userId === 0; // Специальный ID для админа
  }

  /**
   * Получение пользователя с внешним аккаунтом
   */
  async getUserWithExternalAccount(userId: number): Promise<ServiceResult<UserWithRelations>> {
    try {
      const user = await this.repositories.user.findWithExternalAccount(userId);
      
      if (!user) {
        return this.createErrorResult(
          SERVICE_ERROR_CODES.USER_NOT_FOUND,
          'User not found',
          { userId }
        );
      }

      return this.createSuccessResult(user);
      
    } catch (error) {
      return this.createErrorResult(
        SERVICE_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get user with external account',
        { userId },
        error
      );
    }
  }

  /**
   * Декодирование токена без проверки (для отладки)
   */
  decodeTokenUnsafe(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
} 