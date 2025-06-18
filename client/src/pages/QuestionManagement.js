import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Clock, Star, FileImage, X } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

const QuestionManagement = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, questionId: null });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    solution: '',
    difficulty: 'medium',
    time_limit_minutes: 10,
    tip_1: '',
    tip_2: '',
    image: null
  });

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await axios.get('/api/questions');
      setQuestions(response.data);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Fehler beim Laden der Fragen');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      solution: '',
      difficulty: 'medium',
      time_limit_minutes: 10,
      tip_1: '',
      tip_2: '',
      image: null
    });
    setEditingQuestion(null);
    setShowCreateForm(false);
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
    
    if (!formData.title || !formData.solution) {
      toast.error('Titel und Lösung sind erforderlich');
      return;
    }

    const loadingToast = toast.loading(editingQuestion ? 'Frage wird aktualisiert...' : 'Frage wird erstellt...');

    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      if (editingQuestion) {
        await axios.put(`/api/questions/${editingQuestion.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Frage erfolgreich aktualisiert!', { id: loadingToast });
      } else {
        await axios.post('/api/questions', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Frage erfolgreich erstellt!', { id: loadingToast });
      }

      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Fehler beim Speichern der Frage: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  const handleEdit = (question) => {
    setFormData({
      title: question.title,
      description: question.description || '',
      solution: question.solution,
      difficulty: question.difficulty,
      time_limit_minutes: Math.round(question.time_limit_seconds / 60),
      tip_1: question.tip_1 || '',
      tip_2: question.tip_2 || '',
      image: null
    });
    setEditingQuestion(question);
    setShowCreateForm(true);
  };

  const handleDeleteClick = (questionId) => {
    setConfirmModal({
      isOpen: true,
      questionId,
      title: 'Frage löschen',
      message: 'Sind Sie sicher, dass Sie diese Frage löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.'
    });
  };

  const handleDeleteConfirm = async () => {
    const { questionId } = confirmModal;
    const loadingToast = toast.loading('Frage wird gelöscht...');

    try {
      await axios.delete(`/api/questions/${questionId}`);
      toast.success('Frage erfolgreich gelöscht!', { id: loadingToast });
      fetchQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      if (error.response?.status === 400) {
        toast.error('Diese Frage kann nicht gelöscht werden, da sie in einem oder mehreren Events verwendet wird.', { id: loadingToast });
      } else {
        toast.error('Fehler beim Löschen der Frage', { id: loadingToast });
      }
    } finally {
      setConfirmModal({ isOpen: false, questionId: null });
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400';
      case 'hard': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getDifficultyText = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'Leicht';
      case 'medium': return 'Mittel';
      case 'hard': return 'Schwer';
      default: return difficulty;
    }
  };

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
            <h1 className="text-3xl font-bold text-white">Fragenkatalog verwalten</h1>
            <p className="text-gray-300 mt-2">
              Erstellen Sie Fragen unabhängig von Events. Diese können dann bei der Event-Erstellung zugeordnet werden.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Neue Frage erstellen
          </button>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                {editingQuestion ? 'Frage bearbeiten' : 'Neue Frage erstellen'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-white p-1"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">Titel *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 placeholder-gray-400"
                    placeholder="Kurzer Titel für die Frage"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white font-medium mb-2">Schwierigkeit</label>
                  <select
                    name="difficulty"
                    value={formData.difficulty}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                  >
                    <option value="easy">Leicht</option>
                    <option value="medium">Mittel</option>
                    <option value="hard">Schwer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Beschreibung</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 placeholder-gray-400"
                  placeholder="Detaillierte Beschreibung der Frage"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">Lösung *</label>
                  <input
                    type="text"
                    name="solution"
                    value={formData.solution}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 placeholder-gray-400"
                    placeholder="Die korrekte Antwort"
                    required
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
                    max="60"
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">Tipp 1</label>
                  <input
                    type="text"
                    name="tip_1"
                    value={formData.tip_1}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 placeholder-gray-400"
                    placeholder="Erster Hinweis (optional)"
                  />
                </div>
                <div>
                  <label className="block text-white font-medium mb-2">Tipp 2</label>
                  <input
                    type="text"
                    name="tip_2"
                    value={formData.tip_2}
                    onChange={handleInputChange}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 placeholder-gray-400"
                    placeholder="Zweiter Hinweis (optional)"
                  />
                </div>
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
                <p className="text-gray-400 text-sm mt-1">
                  Unterstützte Formate: JPG, PNG, GIF, WebP (max. 5MB)
                </p>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  {editingQuestion ? 'Aktualisieren' : 'Erstellen'}
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

        {/* Questions List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Alle Fragen ({questions.length})
          </h2>
          
          {questions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Noch keine Fragen erstellt.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Erste Frage erstellen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {questions.map((question) => (
                <div key={question.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-white font-medium text-lg">{question.title}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(question)}
                        className="text-blue-400 hover:text-blue-300 p-1"
                        title="Bearbeiten"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(question.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {question.description && (
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                      {question.description}
                    </p>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Schwierigkeit:</span>
                      <span className={`font-medium ${getDifficultyColor(question.difficulty)}`}>
                        <Star className="w-4 h-4 inline mr-1" />
                        {getDifficultyText(question.difficulty)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Zeitlimit:</span>
                      <span className="text-white">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {Math.round(question.time_limit_seconds / 60)} Min
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Lösung:</span>
                      <span className="text-green-400 font-medium">
                        {question.solution}
                      </span>
                    </div>
                    
                    {question.image_path && (
                      <div className="flex items-center text-purple-400">
                        <FileImage className="w-4 h-4 mr-1" />
                        <span className="text-sm">Bild vorhanden</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ isOpen: false, questionId: null })}
          onConfirm={handleDeleteConfirm}
          title="Frage löschen"
          message="Sind Sie sicher, dass Sie diese Frage löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden."
          confirmText="Löschen"
          cancelText="Abbrechen"
          variant="danger"
        />
      </div>
    </div>
  );
};

export default QuestionManagement; 