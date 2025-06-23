import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Configure axios to send cookies
axios.defaults.withCredentials = true;

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastVerification, setLastVerification] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    // Always try to verify (will check both JWT and session)
    verifyToken();
  }, []);

  const verifyToken = async (force = false) => {
    // Prevent too frequent verification calls (max once per 5 minutes)
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    if (!force && (now - lastVerification) < FIVE_MINUTES && user) {
      console.log('🔍 Frontend: Skipping verification - too recent');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Frontend: Verifying token/session...');
      console.log('🔍 Frontend: Cookies will be sent:', document.cookie ? 'Yes' : 'No');
      
      const response = await axios.get('/api/auth/verify');
      console.log('✅ Frontend: Verification successful:', response.data.user);
      setUser(response.data.user);
      setLastVerification(now);
    } catch (error) {
      console.error('❌ Frontend: Token verification failed:', error.response?.status, error.response?.data);
      
      // Only try session test if it's not a rate limit error
      if (error.response?.status !== 429) {
        try {
          const sessionTest = await axios.get('/api/auth/session-test');
          console.log('🔍 Frontend: Session test result:', sessionTest.data);
        } catch (sessionError) {
          console.error('❌ Frontend: Session test failed:', sessionError);
        }
      }
      
      // Clear localStorage but don't call logout() to avoid infinite loop
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setLastVerification(0);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const register = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/register', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Registration failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 