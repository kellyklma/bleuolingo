import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Download, Check, AlertCircle, Sparkles, Trash2, Plus, ArrowRight } from 'lucide-react';
import { Flashcard } from '../types';
import { parseCSVText, convertRowsToFlashcards, downloadSampleCSV } from '../lib/csvParser';
import { BleuoMascot } from './BleuoMascot';

interface SpreadsheetCardInputProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCards: (newCards: Flashcard[], replace: boolean) => void;
  currentDeckCount: number;
}

const PRESET_DECKS: { name: string; lang: string; data: string }[] = [
  {
    name: 'French Daily Essentials',
    lang: 'fr-FR',
    data: `Front,Back\nBonjour,Hello / Good morning\nMerci beaucoup,Thank you very much\nS'il vous plaît,Please\nEnchanté,Nice to meet you\nÀ bientôt,See you soon\nL'addition,The bill / check\nOù est la gare ?,Where is the train station?\nJe voudrais un café,I would like a coffee`,
  },
  {
    name: 'Spanish Travel Phrases',
    lang: 'es-ES',
    data: `Front,Back\nHola,Hello\nMuchas gracias,Thank you very much\nPor favor,Please\nMucho gusto,Nice to meet you\nHasta luego,See you later\n¿Cuánto cuesta?,How much does it cost?\nLa cuenta, por favor,The check, please\nDisculpe,Excuse me`,
  },
  {
    name: 'Japanese Core Words',
    lang: 'ja-JP',
    data: `Front,Back\nこんにちは,Hello\nありがとう,Thank you\nお願いします,Please\nはじめまして,Nice to meet you\nさようなら,Goodbye\nいくらですか,How much is it?\nすみません,Excuse me\nはい、お願いします,Yes, please`,
  },
];

