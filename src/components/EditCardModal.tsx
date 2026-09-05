import React, { useState, useEffect } from 'react';
import { X, Tag, Check } from 'lucide-react';
import { Flashcard } from '../types';
import { parseTags, formatTags } from '../lib/tagUtils';

interface EditCardModalProps {
  card: Flashcard | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCard: Flashcard) => void;
}

export const EditCardModal: React.FC<EditCardModalProps> = ({
  card,
  isOpen,
  onClose,
  onSave,
}) => {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (card) {
      setFront(card.front);
      setBack(card.back);
      setTagsInput(formatTags(card.tags));
    }
  }, [card]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !card) return null;

  const currentParsedTags = parseTags(tagsInput);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    const parsed = parseTags(tagsInput);

    const updated: Flashcard = {
      ...card,
      front: front.trim().toLowerCase(),
      back: back.trim().toLowerCase(),
      tags: parsed.length > 0 ? parsed : undefined,
      modifiedAt: Date.now(),
    };

    onSave(updated);
    onClose();
  };

  return (
    <div
      id="edit-card-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="edit-card-modal-dialog"
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 flex flex-col gap-5 animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Edit Flashcard</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Update word, translation, or tags separated by <code className="px-1 py-0.5 rounded bg-slate-100 font-mono font-bold text-blue-600">::</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Front text input */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Front (Prompt / Target Word) *
            </label>
            <input
              type="text"
              required
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="e.g. Bonjour"
              className="w-full text-sm font-semibold px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-900"
            />
          </div>

          {/* Back text input */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Back (Answer / Translation) *
            </label>
            <input
              type="text"
              required
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="e.g. Hello / Good morning"
              className="w-full text-sm font-semibold px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-900"
            />
          </div>

          {/* Tags with :: separator */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Tags (Separated by ::)</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium">e.g. greetings::basics::french</span>
            </div>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tag1::tag2::tag3"
              className="w-full text-xs sm:text-sm font-mono px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-900"
            />

            {/* Tag preview chips */}
            {currentParsedTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1">
                  Preview:
                </span>
                {currentParsedTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80"
                  >
                    <Tag className="w-2.5 h-2.5 text-blue-500 opacity-70" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* FSRS Learning Status summary */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Learning Status: <strong className="uppercase text-slate-800">{card.state}</strong> ({card.reps} reps)
            </span>
            <span>Stability: <strong>{card.stability.toFixed(1)}d</strong></span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-blue-500 hover:bg-blue-600 border-b-3 border-blue-700 active:border-b-0 active:translate-y-0.5 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
