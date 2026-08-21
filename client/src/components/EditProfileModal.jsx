import React, { useState } from 'react';
import { X, Camera } from 'lucide-react';

export default function EditProfileModal({ isOpen, onClose, currentUser, onSave }) {
  const [displayName, setDisplayName] = useState(currentUser?.name || 'Chakri Parella');
  const [username, setUsername] = useState(currentUser?.username || 'sivachakri.parella23');

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ name: displayName, username });
    onClose();
  };

  const getInitials = (name) => {
    if (!name) return 'CP';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#202123] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Edit profile</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Avatar Circle */}
          <div className="flex justify-center">
            <div className="relative group cursor-pointer">
              <div className="w-28 h-28 rounded-full bg-amber-400 text-slate-900 font-bold text-3xl flex items-center justify-center shadow-lg border-2 border-amber-300">
                {getInitials(displayName)}
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#202123] border border-slate-600 flex items-center justify-center text-slate-300 shadow-md">
                <Camera className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-[#2a2b32] border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-white outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-[#2a2b32] border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-white outline-none transition"
              />
            </div>
          </div>

          {/* Footer Note */}
          <p className="text-[11px] text-slate-400 text-center">
            Your profile helps people recognize you in group chats.
          </p>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-full border border-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-white hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-full transition shadow-md cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