export const SpreadsheetCardInput: React.FC<SpreadsheetCardInputProps> = ({
  isOpen,
  onClose,
  onImportCards,
  currentDeckCount,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'single'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [selectedLang, setSelectedLang] = useState('fr-FR');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [previewCards, setPreviewCards] = useState<Flashcard[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Single card quick input state
  const [singleFront, setSingleFront] = useState('');
  const [singleBack, setSingleBack] = useState('');
  const [singleExample, setSingleExample] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processRawSpreadsheet = (text: string) => {
    const rows = parseCSVText(text);
    const { cards, errors } = convertRowsToFlashcards(rows, selectedLang);
    setPreviewCards(cards);
    setParseErrors(errors);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      processRawSpreadsheet(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      processRawSpreadsheet(content);
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedText(text);
    processRawSpreadsheet(text);
  };

  const handleLoadPreset = (preset: typeof PRESET_DECKS[0]) => {
    setSelectedLang(preset.lang);
    setPastedText(preset.data);
    processRawSpreadsheet(preset.data);
    setActiveTab('paste');
  };

  const handleAddSingleCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleFront.trim() || !singleBack.trim()) return;

    const newCard: Flashcard = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      front: singleFront.trim(),
      back: singleBack.trim(),
      example: singleExample.trim() || undefined,
      lang: selectedLang,
      state: 'new',
      stability: 0,
      difficulty: 5.0,
      reps: 0,
      lapses: 0,
      due: Date.now(),
    };

    setPreviewCards((prev) => [newCard, ...prev]);
    setSingleFront('');
    setSingleBack('');
    setSingleExample('');
  };

  const handleRemovePreviewCard = (id: string) => {
    setPreviewCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleConfirmImport = () => {
    if (previewCards.length === 0) return;
    onImportCards(previewCards, importMode === 'replace');
    onClose();
  };

  return (
    <div
      id="spreadsheet-input-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        id="spreadsheet-input-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border-2 border-blue-100 shadow-[0_20px_50px_rgba(37,99,235,0.15)] p-5 sm:p-7 flex flex-col relative"
      >
        {/* Header with Cute Mascot */}
        <div className="flex items-center justify-between pb-4 border-b border-blue-50">
          <div className="flex items-center gap-3">
            <BleuoMascot mood="happy" size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h3 id="spreadsheet-input-title" className="text-xl font-black text-slate-900 tracking-tight">
                  Spreadsheet Card Input
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[11px]">
                  Front & Back
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Paste or upload any 2-column spreadsheet (Word & Meaning)
              </p>
            </div>
          </div>

          <button
            id="close-spreadsheet-input-btn"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Format Banner & Sample Download */}
        <div className="my-4 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-sky-50 to-blue-50/80 border border-blue-100/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-extrabold text-blue-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Expected Columns:
            </span>
            <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-white border border-blue-200 font-bold text-blue-700">
                Column A: Front
              </span>
              <span className="text-slate-400 font-sans">→</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-blue-200 font-bold text-blue-700">
                Column B: Back
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              id="download-template-csv-btn"
              onClick={downloadSampleCSV}
              className="text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Download Template</span>
            </button>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="flex rounded-2xl bg-slate-100 p-1 mb-4 text-xs font-bold">
          <button
            id="tab-paste-spreadsheet"
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'paste'
                ? 'bg-white text-blue-600 shadow-xs border border-blue-100/60'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste Spreadsheet</span>
          </button>
          <button
            id="tab-upload-file"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-white text-blue-600 shadow-xs border border-blue-100/60'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File (.csv / .tsv)</span>
          </button>
          <button
            id="tab-single-card"
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'single'
                ? 'bg-white text-blue-600 shadow-xs border border-blue-100/60'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Single Card</span>
          </button>
        </div>

        {/* Tab 1: Paste Spreadsheet */}
        {activeTab === 'paste' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="paste-spreadsheet-box"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <span>Paste cells from Google Sheets / Excel / CSV</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Tab or comma separated</span>
              </div>
              <textarea
                id="paste-spreadsheet-box"
                rows={6}
                value={pastedText}
                onChange={handlePasteChange}
                placeholder={`Front,Back\nBonjour,Hello / Good morning\nMerci,Thank you\nAu revoir,Goodbye\nS'il vous plaît,Please`}
                className="w-full text-xs font-mono p-3 bg-slate-50 border-2 border-slate-200 focus:border-blue-400 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 text-slate-800 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Quick Starter Presets */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Or try a starter pack:
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESET_DECKS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleLoadPreset(preset)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-blue-50/70 hover:bg-blue-100 text-blue-700 border border-blue-200/70 transition-colors flex items-center gap-1"
                  >
                    <span>{preset.name}</span>
                    <ArrowRight className="w-3 h-3 text-blue-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Upload File */}
        {activeTab === 'upload' && (
          <div>
            <div
              id="drop-file-zone"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                  : 'border-blue-200 hover:border-blue-400 bg-blue-50/20 hover:bg-blue-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-14 h-14 mx-auto rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 shadow-xs">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-sm font-extrabold text-slate-800">
                Click to browse or drop your spreadsheet file here
              </p>
              <p className="text-xs font-medium text-slate-400 mt-1">
                Accepts <span className="font-mono text-blue-600 font-bold">.csv</span> or{' '}
                <span className="font-mono text-blue-600 font-bold">.tsv</span> with Front & Back columns
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Quick Single Card Form */}
        {activeTab === 'single' && (
          <form onSubmit={handleAddSingleCard} className="space-y-3 p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-blue-900 block mb-1">Front (Target Word) *</label>
                <input
                  type="text"
                  required
                  value={singleFront}
                  onChange={(e) => setSingleFront(e.target.value)}
                  placeholder="e.g. Chat"
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-blue-900 block mb-1">Back (Translation) *</label>
                <input
                  type="text"
                  required
                  value={singleBack}
                  onChange={(e) => setSingleBack(e.target.value)}
                  placeholder="e.g. Cat"
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-blue-900 block mb-1">Example sentence (optional)</label>
              <input
                type="text"
                value={singleExample}
                onChange={(e) => setSingleExample(e.target.value)}
                placeholder="e.g. Le chat dort sur le lit."
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Preview List</span>
              </button>
            </div>
          </form>
        )}

        {/* Parse errors / warnings */}
        {parseErrors.length > 0 && (
          <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Parsing Note:</p>
              <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                {parseErrors.slice(0, 3).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Live Preview of Parsed Cards (Front & Back) */}
        {previewCards.length > 0 && (
          <div className="mt-5 pt-4 border-t border-blue-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  {previewCards.length} Card{previewCards.length > 1 ? 's' : ''} Ready:
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  (Previewing Front & Back)
                </span>
              </div>

              {/* Append vs Replace Choice */}
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="text-blue-600 focus:ring-blue-400"
                  />
                  <span>Add to Deck ({currentDeckCount})</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-blue-600 focus:ring-blue-400"
                  />
                  <span className="text-rose-600">Replace Deck</span>
                </label>
              </div>
            </div>

            {/* Preview Table */}
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-blue-100 text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-blue-50/80 border-b border-blue-100 text-[11px] font-extrabold text-blue-900 sticky top-0">
                  <tr>
                    <th className="p-2.5 pl-3">Front (Word)</th>
                    <th className="p-2.5">Back (Meaning)</th>
                    <th className="p-2.5 text-right pr-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {previewCards.map((card) => (
                    <tr key={card.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-2.5 pl-3 font-bold text-slate-800">{card.front}</td>
                      <td className="p-2.5 text-slate-600 font-medium">{card.back}</td>
                      <td className="p-2.5 text-right pr-3">
                        <button
                          type="button"
                          onClick={() => handleRemovePreviewCard(card.id)}
                          className="text-slate-300 hover:text-rose-500 p-1 rounded-lg transition-colors"
                          title="Remove from import"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            id="cancel-spreadsheet-input-btn"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
          >
            Cancel
          </button>

          <button
            id="import-spreadsheet-confirm-btn"
            disabled={previewCards.length === 0}
            onClick={handleConfirmImport}
            className={`px-6 py-3 rounded-2xl font-extrabold text-sm flex items-center gap-2 shadow-md transition-all ${
              previewCards.length > 0
                ? 'bg-blue-500 hover:bg-blue-600 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 text-white cursor-pointer shadow-blue-500/25'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border-b-0'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {previewCards.length > 0
                ? `Import ${previewCards.length} Card${previewCards.length > 1 ? 's' : ''}`
                : 'Add Cards to Import'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
