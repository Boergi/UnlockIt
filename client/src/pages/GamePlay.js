import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lock, Clock, Lightbulb, Send, CheckCircle, XCircle, Trophy, ArrowLeft, Info } from 'lucide-react';
import PointsInfoModal from '../components/PointsInfoModal';

// Global tracker to prevent duplicate question starts
const startedQuestions = new Set();

// Global lock to prevent any question starts for a team
const teamStartLocks = new Map();

// Global session-based lock to prevent multiple mounts from starting questions
const sessionStartLocks = new Map();

// Helper function to acquire team start lock
const acquireTeamStartLock = (teamId) => {
  const lockKey = `team-${teamId}`;
  if (teamStartLocks.has(lockKey)) {
    console.log('🚫 Team start lock already exists for team:', teamId);
    return false;
  }
  console.log('🔒 Acquiring team start lock for team:', teamId);
  teamStartLocks.set(lockKey, Date.now());
  return true;
};

// Helper function to acquire session start lock (survives component unmount/mount)
const acquireSessionStartLock = (teamId) => {
  const sessionKey = `session-${teamId}`;
  const now = Date.now();
  
  if (sessionStartLocks.has(sessionKey)) {
    const lockTime = sessionStartLocks.get(sessionKey);
    // Only allow if lock is older than 5 seconds
    if (now - lockTime < 5000) {
      console.log('🚫 Session start lock exists for team:', teamId, 'Age:', now - lockTime, 'ms');
      return false;
    } else {
      console.log('🕐 Session start lock expired, acquiring new one for team:', teamId);
    }
  }
  
  console.log('🔒 Acquiring session start lock for team:', teamId);
  sessionStartLocks.set(sessionKey, now);
  return true;
};

// Helper function to release team start lock
const releaseTeamStartLock = (teamId) => {
  const lockKey = `team-${teamId}`;
  if (teamStartLocks.has(lockKey)) {
    console.log('🔓 Releasing team start lock for team:', teamId);
    teamStartLocks.delete(lockKey);
  }
};

// Auto-release locks after timeout to prevent permanent locks
setInterval(() => {
  const now = Date.now();
  const TEAM_LOCK_TIMEOUT = 30000; // 30 seconds
  const SESSION_LOCK_TIMEOUT = 10000; // 10 seconds
  
  // Release expired team locks
  for (const [lockKey, timestamp] of teamStartLocks.entries()) {
    if (now - timestamp > TEAM_LOCK_TIMEOUT) {
      console.log('🕐 Auto-releasing expired team start lock:', lockKey);
      teamStartLocks.delete(lockKey);
    }
  }
  
  // Release expired session locks
  for (const [sessionKey, timestamp] of sessionStartLocks.entries()) {
    if (now - timestamp > SESSION_LOCK_TIMEOUT) {
      console.log('🕐 Auto-releasing expired session start lock:', sessionKey);
      sessionStartLocks.delete(sessionKey);
    }
  }
}, 5000); // Check every 5 seconds

