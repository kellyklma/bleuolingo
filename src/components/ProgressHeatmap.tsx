import React, { useState, useMemo } from 'react';
import { Flame, Trophy, CheckCircle2, CalendarDays, Activity, Sparkles, Zap } from 'lucide-react';
import { ActivityLog, formatDateKey, calculateStreak } from '../lib/activityStorage';

interface ProgressHeatmapProps {
  activityLog: ActivityLog;
  className?: string;
}

type RangeOption = '3m' | '6m' | '1y';

export const ProgressHeatmap: React.FC<ProgressHeatmapProps> = ({
  activityLog,
  className = '',
}) => {
  // Traditional range options: 3 months (13 weeks), 6 months (26 weeks), 1 year (52 weeks)
  const [selectedRange, setSelectedRange] = useState<RangeOption>('6m');
  const [hoveredCell, setHoveredCell] = useState<{
    date: Date;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Compute streaks and totals
  const { currentStreak, longestStreak, totalReviews } = useMemo(
    () => calculateStreak(activityLog),
    [activityLog]
  );

  // Compute all-time daily record and today's reviews
  const { dailyRecordCount, dailyRecordDateString, todayReviews, isNewRecordToday } = useMemo(() => {
    let maxCount = 0;
    let maxDate = '';
    for (const [dateKey, count] of Object.entries(activityLog)) {
      const num = Number(count) || 0;
      if (num > maxCount) {
        maxCount = num;
        maxDate = dateKey;
      }
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayKey = `${year}-${month}-${day}`;
    const todayCount = Number(activityLog[todayKey]) || 0;

    let dateStr = '';
    if (maxDate) {
      const [y, m, d] = maxDate.split('-').map(Number);
      const dObj = new Date(y, m - 1, d);
      dateStr = dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    return {
      dailyRecordCount: maxCount,
      dailyRecordDateString: dateStr,
      todayReviews: todayCount,
      isNewRecordToday: todayCount > 0 && todayCount >= maxCount,
    };
  }, [activityLog]);

  // Collect sorted list of active days (most recent first)
  const activeDaysList = useMemo(() => {
    return Object.entries(activityLog)
      .filter(([_, count]) => (Number(count) || 0) > 0)
      .sort((a, b) => b[0].localeCompare(a[0])) // latest first
      .map(([dateKey, count]) => {
        const [y, m, d] = dateKey.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return {
          dateKey,
          dateObj,
          count: Number(count),
        };
      });
  }, [activityLog]);

  const activeDaysCount = activeDaysList.length;

  // Traditional week-column grid (GitHub / Anki style)
  const { weeks, monthLabels, daysWithActivityCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekCount = selectedRange === '3m' ? 14 : selectedRange === '6m' ? 26 : 52;
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - currentDayOfWeek));

    const totalDays = weekCount * 7;
    const startDate = new Date(endOfWeek);
    startDate.setDate(endOfWeek.getDate() - totalDays + 1);

    const generatedWeeks: {
      date: Date;
      dateKey: string;
      count: number;
      isFuture: boolean;
      isToday: boolean;
    }[][] = [];

    const monthHeaders: { name: string; colIndex: number }[] = [];
    let lastMonth = -1;
    let daysWithReviews = 0;

    let currentWeek: {
      date: Date;
      dateKey: string;
      count: number;
      isFuture: boolean;
      isToday: boolean;
    }[] = [];

    const cursor = new Date(startDate);

    for (let i = 0; i < totalDays; i++) {
      const colIdx = Math.floor(i / 7);
      const m = cursor.getMonth();

      // Place month header when entering a new month
      if (m !== lastMonth && cursor.getDate() <= 7) {
        monthHeaders.push({
          name: cursor.toLocaleDateString(undefined, { month: 'short' }),
          colIndex: colIdx,
        });
        lastMonth = m;
      }

      const dateKey = formatDateKey(cursor);
      const isToday = cursor.toDateString() === today.toDateString();
      const isFuture = cursor > today;
      const count = isFuture ? 0 : Number(activityLog[dateKey]) || 0;

      if (count > 0) {
        daysWithReviews++;
      }

      currentWeek.push({
        date: new Date(cursor),
        dateKey,
        count,
        isFuture,
        isToday,
      });

      if (currentWeek.length === 7) {
        generatedWeeks.push(currentWeek);
        currentWeek = [];
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      generatedWeeks.push(currentWeek);
    }

    return {
      weeks: generatedWeeks,
      monthLabels: monthHeaders,
      daysWithActivityCount: daysWithReviews,
    };
  }, [activityLog, selectedRange]);

  // Clean, modern GitHub/Anki aesthetic color scaling
  const getCellColor = (count: number, isFuture: boolean, isToday: boolean) => {
    if (isFuture) {
      return 'bg-slate-100/50 border border-slate-200/40 opacity-30 cursor-default';
    }
    if (count === 0) {
      return isToday
        ? 'bg-blue-50 border-2 border-blue-500 ring-1 ring-blue-300 cursor-pointer shadow-xs'
        : 'bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 cursor-pointer transition-colors';
    }
    if (count <= 3) {
      return isToday
        ? 'bg-blue-200 border-2 border-blue-600 ring-1 ring-blue-400 hover:bg-blue-300 cursor-pointer shadow-xs'
        : 'bg-blue-100 hover:bg-blue-200 border border-blue-200 cursor-pointer transition-colors';
    }
    if (count <= 7) {
      return isToday
        ? 'bg-blue-400 border-2 border-blue-700 ring-1 ring-blue-500 hover:bg-blue-500 cursor-pointer shadow-xs'
        : 'bg-blue-300 hover:bg-blue-400 border border-blue-400 cursor-pointer transition-colors';
    }
    if (count <= 14) {
      return isToday
        ? 'bg-blue-600 border-2 border-blue-800 ring-1 ring-blue-500 hover:bg-blue-700 cursor-pointer shadow-xs'
        : 'bg-blue-500 hover:bg-blue-600 border border-blue-600 cursor-pointer transition-colors';
    }
    return isToday
      ? 'bg-blue-800 border-2 border-slate-900 ring-1 ring-blue-600 hover:bg-blue-900 cursor-pointer shadow-xs'
      : 'bg-blue-700 hover:bg-blue-800 border border-blue-800 cursor-pointer transition-colors';
  };

  const formatDateLabel = (d: Date): string => {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeDay = (dateObj: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateObj);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div
      id="settings-progress-heatmap"
      className={`rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col gap-6 ${className}`}
    >
      {/* Top Header: Title, Description & Traditional Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Study Activity
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Consistent daily practice heatmap and study momentum tracking.
            </p>
          </div>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl self-start sm:self-auto border border-slate-200/60">
          <button
            type="button"
            onClick={() => setSelectedRange('3m')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedRange === '3m'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3 Months
          </button>
          <button
            type="button"
            onClick={() => setSelectedRange('6m')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedRange === '6m'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            6 Months
          </button>
          <button
            type="button"
            onClick={() => setSelectedRange('1y')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedRange === '1y'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1 Year
          </button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Current Streak */}
        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex flex-col justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
            <Flame
              className={`w-3.5 h-3.5 ${
                currentStreak > 0 ? 'text-amber-500 fill-amber-500 animate-pulse' : 'text-slate-400'
              }`}
            />
            <span>Current Streak</span>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 tracking-tight">
              {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              {currentStreak > 0 ? 'Consistent practice' : 'Start streak today'}
            </div>
          </div>
        </div>

        {/* Longest Streak */}
        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex flex-col justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Best Streak</span>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 tracking-tight">
              {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Personal longest streak
            </div>
          </div>
        </div>

        {/* Daily Record Tracker */}
        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex flex-col justify-between gap-1.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
              <Zap className="w-3.5 h-3.5 text-violet-600 fill-violet-600" />
              <span>Daily Record</span>
            </div>
            {isNewRecordToday && (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-[10px] font-black text-amber-800 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                New!
              </span>
            )}
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span>{dailyRecordCount}</span>
              <span className="text-xs font-bold text-slate-400">cards/day</span>
            </div>
            <div className="mt-1">
              {dailyRecordCount > 0 ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                    <span>Today: {todayReviews}</span>
                    <span>
                      {isNewRecordToday
                        ? 'Record matched!'
                        : `${Math.round((todayReviews / dailyRecordCount) * 100)}%`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-violet-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.round((todayReviews / dailyRecordCount) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[11px] font-semibold text-slate-400">Review to set record</div>
              )}
            </div>
          </div>
        </div>

        {/* Total Reviews */}
        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex flex-col justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Total Reviews</span>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 tracking-tight">
              {totalReviews}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Cards reviewed all-time
            </div>
          </div>
        </div>

        {/* Active Study Days */}
        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex flex-col justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
            <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active Days</span>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 tracking-tight">
              {activeDaysCount}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Total active sessions
            </div>
          </div>
        </div>
      </div>

      {/* Traditional GitHub-Style Clean Heatmap Grid */}
      <div className="flex flex-col gap-2.5 select-none bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>
            {daysWithActivityCount} active study day{daysWithActivityCount === 1 ? '' : 's'} recorded
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span>Less</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-[3px] bg-slate-100 border border-slate-200/80" title="0 reviews" />
              <span className="w-3 h-3 rounded-[3px] bg-blue-100 border border-blue-200" title="1-3 reviews" />
              <span className="w-3 h-3 rounded-[3px] bg-blue-300 border border-blue-400" title="4-7 reviews" />
              <span className="w-3 h-3 rounded-[3px] bg-blue-500 border border-blue-600" title="8-14 reviews" />
              <span className="w-3 h-3 rounded-[3px] bg-blue-700 border border-blue-800" title="15+ reviews" />
            </div>
            <span>More</span>
          </div>
        </div>

        {/* Scrollable Container with Smooth Padding */}
        <div className="overflow-x-auto pb-2 pt-1 no-scrollbar">
          <div className="inline-flex flex-col">
            {/* Month Labels row */}
            <div className="flex items-center pl-7 pb-1 text-[11px] font-bold text-slate-400 relative h-4">
              {monthLabels.map((lbl, idx) => {
                const leftPos = lbl.colIndex * 15; // 12px tile + 3px gap
                return (
                  <span
                    key={idx}
                    className="absolute uppercase tracking-wider text-[10px]"
                    style={{ left: `${leftPos + 28}px` }}
                  >
                    {lbl.name}
                  </span>
                );
              })}
            </div>

            {/* Matrix: Day Labels + Week Columns */}
            <div className="flex items-start gap-2">
              {/* Day of Week Labels (Traditional GitHub style: Mon, Wed, Fri) */}
              <div className="flex flex-col gap-[3px] text-[9px] font-bold text-slate-400 pt-0.5 select-none w-5">
                <span className="h-3 flex items-center"></span>
                <span className="h-3 flex items-center leading-none">Mon</span>
                <span className="h-3 flex items-center"></span>
                <span className="h-3 flex items-center leading-none">Wed</span>
                <span className="h-3 flex items-center"></span>
                <span className="h-3 flex items-center leading-none">Fri</span>
                <span className="h-3 flex items-center"></span>
              </div>

              {/* Week Columns of Clean Square Tiles */}
              <div className="flex gap-[3px]">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px]">
                    {week.map((day, dIdx) => (
                      <div
                        key={dIdx}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({
                            date: day.date,
                            count: day.count,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] transition-transform hover:scale-125 ${getCellColor(
                          day.count,
                          day.isFuture,
                          day.isToday
                        )}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl whitespace-nowrap flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-75"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 6}px`,
          }}
        >
          <span className="text-slate-200">{formatDateLabel(hoveredCell.date)}</span>
          <span className="text-slate-500">•</span>
          <span className={hoveredCell.count > 0 ? 'text-blue-300 font-bold' : 'text-slate-400'}>
            {hoveredCell.count === 0
              ? 'No reviews logged'
              : `${hoveredCell.count} card${hoveredCell.count === 1 ? '' : 's'} reviewed`}
          </span>
        </div>
      )}
    </div>
  );
};
