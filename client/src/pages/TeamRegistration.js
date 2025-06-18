import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Users, Lock, Calendar, Play } from 'lucide-react';

const TeamRegistration = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { emitTeamJoined } = useSocket();
  
  const [event, setEvent] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const response = await axios.get(`/api/events/${eventId}`);
      setEvent(response.data);
    } catch (error) {
      console.error('Error loading event:', error);
      toast.error('Event nicht gefunden');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const registerTeam = async (e) => {
    e.preventDefault();
    
    if (!teamName.trim()) {
      toast.error('Bitte gib einen Teamnamen ein');
      return;
    }

    if (event?.access_code && !accessCode.trim()) {
      toast.error('Bitte gib den Zugangscode ein');
      return;
    }

    setSubmitting(true);

    try {
      const response = await axios.post('/api/teams/register', {
        name: teamName.trim(),
        event_id: eventId,
        access_code: accessCode.trim()
      });

      const team = response.data;
      
      emitTeamJoined({
        eventId,
        teamId: team.id,
        teamName: team.name
      });

      toast.success(`Team "${team.name}" erfolgreich angemeldet!`);
      
      // Navigate to game after short delay
      setTimeout(() => {
        navigate(`/play/${team.id}`);
      }, 1500);
      
    } catch (error) {
      console.error('Registration error:', error);
      const message = error.response?.data?.error || 'Anmeldung fehlgeschlagen';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isEventStarted = () => {
    if (!event) return false;
    return new Date() >= new Date(event.start_time);
  };

  const getTimeUntilStart = () => {
    if (!event) return '';
    const now = new Date();
    const startTime = new Date(event.start_time);
    const timeDiff = startTime - now;
    
    if (timeDiff <= 0) return 'Event läuft bereits!';
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `Startet in ${hours}h ${minutes}min`;
    } else {
      return `Startet in ${minutes} Minuten`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-xl">Lade Event...</p>
        </div>
      </div>
    );
  }

  if (!event?.team_registration_open) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <Lock className="w-24 h-24 text-red-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">
            Anmeldung geschlossen
          </h1>
          <p className="text-gray-300">
            Die Team-Anmeldung für dieses Event ist derzeit nicht möglich.
          </p>
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
            <Lock className="w-12 h-12 text-yellow-400 mr-3" />
            <h1 className="text-3xl font-bold text-white">UnlockIt</h1>
          </div>
          <h2 className="text-xl text-gray-300">Team-Anmeldung</h2>
        </div>

        {/* Event Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Calendar className="w-5 h-5 text-blue-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">{event?.name}</h3>
          </div>
          
          <div className="space-y-2 text-sm text-gray-300">
            <p>
              <strong>Start:</strong>{' '}
              {new Date(event?.start_time).toLocaleString('de-DE')}
            </p>
            <p className={isEventStarted() ? 'text-green-400' : 'text-yellow-400'}>
              <strong>Status:</strong> {getTimeUntilStart()}
            </p>
          </div>
        </div>

        {/* Registration Form */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          <form onSubmit={registerTeam} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Teamname
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3 py-3 bg-white/20 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. Die Rätselmeister"
                maxLength={50}
                disabled={submitting}
              />
            </div>

            {event?.access_code && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Zugangscode
                </label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full px-3 py-3 bg-white/20 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Zugangscode eingeben"
                  disabled={submitting}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !teamName.trim()}
              className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Anmelden...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Team anmelden
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-600">
            <p className="text-xs text-gray-400 text-center">
              Nach der Anmeldung werdet ihr automatisch zum Spiel weitergeleitet.
              Das Event startet automatisch zur geplanten Zeit.
            </p>
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
      </div>
    </div>
  );
};

export default TeamRegistration; 