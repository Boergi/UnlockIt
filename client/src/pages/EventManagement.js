import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus, Edit, Trash2, Calendar, Users, HelpCircle, Eye, Settings } from 'lucide-react';

const EventManagement = () => {
  const [events, setEvents] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    start_time: '',
    end_time: '',
    use_random_order: false,
    team_registration_open: true,
    access_code: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [eventsResponse, questionsResponse] = await Promise.all([
        axios.get('/api/events'),
        axios.get('/api/questions')
      ]);
      setEvents(eventsResponse.data);
      setQuestions(questionsResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      start_time: '',
      end_time: '',
      use_random_order: false,
      team_registration_open: true,
      access_code: ''
    });
    setEditingEvent(null);
    setShowCreateForm(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.start_time) {
      alert('Name und Startzeit sind erforderlich');
      return;
    }

    try {
      if (editingEvent) {
        await axios.put(`/api/events/${editingEvent.id}`, formData);
        alert('Event erfolgreich aktualisiert!');
      } else {
        await axios.post('/api/events', formData);
        alert('Event erfolgreich erstellt!');
      }

      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Fehler beim Speichern des Events: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (event) => {
    setFormData({
      name: event.name,
      start_time: event.start_time ? new Date(event.start_time).toISOString().slice(0, 16) : '',
      end_time: event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : '',
      use_random_order: event.use_random_order || false,
      team_registration_open: event.team_registration_open !== false,
      access_code: event.access_code || ''
    });
    setEditingEvent(event);
    setShowCreateForm(true);
  };

  const handleDelete = async (eventId) => {
    if (window.confirm('Sind Sie sicher, dass Sie dieses Event löschen möchten?')) {
      try {
        await axios.delete(`/api/events/${eventId}`);
        alert('Event erfolgreich gelöscht!');
        fetchData();
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Fehler beim Löschen des Events');
      }
    }
  };

  const handleManageQuestions = async (event) => {
    try {
      const response = await axios.get(`/api/events/${event.id}/questions`);
      setSelectedQuestions(response.data.map(q => q.id));
      setShowQuestionSelector(event);
    } catch (error) {
      console.error('Error fetching event questions:', error);
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
    try {
      await axios.post(`/api/events/${showQuestionSelector.id}/questions`, {
        questionIds: selectedQuestions
      });
      alert('Fragen erfolgreich zugeordnet!');
      setShowQuestionSelector(null);
      fetchData();
    } catch (error) {
      console.error('Error saving questions:', error);
      alert('Fehler beim Speichern der Fragen');
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
            onClick={() => setShowCreateForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Neues Event erstellen
          </button>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingEvent ? 'Event bearbeiten' : 'Neues Event erstellen'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">Event Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 placeholder-gray-400"
                    placeholder="z.B. Escape Room Challenge 2024"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white font-medium mb-2">Zugangs-Code</label>
                  <input
                    type="text"
                    name="access_code"
                    value={formData.access_code}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 placeholder-gray-400"
                    placeholder="Optional - für private Events"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">Startzeit *</label>
                  <input
                    type="datetime-local"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white font-medium mb-2">Endzeit</label>
                  <input
                    type="datetime-local"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    name="use_random_order"
                    checked={formData.use_random_order}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  Zufällige Fragenreihenfolge
                </label>
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    name="team_registration_open"
                    checked={formData.team_registration_open}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  Team-Registrierung offen
                </label>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  {editingEvent ? 'Aktualisieren' : 'Erstellen'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Events List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Alle Events ({events.length})
          </h2>
          
          {events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Noch keine Events erstellt.</p>
              <button
                onClick={() => setShowCreateForm(true)}
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
                    <div className="flex-1">
                      <h3 className="text-white font-medium text-lg mb-2">{event.name}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          <span>Start: {new Date(event.start_time).toLocaleString('de-DE')}</span>
                        </div>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          <span className={event.team_registration_open ? 'text-green-400' : 'text-red-400'}>
                            {event.team_registration_open ? 'Registrierung offen' : 'Registrierung geschlossen'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <HelpCircle className="w-4 h-4 mr-1" />
                          <span>Fragen: {/* TODO: Show question count */}</span>
                        </div>
                      </div>
                      {event.access_code && (
                        <div className="mt-2 text-sm text-purple-400">
                          🔒 Zugangs-Code: {event.access_code}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleManageQuestions(event)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center"
                        title="Fragen verwalten"
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Fragen
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
                        to={`/scoreboard/${event.id}`}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center"
                        title="Scoreboard anzeigen"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Scoreboard
                      </Link>
                      <button
                        onClick={() => handleDelete(event.id)}
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
              <h2 className="text-2xl font-bold text-white mb-4">
                Fragen für "{showQuestionSelector.name}" auswählen
              </h2>
              
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
      </div>
    </div>
  );
};

export default EventManagement; 