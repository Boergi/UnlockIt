import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import { 
  Users, 
  Lock, 
  Calendar, 
  Clock, 
  Trophy, 
  Target,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Home,
  QrCode,
  Share2,
  Copy
} from 'lucide-react';

const TeamEventPage = () => {
  const { teamId, eventId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  
  const [team, setTeam] = useState(null);
  const [event, setEvent] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [teamProgress, setTeamProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({});
  const [isEventStarted, setIsEventStarted] = useState(false);
  const [isEventEnded, setIsEventEnded] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    loadTeamAndEvent();
  }, [teamId, eventId]);

  useEffect(() => {
    if (event) {
      const timer = setInterval(updateCountdown, 1000);
      return () => clearInterval(timer);
    }
  }, [event]);

  useEffect(() => {
    if (isEventStarted && !isEventEnded) {
      loadTeamProgress();
    }
  }, [isEventStarted, isEventEnded]);



  // Socket.IO listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleProgressUpdate = (data) => {
      if (data.teamId === parseInt(teamId)) {
        loadTeamProgress();
      }
    };

    socket.on('team-progress-update', handleProgressUpdate);

    return () => {
      socket.off('team-progress-update', handleProgressUpdate);
    };
  }, [socket, teamId]);

  const loadTeamAndEvent = async () => {
    try {
      const [teamResponse, eventResponse] = await Promise.all([
        axios.get(`/api/teams/${teamId}`),
        axios.get(`/api/events/${eventId}`)
      ]);

      const teamData = teamResponse.data;
      const eventData = eventResponse.data;

      // Verify team belongs to this event
      if (teamData.event_id !== parseInt(eventId)) {
        toast.error('Team gehört nicht zu diesem Event');
        navigate('/');
        return;
      }

      setTeam(teamData);
      setEvent(eventData);
      
      // Store in localStorage for automatic navigation
      localStorage.setItem('currentTeam', JSON.stringify({
        teamId: teamData.id,
        eventId: eventData.id,
        teamName: teamData.name,
        eventName: eventData.name
      }));

      // Generate QR Code for this team page
      generateQrCode(teamData.id, eventData.id);

      updateCountdown();
    } catch (error) {
      console.error('Error loading team/event:', error);
      toast.error('Team oder Event nicht gefunden');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamProgress = async () => {
    try {
      const response = await axios.get(`/api/teams/${teamId}/progress`);
      setTeamProgress(response.data);
      
      // Find current question (first not completed)
      // This now includes questions that haven't been started yet
      const currentQ = response.data.find(q => !q.completed);
      setCurrentQuestion(currentQ);
      
      console.log('Team progress loaded:', response.data);
      console.log('Current question:', currentQ);
    } catch (error) {
      console.error('Error loading team progress:', error);
    }
  };

  const updateCountdown = () => {
    if (!event) return;
    
    const now = new Date().getTime();
    const startTime = new Date(event.start_time).getTime();
    const endTime = event.end_time ? new Date(event.end_time).getTime() : null;
    
    if (now >= startTime) {
      if (endTime && now >= endTime) {
        setIsEventEnded(true);
        setIsEventStarted(false);
        setTimeLeft({ ended: true });
      } else {
        setIsEventStarted(true);
        setIsEventEnded(false);
        if (endTime) {
          const timeDiff = endTime - now;
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
          setTimeLeft({ hours, minutes, seconds, running: true });
        } else {
          setTimeLeft({ running: true });
        }
      }
      return;
    }
    
    const timeDiff = startTime - now;
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    setTimeLeft({ days, hours, minutes, seconds });
    setIsEventStarted(false);
    setIsEventEnded(false);
  };

  const goToGamePlay = () => {
    if (currentQuestion) {
      navigate(`/play/${teamId}`);
    }
  };

  const generateQrCode = async (teamId, eventId) => {
    try {
      const teamPageUrl = `${window.location.origin}/team/${teamId}/event/${eventId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(teamPageUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(qrCodeDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const copyTeamUrl = async () => {
    const teamPageUrl = `${window.location.origin}/team/${team.id}/event/${event.id}`;
    try {
      await navigator.clipboard.writeText(teamPageUrl);
      toast.success('Team-Link kopiert!');
    } catch (error) {
      console.error('Error copying URL:', error);
      toast.error('Fehler beim Kopieren');
    }
  };

  const leaveTeam = () => {
    localStorage.removeItem('currentTeam');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!team || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Team oder Event nicht gefunden</h1>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6 border border-gray-600">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              {/* Event Logo */}
              {event.logo_url && (
                <img
                  src={`http://localhost:3001${event.logo_url}`}
                  alt={`${event.name} Logo`}
                  className="w-16 h-16 rounded-xl object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              )}
              
              <div>
                <h1 className="text-2xl font-bold text-white">{event.name}</h1>
                <div className="flex items-center space-x-2 text-gray-300">
                  <Users className="w-4 h-4" />
                  <span>Team: {team.name}</span>
                  {team.logo_url && (
                    <img
                      src={`http://localhost:3001${team.logo_url}`}
                      alt={`${team.name} Logo`}
                      className="w-6 h-6 rounded object-cover ml-2"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setShowQrCode(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <QrCode className="w-4 h-4" />
                <span>QR-Code</span>
              </button>
              <button
                onClick={copyTeamUrl}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>Link</span>
              </button>
              <button
                onClick={leaveTeam}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>Verlassen</span>
              </button>
            </div>
          </div>
        </div>

        {/* Event Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Countdown/Status */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-gray-600">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Event Status</h2>
            </div>

            {timeLeft.ended ? (
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400 mb-2">Event beendet</div>
                <p className="text-gray-300">Das Event ist zu Ende</p>
              </div>
            ) : timeLeft.running ? (
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400 mb-2">Event läuft!</div>
                {timeLeft.hours !== undefined && (
                  <p className="text-gray-300">
                    Noch {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-400 mb-3">Startet in:</div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-xl font-bold text-white">{timeLeft.days || 0}</div>
                    <div className="text-xs text-gray-300">Tage</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-xl font-bold text-white">{timeLeft.hours || 0}</div>
                    <div className="text-xs text-gray-300">Std</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-xl font-bold text-white">{timeLeft.minutes || 0}</div>
                    <div className="text-xs text-gray-300">Min</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-xl font-bold text-white">{timeLeft.seconds || 0}</div>
                    <div className="text-xs text-gray-300">Sek</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Team Progress */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-gray-600">
            <div className="flex items-center space-x-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">Team Fortschritt</h2>
            </div>

            {teamProgress.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Gelöste Fragen:</span>
                  <span className="text-green-400">{teamProgress.filter(q => q.correct).length} / {teamProgress.length}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Abgeschlossene Fragen:</span>
                  <span>{teamProgress.filter(q => q.completed).length} / {teamProgress.length}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${teamProgress.length > 0 ? (teamProgress.filter(q => q.correct).length / teamProgress.length) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
                <div className="text-sm text-gray-300">
                  Gesamtpunkte: {teamProgress.reduce((sum, q) => sum + (q.points_awarded || 0), 0)}
                </div>
              </div>
            ) : (
              <p className="text-gray-300">Noch keine Fragen verfügbar</p>
            )}
          </div>
        </div>

        {/* Main Content */}
        {!isEventStarted && !isEventEnded ? (
          // Event hasn't started yet
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 text-center border border-gray-600">
            <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Warten auf Event-Start</h2>
            <p className="text-gray-300 mb-6">
              Das Event hat noch nicht begonnen. Die Fragen werden verfügbar, sobald das Event startet.
            </p>
            <div className="text-sm text-gray-400">
              Startzeit: {new Date(event.start_time).toLocaleString('de-DE')}
            </div>
          </div>
        ) : isEventEnded ? (
          // Event has ended
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 text-center border border-gray-600">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Event beendet</h2>
            <p className="text-gray-300 mb-6">
              Das Event ist zu Ende. Vielen Dank für eure Teilnahme!
            </p>
            {teamProgress.length > 0 && (
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-2">Euer Endergebnis:</h3>
                <div className="text-3xl font-bold text-yellow-400">
                  {teamProgress.reduce((sum, q) => sum + (q.points_earned || 0), 0)} Punkte
                </div>
                <div className="text-gray-300 mt-2">
                  {teamProgress.filter(q => q.completed).length} von {teamProgress.length} Fragen gelöst
                </div>
              </div>
            )}
          </div>
        ) : (
          // Event is running
          <div className="space-y-6">
            {/* Current Question */}
            {currentQuestion && (
              <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-6 border border-green-500/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Target className="w-6 h-6 text-green-400" />
                    <h2 className="text-xl font-bold text-white">Aktuelle Frage</h2>
                  </div>
                  <button
                    onClick={goToGamePlay}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <span>Frage lösen</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{currentQuestion.question_title}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-300">
                    <span>Schwierigkeit: {currentQuestion.difficulty}</span>
                    <span>Versuche: {currentQuestion.attempts || 0}/3</span>
                  </div>
                </div>
              </div>
            )}

            {/* Questions Overview */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-gray-600">
              <h2 className="text-xl font-bold text-white mb-4">Beantwortete Fragen</h2>
              
              {teamProgress.filter(progress => progress.attempt_1 !== null || progress.attempt_2 !== null || progress.attempt_3 !== null).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamProgress.filter(progress => progress.attempt_1 !== null || progress.attempt_2 !== null || progress.attempt_3 !== null).map((progress, index) => {
                    const isCorrect = progress?.correct || false;
                    const isCompleted = progress?.completed || false;
                    const attempts = progress ? [progress.attempt_1, progress.attempt_2, progress.attempt_3].filter(Boolean).length : 0;
                    const pointsEarned = progress?.points_awarded || 0;
                    const usedTip = progress?.used_tip || 0;
                    
                    // Determine completion reason for display
                    let completionReason = '';
                    if (isCompleted && !isCorrect) {
                      if (usedTip >= 3) {
                        completionReason = 'Lösung verwendet';
                      } else if (attempts >= 3) {
                        completionReason = 'Alle Versuche aufgebraucht';
                      } else {
                        completionReason = 'Zeit abgelaufen';
                      }
                    }
                    
                    return (
                      <div
                        key={progress.question_id}
                        className={`p-4 rounded-lg border ${
                          isCorrect
                            ? 'bg-green-500/20 border-green-500/30'
                            : isCompleted
                            ? 'bg-red-500/20 border-red-500/30'
                            : attempts > 0
                            ? 'bg-yellow-500/20 border-yellow-500/30'
                            : 'bg-white/5 border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-white">
                            {progress.question_title}
                          </h3>
                          {isCorrect ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : isCompleted ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                          ) : attempts > 0 ? (
                            <AlertCircle className="w-5 h-5 text-yellow-400" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-400"></div>
                          )}
                        </div>
                        <div className="flex justify-between text-sm text-gray-300">
                          <span>Schwierigkeit: {progress.difficulty}</span>
                          <span>
                            {isCorrect 
                              ? `${pointsEarned} Punkte` 
                              : isCompleted
                              ? `0 Punkte (${completionReason})`
                              : `Versuche: ${attempts}/3`
                            }
                          </span>
                        </div>
                        {isCompleted && !isCorrect && (
                          <div className="mt-2 text-xs text-red-300">
                            {completionReason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-300">Noch keine Fragen beantwortet</p>
              )}
            </div>

            {/* Scoreboard Button */}
            <div className="text-center">
              <button
                onClick={() => window.open(`/scoreboard/${eventId}`, '_blank')}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Trophy className="w-5 h-5 mr-2" />
                Live Scoreboard anzeigen
              </button>
              <p className="text-gray-400 text-sm mt-2">
                Schaut euch an, wie ihr im Vergleich zu anderen Teams steht
              </p>
            </div>
                     </div>
         )}

         {/* QR Code Modal */}
         {showQrCode && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
             <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-white">Team QR-Code</h3>
                 <button
                   onClick={() => setShowQrCode(false)}
                   className="text-gray-400 hover:text-white p-1"
                 >
                   <XCircle className="w-6 h-6" />
                 </button>
               </div>
               
               <div className="text-center">
                 <div className="bg-white rounded-lg p-4 mb-4 inline-block">
                   {qrCodeUrl && (
                     <img
                       src={qrCodeUrl}
                       alt="Team QR Code"
                       className="w-64 h-64"
                     />
                   )}
                 </div>
                 
                 <div className="space-y-3">
                   <p className="text-gray-300 text-sm">
                     Scanne diesen QR-Code, um andere zur Team-Seite einzuladen
                   </p>
                   
                   <div className="bg-white/10 rounded-lg p-3">
                     <p className="text-white font-medium mb-1">Team: {team?.name}</p>
                     <p className="text-gray-300 text-sm">Event: {event?.name}</p>
                   </div>
                   
                   <div className="flex space-x-2">
                     <button
                       onClick={copyTeamUrl}
                       className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                     >
                       <Copy className="w-4 h-4" />
                       <span>Link kopieren</span>
                     </button>
                     <button
                       onClick={() => setShowQrCode(false)}
                       className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                     >
                       Schließen
                     </button>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         )}
       </div>
     </div>
   );
 };
 
 export default TeamEventPage; 