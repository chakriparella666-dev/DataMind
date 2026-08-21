import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Sun, Moon } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password' | 'two-factor' | 'appearance'
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Active theme state ('dark' | 'light')
  const [themeMode, setThemeMode] = useState(() => {
    return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
  });

  useEffect(() => {
    const isLight = document.documentElement.classList.contains('theme-light');
    setThemeMode(isLight ? 'light' : 'dark');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleTheme = (mode) => {
    setThemeMode(mode);
    if (mode === 'light') {
      document.documentElement.classList.add('theme-light');
      localStorage.setItem('datamind_theme', 'light');
    } else {
      document.documentElement.classList.remove('theme-light');
      localStorage.setItem('datamind_theme', 'dark');
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#121419] border border-slate-800/90 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col font-sans select-none antialiased">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800/80 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-1">Settings</h2>
            <p className="text-sm text-slate-400">Manage your profile and account settings</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-navigation Links */}
        <div className="px-6 border-b border-slate-800/80 flex items-center space-x-6 text-sm font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3.5 border-b-2 transition cursor-pointer ${
              activeTab === 'profile'
                ? 'border-white text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Profile
          </button>

          <button
            onClick={() => setActiveTab('password')}
            className={`py-3.5 border-b-2 transition cursor-pointer ${
              activeTab === 'password'
                ? 'border-white text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Password
          </button>

          <button
            onClick={() => setActiveTab('two-factor')}
            className={`py-3.5 border-b-2 transition cursor-pointer ${
              activeTab === 'two-factor'
                ? 'border-white text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Two-Factor Auth
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`py-3.5 border-b-2 transition cursor-pointer ${
              activeTab === 'appearance'
                ? 'border-white text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Appearance
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 md:p-7 overflow-y-auto max-h-[70vh] space-y-6">
          
          {/* Saved Notification */}
          {savedSuccess && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-sm flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>Profile settings saved successfully!</span>
            </div>
          )}

          {/* Profile Tab Content */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Profile</h3>
                <p className="text-sm text-slate-400">Update your name and email address</p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-[#181a20] border border-slate-700/70 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full bg-[#181a20] border border-slate-700/70 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition"
                />
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-white hover:bg-slate-200 text-black font-bold text-sm rounded-xl transition cursor-pointer shadow-md active:scale-[0.98]"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Change Password</h3>
                <p className="text-sm text-slate-400">Update password associated with your DataMind account</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Current Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-[#181a20] border border-slate-700/70 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">New Password</label>
                <input
                  type="password"
                  placeholder="New password"
                  className="w-full bg-[#181a20] border border-slate-700/70 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                className="px-6 py-2.5 bg-white hover:bg-slate-200 text-black font-bold text-sm rounded-xl transition cursor-pointer shadow-md"
              >
                Save
              </button>
            </div>
          )}

          {/* Two-Factor Auth Tab */}
          {activeTab === 'two-factor' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Two-Factor Authentication</h3>
                <p className="text-sm text-slate-400">Add an extra layer of security to your account</p>
              </div>

              <div className="p-5 bg-[#181a20] border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white mb-0.5">Authenticator App (TOTP)</p>
                  <p className="text-xs text-slate-400">Use Google Authenticator or 1Password</p>
                </div>
                <button
                  type="button"
                  className="px-5 py-2 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-semibold text-sm rounded-xl cursor-pointer"
                >
                  Enable
                </button>
              </div>
            </div>
          )}

          {/* Appearance Tab with Working Light Mode / Dark Mode Toggle */}
          {activeTab === 'appearance' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Appearance Settings</h3>
                <p className="text-sm text-slate-400">Customize dark mode theme and light mode contrast</p>
              </div>

              <div className="p-5 bg-[#181a20] border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-200 mb-0.5">Theme Preference</p>
                    <p className="text-xs text-slate-400">Switch between dark charcoal and clean light theme</p>
                  </div>

                  <div className="flex items-center space-x-2 bg-[#121419] p-1 rounded-xl border border-slate-700/80">
                    <button
                      type="button"
                      onClick={() => handleToggleTheme('dark')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                        themeMode === 'dark'
                          ? 'bg-[#5850ec] text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span>Dark Mode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleTheme('light')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                        themeMode === 'light'
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span>Light Mode</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
