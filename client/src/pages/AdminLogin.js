import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Lock, Mail, Eye, EyeOff, Shield } from 'lucide-react';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, register, loading, isAuthenticated, user } = useAuth();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      console.log('🔄 Already authenticated, redirecting to dashboard');
      navigate('/admin/dashboard');
    }
  }, [loading, isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    setSubmitting(true);

    try {
      const result = isLoginMode 
        ? await login(email, password)
        : await register(email, password);

      if (result.success) {
        toast.success(isLoginMode ? 'Erfolgreich angemeldet!' : 'Account erstellt!');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-xl">Lade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-purple-400 mr-3" />
            <h1 className="text-3xl font-bold text-white">Admin-Bereich</h1>
          </div>
          <p className="text-gray-300">
            {isLoginMode ? 'Melde dich an, um Events zu verwalten' : 'Erstelle einen Admin-Account'}
          </p>
        </div>

        {/* Login/Register Form */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
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
                className="w-full px-3 py-3 bg-white/20 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-3 py-3 bg-white/20 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
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
              className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {isLoginMode ? 'Anmelden...' : 'Registrieren...'}
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  {isLoginMode ? 'Anmelden' : 'Account erstellen'}
                </>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 pt-6 border-t border-gray-600 text-center">
            <p className="text-gray-400">
              {isLoginMode ? 'Noch kein Account?' : 'Bereits registriert?'}
            </p>
            <button
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="mt-2 text-purple-400 hover:text-purple-300 transition-colors duration-200"
            >
              {isLoginMode ? 'Account erstellen' : 'Zur Anmeldung'}
            </button>
          </div>
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

        {/* Development Note */}
        <div className="mt-8 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <p className="text-orange-300 text-sm text-center">
            <strong>Entwicklungshinweis:</strong> In der Produktion sollte die Registrierung 
            deaktiviert oder durch Einladungen geschützt werden.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin; 