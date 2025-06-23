import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import { Trophy, Medal, Award, Users, Target, Clock, ArrowLeft } from 'lucide-react';

const Scoreboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { joinEvent, requestLiveData, onLiveDataUpdate, connected } = useSocket();
  
  const [event, setEvent] = useState(null);
  const [scoreboard, setScoreboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTeam, setCurrentTeam] = useState(null);

  useEffect(() => {
    console.log('🔄 Scoreboard useEffect triggered for eventId:', eventId);
    
    loadEventAndScoreboard();
    loadCurrentTeam();
  }, [eventId]);

  // Separate useEffect for Socket.IO that waits for connection
  useEffect(() => {
    if (!connected) {
      console.log('🔌 Socket not connected yet, waiting...');
      return;
    }

    console.log('🔗 Socket connected! Joining event:', eventId);
    joinEvent(eventId);

    // Listen for real-time updates via Socket.IO
    const cleanup = onLiveDataUpdate((data) => {
      console.log('📊 Socket.IO data received:', data);
      console.log('📊 Data type:', data.type, 'Expected: scoreboard');
      console.log('📊 Data eventId:', data.eventId, 'Expected:', parseInt(eventId));
      console.log('📊 EventId comparison:', data.eventId === parseInt(eventId));
      
      if (data.type === 'scoreboard' && data.eventId === parseInt(eventId)) {
        console.log('✅ Updating scoreboard with new data:', data.data);
        setScoreboard(data.data);
      } else {
        console.log('❌ Ignoring data - type or eventId mismatch');
      }
    });

    // Request initial scoreboard data
    console.log('📡 Requesting initial scoreboard data for eventId:', eventId);
    requestLiveData('scoreboard', { eventId });

    // Add a test to verify Socket.IO is working
    setTimeout(() => {
      console.log('🧪 Testing Socket.IO connection - requesting scoreboard data');
      requestLiveData('scoreboard', { eventId });
    }, 2000);

    // Refresh scoreboard every 10 seconds as backup
    const interval = setInterval(() => {
      console.log('⏰ Backup refresh - requesting scoreboard data');
      requestLiveData('scoreboard', { eventId });
    }, 10000);

    return () => {
      console.log('🧹 Cleaning up scoreboard listeners');
      cleanup && cleanup();
      clearInterval(interval);
    };
  }, [connected, eventId]);

  const loadCurrentTeam = () => {
    try {
      const teamData = localStorage.getItem('currentTeam');
      if (teamData) {
        const team = JSON.parse(teamData);
        // Only set current team if it matches the current event
        if (team.eventId === parseInt(eventId)) {
          setCurrentTeam(team);
        }
      }
    } catch (error) {
      console.error('Error loading current team from localStorage:', error);
    }
  };

  const goBack = () => {
    if (currentTeam) {
      // Navigate back to team page
      navigate(`/team/${currentTeam.teamId}/event/${currentTeam.eventId}`);
    } else {
      // Navigate back to event page
      navigate(`/events/${eventId}`);
    }
  };

  const loadEventAndScoreboard = async () => {
    try {
      const [eventResponse, scoreboardResponse] = await Promise.all([
        axios.get(`/api/events/${eventId}`),
        axios.get(`/api/game/event/${eventId}/scoreboard`)
      ]);
      
      setEvent(eventResponse.data);
      setScoreboard(scoreboardResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScoreboard = async () => {
    try {
      const response = await axios.get(`/api/game/event/${eventId}/scoreboard`);
      setScoreboard(response.data);
    } catch (error) {
      console.error('Error loading scoreboard:', error);
    }
  };

  const getRankIcon = (position) => {
    switch (position) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <div className="w-6 h-6 flex items-center justify-center text-gray-400 font-bold">#{position}</div>;
    }
  };

  const getRankClass = (position) => {
    switch (position) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-400/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-slate-400/20 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/30';
      default:
        return 'bg-white/5 border-gray-600/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-xl">Lade Scoreboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={goBack}
            className="flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {currentTeam ? 'Zurück zum Team' : 'Zurück zum Event'}
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="w-12 h-12 text-yellow-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">Live Scoreboard</h1>
          </div>
          <h2 className="text-xl text-gray-300">{event?.name}</h2>
        </div>

        {/* Scoreboard */}
        <div className="space-y-3">
          {scoreboard.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-xl text-gray-400">Noch keine Teams angemeldet</p>
            </div>
          ) : (
            scoreboard.map((team, index) => (
              <div
                key={team.id}
                className={`scoreboard-entry rounded-lg border p-4 ${getRankClass(index + 1)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getRankIcon(index + 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {team.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {team.questions_solved || 0} Rätsel gelöst
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      {team.total_points || 0}
                    </div>
                    <div className="text-xs text-gray-400">Punkte</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Scoreboard;