import React from 'react';
import { Volume2, VolumeX, Layers, RotateCcw } from 'lucide-react';
import { BleuoMascot } from './BleuoMascot';

interface NavbarProps {
  autoAudio: boolean;
  onToggleAutoAudio: () => void;
  onOpenDeckManager: () => void;
  onResetSession: () => void;
  sessionReviewedCount: number;
  totalCards: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  autoAudio,
  onToggleAutoAudio,
  onOpenDeckManager,
  onResetSession,
  sessionReviewedCount,
  totalCards,
}) => {
  return (
    <header
      id="app-header"
      className="w-full bg-white border-b-2 border-slate-100 sticky top-0 z-30 px-4 sm:px-6 py-2.5"
    >
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        {/* Brand Logo with Cute Beagle */}
        <div id="brand-container" className="flex items-center gap-2 cursor-pointer select-none">
          <BleuoMascot mood="happy" size="sm" />
          <h1 id="brand-title" className="font-black text-2xl tracking-tight text-blue-500">
            bleuo<span className="text-blue-600">lingo</span>
          </h1>
        </div>

        {/* Top Controls */}
        <div id="header-actions" className="flex items-center gap-2">
          {/* Audio Auto-Play Toggle */}
          <button
            id="toggle-audio-btn"
            type="button"
            onClick={onToggleAutoAudio}
            title={autoAudio ? 'Audio ON' : 'Audio OFF'}
            className={`w-10 h-10 rounded-2xl border-2 transition-all flex items-center justify-center cursor-pointer ${
              autoAudio
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
          >
            {autoAudio ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Manage Deck */}
          <button
            id="manage-deck-btn"
            type="button"
            onClick={onOpenDeckManager}
            className="h-10 px-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Deck ({totalCards})</span>
          </button>

          {/* Reset Session Counter */}
          {sessionReviewedCount > 0 && (
            <button
              id="reset-session-btn"
              type="button"
              onClick={onResetSession}
              title="Reset session"
              className="w-10 h-10 rounded-2xl border-2 border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
