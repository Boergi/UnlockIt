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
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const joinEvent = (eventId) => {
    if (socket) {
      socket.emit('join-event', eventId);
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

  const value = {
    socket,
    connected,
    joinEvent,
    emitTeamJoined,
    emitAnswerSubmitted,
    onTeamUpdate,
    onScoreboardUpdate
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 