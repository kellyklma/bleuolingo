import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { Flashcard } from '../types';
import { parseCSVText, convertRowsToFlashcards, downloadSampleCSV } from '../lib/csvParser';

interface CsvDropzoneProps {
  existingCards: Flashcard[];
  onAddCards: (newCards: Flashcard[], addedCount: number, skippedCount: number) => void;
}

export const CsvDropzone: React.FC<CsvDropzoneProps> = ({ existingCards, onAddCards }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processCSVContent = (content: string, filename?: string) => {
    try {
      const rows = parseCSVText(content);
      if (!rows || rows.length === 0) {
        setNotification({
          type: 'error',
          message: 'The file is empty or could not be parsed.',
        });
        return;
      }

      const { cards: parsedCards, errors } = convertRowsToFlashcards(rows);
      if (parsedCards.length === 0) {
        setNotification({
          type: 'error',
          message: errors[0] || 'No valid cards found in file.',
        });
        return;
      }

      // Check against existing deck to avoid duplicates and preserve algorithm state
      const existingSignatures = new Set(
        existingCards.map((c) => `${c.front.trim().toLowerCase()}|||${c.back.trim().toLowerCase()}`)
      );
      const existingFronts = new Set(
        existingCards.map((c) => c.front.trim().toLowerCase())
      );

      const cardsToAdd: Flashcard[] = [];
      let skippedCount = 0;

      for (const card of parsedCards) {
        const signature = `${card.front.trim().toLowerCase()}|||${card.back.trim().toLowerCase()}`;
        const frontKey = card.front.trim().toLowerCase();

        if (existingSignatures.has(signature) || existingFronts.has(frontKey)) {
          skippedCount++;
        } else {
          // New card - ensure clean initial FSRS state without touching existing cards
          cardsToAdd.push({
            ...card,
            id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          });
          existingSignatures.add(signature);
          existingFronts.add(frontKey);
        }
      }

      if (cardsToAdd.length === 0) {
        setNotification({
          type: 'success',
          message: `All ${skippedCount} card${skippedCount === 1 ? '' : 's'} from ${
            filename || 'file'
          } are already in your deck. Existing progress preserved!`,
        });
        return;
      }

      onAddCards(cardsToAdd, cardsToAdd.length, skippedCount);

      setNotification({
        type: 'success',
        message: `Added ${cardsToAdd.length} new card${cardsToAdd.length === 1 ? '' : 's'}! ${
          skippedCount > 0 ? `(${skippedCount} duplicate${skippedCount === 1 ? '' : 's'} skipped)` : ''
        }`,
      });

      setTimeout(() => {
        setNotification((prev) => (prev?.type === 'success' ? null : prev));
      }, 5000);
    } catch (err) {
      console.error('CSV parse error:', err);
      setNotification({
        type: 'error',
        message: 'Failed to read CSV. Please check the file format.',
      });
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      processCSVContent(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div id="csv-dropzone-wrapper" className="w-full max-w-xl mx-auto mb-4 px-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        id="csv-dropzone-container"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative rounded-2xl border border-dashed py-2.5 px-4 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50/90 shadow-sm ring-4 ring-blue-100'
            : 'border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/30 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-left">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isDragging ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800">
                Drop CSV here to add cards
              </p>
              <p className="text-[11px] font-medium text-slate-400">
                Or click to browse (.csv, .tsv)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              downloadSampleCSV();
            }}
            title="Download sample CSV template"
            className="shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Sample CSV</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div
          className={`mt-2 p-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-black text-sm px-1 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
