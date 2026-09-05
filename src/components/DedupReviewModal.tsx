import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Check,
  RotateCcw,
  X,
  Tag,
  ListFilter,
  Eye,
} from 'lucide-react';
import { DuplicateConflict, DuplicateDecision, normalizeWord } from '../lib/dedupUtils';

interface DedupReviewModalProps {
  isOpen: boolean;
  conflicts: DuplicateConflict[];
  onClose: () => void;
  onApply: (conflicts: DuplicateConflict[]) => void;
}

export const DedupReviewModal: React.FC<DedupReviewModalProps> = ({
  isOpen,
  conflicts: initialConflicts,
  onClose,
  onApply,
}) => {
  const [conflicts, setConflicts] = useState<DuplicateConflict[]>(initialConflicts);
  const [mode, setMode] = useState<'prompt' | 'step' | 'list'>('prompt');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sync state if props change
  React.useEffect(() => {
    setConflicts(initialConflicts);
    setCurrentIndex(0);
    setMode('prompt');
  }, [initialConflicts]);

  if (!isOpen || conflicts.length === 0) return null;

  const currentConflict = conflicts[currentIndex];
  const keptCount = conflicts.filter((c) => c.decision === 'keep').length;
  const overwriteCount = conflicts.filter((c) => c.decision === 'overwrite').length;

  // Option 1: Skip all overwriting (keep all existing)
  const handleSkipAll = () => {
    const updated = conflicts.map((c) => ({ ...c, decision: 'keep' as DuplicateDecision }));
    onApply(updated);
  };

  // Option 2: Overwrite all without review
  const handleOverwriteAll = () => {
    const updated = conflicts.map((c) => ({ ...c, decision: 'overwrite' as DuplicateDecision }));
    onApply(updated);
  };

  // Option 3: Start reviewing
  const handleStartReview = (targetMode: 'step' | 'list' = 'step') => {
    setMode(targetMode);
  };

  // Set decision for current step card
  const handleSetDecision = (id: string, decision: DuplicateDecision, autoAdvance = false) => {
    setConflicts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, decision } : c))
    );
    if (autoAdvance && currentIndex < conflicts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Set all remaining from current step
  const handleSetAllRemaining = (decision: DuplicateDecision) => {
    setConflicts((prev) =>
      prev.map((c, idx) => (idx >= currentIndex ? { ...c, decision } : c))
    );
  };

  // Apply final custom decisions
  const handleFinishCustomReview = () => {
    onApply(conflicts);
  };

  return (
    <div
      id="dedup-review-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="dedup-review-dialog"
        className="w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 flex flex-col gap-5 max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Duplicate Cards Detected
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {conflicts.length} card{conflicts.length === 1 ? '' : 's'} in your CSV match existing words in your deck (matching regardless of accents & case).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode 1: Initial Prompt Screen */}
        {mode === 'prompt' && (
          <div className="flex flex-col gap-5">
            {/* Quick Stats Summary */}
            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/80 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  Matching Duplicate Cards
                </span>
                <span className="text-xl font-black text-slate-900">
                  {conflicts.length} duplicate word{conflicts.length === 1 ? '' : 's'}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium max-w-xs text-right hidden sm:block">
                Matches are determined ignoring differences in capitalization and accents.
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              How would you like to resolve the matching cards found between the CSV and your current deck?
            </p>

            {/* The 3 Core Options as Large Interactive Action Cards */}
            <div className="flex flex-col gap-3">
              {/* Option 1: Skip All Overwriting */}
              <button
                id="dedup-skip-all-btn"
                type="button"
                onClick={handleSkipAll}
                className="group w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-left flex items-start justify-between gap-4 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                      Skip All Overwriting
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                      Keep Existing
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-normal">
                    Keep all {conflicts.length} existing card{conflicts.length === 1 ? '' : 's'} unchanged with current definitions, tags, and study stats.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </button>

              {/* Option 2: Overwrite All Without Review */}
              <button
                id="dedup-overwrite-all-btn"
                type="button"
                onClick={handleOverwriteAll}
                className="group w-full p-4 rounded-2xl border-2 border-rose-200 hover:border-rose-400 bg-rose-50/30 hover:bg-rose-50/70 text-left flex items-start justify-between gap-4 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 group-hover:text-rose-700 transition-colors">
                      Overwrite All Without Review
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">
                      Update All
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-normal">
                    Overwrite all {conflicts.length} matching card{conflicts.length === 1 ? '' : 's'} with definitions and tags from the CSV (FSRS review history is preserved).
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-rose-100 group-hover:bg-rose-200 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                  <Check className="w-4 h-4" />
                </div>
              </button>

              {/* Option 3: Review Each Card */}
              <button
                id="dedup-review-each-btn"
                type="button"
                onClick={() => handleStartReview('step')}
                className="group w-full p-4 rounded-2xl border-2 border-blue-400 bg-blue-50/50 hover:bg-blue-50 text-left flex items-start justify-between gap-4 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-blue-900">
                      Review Each Duplicate Card ({conflicts.length})
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-500 text-white">
                      Step-by-Step
                    </span>
                  </div>
                  <p className="text-xs text-blue-700/80 font-medium leading-normal">
                    Inspect each matching card side-by-side to choose whether to keep the current deck card or overwrite it with the CSV version.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform shadow-xs">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>

            {/* Quick List Preview link */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Need to quickly see all matching words?</span>
              <button
                type="button"
                onClick={() => handleStartReview('list')}
                className="font-bold text-blue-600 hover:text-blue-700 underline flex items-center gap-1 cursor-pointer"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>View Full List of Duplicates</span>
              </button>
            </div>
          </div>
        )}

        {/* View Mode 2: Step-by-Step Reviewer */}
        {mode === 'step' && currentConflict && (
          <div className="flex flex-col gap-4">
            {/* Top Navigation & Counter */}
            <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-200/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800">
                  Reviewing Duplicate {currentIndex + 1} of {conflicts.length}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold font-mono">
                  Normalized: "{normalizeWord(currentConflict.incomingCard.front)}"
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
                >
                  <ListFilter className="w-3 h-3" />
                  <span>List View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('prompt')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-600 cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-200"
                style={{ width: `${((currentIndex + 1) / conflicts.length) * 100}%` }}
              />
            </div>

            {/* Side-by-Side Comparison: Existing vs Incoming */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Existing Card in Deck */}
              <div
                onClick={() => handleSetDecision(currentConflict.id, 'keep')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                  currentConflict.decision === 'keep'
                    ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Existing in Deck
                    </span>
                    {currentConflict.decision === 'keep' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500 text-white shadow-xs">
                        <Check className="w-2.5 h-2.5" />
                        <span>KEEP THIS</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xl font-black text-slate-900 mb-1">
                    {currentConflict.existingCard.front}
                  </div>
                  <div className="text-sm font-semibold text-slate-600">
                    {currentConflict.existingCard.back}
                  </div>

                  {/* Existing Tags */}
                  {currentConflict.existingCard.tags &&
                    currentConflict.existingCard.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {currentConflict.existingCard.tags.map((t, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600"
                          >
                            <Tag className="w-2 h-2 text-slate-400" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}
                </div>

                <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>
                    Status: <strong className="uppercase text-slate-600">{currentConflict.existingCard.state}</strong>
                  </span>
                  <span>{currentConflict.existingCard.reps} reviews</span>
                </div>
              </div>

              {/* Incoming Card from CSV */}
              <div
                onClick={() => handleSetDecision(currentConflict.id, 'overwrite')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                  currentConflict.decision === 'overwrite'
                    ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-rose-500">
                      New from CSV
                    </span>
                    {currentConflict.decision === 'overwrite' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs">
                        <Check className="w-2.5 h-2.5" />
                        <span>OVERWRITE</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xl font-black text-slate-900 mb-1">
                    {currentConflict.incomingCard.front}
                  </div>
                  <div className="text-sm font-semibold text-slate-600">
                    {currentConflict.incomingCard.back}
                  </div>

                  {/* Incoming Tags */}
                  {currentConflict.incomingCard.tags &&
                    currentConflict.incomingCard.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {currentConflict.incomingCard.tags.map((t, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800"
                          >
                            <Tag className="w-2 h-2 text-rose-400" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}
                </div>

                <div className="pt-3 border-t border-slate-100/80 text-[11px] text-rose-600 font-semibold">
                  Will overwrite definition & tags in deck
                </div>
              </div>
            </div>

            {/* Decision Action Buttons for This Card */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleSetDecision(currentConflict.id, 'keep', true)}
                className={`py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  currentConflict.decision === 'keep'
                    ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Keep Existing Card</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetDecision(currentConflict.id, 'overwrite', true)}
                className={`py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  currentConflict.decision === 'overwrite'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Overwrite with New</span>
              </button>
            </div>

            {/* Step navigation & quick bulk controls */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  disabled={currentIndex >= conflicts.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(conflicts.length - 1, prev + 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAllRemaining('keep')}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Keep All Remaining
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => handleSetAllRemaining('overwrite')}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                >
                  Overwrite All Remaining
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Mode 3: Full List Review */}
        {mode === 'list' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-200/80">
              <span className="text-xs font-black text-slate-800">
                All Duplicates List ({conflicts.length})
              </span>
              <button
                type="button"
                onClick={() => setMode('step')}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>Step-by-Step View</span>
              </button>
            </div>

            {/* Table of all conflicts */}
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100 text-xs">
              {conflicts.map((conflict, idx) => (
                <div
                  key={conflict.id}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400">#{idx + 1}</span>
                      <span className="font-black text-slate-900 text-sm">
                        {conflict.existingCard.front}
                      </span>
                    </div>
                    <div className="text-slate-500 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span>
                        <strong className="text-slate-700">Existing:</strong> {conflict.existingCard.back}
                      </span>
                      <span className="hidden sm:inline text-slate-300">|</span>
                      <span>
                        <strong className="text-rose-700">Incoming:</strong> {conflict.incomingCard.back}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSetDecision(conflict.id, 'keep')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        conflict.decision === 'keep'
                          ? 'bg-blue-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetDecision(conflict.id, 'overwrite')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        conflict.decision === 'overwrite'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Overwrite
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* List bulk actions */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={() => setConflicts((prev) => prev.map((c) => ({ ...c, decision: 'keep' })))}
                className="font-bold text-slate-600 hover:underline cursor-pointer"
              >
                Mark All as "Keep"
              </button>
              <button
                type="button"
                onClick={() => setConflicts((prev) => prev.map((c) => ({ ...c, decision: 'overwrite' })))}
                className="font-bold text-rose-600 hover:underline cursor-pointer"
              >
                Mark All as "Overwrite"
              </button>
            </div>
          </div>
        )}

        {/* Bottom Finish Bar (visible in review modes) */}
        {mode !== 'prompt' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500 font-medium">
              Duplicate Resolution: <strong className="text-blue-600">{keptCount} to keep</strong>,{' '}
              <strong className="text-rose-600">{overwriteCount} to overwrite</strong>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setMode('prompt')}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Back to Options
              </button>
              <button
                id="dedup-apply-review-btn"
                type="button"
                onClick={handleFinishCustomReview}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Import & Finish</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
