import { useState, useCallback } from 'react';
import { apiClient, Bet, BetRequest } from '../api/api-client';

interface BettingState {
  bets: Bet[];
  isLoading: boolean;
  error: string | null;
  placingBet: boolean;
  recommendedAmount: number | null;
  loadingRecommended: boolean;
}

export const useBetting = () => {
  const [bettingState, setBettingState] = useState<BettingState>({
    bets: [],
    isLoading: false,
    error: null,
    placingBet: false,
    recommendedAmount: null,
    loadingRecommended: false,
  });

  // Получение истории ставок
  const loadBetsHistory = useCallback(async () => {
    setBettingState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const bets = await apiClient.getBetsHistory();
      setBettingState(prev => ({
        ...prev,
        bets,
        isLoading: false,
      }));
      console.log('📊 Bets history loaded:', bets);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load bets history';
      setBettingState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      console.error('❌ Failed to load bets history:', errorMessage);
    }
  }, []);

  // Размещение ставки
  const placeBet = useCallback(async (request: BetRequest) => {
    setBettingState(prev => ({ ...prev, placingBet: true, error: null }));
    
    try {
      const newBet = await apiClient.placeBet(request);
      
      // Обновляем список ставок
      setBettingState(prev => ({
        ...prev,
        bets: [newBet, ...prev.bets],
        placingBet: false,
      }));
      
      console.log('🎯 Bet placed successfully:', newBet);
      return { success: true, bet: newBet };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to place bet';
      setBettingState(prev => ({
        ...prev,
        placingBet: false,
        error: errorMessage,
      }));
      console.error('❌ Failed to place bet:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Получение рекомендуемой ставки
  const getRecommendedBet = useCallback(async () => {
    setBettingState(prev => ({ ...prev, loadingRecommended: true, error: null }));
    
    try {
      const recommendedAmount = await apiClient.getRecommendedBet();
      setBettingState(prev => ({
        ...prev,
        recommendedAmount,
        loadingRecommended: false,
      }));
      console.log('💡 Recommended bet amount:', recommendedAmount);
      return recommendedAmount;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to get recommended bet';
      setBettingState(prev => ({
        ...prev,
        loadingRecommended: false,
        error: errorMessage,
      }));
      console.error('❌ Failed to get recommended bet:', errorMessage);
      return null;
    }
  }, []);

  // Получение информации о конкретной ставке
  const getBetById = useCallback(async (id: string) => {
    try {
      const bet = await apiClient.getBetById(id);
      
      // Обновляем ставку в списке, если она там есть
      setBettingState(prev => ({
        ...prev,
        bets: prev.bets.map(b => b.id === id ? bet : b),
      }));
      
      console.log('🔍 Bet details loaded:', bet);
      return bet;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load bet details';
      setBettingState(prev => ({ ...prev, error: errorMessage }));
      console.error('❌ Failed to load bet details:', errorMessage);
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setBettingState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...bettingState,
    loadBetsHistory,
    placeBet,
    getRecommendedBet,
    getBetById,
    clearError,
  };
}; 