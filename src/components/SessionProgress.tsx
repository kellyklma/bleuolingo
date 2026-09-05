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
    totalSessionTarget > 0 ? Math.min(100, Math.round((reviewedThisSession / totalSessionTarget) * 100)) : 100;

  return (
    <div id="session-progress-card" className="w-full flex items-center gap-3">
      {/* Cute Mascot Icon */}
      <BleuoMascot
        mood={progressPercent === 100 ? 'cheering' : reviewedThisSession > 3 ? 'wink' : 'happy'}
        size="sm"
        className="shrink-0"
      />

      {/* Duolingo Chunky Progress Bar */}
      <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden p-0.5 relative">
        <div
          id="session-progress-fill"
          className="h-full bg-blue-500 rounded-full transition-all duration-300 relative"
          style={{ width: `${Math.max(5, progressPercent)}%` }}
        >
          {/* Top Gloss Highlight (Duolingo style) */}
          <div className="absolute top-0.5 left-1 right-1 h-1 bg-white/40 rounded-full pointer-events-none" />
        </div>
      </div>

      {/* Count */}
      <div className="text-xs font-black text-slate-500 shrink-0 select-none">
        <span className="text-blue-600">{reviewedThisSession}</span>
        {activeQueueSize > 0 && <span className="text-slate-400">/{totalSessionTarget}</span>}
      </div>
    </div>
  );
};
