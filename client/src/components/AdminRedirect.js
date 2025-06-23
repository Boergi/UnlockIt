import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const AdminRedirect = () => {
  const navigate = useNavigate();
  const { loading, isAuthenticated } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAndRedirect = async () => {
      try {
        // First check if setup is needed
        const setupResponse = await axios.get('/api/auth/setup-status');
        
        if (setupResponse.data.needsSetup) {
          // No users exist, redirect to setup
          navigate('/admin/setup');
          return;
        }

        // Setup is complete, check authentication
        if (!loading) {
          if (isAuthenticated) {
            // User is authenticated, go to dashboard
            navigate('/admin/dashboard');
          } else {
            // User not authenticated, go to login
            navigate('/admin/login');
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        // On error, default to login
        navigate('/admin/login');
      } finally {
        setChecking(false);
      }
    };

    checkAndRedirect();
  }, [navigate, loading, isAuthenticated]);

  if (checking || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-lg">Lade...</div>
      </div>
    );
  }

  return null;
};

export default AdminRedirect; 