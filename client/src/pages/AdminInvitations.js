import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Copy, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  Users,
  Calendar,
  Link as LinkIcon
} from 'lucide-react';

const AdminInvitations = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/auth/invitations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvitations(response.data);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast.error('Fehler beim Laden der Einladungen');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvitation = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('E-Mail-Adresse ist erforderlich');
      return;
    }

    setCreating(true);
    const loadingToast = toast.loading('Einladung wird erstellt...');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/auth/create-invitation', 
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Einladung erfolgreich erstellt!', { id: loadingToast });
      setEmail('');
      setShowCreateForm(false);
      fetchInvitations();

      // Copy invitation link to clipboard
      navigator.clipboard.writeText(response.data.invitationLink);
      toast.success('Einladungslink in Zwischenablage kopiert!');
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast.error(
        error.response?.data?.error || 'Fehler beim Erstellen der Einladung',
        { id: loadingToast }
      );
    } finally {
      setCreating(false);
    }
  };

  const copyInvitationLink = (token) => {
    const link = `${window.location.origin}/admin/register?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Einladungslink kopiert!');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  const isExpired = (expiresAt) => {
    return new Date(expiresAt) < new Date();
  };

  const getStatusBadge = (invitation) => {
    if (invitation.used) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Verwendet
        </span>
      );
    }
    
    if (isExpired(invitation.expires_at)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Abgelaufen
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3 mr-1" />
        Ausstehend
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Lade Einladungen...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Zurück zum Dashboard
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Users className="w-8 h-8 mr-3 text-blue-600" />
                Admin-Einladungen
              </h1>
              <p className="text-gray-600 mt-2">
                Verwalten Sie Einladungen für neue Admin-Benutzer
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Neue Einladung
            </button>
          </div>
        </div>

        {/* Create Invitation Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Neue Admin-Einladung erstellen
            </h2>
            
            <form onSubmit={handleCreateInvitation} className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-Mail-Adresse
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
              </div>
              
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {creating ? 'Erstelle...' : 'Erstellen'}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEmail('');
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Invitations List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Alle Einladungen ({invitations.length})
            </h2>
          </div>

          {invitations.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Keine Einladungen vorhanden
              </h3>
              <p className="text-gray-600 mb-4">
                Erstellen Sie Ihre erste Admin-Einladung
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                Erste Einladung erstellen
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {invitation.email}
                        </h3>
                        {getStatusBadge(invitation)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          Erstellt: {formatDate(invitation.created_at)}
                        </div>
                        
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          Läuft ab: {formatDate(invitation.expires_at)}
                        </div>
                        
                        <div className="flex items-center">
                          <Mail className="w-4 h-4 mr-2" />
                          Von: {invitation.created_by_email}
                        </div>
                      </div>
                      
                      {invitation.used && invitation.used_at && (
                        <div className="mt-2 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                          Verwendet am: {formatDate(invitation.used_at)}
                        </div>
                      )}
                    </div>
                    
                    {!invitation.used && !isExpired(invitation.expires_at) && (
                      <div className="ml-4">
                        <button
                          onClick={() => copyInvitationLink(invitation.token)}
                          className="inline-flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <LinkIcon className="w-4 h-4 mr-2" />
                          Link kopieren
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminInvitations; 