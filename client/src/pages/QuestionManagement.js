import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';

const QuestionManagement = () => {
  const { eventId } = useParams(); // Optional eventId from URL
  const [questions, setQuestions] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [formData, setFormData] = useState({
    event_id: '',
    question_text: '',
    solution: '',
    difficulty_level: 1,
    time_limit_minutes: 10,
    tip1: '',
    tip2: '',
    image: null
  });

  useEffect(() => {
    fetchData();
    // If eventId is provided in URL, set it as selected
    if (eventId) {
      setSelectedEventId(eventId);
    }
  }, [eventId]);

  const fetchData = async () => {
    try {
      const [questionsResponse, eventsResponse] = await Promise.all([
        axios.get('/api/questions'),
        axios.get('/api/events')
      ]);
      setQuestions(questionsResponse.data);
      setEvents(eventsResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      await axios.post('/api/questions', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowCreateForm(false);
      setFormData({
        event_id: '',
        question_text: '',
        solution: '',
        difficulty_level: 1,
        time_limit_minutes: 10,
        tip1: '',
        tip2: '',
        image: null
      });
      fetchData(); // Refresh data
      alert('Frage erfolgreich erstellt!');
    } catch (error) {
      console.error('Error creating question:', error);
      alert('Fehler beim Erstellen der Frage: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (questionId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diese Frage löschen möchten?')) {
      try {
        await axios.delete(`/api/questions/${questionId}`);
        fetchData(); // Refresh data
        alert('Frage erfolgreich gelöscht!');
      } catch (error) {
        console.error('Error deleting question:', error);
        alert('Fehler beim Löschen der Frage');
      }
    }
  };

  const filteredQuestions = selectedEventId 
    ? questions.filter(q => q.event_id.toString() === selectedEventId)
    : questions;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Lade Fragen...</div>
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
                         <h1 className="text-3xl font-bold text-white">
               {eventId ? `Fragen für Event verwalten` : 'Alle Fragen verwalten'}
             </h1>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            ➕ Neue Frage erstellen
          </button>
        </div>

        {/* Event Filter */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
          <label className="block text-white font-medium mb-2">Nach Event filtern:</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full md:w-auto bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
          >
            <option value="">Alle Events</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>

        {/* Questions List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Fragen ({filteredQuestions.length})
          </h2>
          
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">
                {selectedEventId ? 'Keine Fragen für dieses Event gefunden.' : 'Noch keine Fragen erstellt.'}
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Erste Frage erstellen
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((question) => (
                <div key={question.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                                             <h3 className="text-white font-medium mb-2">{question.title}</h3>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
                         <div>
                           <span className="font-medium">Event:</span> {events.find(e => e.id === question.event_id)?.name || 'Unbekannt'}
                         </div>
                         <div>
                           <span className="font-medium">Schwierigkeit:</span> {question.difficulty}
                         </div>
                         <div>
                           <span className="font-medium">Zeitlimit:</span> {Math.round(question.time_limit_seconds / 60)} Min
                         </div>
                       </div>
                       <div className="mt-2 text-sm text-gray-400">
                         <span className="font-medium">Lösung:</span> {question.solution}
                       </div>
                       {question.image_path && (
                         <div className="mt-2 text-sm text-green-400">
                           📷 Bild vorhanden: {question.image_path}
                         </div>
                       )}
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleDelete(question.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Question Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Neue Frage erstellen</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white font-medium mb-2">Event *</label>
                  <select
                    name="event_id"
                    value={formData.event_id}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                  >
                    <option value="">Event auswählen</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Frage *</label>
                  <textarea
                    name="question_text"
                    value={formData.question_text}
                    onChange={handleInputChange}
                    required
                    rows="3"
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                    placeholder="Beschreiben Sie die Aufgabe oder das Rätsel..."
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Lösung *</label>
                  <input
                    type="text"
                    name="solution"
                    value={formData.solution}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                    placeholder="Die korrekte Antwort"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2">Schwierigkeit (1-5)</label>
                    <input
                      type="number"
                      name="difficulty_level"
                      value={formData.difficulty_level}
                      onChange={handleInputChange}
                      min="1"
                      max="5"
                      className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-white font-medium mb-2">Zeitlimit (Minuten)</label>
                    <input
                      type="number"
                      name="time_limit_minutes"
                      value={formData.time_limit_minutes}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Tipp 1 (optional)</label>
                  <input
                    type="text"
                    name="tip1"
                    value={formData.tip1}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                    placeholder="Erster Hinweis"
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Tipp 2 (optional)</label>
                  <input
                    type="text"
                    name="tip2"
                    value={formData.tip2}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                    placeholder="Zweiter Hinweis"
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Bild (optional)</label>
                  <input
                    type="file"
                    name="image"
                    onChange={handleInputChange}
                    accept="image/*"
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Frage erstellen
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionManagement; 