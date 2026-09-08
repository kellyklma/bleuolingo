import React from 'react';
import { BleuoMascot } from './BleuoMascot';

interface SessionProgressProps {
  reviewedThisSession: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  totalDeckSize: number;
}

export const SessionProgress: React.FC<SessionProgressProps> = ({
  reviewedThisSession,
  newCount,
  learningCount,
  reviewCount,
}) => {
  const activeQueueSize = newCount + learningCount + reviewCount;
  const totalSessionTarget = reviewedThisSession + activeQueueSize;

  const progressPercent =
    totalSessionTarget > 0
      ? Math.min(100, Math.round((reviewedThisSession / totalSessionTarget) * 100))
      : 0;

  return (
    <div id="session-progress-card" className="w-full flex flex-col gap-2">
      <div className="w-full flex items-center gap-3">
        <BleuoMascot
          mood={
            progressPercent === 100 && totalSessionTarget > 0
              ? 'cheering'
              : reviewedThisSession > 3
                ? 'wink'
                : 'happy'
          }
          size="sm"
          className="shrink-0"
        />

        <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden p-0.5 relative">
          <div
            id="session-progress-fill"
            className="h-full bg-blue-500 rounded-full transition-all duration-300 relative"
            style={{ width: `${progressPercent > 0 ? Math.max(5, progressPercent) : 0}%` }}
          >
            <div className="absolute top-0.5 left-1 right-1 h-1 bg-white/40 rounded-full pointer-events-none" />
          </div>
        </div>

        <div className="text-xs font-black text-slate-500 shrink-0 select-none">
          <span className="text-blue-600">{reviewedThisSession}</span>
          <span className="text-slate-400">/{totalSessionTarget}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-9 text-[11px] font-bold select-none">
        <span
          title="New cards to introduce"
          className={`px-2 py-0.5 rounded-md transition-colors ${newCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
            }`}
        >
          {newCount} New
        </span>
        <span
          title="Cards in short-term learning"
          className={`px-2 py-0.5 rounded-md transition-colors ${learningCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
            }`}
        >
          {learningCount} Learn
        </span>
        <span
          title="Scheduled review cards"
          className={`px-2 py-0.5 rounded-md transition-colors ${reviewCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
            }`}
        >
          {reviewCount} Review
        </span>
      </div>
    </div>
  );
};