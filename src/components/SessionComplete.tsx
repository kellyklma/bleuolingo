import React from 'react';
import { RotateCw, PlusCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { SessionStats } from '../types';
import { BleuoMascot } from './BleuoMascot';

interface SessionCompleteProps {
  stats: SessionStats;
  onPracticeAll: () => void;
  onOpenUpload: () => void;
  onRestartSession: () => void;
}

export const SessionComplete: React.FC<SessionCompleteProps> = ({
  stats,
  onPracticeAll,
  onOpenUpload,
  onRestartSession,
}) => {
  const total = stats.totalReviewed;
  const recalled = stats.goodCount + stats.easyCount;
  const accuracyPercent = total > 0 ? Math.round((recalled / total) * 100) : 100;

  return (
    <motion.div
      id="session-complete-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-xl mx-auto px-4 py-8"
    >
      <div className="bg-white rounded-3xl p-8 border-2 border-blue-100 shadow-xl text-center relative overflow-hidden">
        {/* Playful Cheering Bleuo Mascot */}
        <div className="flex justify-center mb-3">
          <BleuoMascot mood="cheering" size="lg" />
        </div>

        <h2 id="session-complete-title" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Session Complete!
        </h2>
        <p className="text-sm font-semibold text-slate-500 mt-1 max-w-sm mx-auto">
          You're all caught up for now!
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-6 text-left">
          {/* Total Reviewed */}
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
            <span className="text-[11px] font-black text-blue-700 uppercase tracking-wider block">Reviewed</span>
            <span className="text-2xl font-black text-blue-900">{total}</span>
            <span className="text-[11px] font-semibold text-blue-600 block mt-0.5">cards this session</span>
          </div>

          {/* Retention Accuracy */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
            <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wider block">Recall Rate</span>
            <span className="text-2xl font-black text-emerald-900">{accuracyPercent}%</span>
            <span className="text-[11px] font-semibold text-emerald-600 block mt-0.5">Good & Easy</span>
          </div>

          {/* FSRS Learning Distribution */}
          <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">Ratings</span>
            <div className="text-xs font-bold text-slate-700 mt-1 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-rose-600">Again:</span> <span>{stats.againCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-600">Hard:</span> <span>{stats.hardCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">Good:</span> <span>{stats.goodCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-600">Easy:</span> <span>{stats.easyCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          {/* Practice Ahead */}
          <button
            id="practice-ahead-btn"
            type="button"
            onClick={onPracticeAll}
            className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-blue-500 hover:bg-blue-600 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            <span>Practice Ahead</span>
          </button>

          {/* Upload More Flashcards */}
          <button
            id="upload-more-cards-btn"
            type="button"
            onClick={onOpenUpload}
            className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 active:bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-blue-500" />
            <span>Add Cards</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
