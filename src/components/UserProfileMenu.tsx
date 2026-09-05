import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, Trash2, Users, UserPlus, Pencil, X } from 'lucide-react';
import { UserProfile } from '../types';

interface UserProfileMenuProps {
  profiles: UserProfile[];
  activeUserId: string;
  onSelectUser: (userId: string) => void;
  onCreateUser: (name: string) => void;
  onDeleteUser: (userId: string) => void;
  onRenameUser: (userId: string, newName: string) => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  profiles,
  activeUserId,
  onSelectUser,
  onCreateUser,
  onDeleteUser,
  onRenameUser,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const activeProfile = profiles.find((p) => p.id === activeUserId) || profiles[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingUserId(null);
        setNewUserName('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserName.trim()) {
      onCreateUser(newUserName.trim());
      setNewUserName('');
      setIsCreating(false);
      setIsOpen(false);
    }
  };

  const handleSaveRename = (userId: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      onRenameUser(userId, trimmed);
    }
    setEditingUserId(null);
  };

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
    <div ref={menuRef} className="relative w-full">
      {/* Active User Pill / Trigger Button */}
      <button
        id="user-profile-trigger-btn"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between p-2 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-xl ${
              activeProfile?.avatarColor || 'bg-blue-500'
            } text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs`}
          >
            {getInitials(activeProfile?.name || 'User')}
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
              Learner
            </span>
            <span className="text-xs font-black text-slate-800 truncate mt-0.5">
              {activeProfile?.name || 'Learner'}
            </span>
          </div>
        </div>

        <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors">
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          id="user-profiles-dropdown"
          className="absolute left-0 top-full mt-2 w-full sm:w-76 bg-white rounded-2xl p-2.5 shadow-xl border border-slate-200/90 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2"
        >
          <div className="px-2 pt-1 pb-1.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span>Learner Profiles</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              {profiles.length} user{profiles.length === 1 ? '' : 's'}
            </span>
          </div>

          <p className="px-2 text-[11px] text-slate-500 font-medium leading-tight">
            Each learner has independent cards, CSV imports, and FSRS progress.
          </p>

          {/* User List */}
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-0.5">
            {profiles.map((profile) => {
              const isActive = profile.id === activeUserId;
              const isEditing = editingUserId === profile.id;

              return (
                <div
                  key={profile.id}
                  className={`group flex items-center justify-between p-2 rounded-xl transition-colors ${
                    isActive ? 'bg-blue-50/70 border border-blue-200/60' : 'hover:bg-slate-50'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(profile.id);
                          if (e.key === 'Escape') setEditingUserId(null);
                        }}
                        className="w-full text-xs font-bold px-2 py-1 bg-white border border-blue-400 rounded-lg focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(profile.id)}
                        className="p-1 rounded bg-blue-500 hover:bg-blue-600 text-white cursor-pointer shrink-0"
                        title="Save name"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingUserId(null)}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer shrink-0"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectUser(profile.id);
                          setIsOpen(false);
                        }}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <div
                          className={`w-6 h-6 rounded-lg ${
                            profile.avatarColor || 'bg-blue-500'
                          } text-white flex items-center justify-center font-black text-[10px] shrink-0`}
                        >
                          {getInitials(profile.name)}
                        </div>
                        <span
                          className={`text-xs truncate ${
                            isActive ? 'font-black text-blue-900' : 'font-bold text-slate-700'
                          }`}
                        >
                          {profile.name}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit name pencil button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingUserId(profile.id);
                            setEditName(profile.name);
                          }}
                          className="opacity-60 hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                          title="Rename profile"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>

                        {isActive && (
                          <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}

                        {!isActive && profiles.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(`Delete profile "${profile.name}" and all its saved cards?`)
                              ) {
                                onDeleteUser(profile.id);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Delete this profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add New Learner Section */}
          <div className="pt-1.5 border-t border-slate-100">
            {isCreating ? (
              <form onSubmit={handleCreateSubmit} className="flex flex-col gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Alex or French Learner"
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setNewUserName('');
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newUserName.trim()}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-[11px] font-black rounded-lg cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create</span>
                  </button>
                </div>
              </form>
            ) : (
              <button
                id="add-new-learner-btn"
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full py-1.5 px-2 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add New Learner Profile</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
