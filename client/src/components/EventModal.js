import React, { useState, useEffect } from 'react';
import { X, Calendar, Users, Lock, Palette, Upload, Wand2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatDateTimeLocal, convertLocalToUTC } from '../utils/dateUtils';

const EventModal = ({ isOpen, onClose, event = null, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    start_time: '',
    end_time: '',
    use_random_order: false,
    team_registration_open: true,
    access_code: '',
    logo_url: '',
    generate_ai_logo: false
  });
  const [loading, setLoading] = useState(false);
  const [aiConfig, setAiConfig] = useState({ aiEnabled: false });
  const [generatingLogo, setGeneratingLogo] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAiConfig();
      if (event) {
        // Editing existing event
        setFormData({
          name: event.name || '',
          start_time: formatDateTimeLocal(event.start_time),
          end_time: formatDateTimeLocal(event.end_time),
          use_random_order: event.use_random_order || false,
          team_registration_open: event.team_registration_open !== false,
          access_code: event.access_code || '',
          logo_url: event.logo_url || '',
          generate_ai_logo: false
        });
      } else {
        // Creating new event - reset form
        setFormData({
          name: '',
          start_time: '',
          end_time: '',
          use_random_order: false,
          team_registration_open: true,
          access_code: '',
          logo_url: '',
          generate_ai_logo: false
        });
      }
    }
  }, [isOpen, event]);

  const fetchAiConfig = async () => {
    try {
      const response = await axios.get('/api/events/ai-config');
      setAiConfig(response.data);
    } catch (error) {
      console.error('Error fetching AI config:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.start_time) {
      toast.error('Name und Startzeit sind erforderlich');
      return;
    }

    setLoading(true);
    setGeneratingLogo(formData.generate_ai_logo);
    
    const loadingMessage = formData.generate_ai_logo 
      ? (event ? 'Event wird aktualisiert und Logo generiert...' : 'Event wird erstellt und Logo generiert...')
      : (event ? 'Event wird aktualisiert...' : 'Event wird erstellt...');
    
    const loadingToast = toast.loading(loadingMessage);

    try {
      // Convert local datetime to UTC for API
      const apiData = {
        ...formData,
        start_time: convertLocalToUTC(formData.start_time),
        end_time: formData.end_time ? convertLocalToUTC(formData.end_time) : null
      };

      let response;
      if (event) {
        response = await axios.put(`/api/events/${event.id}`, apiData);
        const successMessage = formData.generate_ai_logo 
          ? 'Event erfolgreich aktualisiert und Logo generiert!' 
          : 'Event erfolgreich aktualisiert!';
        toast.success(successMessage, { id: loadingToast });
      } else {
        response = await axios.post('/api/events', apiData);
        const successMessage = formData.generate_ai_logo 
          ? 'Event erfolgreich erstellt und Logo generiert!' 
          : 'Event erfolgreich erstellt!';
        toast.success(successMessage, { id: loadingToast });
      }

      onSave(response.data);
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Fehler beim Speichern des Events: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    } finally {
      setLoading(false);
      setGeneratingLogo(false);
    }
  };

  const handleClose = () => {
    if (!loading && !generatingLogo) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {event ? 'Event bearbeiten' : 'Neues Event erstellen'}
          </h2>
          <button
            onClick={handleClose}
            disabled={loading || generatingLogo}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="z.B. Operations Event 2025"
              required
            />
          </div>

          {/* Logo Section */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Event Logo
            </label>
            
            {/* Current Logo Display */}
            {formData.logo_url && (
              <div className="flex flex-col items-center space-y-3">
                <img
                  src={formData.logo_url}
                  alt="Event Logo"
                  className="w-48 h-48 object-cover rounded-lg border shadow-md"
                />
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Aktuelles Event Logo</p>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                    className="text-sm text-red-600 hover:text-red-800 px-3 py-1 border border-red-300 rounded-md hover:bg-red-50"
                  >
                    Logo entfernen
                  </button>
                </div>
              </div>
            )}

            {/* Logo Generation Loading - Single logo for events */}
            {generatingLogo && (
              <div className="flex flex-col items-center space-y-4 py-8">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-lg">🎨</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    🎨 Event-Logo wird generiert...
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Bitte warten Sie, während die KI Ihr professionelles Event-Logo erstellt
                  </p>
                  <div className="bg-purple-50 rounded-lg p-3 inline-block">
                    <p className="text-sm text-purple-800 font-medium">
                      ⚡ Hochqualitatives Logo mit Event-Namen
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      Optimiert für Event-Branding und Marketing
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Logo URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Logo URL
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  name="logo_url"
                  value={formData.logo_url}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/logo.png oder /uploads/logos/logo.png"
                />
                <button
                  type="button"
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center space-x-1"
                  title="Logo hochladen"
                >
                  <Upload size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Vollständige URL (https://...) oder relativer Pfad (/uploads/logos/...)
              </p>
            </div>

            {/* AI Logo Generation */}
            {aiConfig.aiEnabled && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Wand2 size={20} className="text-purple-600" />
                  <span className="font-medium text-gray-900">AI Logo Generator</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Lassen Sie eine KI ein professionelles Logo für Ihr Event erstellen
                </p>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="generate_ai_logo"
                    checked={formData.generate_ai_logo}
                    onChange={handleInputChange}
                    disabled={generatingLogo}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">
                    {generatingLogo 
                      ? 'Logo wird generiert...' 
                      : (event?.ai_logo_generated 
                          ? 'Neues AI Logo generieren' 
                          : 'AI Logo generieren'
                        )
                    }
                  </span>
                  {generatingLogo && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                  )}
                </label>
                {event?.ai_logo_generated && !generatingLogo && (
                  <p className="text-xs text-gray-500 mt-1">
                    Sie können jederzeit ein neues AI Logo generieren lassen
                  </p>
                )}
                {generatingLogo && (
                  <p className="text-xs text-purple-600 mt-1 font-medium">
                    ⏳ Die KI erstellt gerade Ihr professionelles Event-Logo...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Startzeit *
              </label>
              <input
                type="datetime-local"
                name="start_time"
                value={formData.start_time}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Endzeit (optional)
              </label>
              <input
                type="datetime-local"
                name="end_time"
                value={formData.end_time}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Access Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock size={16} className="inline mr-1" />
              Zugangscode (optional)
            </label>
            <input
              type="text"
              name="access_code"
              value={formData.access_code}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="z.B. POWER2025"
            />
            <p className="text-sm text-gray-500 mt-1">
              Teams benötigen diesen Code zur Registrierung (falls angegeben)
            </p>
          </div>

          {/* Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Einstellungen</h3>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="use_random_order"
                checked={formData.use_random_order}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Zufällige Reihenfolge der Fragen
              </span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="team_registration_open"
                checked={formData.team_registration_open}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                <Users size={16} className="inline mr-1" />
                Team-Registrierung geöffnet
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || generatingLogo}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || generatingLogo}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{event ? 'Aktualisieren' : 'Erstellen'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal; 