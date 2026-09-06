import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  ShieldAlert,
  Check,
  CheckCircle2,
  X,
  Sparkles,
  User,
} from 'lucide-react';
import { UserProfile } from '../types';
import { ActivityLog } from '../lib/activityStorage';
import { ProgressHeatmap } from './ProgressHeatmap';

interface SettingsViewProps {
  activeProfile?: UserProfile;
  totalCards: number;
  activityLog?: ActivityLog;
  autoPlayOnDisplay: boolean;
  onToggleAutoPlayOnDisplay: () => void;
  autoPlayOnFlip: boolean;
  onToggleAutoPlayOnFlip: () => void;
  onResetAllDue: () => void;
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
  onResetAllDue,
  onResetToDefault,
}) => {
  // Safety confirmation modal state for Reset to Starter Deck
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [isJustQueuedDue, setIsJustQueuedDue] = useState(false);

  const handleExecuteResetToDefault = () => {
    onResetToDefault();
    setIsConfirmModalOpen(false);
    setConfirmInputText('');
    setResetSuccessMessage('Your deck has been safely reset to the original starter deck.');
    setTimeout(() => {
      setResetSuccessMessage(null);
    }, 4000);
  };

  const handleMakeAllDue = () => {
    onResetAllDue();
    setIsJustQueuedDue(true);
    setResetSuccessMessage(`All ${totalCards} cards have been queued and are ready for practice now!`);
    setTimeout(() => {
      setIsJustQueuedDue(false);
    }, 2500);
    setTimeout(() => {
      setResetSuccessMessage(null);
    }, 4500);
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
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Settings</h2>
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

      {/* Modern Minimal Heat Map with Full Space */}
      <ProgressHeatmap activityLog={activityLog} />

      {/* Study Preferences Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase text-[11px] text-slate-400">
          Study & Audio Preferences
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

      {/* Improved Dedicated UI for "Reset All Cards to Due Now" */}
      <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white rounded-3xl p-5 sm:p-6 border border-blue-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-900 font-black text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Study Queue & Review Scheduling</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100/90 text-blue-800 border border-blue-200/60">
            Safe • Non-Destructive
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 pt-1">
          <div className="max-w-md">
            <h4 className="text-base font-black text-slate-900">
              Reset All Cards to &quot;Due Now&quot;
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Want to practice ahead? This immediately queues all{' '}
              <strong className="text-slate-900 font-black">{totalCards} cards</strong> in this profile for review right now.
              Your card memory stability, repetition count, and FSRS difficulty history remain completely safe and intact.
            </p>
          </div>

          <button
            id="settings-reset-all-due-btn"
            type="button"
            onClick={handleMakeAllDue}
            className={`px-5 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 border-b-3 active:translate-y-0.5 active:border-b-1 ${
              isJustQueuedDue
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800 shadow-md'
                : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-800 shadow-sm hover:shadow-md'
            }`}
          >
            {isJustQueuedDue ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>All {totalCards} Cards Due!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Make All {totalCards} Cards Due</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-rose-50/50 rounded-3xl p-5 sm:p-6 border border-rose-200 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <span>Danger Zone</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              Reset to Starter Deck
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5 max-w-lg">
              Safely protected: Replaces all cards in the current learner profile with the original 10 starter cards. All custom created cards and CSV imports for this profile will be permanently removed.
            </p>
          </div>

          {/* Trigger Button with Safeguard */}
          <button
            id="open-reset-default-dialog-btn"
            type="button"
            onClick={() => {
              setConfirmInputText('');
              setIsConfirmModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Starter Deck</span>
          </button>
        </div>
      </div>

      {/* Confirmation Safeguard Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">
                Are you absolutely sure?
              </h3>
              <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                This action cannot be undone. It will permanently replace your current{' '}
                <strong className="text-slate-900 font-black">{totalCards} cards</strong> with the original 10 starter cards for{' '}
                <strong className="text-slate-900 font-black">{activeProfile?.name}</strong>.
              </p>
            </div>

            <div className="bg-rose-50 p-3 rounded-2xl border border-rose-200 text-xs text-rose-800 font-semibold">
              To verify and proceed, please type <strong className="font-black text-rose-900">RESET</strong> in the box below:
            </div>

            <input
              id="confirm-reset-input"
              type="text"
              value={confirmInputText}
              onChange={(e) => setConfirmInputText(e.target.value)}
              placeholder="Type RESET to confirm"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              autoFocus
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-reset-to-default-btn"
                type="button"
                disabled={confirmInputText.trim().toUpperCase() !== 'RESET'}
                onClick={handleExecuteResetToDefault}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-black text-xs sm:text-sm transition-all cursor-pointer shadow-xs"
              >
                Confirm Reset Deck
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
