import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

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

  // Handle automatic logout on 401 responses
  const handleLogout = () => {
    console.log('🚪 Frontend: Auto-logout triggered by 401 response');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setLastVerification(0);
    toast.error('Session abgelaufen. Bitte loggen Sie sich erneut ein.');
    
    // Redirect to admin login if we're on an admin page
    if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin') {
      window.location.href = '/admin';
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Set up axios interceptor for automatic logout on 401
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Only auto-logout if we currently think we're authenticated
          if (user) {
            handleLogout();
          }
        }
        return Promise.reject(error);
      }
    );

    // Only verify on admin pages or if we have a token
    const isAdminPage = window.location.pathname.startsWith('/admin');
    if (isAdminPage || token) {
      verifyToken();
    } else {
      // On public pages without token, just set loading to false
      setLoading(false);
    }

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [user]); // Include user in dependency array

  const verifyToken = async (force = false) => {
    // Prevent too frequent verification calls (max once per 5 minutes)
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    const isAdminPage = window.location.pathname.startsWith('/admin');
    
    if (!force && (now - lastVerification) < FIVE_MINUTES && user) {
      if (isAdminPage) {
        console.log('🔍 Frontend: Skipping verification - too recent');
      }
      setLoading(false);
      return;
    }

    try {
      if (isAdminPage) {
        console.log('🔍 Frontend: Verifying token/session...');
        console.log('🔍 Frontend: Cookies will be sent:', document.cookie ? 'Yes' : 'No');
      }
      
      const response = await axios.get('/api/auth/verify');
      if (isAdminPage) {
        console.log('✅ Frontend: Verification successful:', response.data.user);
      }
      setUser(response.data.user);
      setLastVerification(now);
    } catch (error) {
      // Only log errors on admin pages
      if (isAdminPage) {
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