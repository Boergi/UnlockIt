import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const AdminRedirect = () => {
  const navigate = useNavigate();
  const { loading, isAuthenticated } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Only run once when component mounts
    let isMounted = true;
    
    const checkAndRedirect = async () => {
      if (!isMounted) return;
      
      try {
        // First check if setup is needed
        const setupResponse = await axios.get('/api/auth/setup-status');
        
        if (!isMounted) return; // Component unmounted during request
        
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
        } else {
          // Still loading auth state, wait a bit and try again
          setTimeout(() => {
            if (isMounted && !loading) {
              if (isAuthenticated) {
                navigate('/admin/dashboard');
              } else {
                navigate('/admin/login');
              }
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        if (isMounted) {
          // On error, default to login
          navigate('/admin/login');
        }
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };

    checkAndRedirect();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // ← EMPTY dependency array - run only once!

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