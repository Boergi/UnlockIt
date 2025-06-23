import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import { Plus, Edit, Trash2, Calendar, Users, HelpCircle, Eye, Settings, X, UserPlus, QrCode, Copy, Share2 } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import EventModal from '../components/EventModal';
import { useSocket } from '../contexts/SocketContext';
import { formatDateTimeDisplay } from '../utils/dateUtils';

const EventManagement = () => {
  const location = useLocation();
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [events, setEvents] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, eventId: null });
  
  // Team Management State
  const [showTeamManager, setShowTeamManager] = useState(null);
  const [teams, setTeams] = useState([]);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamConfirmModal, setTeamConfirmModal] = useState({ isOpen: false, teamId: null });
  const [aiConfig, setAiConfig] = useState({ aiEnabled: false });
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [logoOptions, setLogoOptions] = useState([]);
  const [showLogoSelector, setShowLogoSelector] = useState(false);
  const [currentTeamForLogo, setCurrentTeamForLogo] = useState(null);
  const [generationProgress, setGenerationProgress] = useState({ progress: 0, total: 3, message: '', currentStyle: '' });
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    logo_url: '',
    generate_ai_logo: false
  });
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);
  const [selectedTeamForQr, setSelectedTeamForQr] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  


  useEffect(() => {
    fetchData();
    fetchAiConfig();
    
    // Handle URL-based actions
    if (location.pathname.includes('/new')) {
      setShowEventModal(true);
    } else if (eventId) {
      // Load event for editing
      loadEventForEditing(eventId);
    }
  }, [location.pathname, eventId]);

  // Socket.IO listeners for live logo updates
  useEffect(() => {
    if (!socket) return;

    const handleLogoStatus = (data) => {
      setGenerationProgress({
        progress: data.progress || 0,
        total: data.total || 3,
        message: data.message || '',
        currentStyle: data.currentStyle || ''
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

    const loadEventForEditing = async (id) => {
    try {
      const response = await axios.get(`/api/events/${id}`);
      const event = response.data;
      
      setEditingEvent(event);
      setShowEventModal(true);
    } catch (error) {
      console.error('Error loading event for editing:', error);
      toast.error('Fehler beim Laden des Events');
    }
  };

  const fetchData = async () => {
    try {
      const [eventsResponse, questionsResponse] = await Promise.all([
        axios.get('/api/events'),
        axios.get('/api/questions')
      ]);
      
      // Fetch stats for each event
      const eventsWithStats = await Promise.all(
        eventsResponse.data.map(async (event) => {
          try {
            const statsResponse = await axios.get(`/api/events/${event.id}/stats`);
            return {
              ...event,
              teamCount: statsResponse.data.teams || 0,
              questionCount: statsResponse.data.questions || 0
            };
          } catch (error) {
            console.error('Error fetching stats for event:', event.id, error);
            return {
              ...event,
              teamCount: 0,
              questionCount: 0
            };
          }
        })
      );
      
      setEvents(eventsWithStats);
      setQuestions(questionsResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const fetchAiConfig = async () => {
    try {
      const response = await axios.get('/api/teams/ai-config');
      setAiConfig(response.data);
    } catch (error) {
      console.error('Error fetching AI config:', error);
    }
  };



  const handleEdit = (event) => {
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleDeleteClick = (eventId) => {
    setConfirmModal({
      isOpen: true,
      eventId,
      title: 'Event löschen',
      message: 'Sind Sie sicher, dass Sie dieses Event löschen möchten? Alle zugehörigen Teams und Fortschritte werden ebenfalls gelöscht.'
    });
  };

  const handleDeleteConfirm = async () => {
    const { eventId } = confirmModal;
    const loadingToast = toast.loading('Event wird gelöscht...');

    try {
      await axios.delete(`/api/events/${eventId}`);
      toast.success('Event erfolgreich gelöscht!', { id: loadingToast });
      fetchData();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Fehler beim Löschen des Events', { id: loadingToast });
    } finally {
      setConfirmModal({ isOpen: false, eventId: null });
    }
  };

  const handleManageQuestions = async (event) => {
    try {
      const response = await axios.get(`/api/events/${event.id}/questions/admin`);
      setSelectedQuestions(response.data.map(q => q.id));
      setShowQuestionSelector(event);
    } catch (error) {
      console.error('Error fetching event questions:', error);
      toast.error('Fehler beim Laden der Event-Fragen');
    }
  };

  const handleQuestionToggle = (questionId) => {
    setSelectedQuestions(prev => 
      prev.includes(questionId) 
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleSaveQuestions = async () => {
    const loadingToast = toast.loading('Fragen werden gespeichert...');

    try {
      await axios.post(`/api/events/${showQuestionSelector.id}/questions`, {
        questionIds: selectedQuestions
      });
      toast.success('Fragen erfolgreich zugeordnet!', { id: loadingToast });
      setShowQuestionSelector(null);
      fetchData();
    } catch (error) {
      console.error('Error saving questions:', error);
      toast.error('Fehler beim Speichern der Fragen', { id: loadingToast });
    }
  };

  // Team Management Functions
  const handleManageTeams = async (event) => {
    try {
      const response = await axios.get(`/api/teams/event/${event.id}`);
      setTeams(response.data);
      setShowTeamManager(event);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Fehler beim Laden der Teams');
    }
  };

  const resetTeamForm = () => {
    setTeamFormData({
      name: '',
      logo_url: '',
      generate_ai_logo: false
    });
    setEditingTeam(null);
    setShowTeamForm(false);
    setLogoOptions([]);
    setShowLogoSelector(false);
    setCurrentTeamForLogo(null);
  };

  const handleTeamInputChange = (e) => {
    const { name, value } = e.target;
    setTeamFormData({
      ...teamFormData,
      [name]: value
    });
  };

  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    
    if (!teamFormData.name) {
      toast.error('Team-Name ist erforderlich');
      return;
    }

    // Check if AI logo generation is requested but AI is not enabled
    if (teamFormData.generate_ai_logo && !aiConfig.aiEnabled) {
      toast.error('AI-Logo-Generierung ist nicht verfügbar');
      return;
    }

    const loadingMessage = editingTeam 
      ? 'Team wird aktualisiert...' 
      : (teamFormData.generate_ai_logo ? 'Team wird erstellt und 3 Logo-Optionen generiert...' : 'Team wird erstellt...');
    
    const loadingToast = toast.loading(loadingMessage);
    setGeneratingLogo(teamFormData.generate_ai_logo);

    try {
      if (editingTeam) {
        await axios.put(`/api/teams/${editingTeam.id}`, teamFormData);
        const successMessage = teamFormData.generate_ai_logo && !editingTeam.ai_logo_generated
          ? 'Team erfolgreich aktualisiert und Logo-Optionen generiert!'
          : 'Team erfolgreich aktualisiert!';
        toast.success(successMessage, { id: loadingToast });
      } else {
        const response = await axios.post('/api/teams/admin/create', {
          ...teamFormData,
          event_id: showTeamManager.id
        });
        
        if (teamFormData.generate_ai_logo) {
          // If AI logo was generated, show logo selection
          toast.success('Team erstellt! Wähle jetzt dein Logo aus.', { id: loadingToast });
          setCurrentTeamForLogo(response.data);
          await generateLogoOptions(teamFormData.name, showTeamManager.name);
        } else {
          toast.success('Team erfolgreich erstellt!', { id: loadingToast });
        }
      }

      if (!teamFormData.generate_ai_logo || editingTeam) {
        resetTeamForm();
        handleManageTeams(showTeamManager); // Refresh teams
      }
    } catch (error) {
      console.error('Error saving team:', error);
      if (error.response?.status === 409) {
        toast.error('Ein Team mit diesem Namen existiert bereits für dieses Event', { id: loadingToast });
      } else {
        toast.error('Fehler beim Speichern des Teams: ' + (error.response?.data?.error || error.message), { id: loadingToast });
      }
    } finally {
      setGeneratingLogo(false);
    }
  };

  const generateLogoOptions = async (teamName, eventName) => {
    try {
      // Clear previous logos and show selector immediately
      setLogoOptions([]);
      setGenerationProgress({ progress: 0, total: 3, message: 'Starte Logo-Generierung...', currentStyle: '' });
      setShowLogoSelector(true);
      setShowTeamForm(false);

      const response = await axios.post('/api/teams/generate-logo', {
        teamName,
        eventName,
        socketId: socket?.id
      });
      
      // Final logos will be set via socket events
      console.log('Logo generation started:', response.data.message);
    } catch (error) {
      console.error('Error generating logo options:', error);
      toast.error('Fehler beim Generieren der Logo-Optionen: ' + (error.response?.data?.error || error.message));
      setShowLogoSelector(false);
      setShowTeamForm(true);
    }
  };

  const handleLogoSelect = async (logoUrl) => {
    if (!currentTeamForLogo) return;

    const loadingToast = toast.loading('Logo wird ausgewählt...');

    try {
      await axios.post('/api/teams/select-logo', {
        teamId: currentTeamForLogo.uuid || currentTeamForLogo.id,
        logoUrl: logoUrl
      });

      toast.success('Logo erfolgreich ausgewählt!', { id: loadingToast });
      resetTeamForm();
      handleManageTeams(showTeamManager); // Refresh teams
    } catch (error) {
      console.error('Error selecting logo:', error);
      toast.error('Fehler beim Auswählen des Logos: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  const handleTeamEdit = (team) => {
    setTeamFormData({
      name: team.name,
      logo_url: team.logo_url || '',
      generate_ai_logo: team.generate_ai_logo || false
    });
    setEditingTeam(team);
    setShowTeamForm(true);
  };

  const handleTeamDeleteClick = (teamId) => {
    setTeamConfirmModal({
      isOpen: true,
      teamId,
      title: 'Team löschen',
      message: 'Sind Sie sicher, dass Sie dieses Team löschen möchten? Alle Fortschritte des Teams werden ebenfalls gelöscht.'
    });
  };

  const handleTeamDeleteConfirm = async () => {
    const { teamId } = teamConfirmModal;
    const loadingToast = toast.loading('Team wird gelöscht...');

    try {
      await axios.delete(`/api/teams/${teamId}`);
      toast.success('Team erfolgreich gelöscht!', { id: loadingToast });
      handleManageTeams(showTeamManager); // Refresh teams
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('Fehler beim Löschen des Teams', { id: loadingToast });
    } finally {
      setTeamConfirmModal({ isOpen: false, teamId: null });
    }
  };

  const generateTeamQrCode = async (team, event) => {
    try {
      // Use UUIDs if available, fall back to IDs
      const teamIdentifier = team?.uuid || team?.id;
      const eventIdentifier = event?.uuid || event?.id;
      const teamPageUrl = `${window.location.origin}/team/${teamIdentifier}/event/${eventIdentifier}`;
      const qrCodeDataUrl = await QRCode.toDataURL(teamPageUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(qrCodeDataUrl);
      setSelectedTeamForQr({ ...team, event });
      setShowQrCodeModal(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Fehler beim Generieren des QR-Codes');
    }
  };

  const copyTeamUrl = async (team, event) => {
    // Use UUIDs if available, fall back to IDs
    const teamIdentifier = team?.uuid || team?.id;
    const eventIdentifier = event?.uuid || event?.id;
    const teamPageUrl = `${window.location.origin}/team/${teamIdentifier}/event/${eventIdentifier}`;
    try {
      await navigator.clipboard.writeText(teamPageUrl);
      toast.success('Team-Link kopiert!');
    } catch (error) {
      console.error('Error copying URL:', error);
      toast.error('Fehler beim Kopieren');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Lade Events...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link to="/admin/dashboard" className="text-blue-400 hover:text-blue-300 mb-2 inline-block">
              ← Zurück zum Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-white">Event Management</h1>
            <p className="text-gray-300 mt-2">
              Erstellen und verwalten Sie Events und ordnen Sie Fragen aus dem Katalog zu.
            </p>
          </div>
          <button
            onClick={() => setShowEventModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Neues Event erstellen
          </button>
        </div>

        {/* Event Modal */}
        <EventModal
          isOpen={showEventModal}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
            if (eventId) {
              navigate('/admin/events');
            }
          }}
          event={editingEvent}
          onSave={(savedEvent) => {
            fetchData();
          }}
        />

        {/* Events List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Alle Events ({events.length})
          </h2>
          
          {events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Noch keine Events erstellt.</p>
              <button
                onClick={() => setShowEventModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Erstes Event erstellen
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-4 flex-1">
                      {event.logo_url && (
                        <img
                          src={event.logo_url}
                          alt={`${event.name} Logo`}
                          className="w-12 h-12 object-cover rounded-lg border border-white/20"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-white font-medium text-lg">{event.name}</h3>
                          {event.ai_logo_generated && (
                            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
                              AI Logo
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-400">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            <span>Start: {formatDateTimeDisplay(event.start_time)}</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            <span className={event.team_registration_open ? 'text-green-400' : 'text-red-400'}>
                              {event.team_registration_open ? 'Registrierung offen' : 'Registrierung geschlossen'}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            <span>Teams: {event.teamCount || 0}</span>
                          </div>
                          <div className="flex items-center">
                            <HelpCircle className="w-4 h-4 mr-1" />
                            <span>Fragen: {event.questionCount || 0}</span>
                          </div>
                        </div>
                        {event.access_code && (
                          <div className="mt-2 text-sm text-purple-400">
                            🔒 Zugangs-Code: {event.access_code}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-4">
                      <button
                        onClick={() => handleManageQuestions(event)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center"
                        title="Fragen verwalten"
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Fragen
                      </button>
                      <button
                        onClick={() => handleManageTeams(event)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center"
                        title="Teams verwalten"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Teams
                      </button>
                      <button
                        onClick={() => handleEdit(event)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center"
                        title="Bearbeiten"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Bearbeiten
                      </button>
                      <Link
                        to={`/scoreboard/${event.uuid || event.id}`}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center"
                        title="Scoreboard anzeigen"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Scoreboard
                      </Link>
                      <button
                        onClick={() => handleDeleteClick(event.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question Selector Modal */}
        {showQuestionSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                  Fragen für "{showQuestionSelector.name}" auswählen
                </h2>
                <button
                  onClick={() => setShowQuestionSelector(null)}
                  className="text-gray-400 hover:text-white p-1"
                  title="Schließen"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-300 mb-2">
                  Wählen Sie die Fragen aus, die in diesem Event verwendet werden sollen:
                </p>
                <p className="text-sm text-gray-400">
                  {selectedQuestions.length} von {questions.length} Fragen ausgewählt
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {questions.map((question) => (
                  <div 
                    key={question.id} 
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedQuestions.includes(question.id)
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                    }`}
                    onClick={() => handleQuestionToggle(question.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">{question.title}</h3>
                        {question.description && (
                          <p className="text-gray-400 text-sm mb-2 line-clamp-2">
                            {question.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-gray-400">
                          <span className={`px-2 py-1 rounded ${
                            question.difficulty === 'easy' ? 'bg-green-600' :
                            question.difficulty === 'hard' ? 'bg-red-600' : 'bg-yellow-600'
                          }`}>
                            {question.difficulty === 'easy' ? 'Leicht' :
                             question.difficulty === 'hard' ? 'Schwer' : 'Mittel'}
                          </span>
                          <span>{Math.round(question.time_limit_seconds / 60)} Min</span>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        selectedQuestions.includes(question.id)
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-400'
                      }`}>
                        {selectedQuestions.includes(question.id) && (
                          <span className="text-white text-sm">✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowQuestionSelector(null)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveQuestions}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Fragen speichern ({selectedQuestions.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Team Management Modal */}
        {showTeamManager && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                  Teams für "{showTeamManager.name}" verwalten
                </h2>
                <button
                  onClick={() => setShowTeamManager(null)}
                  className="text-gray-400 hover:text-white p-1"
                  title="Schließen"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-gray-300">
                    Verwalten Sie Teams für dieses Event. Teams können manuell erstellt werden, wenn die Registrierung geschlossen ist.
                  </p>
                  <button
                    onClick={() => setShowTeamForm(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Team hinzufügen
                  </button>
                </div>
              </div>

              {/* Teams List */}
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-lg font-bold text-white mb-4">
                  Teams ({teams.length})
                </h3>
                
                {teams.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">Noch keine Teams für dieses Event.</p>
                    <button
                      onClick={() => setShowTeamForm(true)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Erstes Team erstellen
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                         {teams.map((team) => (
                       <div key={team.id} className="bg-white/5 rounded-lg p-4">
                         <div className="flex justify-between items-start mb-3">
                           <div className="flex items-center">
                             {team.logo_url && (
                               <div className="relative mr-2">
                                 <img 
                                   src={`http://localhost:3001${team.logo_url}`}
                                   alt={`${team.name} Logo`}
                                   className="w-8 h-8 rounded-full object-cover"
                                   onError={(e) => { e.target.style.display = 'none' }}
                                 />
                                 {team.ai_logo_generated && (
                                   <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center">
                                     <span className="text-xs text-white">✨</span>
                                   </div>
                                 )}
                               </div>
                             )}
                             <div>
                               <h4 className="text-white font-medium">{team.name}</h4>
                               {team.ai_logo_generated && (
                                 <span className="text-xs text-purple-400">🎨 AI-Logo</span>
                               )}
                             </div>
                           </div>
                           <div className="flex space-x-1">
                             <button
                               onClick={() => generateTeamQrCode(team, showTeamManager)}
                               className="text-green-400 hover:text-green-300 p-1"
                               title="QR-Code generieren"
                             >
                               <QrCode className="w-4 h-4" />
                             </button>
                             <button
                               onClick={() => copyTeamUrl(team, showTeamManager)}
                               className="text-purple-400 hover:text-purple-300 p-1"
                               title="Link kopieren"
                             >
                               <Copy className="w-4 h-4" />
                             </button>
                             <button
                               onClick={() => handleTeamEdit(team)}
                               className="text-blue-400 hover:text-blue-300 p-1"
                               title="Team bearbeiten"
                             >
                               <Edit className="w-4 h-4" />
                             </button>
                             <button
                               onClick={() => handleTeamDeleteClick(team.id)}
                               className="text-red-400 hover:text-red-300 p-1"
                               title="Team löschen"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         </div>
                         <div className="text-sm text-gray-400">
                           <p>Erstellt: {new Date(team.created_at).toLocaleDateString('de-DE')}</p>
                           {team.updated_at !== team.created_at && (
                             <p>Bearbeitet: {new Date(team.updated_at).toLocaleDateString('de-DE')}</p>
                           )}
                         </div>
                       </div>
                     ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowTeamManager(null)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Team Form Modal */}
        {showTeamForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">
                  {editingTeam ? 'Team bearbeiten' : 'Neues Team erstellen'}
                </h3>
                <button
                  onClick={resetTeamForm}
                  className="text-gray-400 hover:text-white p-1"
                  title="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleTeamSubmit} className="space-y-4">
                <div>
                  <label className="block text-white font-medium mb-2">Team Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={teamFormData.name}
                    onChange={handleTeamInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 placeholder-gray-400"
                    placeholder="z.B. Team Alpha"
                    required
                    disabled={generatingLogo}
                  />
                </div>

                {/* Logo Section */}
                <div>
                  <label className="block text-white font-medium mb-2">Team Logo</label>
                  
                  {aiConfig.aiEnabled ? (
                    <div className="space-y-3">
                      {/* AI Logo Generation Option */}
                      {(!editingTeam || !editingTeam.ai_logo_generated) && (
                        <label className="flex items-center text-white">
                          <input
                            type="checkbox"
                            name="generate_ai_logo"
                            checked={teamFormData.generate_ai_logo}
                            onChange={handleTeamInputChange}
                            className="mr-2"
                            disabled={generatingLogo || (editingTeam && editingTeam.ai_logo_generated)}
                          />
                          <span className="flex items-center">
                            🎨 3 AI-Logo Optionen generieren
                            {generatingLogo && <span className="ml-2 text-yellow-400">Generiert...</span>}
                          </span>
                        </label>
                      )}
                      
                      {editingTeam && editingTeam.ai_logo_generated && (
                        <div className="text-green-400 text-sm">
                          ✅ AI-Logo bereits generiert
                        </div>
                      )}

                      {/* Manual Logo URL (only if not using AI) */}
                      {!teamFormData.generate_ai_logo && (
                        <div>
                          <input
                            type="url"
                            name="logo_url"
                            value={teamFormData.logo_url}
                            onChange={handleTeamInputChange}
                            className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 placeholder-gray-400"
                            placeholder="https://example.com/logo.png"
                            disabled={generatingLogo}
                          />
                          <p className="text-gray-400 text-sm mt-1">
                            Optional - URL zu einem Team-Logo
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* No AI Available - Name Only */
                    <div className="text-gray-400 text-sm">
                      Nur Team-Name verfügbar (AI-Logo-Generierung nicht aktiviert)
                    </div>
                  )}
                </div>

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={generatingLogo}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      generatingLogo 
                        ? 'bg-gray-500 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
                  >
                    {generatingLogo 
                      ? '🎨 Generiert 3 Optionen...' 
                      : (editingTeam ? 'Aktualisieren' : 'Erstellen')
                    }
                  </button>
                  <button
                    type="button"
                    onClick={resetTeamForm}
                    disabled={generatingLogo}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Logo Selection Modal */}
        {showLogoSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    Logo auswählen für "{currentTeamForLogo?.name}"
                  </h3>
                  <p className="text-gray-300 mt-1">
                    Wähle eines der generierten Logos aus. Kosten: ~12 Cent (3 × 4 Cent)
                  </p>
                </div>
                <button
                  onClick={resetTeamForm}
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
                            src={`http://localhost:3001${option.url}`}
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
                                {['Modern & Professional', 'Dynamic & Bold', 'Minimalist & Clean'][id - 1]}
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
                          {option ? option.style : ['Modern & Professional', 'Dynamic & Bold', 'Minimalist & Clean'][id - 1]}
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
                  onClick={resetTeamForm}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Confirmation Modal */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ isOpen: false, eventId: null })}
          onConfirm={handleDeleteConfirm}
          title="Event löschen"
          message="Sind Sie sicher, dass Sie dieses Event löschen möchten? Alle zugehörigen Teams und Fortschritte werden ebenfalls gelöscht."
          confirmText="Löschen"
          cancelText="Abbrechen"
          variant="danger"
        />

        {/* Team Confirmation Modal */}
        <ConfirmationModal
          isOpen={teamConfirmModal.isOpen}
          onClose={() => setTeamConfirmModal({ isOpen: false, teamId: null })}
          onConfirm={handleTeamDeleteConfirm}
          title="Team löschen"
          message="Sind Sie sicher, dass Sie dieses Team löschen möchten? Alle Fortschritte des Teams werden ebenfalls gelöscht."
          confirmText="Löschen"
          cancelText="Abbrechen"
          variant="danger"
        />

        {/* QR Code Modal */}
        {showQrCodeModal && selectedTeamForQr && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Team QR-Code</h3>
                <button
                  onClick={() => setShowQrCodeModal(false)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X className="w-6 h-6" />
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
                    QR-Code für Team-Seite
                  </p>
                  
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-white font-medium mb-1">Team: {selectedTeamForQr.name}</p>
                    <p className="text-gray-300 text-sm">Event: {selectedTeamForQr.event?.name}</p>
                    <p className="text-gray-400 text-xs mt-2">
                      {window.location.origin}/team/{selectedTeamForQr.uuid || selectedTeamForQr.id}/event/{selectedTeamForQr.event?.uuid || selectedTeamForQr.event?.id}
                    </p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyTeamUrl(selectedTeamForQr, selectedTeamForQr.event)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Link kopieren</span>
                    </button>
                    <button
                      onClick={() => setShowQrCodeModal(false)}
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

export default EventManagement; 