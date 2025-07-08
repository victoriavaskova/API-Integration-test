import { useState, useEffect } from 'react';
import { apiClient } from '@shared/api/client';
import type { Bet } from '@shared/api/types';

export const useBetting = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [recommendedAmount, setRecommendedAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [placingBet, setPlacingBet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBets = async () => {
    setLoading(true);
    setError(null);
    
    console.log('🎯 Fetching bets...');
    
    try {
      console.log('📤 API Call: GET /bets');
      const response = await apiClient.getBets();
      console.log('✅ Bets received', { count: response.bets?.length });
      setBets(response.bets || []); // Ensure it's always an array
    } catch (error: any) {
      console.error('❌ Failed to fetch bets', error);
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      setBets([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendedBet = async () => {
    console.log('💡 Fetching recommended bet...');
    
    try {
      console.log('📤 API Call: GET /bets/recommended');
      const response = await apiClient.getRecommendedBet();
      console.log('✅ Recommended bet received', response);
      setRecommendedAmount(response.recommended_amount || 3); // Default to 3 if not available
    } catch (error: any) {
      console.warn('⚠️ Failed to fetch recommended bet, using fallback', error);
      setRecommendedAmount(3); // Default fallback amount
    }
  };

  const placeBet = async (amount: number) => {
    setPlacingBet(true);
    setError(null);
    
    console.log('🎲 Placing bet...', { amount });
    
    try {
      console.log('📤 API Call: POST /bets', { amount });
      const response = await apiClient.placeBet({ amount });
      console.log('✅ Bet placed successfully', response);
      
      // Add new bet to the beginning of the list
      setBets(prev => [response, ...prev]);
      
      return response;
    } catch (error: any) {
      console.error('❌ Failed to place bet', error);
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      throw error;
    } finally {
      setPlacingBet(false);
    }
  };

  const getBet = async (id: string) => {
    setLoading(true);
    setError(null);
    
    console.log('🔍 Fetching specific bet...', { id });
    
    try {
      console.log('📤 API Call: GET /bets/:id', { id });
      const response = await apiClient.getBet(id);
      console.log('✅ Bet details received', response);
      
      // Update bet in the list if it exists
      setBets(prev => prev.map(bet => bet.id === id ? response : bet));
      
      return response;
    } catch (error: any) {
      console.error('❌ Failed to fetch bet details', error);
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkBetResult = async (betId: string) => {
    setLoading(true);
    setError(null);
    
    console.log('🔍 API Call: Checking bet result', { betId, endpoint: `/api/bets/result/${betId}` });
    
    try {
      const response = await apiClient.checkBetResult(betId);
      console.log('📊 API Response: Bet result received', response);
      
      // Update bet in the list with the result
      setBets(prev => prev.map(bet => bet.id === betId ? response : bet));
      
      return response;
    } catch (error: any) {
      console.error('❌ API Error: Failed to check bet result', error);
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshBets = async () => {
    await fetchBets();
  };

  const refreshRecommendedBet = async () => {
    await fetchRecommendedBet();
  };

  const clearError = () => {
    setError(null);
  };

  // Load initial data - removed dependencies to prevent infinite loops
  useEffect(() => {
    fetchBets();
    fetchRecommendedBet();
  }, []); // Empty dependency array

  // Get betting statistics
  const stats = {
    totalBets: bets.length,
    completedBets: bets.filter(bet => bet.status === 'completed').length,
    pendingBets: bets.filter(bet => bet.status === 'pending').length,
    totalWinnings: bets
      .filter(bet => bet.status === 'completed' && bet.win_amount && bet.win_amount !== '0')
      .reduce((sum, bet) => sum + Number(bet.win_amount || 0), 0),
    totalWagered: bets.reduce((sum, bet) => sum + Number(bet.amount), 0),
  };

  return {
    bets,
    recommendedAmount,
    loading,
    placingBet,
    error,
    stats,
    fetchBets,
    fetchRecommendedBet,
    placeBet,
    getBet,
    checkBetResult,
    refreshBets,
    refreshRecommendedBet,
    clearError,
  };
}; 