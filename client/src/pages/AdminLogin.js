import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lock, Mail, Eye, EyeOff, Shield } from 'lucide-react';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, loading, isAuthenticated, user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(null);

  // Check setup status and redirect if already authenticated
  useEffect(() => {
    checkSetupStatus();
    
    if (!loading && isAuthenticated && user) {
      console.log('🔄 Already authenticated, redirecting to dashboard');
      navigate('/admin/dashboard');
    }
  }, [loading, isAuthenticated, user, navigate]);

  const checkSetupStatus = async () => {
    try {
      const response = await axios.get('/api/auth/setup-status');
      setNeedsSetup(response.data.needsSetup);
      
      if (response.data.needsSetup) {
        // No users exist, redirect to setup
        navigate('/admin/setup');
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    setSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        toast.success('Erfolgreich angemeldet!');
        navigate('/admin/dashboard');
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || needsSetup === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-xl">Lade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-purple-400 mr-3" />
            <h1 className="text-3xl font-bold text-white">Admin-Anmeldung</h1>
          </div>
          <p className="text-gray-300">
            Melde dich an, um Events zu verwalten
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                E-Mail-Adresse
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-3 bg-white/20 border border-white/30 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@example.com"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Lock className="w-4 h-4 inline mr-1" />
                Passwort
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-3 bg-white/20 border border-white/30 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  placeholder="Sicheres Passwort"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Anmelden...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Anmelden
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white transition-colors duration-200"
          >
            ← Zurück zur Startseite
          </button>
        </div>

        {/* Info Note */}
        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-blue-300 text-sm text-center">
            <strong>Neue Admins:</strong> Neue Admin-Accounts können nur über Einladungslinks 
            von bestehenden Admins erstellt werden.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin; 