import { useState, useEffect } from 'react';
import { apiClient } from '@shared/api/client';
import type { BalanceResponse, TransactionsResponse } from '@shared/api/types';

export const useBalance = () => {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.getBalance();
      setBalance(response.balance || 0);
    } catch (error: any) {
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (page: number = 1, limit: number = 10) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.getTransactions(page, limit);
      setTransactions(response.transactions || []);
    } catch (error: any) {
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshBalance = async () => {
    await fetchBalance();
  };

  const refreshTransactions = async () => {
    await fetchTransactions();
  };

  const clearError = () => {
    setError(null);
  };

  // Load initial data - empty dependency array to prevent infinite loops
  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, []);

  return {
    balance,
    transactions,
    loading,
    error,
    fetchBalance,
    fetchTransactions,
    refreshBalance,
    refreshTransactions,
    clearError,
  };
}; 