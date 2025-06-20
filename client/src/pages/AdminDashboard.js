import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import QRCode from 'qrcode';
import { QrCode, Download, X } from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, eventId: null });
  const [qrModal, setQrModal] = useState({ isOpen: false, event: null, qrCodeUrl: '' });
  const canvasRef = useRef(null);
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    totalTeams: 0,
    totalQuestions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [eventsResponse, statsResponse] = await Promise.all([
        axios.get('/api/events'),
        axios.get('/api/events/stats')
      ]);
      
      setEvents(eventsResponse.data);
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Fehler beim Laden der Dashboard-Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (eventId) => {
    setConfirmModal({
      isOpen: true,
      eventId,
      title: 'Event löschen',
      message: 'Sind Sie sicher, dass Sie dieses Event löschen möchten? Alle zugehörigen Teams und Fortschritte werden ebenfalls gelöscht.'
    });
  };

  const handleDeleteConfirm = async () => {
    const { eventId } = confirmModal;
    const loadingToast = toast.loading('Event wird gelöscht...');

    try {
      await axios.delete(`/api/events/${eventId}`);
      toast.success('Event erfolgreich gelöscht!', { id: loadingToast });
      fetchDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Fehler beim Löschen des Events', { id: loadingToast });
    } finally {
      setConfirmModal({ isOpen: false, eventId: null });
    }
  };

  const handleQRCodeClick = async (event) => {
    try {
      // Generate event page URL
      const eventUrl = `${window.location.origin}/events/${event.id}`;
      
      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(eventUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrModal({
        isOpen: true,
        event: event,
        qrCodeUrl: qrCodeDataUrl
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Fehler beim Generieren des QR-Codes');
    }
  };

  const handleDownloadQRCode = () => {
    if (!qrModal.qrCodeUrl || !qrModal.event) return;

    // Create download link
    const link = document.createElement('a');
    link.download = `QR-Code-${qrModal.event.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = qrModal.qrCodeUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('QR-Code heruntergeladen!');
  };

  const closeQRModal = () => {
    setQrModal({ isOpen: false, event: null, qrCodeUrl: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Lade Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-300">Willkommen, {user?.email}</span>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-600/20 backdrop-blur-sm rounded-lg p-6 border border-blue-500/30">
            <h3 className="text-blue-300 text-sm font-medium">Gesamt Events</h3>
            <p className="text-2xl font-bold text-white mt-2">{stats.totalEvents}</p>
          </div>
          <div className="bg-green-600/20 backdrop-blur-sm rounded-lg p-6 border border-green-500/30">
            <h3 className="text-green-300 text-sm font-medium">Aktive Events</h3>
            <p className="text-2xl font-bold text-white mt-2">{stats.activeEvents}</p>
          </div>
          <div className="bg-purple-600/20 backdrop-blur-sm rounded-lg p-6 border border-purple-500/30">
            <h3 className="text-purple-300 text-sm font-medium">Teams</h3>
            <p className="text-2xl font-bold text-white mt-2">{stats.totalTeams}</p>
          </div>
          <div className="bg-orange-600/20 backdrop-blur-sm rounded-lg p-6 border border-orange-500/30">
            <h3 className="text-orange-300 text-sm font-medium">Fragen</h3>
            <p className="text-2xl font-bold text-white mt-2">{stats.totalQuestions}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Schnellaktionen</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/admin/events/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-center transition-colors"
            >
              📅 Neues Event erstellen
            </Link>
            <Link
              to="/admin/questions"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-center transition-colors"
            >
              ❓ Fragen verwalten
            </Link>
            <Link
              to="/admin/live"
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg text-center transition-colors"
            >
              🎮 Live Moderation
            </Link>
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Aktuelle Events</h2>
            <Link
              to="/admin/events"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Alle Events anzeigen →
            </Link>
          </div>
          
          {events.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              Noch keine Events erstellt. 
              <Link to="/admin/events/new" className="text-blue-400 hover:text-blue-300 ml-1">
                Jetzt erstellen!
              </Link>
            </p>
          ) : (
            <div className="space-y-4">
              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    {/* Event Logo */}
                    {event.logo_url && (
                      <div className="relative">
                        <img
                          src={`http://localhost:3001${event.logo_url}`}
                          alt={`${event.name} Logo`}
                          className="w-12 h-12 rounded-lg object-cover"
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                        {event.ai_logo_generated && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-xs text-white">✨</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <h3 className="text-white font-medium">{event.name}</h3>
                      <p className="text-gray-400 text-sm">
                        {new Date(event.start_time).toLocaleDateString('de-DE')} - 
                        {new Date(event.end_time).toLocaleDateString('de-DE')}
                      </p>
                      <p className="text-gray-400 text-sm">
                         Status: <span className={event.team_registration_open ? 'text-green-400' : 'text-red-400'}>
                           {event.team_registration_open ? 'Registrierung offen' : 'Registrierung geschlossen'}
                         </span>
                       </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleQRCodeClick(event)}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center space-x-1"
                      title="QR-Code anzeigen"
                    >
                      <QrCode size={16} />
                      <span>QR</span>
                    </button>
                    <Link
                      to={`/admin/events/${event.id}`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Bearbeiten
                    </Link>
                    <Link
                      to={`/admin/events/${event.id}/scoreboard`}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Scoreboard
                    </Link>
                    <button
                      onClick={() => handleDeleteClick(event.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QR Code Modal */}
        {qrModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">
                  QR-Code für "{qrModal.event?.name}"
                </h2>
                <button
                  onClick={closeQRModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              {/* QR Code */}
              <div className="p-6 text-center">
                <div className="bg-white p-4 rounded-lg shadow-inner mb-4 inline-block">
                  <img
                    src={qrModal.qrCodeUrl}
                    alt="QR Code"
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                
                <p className="text-gray-600 text-sm mb-2">
                  Teilnehmer können diesen QR-Code scannen, um direkt zur Event-Seite zu gelangen
                </p>
                
                <div className="bg-gray-100 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Event-URL:</p>
                  <p className="text-sm font-mono text-gray-700 break-all">
                    {window.location.origin}/events/{qrModal.event?.id}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleDownloadQRCode}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download size={16} />
                    <span>QR-Code herunterladen</span>
                  </button>
                  <button
                    onClick={closeQRModal}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ isOpen: false, eventId: null })}
          onConfirm={handleDeleteConfirm}
          title="Event löschen"
          message="Sind Sie sicher, dass Sie dieses Event löschen möchten? Alle zugehörigen Teams und Fortschritte werden ebenfalls gelöscht."
          confirmText="Löschen"
          cancelText="Abbrechen"
          variant="danger"
        />
      </div>
    </div>
  );
};

export default AdminDashboard;