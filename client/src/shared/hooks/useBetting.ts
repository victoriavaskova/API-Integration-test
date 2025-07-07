import { useState, useEffect } from 'react';
import { apiClient } from '@shared/api/client';
import type { Bet, BetsResponse, RecommendedBetResponse, PlaceBetRequest } from '@shared/api/types';

export const useBetting = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [recommendedAmount, setRecommendedAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [placingBet, setPlacingBet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBets = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.getBets();
      setBets(response.bets || []); // Ensure it's always an array
    } catch (error: any) {
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      setBets([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendedBet = async () => {
    try {
      const response = await apiClient.getRecommendedBet();
      setRecommendedAmount(response.recommended_amount || 3); // Default to 3 if not available
    } catch (error: any) {
      console.warn('Failed to fetch recommended bet:', error);
      setRecommendedAmount(3); // Default fallback amount
    }
  };

  const placeBet = async (amount: number) => {
    setPlacingBet(true);
    setError(null);
    
    try {
      const response = await apiClient.placeBet({ amount });
      
      // Add new bet to the beginning of the list
      setBets(prev => [response, ...prev]);
      
      return response;
    } catch (error: any) {
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
    
    try {
      const response = await apiClient.getBet(id);
      
      // Update bet in the list if it exists
      setBets(prev => prev.map(bet => bet.id === id ? response : bet));
      
      return response;
    } catch (error: any) {
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
      .filter(bet => bet.status === 'completed' && bet.win_amount)
      .reduce((sum, bet) => sum + (bet.win_amount || 0), 0),
    totalWagered: bets.reduce((sum, bet) => sum + bet.amount, 0),
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
    refreshBets,
    refreshRecommendedBet,
    clearError,
  };
}; 