import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SocketProvider } from './contexts/SocketContext';
import { AuthProvider } from './contexts/AuthContext';

// Components
import HomePage from './pages/HomePage';
import TeamRegistration from './pages/TeamRegistration';
import GamePlay from './pages/GamePlay';
import Scoreboard from './pages/Scoreboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import EventManagement from './pages/EventManagement';
import QuestionManagement from './pages/QuestionManagement';
import LiveModeration from './pages/LiveModeration';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <div className="App min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/join/:eventId" element={<TeamRegistration />} />
              <Route path="/play/:teamId" element={<GamePlay />} />
              <Route path="/scoreboard/:eventId" element={<Scoreboard />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/events" element={
                <ProtectedRoute>
                  <EventManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/events/new" element={
                <ProtectedRoute>
                  <EventManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/events/:id" element={
                <ProtectedRoute>
                  <EventManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/questions" element={
                <ProtectedRoute>
                  <QuestionManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/questions/:eventId" element={
                <ProtectedRoute>
                  <QuestionManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/moderate/:eventId" element={
                <ProtectedRoute>
                  <LiveModeration />
                </ProtectedRoute>
              } />
            </Routes>
            
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App; 