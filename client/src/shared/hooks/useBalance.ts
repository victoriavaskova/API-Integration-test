import { useState, useCallback } from 'react';
import { apiClient, Balance, Transaction } from '../api/api-client';

interface BalanceState {
  balance: Balance | null;
  transactions: Transaction[];
  isLoadingBalance: boolean;
  isLoadingTransactions: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  } | null;
}

export const useBalance = () => {
  const [balanceState, setBalanceState] = useState<BalanceState>({
    balance: null,
    transactions: [],
    isLoadingBalance: false,
    isLoadingTransactions: false,
    error: null,
    pagination: null,
  });

  // Получение текущего баланса
  const loadBalance = useCallback(async () => {
    setBalanceState(prev => ({ ...prev, isLoadingBalance: true, error: null }));
    
    try {
      const balance = await apiClient.getBalance();
      setBalanceState(prev => ({
        ...prev,
        balance,
        isLoadingBalance: false,
      }));
      console.log('💰 Balance loaded:', balance);
      return balance;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load balance';
      setBalanceState(prev => ({
        ...prev,
        isLoadingBalance: false,
        error: errorMessage,
      }));
      console.error('❌ Failed to load balance:', errorMessage);
      return null;
    }
  }, []);

  // Получение истории транзакций
  const loadTransactions = useCallback(async (page: number = 1, limit: number = 10) => {
    setBalanceState(prev => ({ ...prev, isLoadingTransactions: true, error: null }));
    
    try {
      const data = await apiClient.getTransactions(page, limit);
      setBalanceState(prev => ({
        ...prev,
        transactions: page === 1 ? data.transactions : [...prev.transactions, ...data.transactions],
        pagination: data.pagination || null,
        isLoadingTransactions: false,
      }));
      console.log('📈 Transactions loaded:', data);
      return data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load transactions';
      setBalanceState(prev => ({
        ...prev,
        isLoadingTransactions: false,
        error: errorMessage,
      }));
      console.error('❌ Failed to load transactions:', errorMessage);
      return null;
    }
  }, []);

  // Обновление баланса после операций
  const refreshBalance = useCallback(async () => {
    const balance = await loadBalance();
    return balance;
  }, [loadBalance]);

  // Добавление новой транзакции (для оптимистичного обновления UI)
  const addTransaction = useCallback((transaction: Transaction) => {
    setBalanceState(prev => ({
      ...prev,
      transactions: [transaction, ...prev.transactions],
    }));
  }, []);

  // Очистка ошибок
  const clearError = useCallback(() => {
    setBalanceState(prev => ({ ...prev, error: null }));
  }, []);

  // Получение форматированного баланса
  const getFormattedBalance = useCallback(() => {
    if (!balanceState.balance) return '0.00';
    return balanceState.balance.balance.toFixed(2);
  }, [balanceState.balance]);

  // Получение последних транзакций определенного типа
  const getTransactionsByType = useCallback((type: Transaction['type']) => {
    return balanceState.transactions.filter(t => t.type === type);
  }, [balanceState.transactions]);

  return {
    ...balanceState,
    loadBalance,
    loadTransactions,
    refreshBalance,
    addTransaction,
    clearError,
    getFormattedBalance,
    getTransactionsByType,
  };
}; 