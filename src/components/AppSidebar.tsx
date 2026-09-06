import React from 'react';
import {
  Layers,
  BookOpen,
  Flame,
  CheckCircle2,
  PanelLeftClose,
  PanelLeft,
  Settings,
} from 'lucide-react';
import { BleuoMascot } from './BleuoMascot';
import { playPronunciation } from '../lib/audio';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';
import { LogIn, LogOut } from 'lucide-react';
import { ActivityLog } from '../lib/activityStorage';

export type NavigationTab = 'practice' | 'deck' | 'settings';

interface AppSidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  dueCount: number;
  totalCards: number;
  reviewedCount: number;
  activityLog: ActivityLog;
  mascotMood: 'happy' | 'thinking' | 'cheering' | 'wink';
  profiles: UserProfile[];
  activeUserId: string;
  onSelectUser: (userId: string) => void;
  onCreateUser: (name: string) => void;
  onDeleteUser: (userId: string) => void;
  onRenameUser: (userId: string, newName: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  currentUser?: User | null;
  onLogin?: () => void;
  onLogout?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onSelectTab,
  dueCount,
  totalCards,
  reviewedCount,
  activityLog,
  mascotMood,
  profiles,
  activeUserId,
  onSelectUser,
  onCreateUser,
  onDeleteUser,
  onRenameUser,
  isCollapsed = false,
  onToggleCollapse,
  currentUser,
  onLogin,
  onLogout
}) => {
  const handleTestSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPronunciation('Bonjour ! Bienvenue sur Bleuolingo.', 'fr');
  };

  const activeProfile = profiles.find((p) => p.id === activeUserId) || profiles[0];

  const getInitials = (name: string) => {
    return (
      name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U'
    );
  };

  return (
    <aside
      id="app-left-sidebar"
      className={`w-full ${isCollapsed ? 'md:w-20 p-3 sm:p-3' : 'md:w-72 lg:w-80 p-4 sm:p-5'
        } md:h-screen md:sticky md:top-0 bg-white/95 backdrop-blur-xl border-r border-slate-200/80 flex flex-col justify-between shrink-0 select-none z-30 transition-all duration-200 shadow-[1px_0_10px_rgba(0,0,0,0.02)]`}
    >
      {/* Top Header & Brand */}
      <div className="flex flex-col gap-4">
        {/* Brand Banner with Duolingo-style Blue Beagle Mascot */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-3'}`}>
            {/* Mascot Avatar Container */}
            <div
              className="relative group cursor-pointer"
              onClick={handleTestSound}
              title="Click Bleuo for a greeting!"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-50 to-sky-100/90 border border-blue-200/70 p-1 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <BleuoMascot mood={mascotMood} size="sm" className="w-10 h-10" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="font-black text-slate-900 text-xl tracking-tight leading-none">
                  Bleuolingo
                </h1>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          {onToggleCollapse && !isCollapsed && (
            <button
              id="sidebar-collapse-btn"
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed expand button on top */}
        {isCollapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:flex mx-auto p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Expand sidebar"
          >
            <PanelLeft className="w-5 h-5 text-blue-600" />
          </button>
        )}

        {/* Firebase Google Auth Button */}
        <div className="p-3 border-t border-slate-100">
          {currentUser ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-7 h-7 rounded-full border border-slate-200"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                    {currentUser.displayName?.[0] || 'U'}
                  </div>
                )}
                {!isCollapsed && (
                  <span className="text-xs font-bold text-slate-700 truncate">
                    {currentUser.displayName || currentUser.email}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer ${isCollapsed ? 'px-2' : ''
                }`}
              title="Sign in with Google"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Sign In</span>}
            </button>
          )}
        </div>

        {/* Daily Focus Card (Above Study Tab) */}
        {!isCollapsed && (
          <div className="rounded-2xl bg-gradient-to-b from-slate-50 to-blue-50/40 border border-slate-200/80 p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                Daily Focus
              </span>
              <span className="font-black text-blue-600">
                {reviewedCount} reviewed
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(8, (reviewedCount / Math.max(1, totalCards)) * 100))}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-0.5">
              <span>Deck: {totalCards} cards</span>
              <span className={dueCount > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                {dueCount} due
              </span>
            </div>
          </div>
        )}

        {/* Primary Navigation Rail */}
        <nav className="flex flex-col gap-2">
          {/* Study View */}
          <button
            id="nav-practice-tab"
            type="button"
            onClick={() => onSelectTab('practice')}
            title="Study"
            className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-3'
              } rounded-2xl font-bold text-sm transition-all cursor-pointer relative ${activeTab === 'practice'
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${activeTab === 'practice' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                  }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              {!isCollapsed && <span className="font-extrabold tracking-tight">Study</span>}
            </div>

            {/* Badges */}
            {!isCollapsed ? (
              dueCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-black transition-all ${activeTab === 'practice'
                    ? 'bg-white text-blue-600'
                    : 'bg-rose-500 text-white animate-pulse'
                    }`}
                >
                  {dueCount} due
                </span>
              ) : (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-black flex items-center gap-1 ${activeTab === 'practice' ? 'bg-white/25 text-white' : 'bg-emerald-50 text-emerald-600'
                    }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Done
                </span>
              )
            ) : dueCount > 0 ? (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                {dueCount > 99 ? '99+' : dueCount}
              </span>
            ) : null}
          </button>

          {/* Deck View */}
          <button
            id="nav-deck-tab"
            type="button"
            onClick={() => onSelectTab('deck')}
            title="Deck"
            className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-3'
              } rounded-2xl font-bold text-sm transition-all cursor-pointer relative ${activeTab === 'deck'
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${activeTab === 'deck' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
              >
                <BookOpen className="w-4 h-4" />
              </div>
              {!isCollapsed && <span className="font-extrabold tracking-tight">Deck</span>}
            </div>

            {!isCollapsed ? (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'deck' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
              >
                {totalCards}
              </span>
            ) : (
              <span className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center border border-white">
                {totalCards}
              </span>
            )}
          </button>

          {/* Settings Tab */}
          <button
            id="nav-settings-tab-btn"
            type="button"
            onClick={() => onSelectTab('settings')}
            title={isCollapsed ? 'Settings' : undefined}
            className={`w-full flex items-center justify-between ${isCollapsed ? 'px-2 py-2.5 justify-center' : 'px-3.5 py-2.5'
              } rounded-2xl font-bold text-sm transition-all cursor-pointer relative ${activeTab === 'settings'
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${activeTab === 'settings' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
              >
                <Settings className="w-4 h-4" />
              </div>
              {!isCollapsed && <span className="font-extrabold tracking-tight">Settings</span>}
            </div>
          </button>
        </nav>
      </div>

      {/* Footer / Empty Spacer */}
      <div />
    </aside>
  );
};
