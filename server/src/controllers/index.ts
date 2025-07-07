import type { Services } from '../services/index.js';

// Импорты контроллеров
import { AuthController } from './auth.controller.js';
import { BettingController } from './betting.controller.js';
import { BalanceController } from './balance.controller.js';

/**
 * Интерфейс для всех контроллеров
 */
export interface Controllers {
  auth: AuthController;
  betting: BettingController;
  balance: BalanceController;
}

/**
 * Factory для создания всех контроллеров
 */
export class ControllerFactory {
  private static instance: ControllerFactory;
  private controllers: Controllers | null = null;

  private constructor() {}

  /**
   * Получает singleton instance фабрики контроллеров
   */
  public static getInstance(): ControllerFactory {
    if (!ControllerFactory.instance) {
      ControllerFactory.instance = new ControllerFactory();
    }
    return ControllerFactory.instance;
  }

  /**
   * Создает и возвращает все контроллеры
   */
  public createControllers(services: Services): Controllers {
    if (!this.controllers) {
      this.controllers = {
        auth: new AuthController(services.auth),
        betting: new BettingController(services.betting),
        balance: new BalanceController(services.balance)
      };
    }
    return this.controllers;
  }

  /**
   * Получает существующие контроллеры (должны быть созданы ранее)
   */
  public getControllers(): Controllers {
    if (!this.controllers) {
      throw new Error('Controllers not initialized. Call createControllers() first.');
    }
    return this.controllers;
  }

  /**
   * Сбрасывает singleton instance (для тестирования)
   */
  public static resetInstance(): void {
    ControllerFactory.instance = null as any;
  }
}

// Экспорт типов и классов для прямого использования
export {
  AuthController,
  BettingController,
  BalanceController
};

/**
 * Хелпер функция для быстрого создания контроллеров
 */
export function createControllers(services: Services): Controllers {
  return ControllerFactory.getInstance().createControllers(services);
}

/**
 * Хелпер функция для получения контроллеров
 */
export function getControllers(): Controllers {
  return ControllerFactory.getInstance().getControllers();
} 