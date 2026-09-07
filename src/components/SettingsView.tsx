import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  ShieldAlert,
  CheckCircle2,
  X,
  Clock,
  BookOpen,
} from 'lucide-react';
import { UserProfile } from '../types';
import { ActivityLog } from '../lib/activityStorage';

interface SettingsViewProps {
  activeProfile?: UserProfile;
  totalCards: number;
  activityLog?: ActivityLog;
  autoPlayOnDisplay: boolean;
  onToggleAutoPlayOnDisplay: () => void;
  autoPlayOnFlip: boolean;
  onToggleAutoPlayOnFlip: () => void;
  targetRetention?: number;
  onUpdateTargetRetention?: (retention: number) => void;
  dailyNewLimit?: number;
  onUpdateDailyNewLimit?: (limit: number) => void;
  randomizeNewCards?: boolean;
  onToggleRandomizeNewCards?: (randomize: boolean) => void;
  onResetToDefault: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeProfile,
  totalCards,
  activityLog = {},
  autoPlayOnDisplay,
  onToggleAutoPlayOnDisplay,
  autoPlayOnFlip,
  onToggleAutoPlayOnFlip,
  targetRetention = 0.9,
  onUpdateTargetRetention,
  dailyNewLimit = 10,
  onUpdateDailyNewLimit,
  randomizeNewCards = false,
  onToggleRandomizeNewCards,
  onResetToDefault,
}) => {
  // Safety confirmation modal state for Reset to Starter Deck
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const handleExecuteResetToDefault = () => {
    onResetToDefault();
    setIsConfirmModalOpen(false);
    setConfirmInputText('');
    setResetSuccessMessage('Your deck has been safely reset to the original starter deck.');
    setTimeout(() => {
      setResetSuccessMessage(null);
    }, 4000);
  };

  return (
    <div id="settings-view" className="w-full max-w-3xl mx-auto px-4 py-6 sm:py-8 flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Settings &amp; Preferences
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Customize study preferences, scheduling queue, and deck safeguards.
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {resetSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{resetSuccessMessage}</span>
        </div>
      )}

      {/* Study Preferences Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase text-[11px] text-slate-400">
          Study &amp; Audio Preferences
        </h3>

        {/* Auto-Play on Card Display Toggle */}
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
              {autoPlayOnDisplay ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-800">
                Auto-Play on Card Display
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Automatically pronounce prompt terms when a new flashcard is shown.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="toggle-autoplay-display-btn"
            onClick={onToggleAutoPlayOnDisplay}
            className={`w-12 h-7 rounded-full transition-colors cursor-pointer relative p-1 shrink-0 ${
              autoPlayOnDisplay ? 'bg-blue-500' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                autoPlayOnDisplay ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Auto-Play on Card Flip Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
              {autoPlayOnFlip ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-800">
                Auto-Play on Card Flip
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Automatically pronounce answer translations when flipping to reveal.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="toggle-autoplay-flip-btn"
            onClick={onToggleAutoPlayOnFlip}
            className={`w-12 h-7 rounded-full transition-colors cursor-pointer relative p-1 shrink-0 ${
              autoPlayOnFlip ? 'bg-blue-500' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                autoPlayOnFlip ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Substantially Simplified: New Cards & Daily Pacing */}
      <div id="settings-new-cards-section" className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase text-[11px] text-slate-400">
          New Cards &amp; Daily Pacing
        </h3>

        {/* Daily Limit - Simplified & Clean */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-100">
          <div>
            <div className="text-sm font-extrabold text-slate-800">
              Daily New Card Limit
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Maximum new cards introduced per day (enter 0 for no limit).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="settings-daily-new-limit-input"
              type="number"
              min="0"
              max="500"
              value={dailyNewLimit}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                onUpdateDailyNewLimit?.(isNaN(parsed) || parsed < 0 ? 0 : parsed);
              }}
              className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">cards / day</span>
          </div>
        </div>

        {/* New Card Order */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
          <div>
            <div className="text-sm font-extrabold text-slate-800">
              New Card Order
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Introduce cards in the order added or shuffled randomly.
            </p>
          </div>
          <div className="flex rounded-xl p-1 bg-slate-100 border border-slate-200/80 w-fit">
            <button
              type="button"
              id="new-cards-deck-order-btn"
              onClick={() => onToggleRandomizeNewCards?.(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !randomizeNewCards
                  ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Deck Order
            </button>
            <button
              type="button"
              id="new-cards-random-order-btn"
              onClick={() => onToggleRandomizeNewCards?.(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                randomizeNewCards
                  ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Random
            </button>
          </div>
        </div>
      </div>

      {/* FSRS Scheduling & Review Ahead (Replaced Reset All with Review Ahead & Free Study) */}
      <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white rounded-3xl p-5 sm:p-6 border border-blue-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-900 font-black text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>FSRS Scheduling &amp; Study Modes</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100/90 text-blue-800 border border-blue-200/60">
            FSRS Compliant
          </span>
        </div>

        {/* Target Retention Selector */}
        <div className="flex flex-col gap-2 pt-1 pb-3 border-b border-blue-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-slate-800">
              FSRS Target Retention
            </span>
            <span className="text-xs font-black text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
              {Math.round(targetRetention * 100)}% Recall Probability
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Determines how aggressively intervals expand. Lower retention spaces cards out further with fewer reviews; higher retention schedules reviews more frequently for maximum recall.
          </p>

          <div className="grid grid-cols-3 gap-2 mt-1">
            {[
              { value: 0.85, label: '85%', desc: 'Relaxed' },
              { value: 0.90, label: '90%', desc: 'Standard' },
              { value: 0.95, label: '95%', desc: 'Intensive' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdateTargetRetention?.(opt.value)}
                className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  Math.abs(targetRetention - opt.value) < 0.01
                    ? 'bg-blue-600 border-blue-700 text-white shadow-xs font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                }`}
              >
                <span className="text-sm font-black">{opt.label}</span>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider ${
                    Math.abs(targetRetention - opt.value) < 0.01 ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-rose-50/50 rounded-3xl p-5 sm:p-6 border border-rose-200 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <span>Danger Zone</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="max-w-md">
            <h4 className="text-sm font-black text-rose-950">
              Reset to Starter Deck
            </h4>
            <p className="text-xs text-rose-700/80 font-medium mt-0.5 leading-relaxed">
              Replace current cards with the starter deck. This action cannot be undone.
            </p>
          </div>

          <button
            type="button"
            id="settings-reset-deck-btn"
            onClick={() => setIsConfirmModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-rose-100/80 border border-rose-300 text-rose-700 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Deck</span>
          </button>
        </div>
      </div>

      {/* Safety Confirmation Modal for Reset to Starter Deck */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4 relative">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">
                Reset to Default Starter Deck?
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                This will overwrite the current <strong className="text-slate-800">{totalCards} cards</strong> in {activeProfile?.name || 'this profile'} with the starter deck. Type <strong className="text-rose-600">RESET</strong> to confirm.
              </p>
            </div>

            <input
              type="text"
              placeholder='Type "RESET" here'
              value={confirmInputText}
              onChange={(e) => setConfirmInputText(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setConfirmInputText('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmInputText.trim() !== 'RESET'}
                onClick={handleExecuteResetToDefault}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                  confirmInputText.trim() === 'RESET'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
