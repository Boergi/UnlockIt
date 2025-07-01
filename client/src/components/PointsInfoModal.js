import React from 'react';
import { XCircle } from 'lucide-react';

const PointsInfoModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 sm:p-6 pb-4 border-b border-gray-700">
          <h3 className="text-xl sm:text-2xl font-bold text-white">Punkteberechnung</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4">
          <div className="space-y-6">
            {/* Grundpunkte */}
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-white mb-3">📊 Grundpunkte</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <div className="bg-green-500/20 rounded-lg p-3">
                  <div className="text-green-400 font-bold text-xl">100</div>
                  <div className="text-gray-300 text-sm">Einfach</div>
                </div>
                <div className="bg-yellow-500/20 rounded-lg p-3">
                  <div className="text-yellow-400 font-bold text-xl">200</div>
                  <div className="text-gray-300 text-sm">Mittel</div>
                </div>
                <div className="bg-red-500/20 rounded-lg p-3">
                  <div className="text-red-400 font-bold text-xl">300</div>
                  <div className="text-gray-300 text-sm">Schwer</div>
                </div>
              </div>
            </div>

            {/* Zeitbonus */}
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-white mb-3">⏰ Zeitbonus</h4>
              <p className="text-gray-300 mb-2">
                Bis zu 50% extra Punkte für schnelle Lösungen
              </p>
              <div className="text-sm text-gray-400">
                Bonus = (Verbleibende Zeit / Gesamtzeit) × 50%
              </div>
            </div>

            {/* Tipp-Abzug */}
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-white mb-3">💡 Tipp-Abzug</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-gray-300">
                  <span>Tipp 1:</span>
                  <span className="text-yellow-400">-20%</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Tipp 2:</span>
                  <span className="text-orange-400">-40%</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Tipp 3 (Lösung):</span>
                  <span className="text-red-400">0 Punkte</span>
                </div>
              </div>
            </div>

            {/* Formel */}
            <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/30">
              <h4 className="text-lg font-semibold text-white mb-3">🧮 Formel</h4>
              <div className="text-center">
                <div className="text-blue-400 font-mono text-sm sm:text-lg mb-2 break-words">
                  Endpunkte = Grundpunkte × (1 + Zeitbonus) × (1 - Tipp-Abzug)
                </div>
                <div className="text-gray-300 text-sm">
                  Mindestens 10 Punkte (außer bei Lösungs-Tipp)
                </div>
              </div>
            </div>

            {/* Beispiel */}
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-white mb-3">💡 Beispiel</h4>
              <div className="text-gray-300 space-y-1 text-sm sm:text-base">
                <div className="break-words">Mittlere Frage (200 Punkte), 60s Limit, 20s benötigt, 1 Tipp</div>
                <div className="text-yellow-400 break-words font-mono text-xs sm:text-sm">200 × (1 + 0.67 × 0.5) × (1 - 0.2) = 214 Punkte</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PointsInfoModal; 