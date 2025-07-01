import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { getImageUrl } from '../utils/apiUtils';
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
      console.log('📊 Data eventId:', data.eventId, 'Current eventId:', eventId);
      
      // Handle both UUID and numeric event IDs
      const dataEventId = data.eventId;
      const currentEventId = eventId;
      const numericEventId = parseInt(eventId);
      
      const eventMatches = 
        dataEventId === currentEventId ||  // Direct match (UUID or numeric)
        dataEventId === numericEventId ||  // Numeric match
        (event?.id && dataEventId === event.id) ||  // Match with loaded event's numeric ID
        (event?.uuid && dataEventId === event.uuid);  // Match with loaded event's UUID
      
      console.log('📊 Event matching:', {
        dataEventId,
        currentEventId,
        numericEventId,
        eventId_from_loaded: event?.id,
        eventUuid_from_loaded: event?.uuid,
        eventMatches
      });
      
      if (data.type === 'scoreboard' && eventMatches) {
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
  }, [connected, eventId, event]);

  const loadCurrentTeam = () => {
    try {
      const teamData = localStorage.getItem('currentTeam');
      if (teamData) {
        const team = JSON.parse(teamData);
        // Handle both UUID and numeric event IDs for team validation
        const teamEventId = team.eventId;
        const currentEventId = eventId;
        const numericEventId = parseInt(eventId);
        
        const teamBelongsToEvent = 
          teamEventId === currentEventId ||
          teamEventId === numericEventId ||
          teamEventId === parseInt(currentEventId);
        
        if (teamBelongsToEvent) {
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
      console.log('🔄 Loading event and scoreboard for eventId:', eventId);
      
      const [eventResponse, scoreboardResponse] = await Promise.all([
        axios.get(`/api/events/${eventId}`),
        axios.get(`/api/game/event/${eventId}/scoreboard`)
      ]);
      
      console.log('📋 Event data loaded:', eventResponse.data);
      console.log('📋 Scoreboard data loaded:', scoreboardResponse.data);
      
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
          <div className="flex items-center justify-center">
            {/* Event Logo */}
            {event?.logo_url && (
              <img
                src={getImageUrl(event.logo_url)}
                alt={`${event.name} Logo`}
                className="w-32 h-32 rounded-full object-cover border-2 border-white/20 mr-3"
              />
            )}
            <h2 className="text-xl text-gray-300">{event?.name}</h2>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {scoreboard.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-xl text-gray-400">Noch keine Teams angemeldet</p>
            </div>
          ) : (
            scoreboard.map((team, index) => (
              <div
                key={team.id}
                className={`scoreboard-entry rounded-xl border p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl backdrop-blur-sm ${getRankClass(index + 1)}`}
              >
                <div className="text-center">
                  {/* Rank Icon */}
                  <div className="flex justify-center mb-4">
                    {getRankIcon(index + 1)}
                  </div>
                  
                  {/* Team Logo */}
                  <div className="flex justify-center mb-4">
                    {team.logo_url ? (
                      <img
                        src={getImageUrl(team.logo_url)}
                        alt={`${team.name} Logo`}
                        className="w-20 h-20 rounded-full object-cover border-3 border-white/30 shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 border-3 border-white/30 shadow-lg flex items-center justify-center">
                        <Users className="w-8 h-8 text-white/70" />
                      </div>
                    )}
                  </div>
                  
                  {/* Team Name */}
                  <h3 className="text-xl font-bold text-white mb-2 truncate">
                    {team.name}
                  </h3>
                  
                  {/* Points */}
                  <div className="mb-3">
                    <div className="text-3xl font-bold text-white">
                      {team.total_points || 0}
                    </div>
                    <div className="text-sm text-gray-400">Punkte</div>
                  </div>
                  
                  {/* Questions Solved */}
                  <div className="flex items-center justify-center space-x-2 text-gray-300">
                    <Target className="w-4 h-4" />
                    <span className="text-sm">
                      {team.questions_solved || 0} Rätsel gelöst
                    </span>
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