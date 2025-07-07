import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@shared/api/client';
import type { LoginRequest, AuthResponse } from '@shared/api/types';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = async (username: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.login({ username });
      
      // Store token
      localStorage.setItem('token', response.token);
      
      // Get user info
      try {
        const userInfo = await apiClient.getCurrentUser();
        setUser(userInfo);
      } catch (userError) {
        // If user info fails, set basic user data
        setUser({ username });
      }
      
      setIsAuthenticated(true);
      
      // Navigate to dashboard
      navigate('/dashboard');
      
      return response;
    } catch (error: any) {
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      // Always clear local state
      localStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
      navigate('/login');
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      const userInfo = await apiClient.getCurrentUser();
      setUser(userInfo);
      setIsAuthenticated(true);
    } catch (error) {
      // Token is invalid
      localStorage.removeItem('token');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    clearError,
  };
}; 