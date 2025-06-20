import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lock, Clock, Lightbulb, Send, CheckCircle, XCircle } from 'lucide-react';

const GamePlay = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { joinEvent, emitAnswerSubmitted } = useSocket();
  
  const [team, setTeam] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answer, setAnswer] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [usedTips, setUsedTips] = useState(0);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);

  useEffect(() => {
    loadTeamAndQuestion();
  }, [teamId]);

  useEffect(() => {
    let timer;
    if (timeLeft > 0 && currentQuestion && !gameCompleted) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            toast.error('Zeit abgelaufen!');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timeLeft, currentQuestion, gameCompleted]);

  const loadTeamAndQuestion = async () => {
    try {
      const teamResponse = await axios.get(`/api/teams/${teamId}`);
      setTeam(teamResponse.data);
      
      joinEvent(teamResponse.data.event_id);
      
      const questionResponse = await axios.get(`/api/game/team/${teamId}/current-question`);
      
      if (questionResponse.data.completed) {
        setGameCompleted(true);
        toast.success('Alle Rätsel gelöst! 🎉');
      } else {
        setCurrentQuestion(questionResponse.data);
        
        if (questionResponse.data.progress) {
          // Question already has progress - restore state
          const progress = questionResponse.data.progress;
          setAttempts(progress.attemptsUsed);
          setUsedTips(progress.usedTip);
          
          // Calculate remaining time based on when the question was started
          const timeStarted = new Date(progress.timeStarted);
          const now = new Date();
          const elapsedSeconds = Math.floor((now - timeStarted) / 1000);
          const remainingTime = Math.max(0, questionResponse.data.time_limit_seconds - elapsedSeconds);
          
          console.log('🕐 Time calculation:', {
            timeStarted: timeStarted.toISOString(),
            now: now.toISOString(),
            elapsedSeconds,
            timeLimit: questionResponse.data.time_limit_seconds,
            remainingTime
          });
          
          setTimeLeft(remainingTime);
          
          // Load already used tips
          if (progress.usedTip > 0) {
            try {
              const tipsResponse = await axios.get(`/api/game/question/${questionResponse.data.id}/tips/${teamId}`);
              setTips(tipsResponse.data.tips);
            } catch (error) {
              console.error('Error loading tips:', error);
            }
          } else {
            setTips([]);
          }
          
          if (remainingTime === 0) {
            toast.error('Zeit für diese Frage ist bereits abgelaufen!');
          } else if (progress.attemptsUsed > 0 || progress.usedTip > 0) {
            // Only show restore message if there was actual progress
            toast('Frage wurde wiederhergestellt', {
              icon: '🔄',
              duration: 3000
            });
          }
        } else {
          // Fresh question - start it now
          try {
            const startResponse = await axios.post(`/api/game/question/${questionResponse.data.id}/start`, {
              teamId
            });
            
            // Set initial state
            setTimeLeft(questionResponse.data.time_limit_seconds);
            setAttempts(0);
            setUsedTips(0);
            setTips([]);
            
                         if (startResponse.data.existing) {
               // Question was already started - need to calculate remaining time
               const timeStarted = new Date(startResponse.data.timeStarted);
               const now = new Date();
               const elapsedSeconds = Math.floor((now - timeStarted) / 1000);
               const remainingTime = Math.max(0, questionResponse.data.time_limit_seconds - elapsedSeconds);
               
               console.log('🕐 Time calculation (existing):', {
                 timeStarted: timeStarted.toISOString(),
                 now: now.toISOString(),
                 elapsedSeconds,
                 timeLimit: questionResponse.data.time_limit_seconds,
                 remainingTime
               });
               
               setTimeLeft(remainingTime);
               
               if (remainingTime === 0) {
                 toast.error('Zeit für diese Frage ist bereits abgelaufen!');
               }
             }
          } catch (error) {
            console.error('Error starting question:', error);
            toast.error('Fehler beim Starten der Frage');
          }
        }
      }
    } catch (error) {
      console.error('Error loading game data:', error);
      toast.error('Fehler beim Laden des Spiels');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const getTip = async (tipNumber) => {
    try {
      const response = await axios.post(`/api/game/question/${currentQuestion.id}/tip`, {
        teamId,
        tipNumber
      });
      
      const newTips = [...tips];
      newTips[tipNumber - 1] = response.data.tip;
      setTips(newTips);
      setUsedTips(tipNumber);
      
      if (tipNumber === 3) {
        toast.warning('Achtung: Das ist die Lösung! (0 Punkte)');
      } else {
        toast(`Tipp ${tipNumber} erhalten (Punkte-Abzug)`, {
          icon: '💡',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Error getting tip:', error);
      toast.error('Fehler beim Abrufen des Tipps');
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) {
      toast.error('Bitte gib eine Antwort ein');
      return;
    }

    if (attempts >= 3) {
      toast.error('Maximale Anzahl an Versuchen erreicht');
      return;
    }

    setSubmitting(true);
    
    try {
      const response = await axios.post(`/api/game/question/${currentQuestion.id}/answer`, {
        teamId,
        answer
      });

      if (response.data.correct) {
        toast.success(`Richtig! ${response.data.points} Punkte erhalten! 🎉`);
        emitAnswerSubmitted({
          eventId: team.event_id,
          teamId,
          points: response.data.points
        });
        
        // Load next question after a short delay
        setTimeout(() => {
          setAnswer('');
          setAttempts(0);
          setUsedTips(0);
          setTips([]);
          loadTeamAndQuestion();
        }, 2000);
      } else {
        setAttempts(prev => prev + 1);
        toast.error(response.data.message);
        if (response.data.attemptsRemaining > 0) {
          toast(`Noch ${response.data.attemptsRemaining} Versuche übrig`, {
            icon: 'ℹ️',
            duration: 3000
          });
        }
        setAnswer('');
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Fehler beim Übermitteln der Antwort');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-xl">Lade Spiel...</p>
        </div>
      </div>
    );
  }

  if (gameCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <CheckCircle className="w-24 h-24 text-green-400 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-white mb-4">
            Glückwunsch, {team?.name}! 🎉
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Ihr habt alle Rätsel erfolgreich gelöst!
          </p>
          <button
            onClick={() => navigate(`/scoreboard/${team.event_id}`)}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200"
          >
            Zum Scoreboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Team: {team?.name}
          </h1>
          <div className="flex items-center justify-center space-x-6">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-yellow-400 mr-2" />
              <span className={`text-lg font-mono ${timeLeft < 60 ? 'text-red-400' : 'text-white'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-white">Versuche: {attempts}/3</span>
            </div>
          </div>
        </div>

        {currentQuestion && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 mb-8">
            {/* Lock Visual */}
            <div className="text-center mb-8">
              <Lock className="w-24 h-24 text-yellow-400 mx-auto mb-4" />
              <div className="text-sm text-gray-400 uppercase tracking-wider">
                Schwierigkeit: {currentQuestion.difficulty}
              </div>
            </div>

            {/* Question Content */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4 text-center">
                {currentQuestion.title}
              </h2>
              
              {currentQuestion.description && (
                <p className="text-gray-300 text-center mb-6">
                  {currentQuestion.description}
                </p>
              )}

              {currentQuestion.image_path && (
                <div className="text-center mb-6">
                  <img
                    src={`/uploads/${currentQuestion.image_path}`}
                    alt="Rätsel-Bild"
                    className="max-w-full max-h-64 mx-auto rounded-lg shadow-lg"
                  />
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Lightbulb className="w-5 h-5 text-yellow-400 mr-2" />
                Tipps ({usedTips}/3)
              </h3>
              
              <div className="grid gap-3">
                {[1, 2, 3].map((tipNum) => (
                  <div key={tipNum} className="flex items-center space-x-3">
                    <button
                      onClick={() => getTip(tipNum)}
                      disabled={usedTips >= tipNum}
                      className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                        usedTips >= tipNum
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : tipNum === 3
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      Tipp {tipNum} {tipNum === 3 && '(Lösung)'}
                    </button>
                    
                    {tips[tipNum - 1] && (
                      <div className="flex-1 p-3 bg-black/30 rounded-md">
                        <p className="text-gray-300">{tips[tipNum - 1]}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Answer Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Deine Antwort
                </label>
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && submitAnswer()}
                  disabled={submitting || attempts >= 3 || timeLeft === 0}
                  className="w-full px-4 py-3 bg-white/20 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="Gib deine Antwort ein..."
                />
              </div>
              
              <button
                onClick={submitAnswer}
                disabled={submitting || attempts >= 3 || timeLeft === 0 || !answer.trim()}
                className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Übermittle...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Antwort abgeben
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Scoreboard Link */}
        <div className="text-center">
          <button
            onClick={() => navigate(`/scoreboard/${team?.event_id}`)}
            className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200"
          >
            Scoreboard anzeigen
          </button>
        </div>
      </div>
    </div>
  );
};

export default GamePlay; 