const GamePlay = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { joinEvent, emitAnswerSubmitted, requestLiveData, onLiveDataUpdate } = useSocket();
  
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
  const [teamScore, setTeamScore] = useState(0);
  const [teamPosition, setTeamPosition] = useState(null);
  const [availableTips, setAvailableTips] = useState([]);
  const [questionCompleted, setQuestionCompleted] = useState(false);
  const [completionReason, setCompletionReason] = useState(null);
  const [completingQuestion, setCompletingQuestion] = useState(false);
  const [loadingGame, setLoadingGame] = useState(false);
  const [startingQuestion, setStartingQuestion] = useState(false);
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const hasInitialized = useRef(false);

  // Store the original teamId to prevent re-runs on parameter changes
  const originalTeamIdRef = useRef(teamId);
  
  useEffect(() => {
    console.log('🔄 useEffect triggered for teamId:', teamId, 'originalTeamId:', originalTeamIdRef.current, 'hasInitialized:', hasInitialized.current);
    
    // Prevent multiple initialization calls
    if (hasInitialized.current) {
      console.log('🚫 GamePlay already initialized, skipping...');
      return;
    }
    
    console.log('🎮 Initializing GamePlay for teamId:', teamId);
    hasInitialized.current = true;
    originalTeamIdRef.current = teamId;
    loadTeamAndQuestion();
    
    // Cleanup function to reset on unmount
    return () => {
      console.log('🧹 GamePlay component unmounting, resetting initialization flag');
      hasInitialized.current = false;
      // Clear any started questions for this team
      const teamQuestions = Array.from(startedQuestions).filter(key => 
        key.endsWith(`-${teamId}`) || key.endsWith(`-${originalTeamIdRef.current}`)
      );
      teamQuestions.forEach(key => startedQuestions.delete(key));
      // Release team start lock
      releaseTeamStartLock(teamId);
      releaseTeamStartLock(originalTeamIdRef.current);
      console.log('🧹 Cleared started questions and released locks for team:', teamId);
    };
  }, []); // Remove teamId dependency to prevent re-runs

  // Mark question as completed (for timeout or solution tip usage)
  const completeQuestion = useCallback(async (reason, updateUI = true) => {
    if (!currentQuestion || !team) return;
    
    if (updateUI) {
      setCompletingQuestion(true);
    }
    
    try {
      await axios.post(`/api/game/question/${currentQuestion.id}/complete`, {
        teamId: teamId,
        reason
      });
      
      if (updateUI) {
        setQuestionCompleted(true);
        setCompletionReason(reason);
        
        const reasonText = {
          'timeout': 'Zeit abgelaufen',
          'max_attempts': 'Alle Versuche aufgebraucht',
          'solution': 'Lösung angezeigt'
        }[reason] || reason;
        
        toast(`Frage abgeschlossen (${reasonText})`, {
          icon: '⏰',
          duration: 3000
        });
      }
      
    } catch (error) {
      console.error('Error completing question:', error);
      if (updateUI) {
        toast.error('Fehler beim Abschließen der Frage');
      }
    } finally {
      if (updateUI) {
        setCompletingQuestion(false);
      }
    }
  }, [currentQuestion, team, teamId]);

  useEffect(() => {
    let timer;
    if (timeLeft > 0 && currentQuestion && !gameCompleted && !questionCompleted) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Use setTimeout to avoid state update during render
            setTimeout(() => {
              toast.error('Zeit abgelaufen!');
              completeQuestion('timeout');
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timeLeft, currentQuestion, gameCompleted, questionCompleted, completeQuestion]);

  // Load team score and position via Socket.IO
  const loadTeamScoreAndPosition = useCallback(() => {
    if (!team) return;
    requestLiveData('scoreboard', { eventId: team.event_id });
  }, [team, requestLiveData]);

  useEffect(() => {
    if (team) {
      loadTeamScoreAndPosition();
      // Refresh score every 30 seconds via Socket.IO
      const interval = setInterval(loadTeamScoreAndPosition, 30000);
      return () => clearInterval(interval);
    }
  }, [team]);

  // Listen for live scoreboard updates
  useEffect(() => {
    const cleanup = onLiveDataUpdate((data) => {
      if (data.type === 'scoreboard' && data.eventId === team?.event_id) {
        const scoreboard = data.data;
        const teamIndex = scoreboard.findIndex(t => t.id === parseInt(teamId));
        if (teamIndex >= 0) {
          setTeamPosition(teamIndex + 1);
          setTeamScore(scoreboard[teamIndex].total_points || 0);
        }
      }
    });
    
    return cleanup;
  }, [team, teamId]);

  // Load available tips for current question
  const loadAvailableTips = async (questionId) => {
    try {
      const response = await axios.get(`/api/game/question/${questionId}/available-tips`);
      setAvailableTips(response.data.availableTips);
    } catch (error) {
      console.error('Error loading available tips:', error);
      setAvailableTips([]);
    }
  };

  // Go to next question
  const goToNextQuestion = async () => {
    setCompletingQuestion(true);
    
    try {
      // If the question is completed due to timeout but backend wasn't informed yet, do it now
      if (questionCompleted && completionReason === 'timeout' && currentQuestion && team) {
        await axios.post(`/api/game/question/${currentQuestion.id}/complete`, {
          teamId: teamId,
          reason: 'timeout'
        });
      }
      
      // Reset state
      setAnswer('');
      setAttempts(0);
      setUsedTips(0);
      setTips([]);
      setAvailableTips([]);
      setQuestionCompleted(false);
      setCompletionReason(null);
      setLoadingGame(false); // Reset loading state before loading next question
      setStartingQuestion(false); // Reset starting state
      hasInitialized.current = false; // Allow loading next question
      
      // Release team start lock before loading next question
      releaseTeamStartLock(teamId);
      
      // Load next question
      await loadTeamAndQuestion();
      
    } catch (error) {
      console.error('Error proceeding to next question:', error);
      toast.error('Fehler beim Wechseln zur nächsten Frage');
    } finally {
      setCompletingQuestion(false);
    }
  };

  const loadTeamAndQuestion = async () => {
    // Prevent multiple simultaneous calls
    if (loadingGame) {
      console.log('🚫 loadTeamAndQuestion already running, skipping...');
      return;
    }
    
    // Check session-level lock first (survives component unmount/mount)
    if (!acquireSessionStartLock(teamId)) {
      console.log('🚫 Session start lock exists, aborting loadTeamAndQuestion for teamId:', teamId);
      return;
    }
    
    // Check global team lock
    if (!acquireTeamStartLock(teamId)) {
      console.log('🚫 Team start lock exists, aborting loadTeamAndQuestion for teamId:', teamId);
      return;
    }
    
    setLoadingGame(true);
    try {
      console.log('🔄 Starting loadTeamAndQuestion for teamId:', teamId);
      const teamResponse = await axios.get(`/api/teams/${teamId}`);
      setTeam(teamResponse.data);
      
      joinEvent(teamResponse.data.event_uuid || teamResponse.data.event_id);
      
      const questionResponse = await axios.get(`/api/game/team/${teamId}/current-question`);
      
      if (questionResponse.data.completed) {
        setGameCompleted(true);
        toast.success('Alle Rätsel gelöst! 🎉');
      } else {
        setCurrentQuestion(questionResponse.data);
        
        // Reset completion state for new question
        setQuestionCompleted(false);
        setCompletionReason(null);
        
        // Load available tips for this question
        await loadAvailableTips(questionResponse.data.id);
        
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
            // Update UI immediately
            setQuestionCompleted(true);
            setCompletionReason('timeout');
            // Backend will be informed when user clicks "Next Question"
          } else if (progress.attemptsUsed > 0 || progress.usedTip > 0) {
            // Only show restore message if there was actual progress
            toast('Frage wurde wiederhergestellt', {
              icon: '🔄',
              duration: 3000
            });
          }
        } else {
          // Fresh question - start it now
          const questionId = questionResponse.data.id;
          const questionKey = `${questionId}-${teamId}`;
          
          if (startingQuestion) {
            console.log('🚫 Question already being started, skipping...');
            return;
          }
          
          if (startedQuestions.has(questionKey)) {
            console.log('🚫 Question already started globally, skipping:', questionKey);
            return;
          }
          
          setStartingQuestion(true);
          startedQuestions.add(questionKey);
          
          try {
            console.log('🎯 Starting fresh question:', questionId, 'for team:', teamId);
            const startResponse = await axios.post(`/api/game/question/${questionId}/start`, {
              teamId
            });
            
            console.log('✅ Question start response:', startResponse.data);
            
            // Set initial state
            setTimeLeft(questionResponse.data.time_limit_seconds);
            setAttempts(0);
            setUsedTips(0);
            setTips([]);
            
            if (startResponse.data.existing) {
              console.log('📋 Question was already started, calculating remaining time');
              // Question was already started - need to calculate remaining time
              const timeStarted = new Date(startResponse.data.timeStarted);
              const now = new Date();
              const elapsedSeconds = Math.floor((now - timeStarted) / 1000);
              const remainingTime = Math.max(0, questionResponse.data.time_limit_seconds - elapsedSeconds);
              
              setTimeLeft(remainingTime);
              
              if (remainingTime === 0) {
                toast.error('Zeit für diese Frage ist bereits abgelaufen!');
                // Update UI immediately
                setQuestionCompleted(true);
                setCompletionReason('timeout');
                // Backend will be informed when user clicks "Next Question"
              }
            } else {
              console.log('🆕 New question started successfully');
            }
          } catch (error) {
            console.error('Error starting question:', error);
            toast.error('Fehler beim Starten der Frage');
            // Remove from started questions on error so it can be retried
            startedQuestions.delete(questionKey);
          } finally {
            setStartingQuestion(false);
          }
        }
      }
    } catch (error) {
      console.error('Error loading game data:', error);
      toast.error('Fehler beim Laden des Spiels');
      navigate('/');
    } finally {
      setLoading(false);
      setLoadingGame(false);
      releaseTeamStartLock(teamId);
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
        toast('Achtung: Das ist die Lösung! (0 Punkte)', {
          icon: '⚠️',
          duration: 4000
        });
        // Question is automatically marked as completed by the backend
        setQuestionCompleted(true);
        setCompletionReason('solution');
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
          eventId: team.event_uuid || team.event_id,
          teamId,
          points: response.data.points
        });
        
        // Update team score immediately
        setTeamScore(prev => prev + response.data.points);
        
        // Mark as completed and show continue button
        setQuestionCompleted(true);
        setCompletionReason('correct');
        
        // Refresh position after question completion
        loadTeamScoreAndPosition();
      } else {
        setAttempts(prev => prev + 1);
        toast.error(response.data.message);
        if (response.data.attemptsRemaining > 0) {
          toast(`Noch ${response.data.attemptsRemaining} Versuche übrig`, {
            icon: 'ℹ️',
            duration: 3000
          });
        } else {
          // No more attempts - mark question as completed
          toast.error('Alle Versuche aufgebraucht!');
          completeQuestion('max_attempts');
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
            onClick={() => navigate(`/scoreboard/${team.event_uuid || team.event_id}`)}
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
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={() => {
              const teamIdentifier = team?.uuid || team?.id;
              const eventIdentifier = team?.event_uuid || team?.event_id;
              navigate(`/team/${teamIdentifier}/event/${eventIdentifier}`);
            }}
            className="flex items-center text-gray-400 hover:text-white transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Zurück zur Team-Seite
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Team: {team?.name}
          </h1>
          
          {/* Position and Score */}
          <div className="flex items-center justify-center space-x-6 mb-4">
            <div className="flex items-center">
              <Trophy className="w-5 h-5 text-yellow-400 mr-2" />
              <span className="text-white font-semibold">
                Position: {teamPosition ? `#${teamPosition}` : '--'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-white font-semibold">
                Punkte: {teamScore}
              </span>
            </div>
          </div>

          {/* Timer and Attempts */}
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
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 mb-8 relative">
            {/* Points Info Button */}
            <button
              onClick={() => setShowPointsInfo(true)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-blue-400 hover:text-blue-300 transition-all duration-200"
              title="Punkteberechnung anzeigen"
            >
              <Info className="w-5 h-5" />
            </button>

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
                <div 
                  className="text-gray-300 text-center mb-6 rich-text-content"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.description }}
                />
              )}

              {currentQuestion.image_path && (
                <div className="text-center mb-6">
                  <img
                    src={currentQuestion.image_path}
                    alt="Rätsel-Bild"
                    className="max-w-full max-h-80 mx-auto rounded-lg shadow-lg object-contain cursor-pointer hover:scale-105 transition-transform duration-200"
                    onClick={() => window.open(currentQuestion.image_path, '_blank')}
                    title="Klicken zum Vergrößern"
                  />
                </div>
              )}
            </div>

            {/* Tips */}
            {availableTips.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Lightbulb className="w-5 h-5 text-yellow-400 mr-2" />
                  Tipps ({usedTips}/{availableTips.length})
                </h3>
                
                <div className="grid gap-3">
                  {availableTips.map((tipNum) => (
                    <div key={tipNum} className="flex items-center space-x-3">
                      <button
                        onClick={() => getTip(tipNum)}
                        disabled={usedTips >= tipNum || questionCompleted}
                        className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                          usedTips >= tipNum || questionCompleted
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : tipNum === 3
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {tipNum === 3 ? 'Lösung' : `Tipp ${tipNum}`}
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
            )}

            {/* Answer Input or Continue Button */}
            {questionCompleted ? (
              <div className="space-y-4">
                <div className="text-center p-6 bg-green-600/20 border border-green-600/30 rounded-lg">
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">
                    {completionReason === 'correct' ? 'Richtig gelöst! 🎉' : 
                     completionReason === 'solution' ? 'Lösung angezeigt' :
                     completionReason === 'timeout' ? 'Zeit abgelaufen' :
                     completionReason === 'max_attempts' ? 'Alle Versuche aufgebraucht' :
                     'Frage abgeschlossen'}
                  </h3>
                  <p className="text-gray-300 mb-4">
                    {completionReason === 'correct' ? 'Großartig! Du kannst zur nächsten Frage.' :
                     'Du kannst zur nächsten Frage wechseln.'}
                  </p>
                </div>
                
                <button
                  onClick={goToNextQuestion}
                  disabled={completingQuestion}
                  className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completingQuestion ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Schließe Frage ab...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Weiter zur nächsten Frage
                    </>
                  )}
                </button>
              </div>
            ) : (
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
            )}
          </div>
        )}

        {/* Points Info Modal */}
        <PointsInfoModal 
          isOpen={showPointsInfo} 
          onClose={() => setShowPointsInfo(false)} 
        />
      </div>
    </div>
  );
};

export default GamePlay; 