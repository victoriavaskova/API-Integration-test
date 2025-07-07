import React, { useState } from 'react';
import { apiClient } from '../shared/api';

const ApiTester: React.FC = () => {
  const [username, setUsername] = useState('user1');
  const [betAmount, setBetAmount] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const testHealthCheck = async () => {
    console.log('🧪 Testing Health Check...');
    setIsLoading(true);
    setStatus('Testing health check...');
    
    try {
      const response = await apiClient.healthCheck();
      if (response.success) {
        setStatus('✅ Health check successful!');
      } else {
        setStatus(`❌ Health check failed: ${response.error?.message}`);
      }
    } catch (error) {
      setStatus(`❌ Health check error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testLogin = async () => {
    console.log('🧪 Testing Login...');
    setIsLoading(true);
    setStatus(`Testing login for ${username}...`);
    
    try {
      const response = await apiClient.login(username);
      if (response.success) {
        setStatus(`✅ Login successful! Token saved.`);
      } else {
        setStatus(`❌ Login failed: ${response.error?.message}`);
      }
    } catch (error) {
      setStatus(`❌ Login error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testGetBalance = async () => {
    console.log('🧪 Testing Get Balance...');
    setIsLoading(true);
    setStatus('Testing get balance...');
    
    try {
      const response = await apiClient.getBalance();
      if (response.success) {
        setStatus(`✅ Balance: ${response.data?.balance || 'N/A'}`);
      } else {
        setStatus(`❌ Get balance failed: ${response.error?.message}`);
      }
    } catch (error) {
      setStatus(`❌ Get balance error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testGetBets = async () => {
    console.log('🧪 Testing Get Bets...');
    setIsLoading(true);
    setStatus('Testing get bets...');
    
    try {
      const response = await apiClient.getBets();
      if (response.success) {
        const betsCount = response.data?.bets?.length || 0;
        setStatus(`✅ Found ${betsCount} bets`);
      } else {
        setStatus(`❌ Get bets failed: ${response.error?.message}`);
      }
    } catch (error) {
      setStatus(`❌ Get bets error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testPlaceBet = async () => {
    console.log('🧪 Testing Place Bet...');
    setIsLoading(true);
    setStatus(`Testing place bet with amount ${betAmount}...`);
    
    try {
      const response = await apiClient.placeBet(betAmount);
      if (response.success) {
        setStatus(`✅ Bet placed successfully! ID: ${response.data?.id}`);
      } else {
        setStatus(`❌ Place bet failed: ${response.error?.message}`);
      }
    } catch (error) {
      setStatus(`❌ Place bet error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testGetRecommendedBet = async () => {
    console.log('🧪 Testing Get Recommended Bet...');
    setIsLoading(true);
    setStatus('Testing get recommended bet...');
    
    try {
      const response = await apiClient.getRecommendedBet();
      if (response.success) {
        setStatus(`✅ Recommended bet: ${response.data?.recommended_amount || 'N/A'}`);
      } else {
        setStatus(`❌ Get recommended bet failed: ${response.error?.message}`);
      }
    } catch (error) {
      setStatus(`❌ Get recommended bet error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testLogout = async () => {
    console.log('🧪 Testing Logout...');
    setIsLoading(true);
    setStatus('Testing logout...');
    
    try {
      const response = await apiClient.logout();
      setStatus('✅ Logout completed');
    } catch (error) {
      setStatus(`❌ Logout error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>🧪 API Tester</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Открой DevTools (F12) → Console, чтобы увидеть детальные логи всех API запросов и ответов!
      </p>

      <div style={{ marginBottom: '20px' }}>
        <h3>Настройки:</h3>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Username: 
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Bet Amount: 
            <input 
              type="number" 
              min="1" 
              max="5" 
              value={betAmount} 
              onChange={(e) => setBetAmount(Number(e.target.value))}
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Тесты API:</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <button 
            onClick={testHealthCheck}
            disabled={isLoading}
            style={{ 
              padding: '10px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            🏥 Health Check
          </button>
          
          <button 
            onClick={testLogin}
            disabled={isLoading}
            style={{ 
              padding: '10px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            🔐 Login
          </button>
          
          <button 
            onClick={testGetBalance}
            disabled={isLoading}
            style={{ 
              padding: '10px', 
              backgroundColor: '#ffc107', 
              color: 'black', 
              border: 'none', 
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            💰 Get Balance
          </button>
          
          <button 
            onClick={testGetBets}
            disabled={isLoading}
            style={{ 
              padding: '10px', 
              backgroundColor: '#17a2b8', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            🎲 Get Bets
          </button>
          
          <button 
            onClick={testGetRecommendedBet}
            disabled={isLoading}
            style={{ 
              padding: '10px', 
              backgroundColor: '#6f42c1', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            💡 Recommended Bet
          </button>
          
          <button 
            onClick={testPlaceBet}
            disabled={isLoading}
            style={{ 
              padding: '10px', 
              backgroundColor: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            🎯 Place Bet
          </button>
          
          <button 
            onClick={testLogout}
            disabled={isLoading}
            style={{ 
              padding: '10px', 
              backgroundColor: '#6c757d', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      <div style={{ 
        padding: '15px', 
        backgroundColor: '#f8f9fa', 
        border: '1px solid #dee2e6', 
        borderRadius: '5px',
        minHeight: '50px'
      }}>
        <h4>Статус:</h4>
        <p style={{ margin: '0', fontWeight: isLoading ? 'bold' : 'normal' }}>
          {isLoading ? '⏳ ' : ''}{status || 'Выберите тест для выполнения'}
        </p>
      </div>

      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#e7f3ff', 
        border: '1px solid #b3d9ff', 
        borderRadius: '5px'
      }}>
        <h4>💡 Инструкции:</h4>
        <ol>
          <li>Откройте DevTools (F12) и перейдите на вкладку Console</li>
          <li>Сначала проверьте Health Check</li>
          <li>Затем выполните Login с username (user1, user2, user3)</li>
          <li>После успешного логина можете тестировать остальные методы</li>
          <li>Все запросы и ответы будут детально логироваться в консоли</li>
        </ol>
      </div>
    </div>
  );
};

export default ApiTester; 