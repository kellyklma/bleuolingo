import React from 'react';
import { Clock, Plus, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SessionStats } from '../types';
import { BleuoMascot } from './BleuoMascot';

interface SessionCompleteProps {
  stats: SessionStats;
  onReviewAhead: () => void;
  cardsDueAheadCount: number;
  onAddTodayOverride?: (count: number) => void;
  unintroducedNewCardsCount?: number;
  newCardsIntroducedToday?: number;
  dailyNewLimit?: number;
  onStartFreeStudy: () => void;
  onRestartSession: () => void;
}

export const SessionComplete: React.FC<SessionCompleteProps> = ({
  stats,
  onReviewAhead,
  cardsDueAheadCount = 0,
  onAddTodayOverride,
  unintroducedNewCardsCount = 0,
  newCardsIntroducedToday = 0,
  dailyNewLimit = 0,
  onStartFreeStudy,
}) => {
  const total = stats.totalReviewed;
  const recalled = stats.goodCount + stats.easyCount;
  const accuracyPercent = total > 0 ? Math.round((recalled / total) * 100) : 100;
  const newCardsBatchCount = Math.min(5, unintroducedNewCardsCount);

  return (
    <motion.div
      id="session-complete-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-xl mx-auto px-4 py-8"
    >
      <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-blue-100 shadow-xl text-center relative overflow-hidden">
        {/* Mascot */}
        <div className="flex justify-center mb-3">
          <BleuoMascot mood="cheering" size="lg" />
        </div>

        <h2 id="session-complete-title" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Session Complete!
        </h2>
        <p className="text-sm font-semibold text-slate-500 mt-1 max-w-sm mx-auto">
          You&apos;re completely caught up on your scheduled reviews for now.
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
            <span className="text-[11px] font-semibold text-emerald-600 block mt-0.5">Good &amp; Easy</span>
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
        <div className="flex flex-col gap-2.5 pt-2">
          {/* Top row: Clean Minimalist Review Ahead & Single Add New Cards Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {/* Cleaner Review Ahead button keeping # cards expected to add */}
            <button
              id="review-ahead-btn"
              type="button"
              onClick={onReviewAhead}
              disabled={cardsDueAheadCount === 0}
              className={`w-full sm:flex-1 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                cardsDueAheadCount > 0
                  ? 'border border-blue-200 bg-blue-50/80 hover:bg-blue-100/90 text-blue-700 shadow-2xs cursor-pointer'
                  : 'border border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
              title={
                cardsDueAheadCount > 0
                  ? `Review ${cardsDueAheadCount} card${cardsDueAheadCount === 1 ? '' : 's'} scheduled within the next 24 hours`
                  : 'No reviews due within the next 24 hours'
              }
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Review Ahead ({cardsDueAheadCount})</span>
            </button>

            {/* Single minimalist button to add new cards */}
            {unintroducedNewCardsCount > 0 && onAddTodayOverride ? (
              <button
                id="session-complete-add-today-new-btn"
                type="button"
                onClick={() => onAddTodayOverride(newCardsBatchCount)}
                className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title={`Unlock ${newCardsBatchCount} more new card${newCardsBatchCount === 1 ? '' : 's'} today in excess of daily limit`}
              >
                <Plus className="w-3.5 h-3.5 text-slate-500 stroke-[2.5]" />
                <span>Add New Cards (+{newCardsBatchCount})</span>
              </button>
            ) : (
              <div className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 font-medium text-xs flex items-center justify-center gap-1.5 select-none">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>All New Cards Studied</span>
              </div>
            )}
          </div>

          {/* Minimalist Free-Study Mode Option */}
          <button
            id="session-complete-free-study-btn"
            type="button"
            onClick={onStartFreeStudy}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 hover:border-purple-200 bg-white hover:bg-purple-50/40 text-slate-600 hover:text-purple-700 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-600" />
            <span>Free-Study Mode (Bypass Scheduling)</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
