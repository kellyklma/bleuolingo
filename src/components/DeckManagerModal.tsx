import React, { useState } from 'react';
import { X, Search, Plus, Trash2, RotateCcw, Volume2, Calendar } from 'lucide-react';
import { Flashcard } from '../types';
import { formatInterval } from '../lib/fsrs';
import { playPronunciation } from '../lib/audio';

interface DeckManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Flashcard[];
  onAddCard: (card: Flashcard) => void;
  onDeleteCard: (id: string) => void;
  onResetToDefault: () => void;
  onResetAllDue: () => void;
}

export const DeckManagerModal: React.FC<DeckManagerModalProps> = ({
  isOpen,
  onClose,
  cards,
  onAddCard,
  onDeleteCard,
  onResetToDefault,
  onResetAllDue,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newExample, setNewExample] = useState('');

  if (!isOpen) return null;

  const filteredCards = cards.filter(
    (c) =>
      c.front.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.back.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    const newCard: Flashcard = {
      id: `manual-${Date.now()}`,
      front: newFront.trim(),
      back: newBack.trim(),
      example: newExample.trim() || undefined,
      lang: 'fr-FR',
      state: 'new',
      stability: 0,
      difficulty: 5.0,
      reps: 0,
      lapses: 0,
      due: Date.now(),
    };

    onAddCard(newCard);
    setNewFront('');
    setNewBack('');
    setNewExample('');
    setShowAddForm(false);
  };

  return (
    <div
      id="deck-manager-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="deck-manager-container"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-blue-100 shadow-2xl p-6 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 id="deck-manager-title" className="text-lg font-black text-slate-900 leading-tight">
              Deck Manager
            </h3>
            <p className="text-xs font-medium text-slate-400">
              {cards.length} card{cards.length === 1 ? '' : 's'} in active deck
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="toggle-add-card-form-btn"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 border-b-2 border-blue-700 active:border-b-0 active:translate-y-0.5 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Close Form' : 'Add Card'}</span>
            </button>
            <button
              id="close-deck-manager-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add Card Form Expandable */}
        {showAddForm && (
          <form
            onSubmit={handleCreateCard}
            className="my-3 p-4 rounded-2xl bg-blue-50/70 border border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <div>
              <label className="text-[11px] font-bold text-blue-900 block mb-1">Front (Target Word) *</label>
              <input
                type="text"
                required
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                placeholder="e.g. Au revoir"
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-blue-900 block mb-1">Back (Translation) *</label>
              <input
                type="text"
                required
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                placeholder="e.g. Goodbye"
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-blue-900 block mb-1">Example Sentence (optional)</label>
              <input
                type="text"
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                placeholder="e.g. Au revoir et bonne journée !"
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm"
              >
                Save Flashcard
              </button>
            </div>
          </form>
        )}

        {/* Search Filter */}
        <div className="my-3 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="search-deck-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words or meanings..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-800"
          />
        </div>

        {/* Cards Table */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="p-2.5">Word (Front)</th>
                <th className="p-2.5">Meaning (Back)</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 hidden sm:table-cell">Stability</th>
                <th className="p-2.5 hidden sm:table-cell">Reviews</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCards.map((card) => {
                const isDue = card.due <= Date.now();
                return (
                  <tr key={card.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-2.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => playPronunciation(card.front, card.lang || 'fr-FR')}
                          className="text-blue-500 hover:text-blue-700 p-0.5"
                          title="Listen"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <span>{card.front}</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-slate-600 font-medium">{card.back}</td>
                    <td className="p-2.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          card.state === 'new'
                            ? 'bg-blue-100 text-blue-700'
                            : card.state === 'learning'
                            ? 'bg-amber-100 text-amber-700'
                            : isDue
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {card.state} {isDue && card.state !== 'new' ? '· Due' : ''}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-500 hidden sm:table-cell font-mono">
                      {card.stability > 0 ? formatInterval(card.stability) : '0d'}
                    </td>
                    <td className="p-2.5 text-slate-500 hidden sm:table-cell">{card.reps}</td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => onDeleteCard(card.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredCards.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    No cards match your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Utilities */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              id="reset-due-dates-btn"
              onClick={onResetAllDue}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-blue-50 transition-colors"
              title="Make all cards due for review right now"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Make All Due Now</span>
            </button>
            <button
              id="restore-starter-deck-btn"
              onClick={onResetToDefault}
              className="text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              title="Reset to default French starter deck"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Starter Deck</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
