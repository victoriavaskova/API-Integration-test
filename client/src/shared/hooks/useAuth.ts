import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@shared/api/client';
import type { LoginRequest } from '@shared/api/types';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = async (username: string, email?: string) => {
    setLoading(true);
    setError(null);

    console.log('🔐 Login attempt started', { username, email });

    try {
      const loginData: LoginRequest = { username };
      if (email) {
        loginData.email = email;
      }
      
      console.log('📤 API Call: POST /auth/login', loginData);
      const response = await apiClient.login(loginData);
      console.log('✅ Login successful', response);
      
      // Store token
      localStorage.setItem('token', response.token);
      console.log('💾 Token stored in localStorage');
      
      // Get user info
      try {
        console.log('📤 API Call: GET /auth/me');
        const userInfo = await apiClient.getCurrentUser();
        console.log('✅ User info received', userInfo);
        setUser(userInfo);
      } catch (userError) {
        console.warn('⚠️ Failed to get user info, using fallback', userError);
        // If user info fails, set basic user data
        setUser({ username, email });
      }
      
      setIsAuthenticated(true);
      
      // Navigate to dashboard
      navigate('/dashboard');
      
      return response;
    } catch (error: any) {
      console.error('❌ Login failed', error);
      const apiError = apiClient.handleError(error);
      setError(apiError.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    console.log('🚪 Logout initiated');
    
    try {
      console.log('📤 API Call: POST /auth/logout');
      await apiClient.logout();
      console.log('✅ Logout successful');
    } catch (error) {
      console.warn('⚠️ Logout API call failed, continuing with local cleanup', error);
      // Ignore logout errors
    } finally {
      // Always clear local state
      localStorage.removeItem('token');
      console.log('🗑️ Token removed from localStorage');
      setUser(null);
      setIsAuthenticated(false);
      navigate('/login');
      console.log('🔄 Redirected to login page');
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    console.log('🔍 Checking authentication', { hasToken: !!token });
    
    if (!token) {
      console.log('❌ No token found');
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      console.log('📤 API Call: GET /auth/me (auth check)');
      const userInfo = await apiClient.getCurrentUser();
      console.log('✅ Authentication valid', userInfo);
      setUser(userInfo);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('❌ Authentication invalid, clearing token', error);
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