import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import DatabaseWorkspace from './pages/DatabaseWorkspace';
import GeneralChatPage from './pages/GeneralChatPage';
import DashboardsPage from './pages/DashboardsPage';
import DataSourcesPage from './pages/DataSourcesPage';
import { getMe, getDataSources, getChatSessions } from './services/api';

export default function App() {
  const [activeSection, setActiveSection] = useState('landing');
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dataSources, setDataSources] = useState([]);
  const [activeDataSource, setActiveDataSource] = useState(null);

  // Database Workspace Persisted State across sidebar navigation & page reloads
  const [workspaceQuestion, setWorkspaceQuestion] = useState(() => {
    try {
      return localStorage.getItem('datamind_workspace_question') || '';
    } catch (e) { return ''; }
  });
  const [workspaceActiveQuery, setWorkspaceActiveQuery] = useState(() => {
    try {
      const saved = localStorage.getItem('datamind_workspace_active_query');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  const [workspaceRecentQueries, setWorkspaceRecentQueries] = useState(() => {
    try {
      const saved = localStorage.getItem('datamind_workspace_recent_queries');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    try {
      if (workspaceQuestion) {
        localStorage.setItem('datamind_workspace_question', workspaceQuestion);
      } else {
        localStorage.removeItem('datamind_workspace_question');
      }
    } catch (e) { }
  }, [workspaceQuestion]);

  useEffect(() => {
    try {
      if (workspaceActiveQuery) {
        localStorage.setItem('datamind_workspace_active_query', JSON.stringify(workspaceActiveQuery));
      } else {
        localStorage.removeItem('datamind_workspace_active_query');
      }
    } catch (e) { }
  }, [workspaceActiveQuery]);

  useEffect(() => {
    try {
      localStorage.setItem('datamind_workspace_recent_queries', JSON.stringify(workspaceRecentQueries));
    } catch (e) { }
  }, [workspaceRecentQueries]);

  // Fetch recent queries from database on load to restore state after refresh
  useEffect(() => {
    getChatSessions()
      .then(res => {
        if (res.success && Array.isArray(res.sessions)) {
          const formatted = res.sessions.map(s => ({
            id: s.sessionId || s._id || s.id,
            question: s.question || s.title || '',
            sql: s.sql || '',
            explanation: s.explanation || '',
            columns: s.columns || s.fields || [],
            rows: s.rows || s.data || [],
            rowCount: s.rowCount !== undefined ? s.rowCount : (s.data ? s.data.length : 0),
            executionTimeMs: s.executionTimeMs || 180
          })).filter(s => s.question);

          if (formatted.length > 0) {
            setWorkspaceRecentQueries(prev => {
              const map = new Map();
              [...prev, ...formatted].forEach(q => {
                if (q.question) map.set(q.question.trim().toLowerCase(), q);
              });
              return Array.from(map.values());
            });
          }
        }
      })
      .catch(err => {
        console.warn('[Fetch Sessions Warning]:', err.message);
      });
  }, [currentUser]);

  // Recent chat sessions
  const [recentSessions, setRecentSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('datamind_recent_sessions');
      return saved ? JSON.parse(saved) : [
        { id: 's1', title: 'Top 5 Students by Age', time: '10m ago' },
        { id: 's2', title: 'Average GPA Analysis', time: '1h ago' }
      ];
    } catch (e) {
      return [];
    }
  });

  // General Chat Persisted State across tab navigation
  const [generalChatMessages, setGeneralChatMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('datamind_general_chat_messages');
      return saved ? JSON.parse(saved) : [
        {
          id: 'welcome',
          sender: 'agent',
          text: 'Hello! I am your General AI Assistant. Ask me SQL questions, database design advice, how to write complex joins/CTEs, or general programming help!'
        }
      ];
    } catch (e) {
      return [
        {
          id: 'welcome',
          sender: 'agent',
          text: 'Hello! I am your General AI Assistant. Ask me SQL questions, database design advice, how to write complex joins/CTEs, or general programming help!'
        }
      ];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('datamind_general_chat_messages', JSON.stringify(generalChatMessages));
    } catch (e) { }
  }, [generalChatMessages]);

  // Theme Initialization on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('datamind_theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
  }, []);

  // Verify Auth on mount
  useEffect(() => {
    const token = localStorage.getItem('datamind_token');
    if (token) {
      getMe()
        .then(res => {
          if (res.success) {
            setCurrentUser(res.user);
          }
        })
        .catch(err => {
          console.warn('Auth verify error:', err.message);
        });
    }
  }, []);

  // Helper for per-user localStorage keys
  const getUserKey = (keyName) => {
    const uid = currentUser ? (currentUser.id || currentUser.email || 'user') : 'guest';
    return `datamind_${keyName}_${uid}`;
  };

  // Helper to update & persist active dataset per user permanently
  const handleSelectActiveDataSource = (ds) => {
    if (!ds) return;
    setActiveDataSource(ds);
    try {
      const idStr = String(ds.id || ds._id || '');
      const dsName = ds.name || '';
      const dsKey = getUserKey('active_ds_id');
      const nameKey = getUserKey('active_ds_name');
      if (idStr) localStorage.setItem(dsKey, idStr);
      if (dsName) localStorage.setItem(nameKey, dsName);
      localStorage.setItem('datamind_global_active_ds_name', dsName);
    } catch (e) { }
  };

  // Fetch Data Sources strictly scoped per user and preserve user selected database
  useEffect(() => {
    getDataSources()
      .then(res => {
        if (res.success && Array.isArray(res.dataSources) && res.dataSources.length > 0) {
          setDataSources(res.dataSources);
          const savedDsId = localStorage.getItem(getUserKey('active_ds_id'));
          const savedDsName = localStorage.getItem(getUserKey('active_ds_name')) || localStorage.getItem('datamind_global_active_ds_name');

          setActiveDataSource(prev => {
            // 1. Match by saved dataset ID for this user
            if (savedDsId) {
              const matchSavedId = res.dataSources.find(ds => String(ds.id || ds._id || '') === String(savedDsId));
              if (matchSavedId) return matchSavedId;
            }
            // 2. Match by saved dataset Name across logins (e.g. "student_database_100_records.xlsx")
            if (savedDsName) {
              const matchSavedName = res.dataSources.find(ds => ds.name === savedDsName);
              if (matchSavedName) return matchSavedName;
            }
            // 3. Keep current active dataset in memory if valid
            if (prev) {
              const prevId = String(prev.id || prev._id || '');
              const matchPrev = res.dataSources.find(ds => String(ds.id || ds._id || '') === prevId);
              if (matchPrev) return matchPrev;
            }
            // 4. Default to first available data source
            return res.dataSources[0];
          });
        } else if (res.success && Array.isArray(res.dataSources) && res.dataSources.length === 0) {
          setDataSources([]);
          setActiveDataSource(null);
        }
      })
      .catch(err => {
        console.warn('DataSources fetch warning:', err.message);
      });
  }, [currentUser]);

  const handleAddSession = (question) => {
    const newSession = {
      id: 's_' + Date.now(),
      title: question.slice(0, 30) + (question.length > 30 ? '...' : ''),
      time: 'Just now'
    };
    setRecentSessions(prev => {
      const updated = [newSession, ...prev.slice(0, 9)];
      try {
        localStorage.setItem('datamind_recent_sessions', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  };

  const handleDeleteSession = (id) => {
    setRecentSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem('datamind_recent_sessions', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  };

  const handleNewChat = () => {
    setWorkspaceQuestion('');
    setWorkspaceActiveQuery(null);
    setActiveSection('workspace');
  };

  const handleLogout = () => {
    localStorage.removeItem('datamind_token');
    setCurrentUser(null);
    setDataSources([]);
    setActiveDataSource(null);
    setWorkspaceQuestion('');
    setWorkspaceActiveQuery(null);
    setWorkspaceRecentQueries([]);
    setActiveSection('landing');
    setIsAuthOpen(true);
  };

  const handleNavigate = (sec, data) => {
    const targetSec = typeof sec === 'string' ? sec : 'workspace';
    setActiveSection(targetSec);

    if (targetSec === 'workspace' && data) {
      let targetQuestion = data.question || data.title || '';
      if (!targetQuestion && data.name) {
        targetQuestion = data.name.replace(/^Analytics\s*—\s*/i, '').trim();
      }
      if (!targetQuestion && data.description) {
        targetQuestion = data.description.replace(/^Generated from query:\s*/i, '').trim();
      }

      if (targetQuestion) {
        setWorkspaceQuestion(targetQuestion);
      }

      if (data.sql || (data.rows && data.rows.length > 0) || (data.data && data.data.length > 0)) {
        const activeObj = {
          id: data.id || data._id || 'q_' + Date.now(),
          question: targetQuestion || data.question || 'Database query',
          sql: data.sql || '',
          explanation: data.explanation || '',
          columns: data.columns || data.fields || (data.rows && data.rows.length > 0 ? Object.keys(data.rows[0]) : []),
          rows: data.rows || data.data || [],
          rowCount: data.rowCount !== undefined ? data.rowCount : (data.rows ? data.rows.length : (data.data ? data.data.length : 0)),
          executionTimeMs: data.executionTimeMs || 180
        };
        setWorkspaceActiveQuery(activeObj);
      } else {
        const match = workspaceRecentQueries.find(q =>
          q.question && targetQuestion && q.question.trim().toLowerCase() === targetQuestion.trim().toLowerCase()
        );
        if (match) {
          setWorkspaceActiveQuery(match);
        } else if (targetQuestion) {
          setWorkspaceActiveQuery(null);
        }
      }
    }
  };

  const handleSelectQuery = (queryObj) => {
    if (typeof queryObj === 'string') {
      handleNavigate('workspace', { question: queryObj });
    } else {
      handleNavigate('workspace', queryObj);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#111318] text-slate-100 overflow-hidden font-sans relative">
      {/* Navigation Sidebar (Hidden on first/landing page) */}
      {activeSection !== 'landing' && (
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          activeDataSource={activeDataSource}
          recentSessions={recentSessions}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleNewChat}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
          onLogout={handleLogout}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Active Section View */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col min-w-0">
        {/* Mobile Header Bar */}
        {activeSection !== 'landing' && (
          <div className="md:hidden bg-[#111318] border-b border-slate-800/90 px-4 py-3 flex items-center justify-between shrink-0 z-30">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 bg-[#181a20] border border-zinc-700/80 rounded-xl text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div
              onClick={() => handleNavigate('home')}
              className="flex items-center space-x-2.5 cursor-pointer hover:opacity-80 transition"
            >
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white font-black text-xs">
                D
              </div>
              <span className="text-base font-black text-white tracking-tight">DataMind</span>
            </div>
            <div className="w-9" /> {/* Spacer */}
          </div>
        )}
        {activeSection === 'landing' && (
          <LandingPage
            onLaunchWorkspace={() => setActiveSection('workspace')}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}
        {activeSection === 'home' && (
          <HomePage
            activeDataSource={activeDataSource}
            onNavigate={(sec) => handleNavigate(sec)}
            onSelectQuery={handleSelectQuery}
          />
        )}
        {activeSection === 'workspace' && (
          <DatabaseWorkspace
            activeDataSource={activeDataSource}
            setActiveDataSource={handleSelectActiveDataSource}
            dataSources={dataSources}
            onAddSession={handleAddSession}
            question={workspaceQuestion}
            setQuestion={setWorkspaceQuestion}
            activeQuery={workspaceActiveQuery}
            setActiveQuery={setWorkspaceActiveQuery}
            recentQueries={workspaceRecentQueries}
            setRecentQueries={setWorkspaceRecentQueries}
          />
        )}
        {activeSection === 'general' && (
          <GeneralChatPage
            messages={generalChatMessages}
            setMessages={setGeneralChatMessages}
            onAddSession={handleAddSession}
          />
        )}
        {activeSection === 'dashboards' && (
          <DashboardsPage
            onNavigate={(sec, data) => handleNavigate(sec, data)}
          />
        )}
        {activeSection === 'datasources' && (
          <DataSourcesPage
            activeDataSource={activeDataSource}
            onConnectSuccess={(ds) => {
              setDataSources(prev => [ds, ...(prev || [])]);
              handleSelectActiveDataSource(ds);
            }}
            onSelectDataSource={(ds) => {
              handleSelectActiveDataSource(ds);
            }}
          />
        )}
      </main>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setActiveSection('workspace');
        }}
      />
    </div>
  );
}
