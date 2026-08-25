import React, { useState } from 'react';
import {
  MessageSquare, Home, LayoutDashboard, Database, Plus, Sparkles,
  ChevronDown, Settings, LogOut, Globe, Trash2,
  FileSpreadsheet, Server, ChevronsUpDown, X
} from 'lucide-react';
import SettingsModal from './SettingsModal';
import Logo from './Logo';

export default function Sidebar({
  activeSection,
  setActiveSection,
  activeDataSource,
  recentSessions = [],
  onDeleteSession,
  onNewChat,
  currentUser,
  onOpenAuth,
  onLogout,
  isOpen = false,
  onClose
}) {
  const [isRecentOpen, setIsRecentOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const activeUserName = currentUser ? currentUser.name : 'Guest User';
  const activeUserEmail = currentUser ? currentUser.email : 'name@gmail.com';
  const firstLetter = activeUserName.charAt(0).toUpperCase();

  const handleNav = (sec) => {
    setActiveSection(sec);
    if (onClose) onClose();
  };

  const handleOpenSettings = () => {
    setShowSettings(true);
    setShowProfileMenu(false);
    if (onClose) onClose();
  };

  const handleLogOutClick = () => {
    setShowProfileMenu(false);
    if (onClose) onClose();
    onLogout?.();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-fadeIn"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#111318] border-r border-slate-800/90 flex flex-col h-[100dvh] max-h-screen overflow-y-auto select-none font-sans shrink-0 antialiased transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleNav('home')}>
            <Logo iconSize="w-9 h-9" showText={false} />
            <div>
              <h1 className="text-xl font-black text-white tracking-tight leading-none">DataMind</h1>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">AI Platform</span>
            </div>
          </div>

          {/* Close Mobile Drawer Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={() => {
              if (onClose) onClose();
              onNewChat?.();
            }}
            className="w-full bg-white hover:bg-zinc-200 text-black font-black py-3 px-4 rounded-xl flex items-center justify-center space-x-2.5 shadow-md active:scale-[0.98] transition cursor-pointer text-base"
          >
            <Plus className="w-5 h-5 text-black" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Main Navigation Links */}
        <div className="px-4 space-y-1.5 overflow-y-auto flex-1">
          {/* Home */}
          <button
            onClick={() => handleNav('home')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-bold transition cursor-pointer ${
              activeSection === 'home'
                ? 'bg-[#181a20] text-white border border-zinc-600 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Home className="w-5 h-5 text-zinc-300" />
            <span>Home</span>
          </button>

          {/* Database Workspace */}
          <button
            onClick={() => handleNav('workspace')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-bold transition cursor-pointer ${
              activeSection === 'workspace'
                ? 'bg-[#181a20] text-white border border-zinc-600 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Database className="w-5 h-5 text-zinc-300" />
            <span>Database Workspace</span>
          </button>

          {/* Dashboards */}
          <button
            onClick={() => handleNav('dashboards')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-bold transition cursor-pointer ${
              activeSection === 'dashboards'
                ? 'bg-[#181a20] text-white border border-zinc-600 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 text-zinc-300" />
            <span>Dashboards</span>
          </button>

          {/* Data Sources */}
          <button
            onClick={() => handleNav('datasources')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-bold transition cursor-pointer ${
              activeSection === 'datasources'
                ? 'bg-[#181a20] text-white border border-zinc-600 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Server className="w-5 h-5 text-zinc-300" />
            <span>Data sources</span>
          </button>

          {/* General AI Chatbot */}
          <button
            onClick={() => handleNav('general')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-bold transition cursor-pointer ${
              activeSection === 'general'
                ? 'bg-[#181a20] text-white border border-zinc-600 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <MessageSquare className="w-5 h-5 text-zinc-300" />
            <span>General AI Chatbot</span>
          </button>

          {/* Product Landing */}
          <button
            onClick={() => handleNav('landing')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-bold transition cursor-pointer mt-4 border-t border-slate-800/80 pt-4 ${
              activeSection === 'landing'
                ? 'bg-[#181a20] text-white border border-zinc-600 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Globe className="w-5 h-5 text-zinc-300" />
            <span>Product Landing</span>
          </button>
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-800/80 relative mt-auto shrink-0">
          {/* User Footer Button */}
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#181a20] hover:bg-zinc-800/80 border border-slate-800 transition cursor-pointer"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                {firstLetter}
              </div>
              <span className="text-base font-bold text-zinc-100 truncate">{activeUserName}</span>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-zinc-400 shrink-0" />
          </button>

          {/* Profile Dropup Menu */}
          {showProfileMenu && (
            <div className="absolute bottom-full left-4 right-4 mb-3 bg-[#181a20] border border-zinc-700/80 rounded-2xl shadow-2xl p-2.5 z-50 animate-fadeIn space-y-1.5 text-base">
              {/* User Tile */}
              <div
                onClick={handleOpenSettings}
                className="p-3.5 bg-[#20222a] rounded-xl flex items-center space-x-3 cursor-pointer hover:bg-[#252832] transition"
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-black text-sm flex items-center justify-center shrink-0">
                  {firstLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-white truncate">{activeUserName}</p>
                  <p className="text-xs text-zinc-400 truncate">{activeUserEmail}</p>
                </div>
              </div>

              {/* Settings Item */}
              <button
                type="button"
                onClick={handleOpenSettings}
                className="w-full text-left px-4 py-3 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800 flex items-center space-x-3 transition cursor-pointer font-bold"
              >
                <Settings className="w-5 h-5 text-zinc-300" />
                <span>Settings</span>
              </button>

              {/* Log Out Item */}
              {currentUser ? (
                <button
                  type="button"
                  onClick={handleLogOutClick}
                  className="w-full text-left px-4 py-3 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 flex items-center space-x-3 transition cursor-pointer font-bold border-t border-zinc-800/80 pt-3"
                >
                  <LogOut className="w-5 h-5 text-rose-400" />
                  <span>Log Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onClose) onClose();
                    onOpenAuth?.();
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-white hover:bg-zinc-800 flex items-center space-x-3 transition cursor-pointer font-bold border-t border-zinc-800/80 pt-3"
                >
                  <LogOut className="w-5 h-5 text-white" />
                  <span>Sign In / Register</span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentUser={currentUser}
      />
    </>
  );
}
