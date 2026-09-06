import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Volume2,
  Pencil,
  BookOpen,
  UploadCloud,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Hash,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { Flashcard } from '../types';
import { formatInterval } from '../lib/fsrs';
import { playPronunciation, AVAILABLE_LANGUAGES } from '../lib/audio';
import { EditCardModal } from './EditCardModal';
import { AddCardModal } from './AddCardModal';
import {
  parseCSVText,
  convertRowsToFlashcards,
  downloadSampleCSV,
  exportDeckToCSV,
} from '../lib/csvParser';
import {
  analyzeCardsForDuplicates,
  resolveDuplicates,
  DuplicateConflict,
} from '../lib/dedupUtils';
import { DedupReviewModal } from './DedupReviewModal';

export type DeckSortField = 'front' | 'back' | 'tags' | 'status' | 'interval' | 'created' | 'modified';
export type DeckSortDirection = 'asc' | 'desc';

export type DeckColumnKey = 'front' | 'back' | 'tags' | 'status' | 'interval' | 'created' | 'modified';

export interface DeckColumnDef {
  key: DeckColumnKey;
  label: string;
}

export const DECK_COLUMN_DEFINITIONS: DeckColumnDef[] = [
  { key: 'front', label: 'Front (Prompt)' },
  { key: 'back', label: 'Back (Answer)' },
  { key: 'tags', label: 'Tags' },
  { key: 'status', label: 'Status' },
  { key: 'interval', label: 'Interval / Due' },
  { key: 'created', label: 'Created Date' },
  { key: 'modified', label: 'Modified Date' },
];

const COLUMNS_VISIBILITY_KEY = 'bleuolingo_visible_deck_columns_v1';

interface DeckManagerViewProps {
  cards: Flashcard[];
  frontLanguage?: string;
  backLanguage?: string;
  onSelectFrontLanguage?: (lang: string) => void;
  onSelectBackLanguage?: (lang: string) => void;
  onAddCard: (card: Flashcard) => void;
  onAddCards: (cards: Flashcard[]) => void;
  onApplyImport?: (cardsToAdd: Flashcard[], cardsToUpdate: Flashcard[]) => void;
  onUpdateCard: (card: Flashcard) => void;
  onDeleteCard: (id: string) => void;
  onResetToDefault?: () => void;
  onResetAllDue?: () => void;
}

