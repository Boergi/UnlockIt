import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');
    
    newSocket.on('connect', () => {
      console.log('🔌 Connected to server, Socket ID:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
      setConnected(false);
    });

    // Add general event listener to see all incoming events
    newSocket.onAny((eventName, ...args) => {
      console.log('🔌 Socket event received:', eventName, args);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const joinEvent = (eventId) => {
    if (socket) {
      console.log('🔌 Joining event:', eventId, 'Socket connected:', socket.connected);
      socket.emit('join-event', eventId);
    } else {
      console.log('🔌 Cannot join event - no socket connection');
    }
  };

  const emitTeamJoined = (data) => {
    if (socket) {
      socket.emit('team-joined', data);
    }
  };

  const emitAnswerSubmitted = (data) => {
    if (socket) {
      socket.emit('answer-submitted', data);
    }
  };

  const onTeamUpdate = (callback) => {
    if (socket) {
      socket.on('team-update', callback);
      return () => socket.off('team-update', callback);
    }
  };

  const onScoreboardUpdate = (callback) => {
    if (socket) {
      socket.on('scoreboard-update', callback);
      return () => socket.off('scoreboard-update', callback);
    }
  };

  const onTeamProgressUpdate = (callback) => {
    if (socket) {
      socket.on('team-progress-update', callback);
      return () => socket.off('team-progress-update', callback);
    }
  };

  const onEventStatsUpdate = (callback) => {
    if (socket) {
      socket.on('event-stats-update', callback);
      return () => socket.off('event-stats-update', callback);
    }
  };

  const requestLiveData = (type, params) => {
    if (socket) {
      console.log('🔌 Requesting live data:', type, params, 'Socket connected:', socket.connected);
      socket.emit('request-live-data', { type, params });
    } else {
      console.log('🔌 Cannot request live data - no socket connection');
    }
  };

  const onLiveDataUpdate = (callback) => {
    if (socket) {
      socket.on('live-data-update', (data) => {
        console.log('🔌 SocketContext: live-data-update received:', data);
        callback(data);
      });
      return () => socket.off('live-data-update', callback);
    }
  };

  const value = {
    socket,
    connected,
    joinEvent,
    emitTeamJoined,
    emitAnswerSubmitted,
    onTeamUpdate,
    onScoreboardUpdate,
    onTeamProgressUpdate,
    onEventStatsUpdate,
    requestLiveData,
    onLiveDataUpdate
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 