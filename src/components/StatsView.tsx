import React, { useMemo } from 'react';
import { BarChart3, Layers, Clock, Sparkles, CheckCircle2, BookOpen } from 'lucide-react';
import { Flashcard, SessionStats } from '../types';
import { ActivityLog } from '../lib/activityStorage';
import { ProgressHeatmap } from './ProgressHeatmap';

interface StatsViewProps {
  activityLog: ActivityLog;
  cards: Flashcard[];
  sessionStats?: SessionStats;
  todayReviewedCount: number;
  dueCount: number;
}

export const StatsView: React.FC<StatsViewProps> = ({
  activityLog,
  cards,
  todayReviewedCount,
  dueCount,
}) => {
  // Deck mastery breakdown
  const stats = useMemo(() => {
    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let matureCount = 0; // Stability > 21 days
    let totalStability = 0;
    let totalDifficulty = 0;
    let ratedCount = 0;

    for (const card of cards) {
      if (card.state === 'new') {
        newCount++;
      } else if (card.state === 'learning' || card.state === 'relearning') {
        learningCount++;
      } else if (card.state === 'review') {
        reviewCount++;
      }

      if (card.reps > 0) {
        ratedCount++;
        totalStability += card.stability || 0;
        totalDifficulty += card.difficulty || 0;
        if ((card.stability || 0) >= 21) {
          matureCount++;
        }
      }
    }

    const avgStability = ratedCount > 0 ? (totalStability / ratedCount).toFixed(1) : '0';
    const avgDifficulty = ratedCount > 0 ? (totalDifficulty / ratedCount).toFixed(1) : '0';

    return {
      newCount,
      learningCount,
      reviewCount,
      matureCount,
      avgStability,
      avgDifficulty,
      totalCards: cards.length,
    };
  }, [cards]);

  return (
    <div id="stats-view" className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Study Activity &amp; Stats
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Track your daily review streaks, study heatmap, and deck mastery.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Today's Reviewed */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Today&apos;s Reviews</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-900">{todayReviewedCount}</span>
            <span className="text-xs font-semibold text-slate-500">cards</span>
          </div>
        </div>

        {/* Due for Review */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Due Today</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-2xl font-black ${dueCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {dueCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">pending</span>
          </div>
        </div>

        {/* Mature Cards */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Mature Cards</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-blue-600">{stats.matureCount}</span>
            <span className="text-xs font-semibold text-slate-500">/ {stats.totalCards}</span>
          </div>
        </div>

        {/* Average Memory Stability */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Avg Stability</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-indigo-600">{stats.avgStability}</span>
            <span className="text-xs font-semibold text-slate-500">days</span>
          </div>
        </div>
      </div>

      {/* Progress Heatmap & Consistency (The Core Study Activity Section) */}
      <ProgressHeatmap activityLog={activityLog} />

      {/* Deck State Breakdown */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase text-[11px] text-slate-400">
          Deck Memory Pipeline
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* New Cards */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">Unstudied New</div>
                <div className="text-base font-black text-slate-900">{stats.newCount} cards</div>
              </div>
            </div>
          </div>

          {/* Learning Cards */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">In Learning / Steps</div>
                <div className="text-base font-black text-slate-900">{stats.learningCount} cards</div>
              </div>
            </div>
          </div>

          {/* Review Cards */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">Graduated Review</div>
                <div className="text-base font-black text-slate-900">{stats.reviewCount} cards</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
