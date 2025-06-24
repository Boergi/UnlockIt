import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Users, Lock, Calendar, Play, Clock, Palette, X, Trophy } from 'lucide-react';
import { getImageUrl, buildFrontendUrl } from '../utils/apiUtils';

const EventPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  
  const [event, setEvent] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState({});
  const [isEventStarted, setIsEventStarted] = useState(false);
  
  // Logo generation states
  const [aiConfig, setAiConfig] = useState({ aiEnabled: false });
  const [generateLogo, setGenerateLogo] = useState(false);
  const [logoDescription, setLogoDescription] = useState('');
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [logoOptions, setLogoOptions] = useState([]);
  const [showLogoSelector, setShowLogoSelector] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [generationProgress, setGenerationProgress] = useState({ progress: 0, total: 3, message: '' });

  useEffect(() => {
    const initializePage = async () => {
      try {
        // Load event and AI config in parallel
        const [eventData, aiConfigData] = await Promise.all([
          loadEvent(),
          fetchAiConfig()
        ]);
        
        // Check if user already has a team for this event
        const hasExistingTeam = await checkExistingTeam();
        
        // If no existing team found, show the event page
        if (!hasExistingTeam) {
          setLoading(false);
        }
        // If existing team found, redirect will happen in checkExistingTeam
        
      } catch (error) {
        console.error('Error initializing page:', error);
        setLoading(false);
      }
    };
    
    initializePage();
  }, [eventId]);

  const checkExistingTeam = async () => {
    const currentTeam = localStorage.getItem('currentTeam');
    if (currentTeam) {
      try {
        const teamData = JSON.parse(currentTeam);
        // Check if the stored team belongs to this event
        if (teamData.eventId === parseInt(eventId) || teamData.eventId === eventId) {
          toast.success(`Willkommen zurück, Team ${teamData.teamName}!`);
          setTimeout(() => {
            navigate(`/team/${teamData.teamId}/event/${teamData.eventId}`);
          }, 1000);
          return true; // Team found and redirecting
        }
      } catch (error) {
        console.error('Error parsing stored team data:', error);
        localStorage.removeItem('currentTeam');
      }
    }
    return false; // No existing team found
  };

  useEffect(() => {
    if (event && !loading) {
      updateCountdown(); // Initial countdown calculation
      const timer = setInterval(updateCountdown, 1000);
      return () => clearInterval(timer);
    }
  }, [event, loading]);

  // Socket.IO listeners for live logo updates
  useEffect(() => {
    if (!socket) return;

    const handleLogoStatus = (data) => {
      setGenerationProgress({
        progress: data.progress || 0,
        total: data.total || 3,
        message: data.message || ''
      });
    };

    const handleLogoUpdate = (data) => {
      setLogoOptions(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(opt => opt.id === data.logoOption.id);
        if (existingIndex >= 0) {
          updated[existingIndex] = data.logoOption;
        } else {
          updated.push(data.logoOption);
        }
        return updated.sort((a, b) => a.id - b.id);
      });
    };

    const handleLogoError = (data) => {
      toast.error(data.error || 'Fehler bei Logo-Generierung');
    };

    socket.on('logo-generation-status', handleLogoStatus);
    socket.on('logo-generation-update', handleLogoUpdate);
    socket.on('logo-generation-error', handleLogoError);

    return () => {
      socket.off('logo-generation-status', handleLogoStatus);
      socket.off('logo-generation-update', handleLogoUpdate);
      socket.off('logo-generation-error', handleLogoError);
    };
  }, [socket]);

  const loadEvent = async () => {
    try {
      const response = await axios.get(`/api/events/${eventId}`);
      setEvent(response.data);
      return response.data;
    } catch (error) {
      console.error('Error loading event:', error);
      toast.error('Event nicht gefunden');
      navigate('/');
      throw error;
    }
  };

  const fetchAiConfig = async () => {
    try {
      const response = await axios.get('/api/teams/ai-config');
      setAiConfig(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching AI config:', error);
      return { aiEnabled: false };
    }
  };

  const updateCountdown = () => {
    if (!event) return;
    
    const now = new Date().getTime();
    const startTime = new Date(event.start_time).getTime();
    const timeDiff = startTime - now;
    
    if (timeDiff <= 0) {
      setIsEventStarted(true);
      setTimeLeft({ expired: true });
      return;
    }
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    setTimeLeft({ days, hours, minutes, seconds });
    setIsEventStarted(false);
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
    setGeneratingLogo(generateLogo);

    try {
      const response = await axios.post('/api/teams/register', {
        name: teamName.trim(),
        event_id: eventId,
        access_code: accessCode.trim()
      });

      const team = response.data;
      setSelectedTeam(team);
      
      if (generateLogo && aiConfig.aiEnabled) {
        toast.success(`Team "${team.name}" erstellt! Logo-Optionen werden generiert...`);
        await generateLogoOptions(teamName.trim(), event.name, logoDescription.trim());
      } else {
        toast.success(`Team "${team.name}" erfolgreich angemeldet!`);
        
        // Store team info in localStorage
        localStorage.setItem('currentTeam', JSON.stringify({
          teamId: team.uuid || team.id,
          eventId: event?.uuid || eventId,
          teamName: team.name,
          eventName: event.name
        }));
        
        setTimeout(() => {
          navigate(`/team/${team.uuid || team.id}/event/${event?.uuid || eventId}`);
        }, 1500);
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      const message = error.response?.data?.error || 'Anmeldung fehlgeschlagen';
      toast.error(message);
      setGeneratingLogo(false);
    } finally {
      if (!generateLogo) {
        setSubmitting(false);
      }
    }
  };

  const generateLogoOptions = async (teamName, eventName, logoDescription = '') => {
    try {
      setLogoOptions([]);
      setGenerationProgress({ progress: 0, total: 3, message: 'Starte Logo-Generierung...' });
      setShowLogoSelector(true);

      const response = await axios.post('/api/teams/generate-logo', {
        teamName,
        eventName,
        logoDescription,
        socketId: socket?.id
      });
      
      console.log('Logo generation started:', response.data.message);
    } catch (error) {
      console.error('Error generating logo options:', error);
      toast.error('Fehler beim Generieren der Logo-Optionen');
      setShowLogoSelector(false);
      setGeneratingLogo(false);
      setSubmitting(false);
    }
  };

  const handleLogoSelect = async (logoUrl) => {
    if (!selectedTeam) return;

    const loadingToast = toast.loading('Logo wird ausgewählt...');

    try {
      await axios.put(`/api/teams/${selectedTeam.uuid || selectedTeam.id}/logo`, {
        logoUrl
      });

      toast.dismiss(loadingToast);
      toast.success(`Logo ausgewählt! Team "${selectedTeam.name}" ist bereit.`);
      
      setShowLogoSelector(false);
      setGeneratingLogo(false);
      setSubmitting(false);
      
      // Store team info in localStorage
      localStorage.setItem('currentTeam', JSON.stringify({
        teamId: selectedTeam.uuid || selectedTeam.id,
        eventId: event?.uuid || eventId,
        teamName: selectedTeam.name,
        eventName: event.name
      }));
      
      setTimeout(() => {
        navigate(`/team/${selectedTeam.uuid || selectedTeam.id}/event/${event?.uuid || eventId}`);
      }, 1500);
      
    } catch (error) {
      console.error('Error selecting logo:', error);
      toast.dismiss(loadingToast);
      toast.error('Fehler beim Auswählen des Logos');
    }
  };

  const resetRegistration = () => {
    setShowLogoSelector(false);
    setGeneratingLogo(false);
    setSubmitting(false);
    setSelectedTeam(null);
    setLogoOptions([]);
    setGenerationProgress({ progress: 0, total: 3, message: '' });
    setTeamName('');
    setAccessCode('');
    setLogoDescription('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">
            Lade Event...
          </p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Event nicht gefunden</h1>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Zurück zur Startseite
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Event Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            {event.logo_url ? (
              <div className="relative inline-block mb-4">
                <img
                  src={getImageUrl(event.logo_url)}
                  alt={`${event.name} Logo`}
                  className="w-20 h-20 rounded-xl object-cover shadow-lg mx-auto"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'block';
                  }}
                />
                <div className="w-20 h-20 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto" style={{ display: 'none' }}>
                  <Lock className="w-10 h-10 text-blue-400" />
                </div>
                {event.ai_logo_generated && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-xs text-white">✨</span>
                  </div>
                )}
              </div>
            ) : (
              <Lock className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-bold text-white mb-2">{event.name}</h1>
            {event.description && (
              <p className="text-gray-300 text-sm">{event.description}</p>
            )}
          </div>

          {/* Event Details */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6 border border-gray-600">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-300">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(event.start_time).toLocaleDateString('de-DE')}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{new Date(event.start_time).toLocaleTimeString('de-DE', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</span>
              </div>
            </div>
          </div>

          {/* Countdown */}
          {!timeLeft.expired && (
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-4 mb-6 border border-blue-500/30">
              <h3 className="text-lg font-semibold text-white mb-3">Event startet in:</h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white/10 rounded-lg p-2">
                  <div className="text-2xl font-bold text-white">{timeLeft.days || 0}</div>
                  <div className="text-xs text-gray-300">Tage</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <div className="text-2xl font-bold text-white">{timeLeft.hours || 0}</div>
                  <div className="text-xs text-gray-300">Std</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <div className="text-2xl font-bold text-white">{timeLeft.minutes || 0}</div>
                  <div className="text-xs text-gray-300">Min</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <div className="text-2xl font-bold text-white">{timeLeft.seconds || 0}</div>
                  <div className="text-xs text-gray-300">Sek</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Registration Form or Closed Message */}
        {event.team_registration_open && !timeLeft.expired ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-gray-600">
            <div className="flex items-center space-x-2 mb-6">
              <Users className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Team anmelden</h2>
            </div>

            <form onSubmit={registerTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Euer Team Name"
                  disabled={submitting}
                  required
                />
              </div>

              {event.access_code && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Zugangscode *
                  </label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="w-full px-4 py-3 bg-white/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Zugangscode eingeben"
                    disabled={submitting}
                    required
                  />
                </div>
              )}

              {/* AI Logo Generation Option */}
              {aiConfig.aiEnabled && (
                <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg p-4 border border-purple-500/30">
                  <div className="flex items-center space-x-2 mb-3">
                    <Palette className="w-5 h-5 text-purple-400" />
                    <span className="font-medium text-white">AI Team-Logo</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">
                    Lasse eine KI 3 professionelle Logo-Optionen für dein Team erstellen
                  </p>
                  <label className="flex items-center space-x-2 mb-3">
                    <input
                      type="checkbox"
                      checked={generateLogo}
                      onChange={(e) => setGenerateLogo(e.target.checked)}
                      disabled={submitting}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-300">
                      3 AI Logo-Optionen generieren (~12 Cent)
                    </span>
                  </label>
                  
                  {/* Logo Description Field - only shown when AI generation is enabled */}
                  {generateLogo && (
                    <div className="mt-3 pt-3 border-t border-purple-500/30">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Logo-Beschreibung (optional max 500 Zeichen)
                      </label>
                      <textarea
                        value={logoDescription}
                        onChange={(e) => setLogoDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
                        placeholder="z.B. Moderne Gestaltung mit geometrischen Formen, Corporate-Stil, Vintage-Look..."
                        rows="2"
                        disabled={submitting}
                        maxLength="500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Beschreibe den gewünschten Stil oder Look für euer Logo. Ohne Angabe wird automatisch basierend auf dem Teamnamen generiert.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !teamName.trim()}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                  submitting || !teamName.trim()
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    <span>
                      {generatingLogo ? 'Erstelle Team & generiere Logos...' : 'Team wird erstellt...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5" />
                    <span>Team erstellen</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-red-500/20 backdrop-blur-sm rounded-lg p-8 text-center border border-red-500/30">
            <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Registrierung geschlossen</h2>
            <p className="text-red-300">
              Die Team-Registrierung für dieses Event ist derzeit nicht möglich.
            </p>
          </div>
        )}

        {/* Scoreboard Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.open(`/scoreboard/${event?.uuid || eventId}`, '_blank')}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Trophy className="w-5 h-5 mr-2" />
            Live Scoreboard anzeigen
          </button>
          <p className="text-gray-400 text-sm mt-2">
            Verfolge die Punktestände aller Teams in Echtzeit
          </p>
        </div>

        {/* Logo Selection Modal */}
        {showLogoSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    Logo auswählen für "{selectedTeam?.name}"
                  </h3>
                  <p className="text-gray-300 mt-1">
                    Wähle eines der generierten Logos aus. Kosten: ~12 Cent (3 × 4 Cent)
                  </p>
                </div>
                <button
                  onClick={resetRegistration}
                  className="text-gray-400 hover:text-white p-1"
                  title="Schließen"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((id) => {
                  const option = logoOptions.find(opt => opt.id === id);
                  const isStillGenerating = !option && generationProgress.progress < generationProgress.total;
                  
                  return (
                    <div key={id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                      <div className="aspect-square mb-4 bg-white/10 rounded-lg overflow-hidden relative">
                        {option ? (
                          <img
                            src={getImageUrl(option.url)}
                            alt={`Logo Option ${option.id}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5FcnJvcjwvdGV4dD48L3N2Zz4=';
                            }}
                          />
                        ) : isStillGenerating ? (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <div className="relative w-16 h-16 mb-4">
                              <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-blue-600 font-bold text-sm">🎨</span>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-white text-sm font-medium">Generiert parallel...</p>
                              <p className="text-gray-400 text-xs mt-1">
                                Erstelle individuelles Logo basierend auf Teamnamen...
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <span className="text-gray-400 text-xl">⏳</span>
                              </div>
                              <p className="text-gray-500 text-sm">Fehler oder Timeout</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-center mb-4">
                        <h4 className="text-white font-medium mb-1">Option {id}</h4>
                        <p className="text-gray-400 text-sm">
                          {option ? option.style : `Stil ${id} - Angepasst an "${selectedTeam?.name}"`}
                        </p>
                      </div>
                      <button
                        onClick={() => option && handleLogoSelect(option.url)}
                        disabled={!option}
                        className={`w-full px-4 py-2 rounded-lg transition-colors ${
                          option 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {option ? 'Dieses Logo wählen' : 'Wird generiert...'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="mt-6 bg-white/10 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">Fortschritt</span>
                  <span className="text-gray-300 text-sm">{generationProgress.progress}/{generationProgress.total}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(generationProgress.progress / generationProgress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-gray-300 text-sm">{generationProgress.message}</p>
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={resetRegistration}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventPage;
