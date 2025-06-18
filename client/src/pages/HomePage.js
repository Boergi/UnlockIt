import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Lock, Users, Trophy, Clock } from 'lucide-react';

const HomePage = () => {
  const [qrCode, setQrCode] = useState('');
  const [eventId, setEventId] = useState('');

  const generateQRCode = async () => {
    if (eventId) {
      try {
        const url = `${window.location.origin}/join/${eventId}`;
        const qrCodeData = await QRCode.toDataURL(url);
        setQrCode(qrCodeData);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    }
  };

  useEffect(() => {
    generateQRCode();
  }, [eventId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <Lock className="w-16 h-16 text-yellow-400 mr-4" />
            <h1 className="text-6xl font-bold text-white">
              Unlock<span className="text-yellow-400">It</span>
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Gamifizierte Team-Rätsel für unvergessliche Events. 
            Löst gemeinsam knifflige Aufgaben und knackt digitale Schlösser!
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
            <Users className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Team-Spiel</h3>
            <p className="text-gray-300">
              Meldet euch als Team an und löst gemeinsam herausfordernde Rätsel
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
            <Clock className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Echtzeit</h3>
            <p className="text-gray-300">
              Live-Scoreboard und Echtzeit-Updates für maximale Spannung
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Gamification</h3>
            <p className="text-gray-300">
              Punkte, Tipps-System und Bestenlisten für ultimativen Spielspaß
            </p>
          </div>
        </div>

        {/* QR Code Generator */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Team-Anmeldung per QR-Code
          </h2>
          
          <div className="max-w-md mx-auto">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Event-ID eingeben
              </label>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3 py-2 bg-white/20 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. 123"
              />
            </div>
            
            {qrCode && (
              <div className="text-center">
                <img src={qrCode} alt="QR Code" className="mx-auto mb-4 rounded-lg" />
                <p className="text-sm text-gray-400">
                  Teams können diesen QR-Code scannen oder direkt den Link verwenden
                </p>
                <div className="mt-2 p-2 bg-black/30 rounded text-xs text-gray-300 break-all">
                  {`${window.location.origin}/join/${eventId}`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Access */}
        <div className="text-center">
          <Link
            to="/admin"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
          >
            <Lock className="w-5 h-5 mr-2" />
            Admin-Bereich
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 