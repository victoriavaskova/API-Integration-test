import { useState, useEffect } from 'react';
import { apiClient } from '@shared/api/client';

export const useBalance = () => {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    setLoading(true);
    setError(null);
    
    console.log('💰 Fetching balance...');
    
    try {
      console.log('📤 API Call: GET /balance');
      const response = await apiClient.getBalance();
      console.log('✅ Balance received', response);
      setBalance(response.balance || 0);
    } catch (error: any) {
      console.error('❌ Failed to fetch balance', error);
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
    
    console.log('📜 Fetching transactions...', { page, limit });
    
    try {
      console.log('📤 API Call: GET /transactions', { page, limit });
      const response = await apiClient.getTransactions(page, limit);
      console.log('✅ Transactions received', { count: response.transactions?.length, pagination: response.pagination });
      
      if (page === 1) {
        setTransactions(response.transactions || []);
      } else {
        // Append for pagination
        setTransactions(prev => [...prev, ...(response.transactions || [])]);
      }
      
      setPagination(response.pagination || null);
    } catch (error: any) {
      console.error('❌ Failed to fetch transactions', error);
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      setTransactions([]);
      setPagination(null);
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
    pagination,
    loading,
    error,
    fetchBalance,
    fetchTransactions,
    refreshBalance,
    refreshTransactions,
    clearError,
  };
}; 