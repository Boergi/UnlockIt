import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState([]);
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
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Sind Sie sicher, dass Sie dieses Event löschen möchten?')) {
      try {
        await axios.delete(`/api/events/${eventId}`);
        fetchDashboardData(); // Refresh data
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Fehler beim Löschen des Events');
      }
    }
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
                  <div className="flex space-x-2">
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
                      onClick={() => handleDeleteEvent(event.id)}
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
      </div>
    </div>
  );
};

export default AdminDashboard; 