export const DeckManagerView: React.FC<DeckManagerViewProps> = ({
  cards,
  frontLanguage = 'fr',
  backLanguage = 'en',
  onSelectFrontLanguage,
  onSelectBackLanguage,
  onAddCard,
  onAddCards,
  onApplyImport,
  onUpdateCard,
  onDeleteCard,
  onResetToDefault,
  onResetAllDue,
}) => {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<'all' | 'due' | 'new' | 'learning' | 'review'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Add Card modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Editing & audio states
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);

  // Import states
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDedup, setPendingDedup] = useState<{
    conflicts: DuplicateConflict[];
    newCards: Flashcard[];
    filename?: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const now = Date.now();

  // Extract all distinct tags across all cards
  const allUniqueTags = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => {
      c.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [cards]);

  // Counts for filters
  const dueCount = useMemo(() => cards.filter((c) => c.due <= now).length, [cards, now]);
  const newCount = useMemo(() => cards.filter((c) => c.state === 'new').length, [cards]);
  const learningCount = useMemo(() => cards.filter((c) => c.state === 'learning').length, [cards]);
  const reviewCount = useMemo(() => cards.filter((c) => c.state === 'review').length, [cards]);

  // Toggle multiselect hashtag
  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Header column sorting state
  const [sortField, setSortField] = useState<DeckSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<DeckSortDirection>('asc');

  // Column visibility state (customizable and persisted)
  const [visibleColumns, setVisibleColumns] = useState<Record<DeckColumnKey, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(COLUMNS_VISIBILITY_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            front: parsed.front ?? true,
            back: parsed.back ?? true,
            tags: parsed.tags ?? true,
            status: parsed.status ?? true,
            interval: parsed.interval ?? true,
            created: parsed.created ?? true,
            modified: parsed.modified ?? true,
          };
        }
      } catch { }
    }
    return {
      front: true,
      back: true,
      tags: true,
      status: true,
      interval: true,
      created: true,
      modified: true,
    };
  });

  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setShowColumnsMenu(false);
      }
    };
    if (showColumnsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnsMenu]);

  const toggleColumnVisibility = (colKey: DeckColumnKey) => {
    setVisibleColumns((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[colKey] && activeCount <= 1) {
        return prev;
      }
      const updated = { ...prev, [colKey]: !prev[colKey] };
      if (typeof window !== 'undefined') {
        localStorage.setItem(COLUMNS_VISIBILITY_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleResetVisibleColumns = () => {
    const allOn: Record<DeckColumnKey, boolean> = {
      front: true,
      back: true,
      tags: true,
      status: true,
      interval: true,
      created: true,
      modified: true,
    };
    setVisibleColumns(allOn);
    if (typeof window !== 'undefined') {
      localStorage.setItem(COLUMNS_VISIBILITY_KEY, JSON.stringify(allOn));
    }
  };

  const formatTimestamp = (ts?: number): string => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleToggleSort = (field: DeckSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.front.toLowerCase().includes(q) ||
        c.back.toLowerCase().includes(q) ||
        (c.tags && c.tags.some((t) => t.toLowerCase().includes(q)));
      if (!matchesSearch) return false;

      // Multiselect tag filtering: card must have at least one of the selected tags
      if (selectedTags.length > 0) {
        if (!c.tags || !selectedTags.some((tag) => c.tags?.includes(tag))) {
          return false;
        }
      }

      if (filterState === 'all') return true;
      if (filterState === 'due') return c.due <= now;
      return c.state === filterState;
    });
  }, [cards, searchQuery, selectedTags, filterState, now]);

  // Apply sorting on header column
  const sortedCards = useMemo(() => {
    if (!sortField) return filteredCards;

    return [...filteredCards].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'front') {
        cmp = a.front.localeCompare(b.front);
      } else if (sortField === 'back') {
        cmp = a.back.localeCompare(b.back);
      } else if (sortField === 'tags') {
        const aTags = (a.tags || []).join(', ');
        const bTags = (b.tags || []).join(', ');
        cmp = aTags.localeCompare(bTags);
      } else if (sortField === 'status') {
        const stateWeight: Record<string, number> = { new: 1, learning: 2, review: 3 };
        cmp = (stateWeight[a.state] || 0) - (stateWeight[b.state] || 0);
      } else if (sortField === 'interval') {
        cmp = a.due - b.due;
      } else if (sortField === 'created') {
        cmp = (a.createdAt || 0) - (b.createdAt || 0);
      } else if (sortField === 'modified') {
        cmp = (a.modifiedAt || a.createdAt || 0) - (b.modifiedAt || b.createdAt || 0);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredCards, sortField, sortDirection]);

  const handlePlayWord = (card: Flashcard) => {
    setPlayingId(card.id);
    playPronunciation(
      card.front,
      frontLanguage || card.lang || 'fr',
      () => setPlayingId(card.id),
      () => setPlayingId(null)
    );
  };

  // CSV file parsing & deduplication
  const processCSVContent = (content: string, filename?: string) => {
    try {
      const rows = parseCSVText(content);
      if (!rows || rows.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'No valid data or text could be parsed from the file.',
        });
        return;
      }

      const { cards: parsedCards } = convertRowsToFlashcards(rows);
      if (parsedCards.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'Could not extract valid cards. Make sure your CSV has front and back columns.',
        });
        return;
      }

      // Analyze for duplicates (case and accent insensitive)
      const { newCards, conflicts } = analyzeCardsForDuplicates(parsedCards, cards);

      if (conflicts.length > 0) {
        setPendingDedup({
          conflicts,
          newCards,
          filename,
        });
      } else {
        if (newCards.length === 0) {
          setStatusMessage({
            type: 'success',
            text: 'All cards in the file were already in your deck.',
          });
        } else {
          onAddCards(newCards);
          setStatusMessage({
            type: 'success',
            text: `Successfully added ${newCards.length} new card${newCards.length === 1 ? '' : 's'
              }!`,
          });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'An unexpected error occurred while parsing the CSV file.',
      });
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        processCSVContent(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleApplyDedupReview = (resolvedConflicts: DuplicateConflict[]) => {
    if (!pendingDedup) return;
    const { newCards: newCardsToAdd } = pendingDedup;
    setPendingDedup(null);

    const { cardsToUpdate, cardsToAdd, overwrittenCount, keptCount } = resolveDuplicates(
      resolvedConflicts,
      newCardsToAdd
    );

    if (onApplyImport) {
      onApplyImport(cardsToAdd, cardsToUpdate);
    } else if (cardsToAdd.length > 0) {
      onAddCards(cardsToAdd);
    }

    const summaryParts: string[] = [];
    if (cardsToAdd.length > 0) {
      summaryParts.push(`added ${cardsToAdd.length} new card${cardsToAdd.length === 1 ? '' : 's'}`);
    }
    if (overwrittenCount > 0) {
      summaryParts.push(
        `overwrote ${overwrittenCount} existing card${overwrittenCount === 1 ? '' : 's'}`
      );
    }
    if (keptCount > 0) {
      summaryParts.push(`kept ${keptCount} existing card${keptCount === 1 ? '' : 's'}`);
    }

    setStatusMessage({
      type: 'success',
      text: `Import complete: ${summaryParts.join(', ')}.`,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div id="deck-manager-view" className="w-full max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Hidden file input for direct CSV upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            handleFileUpload(files[0]);
          }
        }}
      />

      {/* Top Header & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Deck</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">
              {cards.length} cards
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
            Manage your flashcards, import spreadsheets, and organize with tags.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export as CSV Button */}
          <button
            id="deck-export-btn"
            type="button"
            onClick={() => exportDeckToCSV(cards)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export entire deck as CSV"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export as CSV</span>
          </button>

          {/* Add Card Button (Opens intuitive Modal) */}
          <button
            id="deck-add-card-btn"
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Card</span>
          </button>
        </div>
      </div>

      {/* Unburied Drag & Drop Upload Banner */}
      <div
        id="deck-dropzone-banner"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full p-4 sm:p-5 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 ${isDragging
            ? 'border-blue-500 bg-blue-50/80 shadow-md scale-[1.01]'
            : 'border-slate-200 hover:border-blue-300 bg-white/80 hover:bg-white shadow-xs'
          }`}
      >
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black text-slate-800">
              Drag & drop CSV here, or{' '}
              <span className="text-blue-600 underline">browse files</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Format: <code className="px-1 py-0.5 rounded bg-slate-100 font-mono font-bold text-blue-700 text-[11px]">front,back,tags</code> (e.g. <span className="font-mono text-[11px] text-slate-600">bonjour,hello,greetings</span>)
            </p>
          </div>
        </div>

        {/* Sample CSV Download Links */}
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={downloadSampleCSV}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            title="Download sample CSV template format"
          >
            <Download className="w-3 h-3" />
            <span>Sample CSV</span>
          </button>
        </div>
      </div>

      {/* Notification / Status Message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold shadow-xs animate-in fade-in duration-150 ${statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filtering Bar with Hashtag Multiselect */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col gap-3.5">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          {/* Search Input - Full width below xl, protected min-width on xl */}
          <div className="relative w-full xl:min-w-[280px] xl:max-w-md flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="deck-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm font-semibold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-900"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-slate-100 rounded-2xl shrink-0 max-w-full">
              <button
                type="button"
                onClick={() => setFilterState('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${filterState === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                All ({cards.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterState('due')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${filterState === 'due'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                Due ({dueCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterState('new')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${filterState === 'new'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                New ({newCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterState('learning')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${filterState === 'learning'
                    ? 'bg-white text-amber-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                Learning ({learningCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterState('review')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${filterState === 'review'
                    ? 'bg-white text-emerald-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                Review ({reviewCount})
              </button>
            </div>

            {/* Columns Visibility Dropdown (Now placed contextually by the table filters!) */}
            <div className="relative shrink-0" ref={columnsMenuRef}>
              <button
                id="deck-columns-menu-btn"
                type="button"
                onClick={() => setShowColumnsMenu((prev) => !prev)}
                className={`h-9 px-3 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${showColumnsMenu
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
                  }`}
                title="Customize table columns"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Columns</span>
                <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-[10px] font-black text-slate-600">
                  {Object.values(visibleColumns).filter(Boolean).length}/{DECK_COLUMN_DEFINITIONS.length}
                </span>
              </button>

              {showColumnsMenu && (
                <div
                  id="deck-columns-dropdown"
                  className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 z-30 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Table Columns
                    </span>
                    <button
                      type="button"
                      onClick={handleResetVisibleColumns}
                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Reset All
                    </button>
                  </div>

                  <div className="flex flex-col gap-0.5 pt-1">
                    {DECK_COLUMN_DEFINITIONS.map((col) => {
                      const isChecked = !!visibleColumns[col.key];
                      return (
                        <label
                          key={col.key}
                          className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700 select-none transition-colors"
                        >
                          <span>{col.label}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleColumnVisibility(col.key)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-400 border-slate-300 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reverted Hashtag Multiselect Bar */}
        {allUniqueTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100">
            <span className="text-xs font-black text-slate-400 mr-1 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              Tags:
            </span>

            {allUniqueTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              const count = cards.filter((c) => c.tags?.includes(tag)).length;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  title={isSelected ? 'Click to deselect tag' : 'Click to filter by this tag'}
                >
                  <span>#{tag}</span>
                  <span
                    className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'
                      }`}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}

            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-xs text-blue-600 hover:underline font-bold ml-1.5 cursor-pointer"
              >
                Clear tags ({selectedTags.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cards Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                {/* Front Header with Contextual Voice Selector */}
                {visibleColumns.front && (
                  <th className="py-2.5 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        id="sort-front-header-btn"
                        type="button"
                        onClick={() => handleToggleSort('front')}
                        className="flex items-center gap-1.5 uppercase font-black tracking-wider text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer group"
                        title="Click to sort by Front"
                      >
                        <span>Front</span>
                        {sortField === 'front' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                        )}
                      </button>

                      {onSelectFrontLanguage && (
                        <div
                          className="relative inline-flex items-center normal-case"
                          title="Card audio voice for Front"
                        >
                          <select
                            id="table-front-voice-select"
                            value={frontLanguage}
                            onChange={(e) => onSelectFrontLanguage(e.target.value)}
                            aria-label="Front voice language"
                            className="appearance-none bg-slate-100/90 hover:bg-slate-200/90 border border-slate-200/90 rounded-md pl-1.5 pr-4 py-0.5 text-[10px] font-black text-slate-600 focus:outline-none cursor-pointer uppercase transition-colors"
                          >
                            {AVAILABLE_LANGUAGES.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.code.toUpperCase()} • {lang.label.split(' ')[0]}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-2.5 h-2.5 text-slate-400 pointer-events-none absolute right-1" />
                        </div>
                      )}
                    </div>
                  </th>
                )}

                {/* Back Header with Contextual Voice Selector */}
                {visibleColumns.back && (
                  <th className="py-2.5 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        id="sort-back-header-btn"
                        type="button"
                        onClick={() => handleToggleSort('back')}
                        className="flex items-center gap-1.5 uppercase font-black tracking-wider text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer group"
                        title="Click to sort by Back"
                      >
                        <span>Back</span>
                        {sortField === 'back' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                        )}
                      </button>

                      {onSelectBackLanguage && (
                        <div
                          className="relative inline-flex items-center normal-case"
                          title="Card audio voice for Back"
                        >
                          <select
                            id="table-back-voice-select"
                            value={backLanguage}
                            onChange={(e) => onSelectBackLanguage(e.target.value)}
                            aria-label="Back voice language"
                            className="appearance-none bg-slate-100/90 hover:bg-slate-200/90 border border-slate-200/90 rounded-md pl-1.5 pr-4 py-0.5 text-[10px] font-black text-slate-600 focus:outline-none cursor-pointer uppercase transition-colors"
                          >
                            {AVAILABLE_LANGUAGES.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.code.toUpperCase()} • {lang.label.split(' ')[0]}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-2.5 h-2.5 text-slate-400 pointer-events-none absolute right-1" />
                        </div>
                      )}
                    </div>
                  </th>
                )}

                {/* Tags Header */}
                {visibleColumns.tags && (
                  <th className="py-3 px-4">
                    <button
                      id="sort-tags-header-btn"
                      type="button"
                      onClick={() => handleToggleSort('tags')}
                      className="flex items-center gap-1.5 uppercase font-black tracking-wider text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer group"
                      title="Click to sort by Tags"
                    >
                      <span>Tags</span>
                      {sortField === 'tags' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                      )}
                    </button>
                  </th>
                )}

                {/* Status Header */}
                {visibleColumns.status && (
                  <th className="py-3 px-4">
                    <button
                      id="sort-status-header-btn"
                      type="button"
                      onClick={() => handleToggleSort('status')}
                      className="flex items-center gap-1.5 uppercase font-black tracking-wider text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer group"
                      title="Click to sort by Status"
                    >
                      <span>Status</span>
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                      )}
                    </button>
                  </th>
                )}

                {/* Interval Header */}
                {visibleColumns.interval && (
                  <th className="py-3 px-4">
                    <button
                      id="sort-interval-header-btn"
                      type="button"
                      onClick={() => handleToggleSort('interval')}
                      className="flex items-center gap-1.5 uppercase font-black tracking-wider text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer group"
                      title="Click to sort by Interval / Due Date"
                    >
                      <span>Interval</span>
                      {sortField === 'interval' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                      )}
                    </button>
                  </th>
                )}

                {/* Created Header */}
                {visibleColumns.created && (
                  <th className="py-3 px-4">
                    <button
                      id="sort-created-header-btn"
                      type="button"
                      onClick={() => handleToggleSort('created')}
                      className="flex items-center gap-1.5 uppercase font-black tracking-wider text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer group"
                      title="Click to sort by Created Date"
                    >
                      <span>Created</span>
                      {sortField === 'created' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                      )}
                    </button>
                  </th>
                )}

                {/* Modified Header */}
                {visibleColumns.modified && (
                  <th className="py-3 px-4">
                    <button
                      id="sort-modified-header-btn"
                      type="button"
                      onClick={() => handleToggleSort('modified')}
                      className="flex items-center gap-1.5 uppercase font-black tracking-wider text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer group"
                      title="Click to sort by Modified Date"
                    >
                      <span>Modified</span>
                      {sortField === 'modified' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                      )}
                    </button>
                  </th>
                )}

                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {sortedCards.length === 0 ? (
                <tr>
                  <td
                    colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
                    className="py-12 text-center text-slate-400 font-medium"
                  >
                    No cards found matching your search or filters.
                  </td>
                </tr>
              ) : (
                sortedCards.map((c) => {
                  const isDue = c.due <= now;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Front with Audio Pronunciation */}
                      {visibleColumns.front && (
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePlayWord(c)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${playingId === c.id
                                  ? 'bg-blue-500 text-white border-blue-600'
                                  : 'bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 border-slate-200 hover:border-blue-200'
                                }`}
                              title="Pronounce word"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            <span>{c.front}</span>
                          </div>
                        </td>
                      )}

                      {/* Back */}
                      {visibleColumns.back && (
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {c.back}
                        </td>
                      )}

                      {/* Tags */}
                      {visibleColumns.tags && (
                        <td className="py-3 px-4">
                          {c.tags && c.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {c.tags.map((t, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleToggleTag(t)}
                                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${selectedTags.includes(t)
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                    }`}
                                >
                                  <span>#{t}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      )}

                      {/* Learning State */}
                      {visibleColumns.status && (
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${c.state === 'review'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.state === 'learning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                          >
                            {c.state}
                          </span>
                        </td>
                      )}

                      {/* Interval / Due Status */}
                      {visibleColumns.interval && (
                        <td className="py-3 px-4 font-semibold text-slate-500">
                          {isDue ? (
                            <span className="text-rose-600 font-bold">Due Now</span>
                          ) : (
                            <span>{formatInterval((c.due - now) / 86400000)}</span>
                          )}
                        </td>
                      )}

                      {/* Created Date */}
                      {visibleColumns.created && (
                        <td className="py-3 px-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                          <span title={c.createdAt ? new Date(c.createdAt).toLocaleString() : undefined}>
                            {formatTimestamp(c.createdAt)}
                          </span>
                        </td>
                      )}

                      {/* Modified Date */}
                      {visibleColumns.modified && (
                        <td className="py-3 px-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                          <span
                            title={
                              c.modifiedAt || c.createdAt
                                ? new Date(c.modifiedAt || c.createdAt || 0).toLocaleString()
                                : undefined
                            }
                          >
                            {formatTimestamp(c.modifiedAt || c.createdAt)}
                          </span>
                        </td>
                      )}

                      {/* Actions: Edit & Delete */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit Button */}
                          <button
                            id={`edit-card-btn-${c.id}`}
                            type="button"
                            onClick={() => setEditingCard(c)}
                            title="Edit this card"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            id={`delete-card-btn-${c.id}`}
                            type="button"
                            onClick={() => onDeleteCard(c.id)}
                            title="Delete card"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Deck Utilities Footer */}
        <div className="p-4 bg-slate-50/60 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {sortField ? (
              <button
                type="button"
                onClick={() => setSortField(null)}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-blue-600 font-bold transition-colors cursor-pointer"
              >
                Clear Sort ({sortField} {sortDirection})
              </button>
            ) : (
              <span className="text-slate-400 font-medium italic">
                Tip: Click table headers to sort
              </span>
            )}
          </div>

          <span className="text-slate-400 font-medium">
            Showing {sortedCards.length} of {cards.length} cards
          </span>
        </div>
      </div>

      {/* Add Card Modal */}
      <AddCardModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddCard={onAddCard}
      />

      {/* Edit Card Modal */}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          isOpen={true}
          onClose={() => setEditingCard(null)}
          onSave={(updated) => {
            onUpdateCard(updated);
            setEditingCard(null);
          }}
        />
      )}

      {/* Dedup Duplicate Resolution Modal */}
      {pendingDedup && (
        <DedupReviewModal
          conflicts={pendingDedup.conflicts}
          newCardsCount={pendingDedup.newCards.length}
          filename={pendingDedup.filename}
          isOpen={true}
          onClose={() => setPendingDedup(null)}
          onApply={handleApplyDedupReview}
        />
      )}
    </div>
  );
};
