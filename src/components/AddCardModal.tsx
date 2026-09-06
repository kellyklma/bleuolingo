import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Hash } from 'lucide-react';
import { Flashcard } from '../types';
import { parseTags } from '../lib/tagUtils';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: Flashcard) => void;
}

export const AddCardModal: React.FC<AddCardModalProps> = ({
  isOpen,
  onClose,
  onAddCard,
}) => {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const frontInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFront('');
      setBack('');
      setTagsInput('');
      setTimeout(() => {
        frontInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parsedTags = parseTags(tagsInput);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFront = front.trim();
    const trimmedBack = back.trim();

    if (!trimmedFront || !trimmedBack) return;

    const now = Date.now();
    const newCard: Flashcard = {
      id: `card-${now}`,
      front: trimmedFront.toLowerCase(),
      back: trimmedBack.toLowerCase(),
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      lang: 'fr-FR',
      createdAt: now,
      modifiedAt: now,
      state: 'new',
      stability: 0,
      difficulty: 5.0,
      reps: 0,
      lapses: 0,
      due: now,
    };

    onAddCard(newCard);
    onClose();
  };

  return (
    <div
      id="add-card-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="add-card-modal-card"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Add New Flashcard
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Front (Prompt / Word) <span className="text-rose-500">*</span>
            </label>
            <input
              ref={frontInputRef}
              type="text"
              required
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="e.g. bonjour or phrase"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 text-sm font-semibold text-slate-800 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Back (Meaning / Translation) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="e.g. hello / good morning"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 text-sm font-semibold text-slate-800 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Tags (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. french, greetings, basics"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 text-sm font-semibold text-slate-800 outline-none transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Separate tags with commas, spaces, or &quot;;&quot; (e.g. #basics, #greetings)
            </p>

            {/* Live Tags Preview */}
            {parsedTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {parsedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60"
                  >
                    <Hash className="w-3 h-3 text-blue-500" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!front.trim() || !back.trim()}
              className="px-5 py-2 rounded-xl text-xs font-black bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Deck</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
