import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import DatabaseWorkspace from './pages/DatabaseWorkspace';
import GeneralChatPage from './pages/GeneralChatPage';
import DashboardsPage from './pages/DashboardsPage';
import DataSourcesPage from './pages/DataSourcesPage';
import { getMe, getDataSources, getChatSessions } from './services/api';

const DEFAULT_WELCOME_MESSAGE = [
  {
    id: 'welcome',
    sender: 'agent',
    text: 'Hello! How can I help you with your database or software engineering questions today? Whether you need help writing a complex SQL query, designing a normalized database schema, optimizing performance, or anything else, just let me know!'
  }
];

const getUserStorageKey = (user, keyName) => {
  const userIdentifier = user ? (user.id || user._id || user.email) : (localStorage.getItem('datamind_guest_id') || 'guest');
  return `datamind_${userIdentifier}_${keyName}`;
};

export default function App() {
  const [activeSection, setActiveSection] = useState('landing');
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [dataSources, setDataSources] = useState([]);
  const [activeDataSource, setActiveDataSource] = useState(null);

  // Database Workspace Persisted State across sidebar navigation
  const [workspaceQuestion, setWorkspaceQuestion] = useState('');
  const [workspaceActiveQuery, setWorkspaceActiveQuery] = useState(null);
  const [workspaceRecentQueries, setWorkspaceRecentQueries] = useState([]);

  // Recent chat sessions strictly scoped per user
  const [recentSessions, setRecentSessions] = useState([]);

  // General Chat Persisted State strictly scoped per user
  const [generalChatMessages, setGeneralChatMessages] = useState(DEFAULT_WELCOME_MESSAGE);

  // Theme Initialization on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('datamind_theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
  }, []);

  // Verify Auth & restore cached user on mount
  useEffect(() => {
    const token = localStorage.getItem('datamind_token');
    const cachedUserStr = localStorage.getItem('datamind_user');
    
    if (cachedUserStr) {
      try {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser && (cachedUser.name || cachedUser.email)) {
          setCurrentUser(cachedUser);
          const savedSec = localStorage.getItem('datamind_active_section');
          setActiveSection((savedSec && savedSec !== 'landing') ? savedSec : 'home');
        }
      } catch (e) {}
    }

    if (token) {
      getMe()
        .then(res => {
          if (res.success && res.user) {
            setCurrentUser(res.user);
            localStorage.setItem('datamind_user', JSON.stringify(res.user));
            const savedSec = localStorage.getItem('datamind_active_section');
            setActiveSection((savedSec && savedSec !== 'landing') ? savedSec : 'home');
          }
        })
        .catch(err => {
          console.warn('Auth verify error:', err.message);
        });
    }
  }, []);

  // Sync / Load User-Scoped States (Chat Messages, Recent Sessions, Data Sources) on currentUser change
  useEffect(() => {
    // 1. Load General Chat Messages for current user
    const chatKey = getUserStorageKey(currentUser, 'general_chat_messages');
    try {
      const savedChat = localStorage.getItem(chatKey);
      setGeneralChatMessages(savedChat ? JSON.parse(savedChat) : DEFAULT_WELCOME_MESSAGE);
    } catch (e) {
      setGeneralChatMessages(DEFAULT_WELCOME_MESSAGE);
    }

    // 2. Load Recent Sessions for current user
    const sessionsKey = getUserStorageKey(currentUser, 'recent_sessions');
    try {
      const savedSessions = localStorage.getItem(sessionsKey);
      setRecentSessions(savedSessions ? JSON.parse(savedSessions) : []);
    } catch (e) {
      setRecentSessions([]);
    }

    // 3. Reset Workspace Transient Query State on account switch
    setWorkspaceQuestion('');
    setWorkspaceActiveQuery(null);

    // 4. Fetch Data Sources strictly scoped for current user
    getDataSources()
      .then(res => {
        if (res.success && Array.isArray(res.dataSources)) {
          setDataSources(res.dataSources);
          
          const savedActiveId = localStorage.getItem(getUserStorageKey(currentUser, 'active_datasource_id'));

          setActiveDataSource(prev => {
            if (prev) {
              const match = res.dataSources.find(ds => String(ds._id || ds.id) === String(prev._id || prev.id));
              if (match) return match;
            }
            if (savedActiveId) {
              const match = res.dataSources.find(ds => String(ds._id || ds.id) === String(savedActiveId));
              if (match) return match;
            }
            return res.dataSources.length > 0 ? res.dataSources[0] : null;
          });
        } else {
          setDataSources([]);
          setActiveDataSource(null);
        }
      })
      .catch(err => {
        console.warn('DataSources fetch warning:', err.message);
        setDataSources([]);
        setActiveDataSource(null);
      });

    // 5. Fetch Backend Chat Sessions for current user
    getChatSessions()
      .then(res => {
        if (res.success && Array.isArray(res.sessions) && res.sessions.length > 0) {
          const formatted = res.sessions.map(s => ({
            id: s.id || s._id || s.sessionId,
            title: s.title || 'Chat Session',
            time: 'Recent'
          }));
          setRecentSessions(formatted);
          try {
            localStorage.setItem(getUserStorageKey(currentUser, 'recent_sessions'), JSON.stringify(formatted));
          } catch (e) {}
        }
      })
      .catch(err => {
        console.warn('Chat sessions fetch warning:', err.message);
      });

  }, [currentUser]);

  // Persist General Chat Messages under user-scoped key whenever updated
  useEffect(() => {
    const chatKey = getUserStorageKey(currentUser, 'general_chat_messages');
    try {
      localStorage.setItem(chatKey, JSON.stringify(generalChatMessages));
    } catch (e) {}
  }, [generalChatMessages, currentUser]);

  const handleSelectDataSource = (ds) => {
    setActiveDataSource(ds);
    const key = getUserStorageKey(currentUser, 'active_datasource_id');
    if (ds && (ds._id || ds.id)) {
      localStorage.setItem(key, String(ds._id || ds.id));
    } else {
      localStorage.removeItem(key);
    }
  };

  const handleAddSession = (question) => {
    const newSession = {
      id: 's_' + Date.now(),
      title: question.slice(0, 30) + (question.length > 30 ? '...' : ''),
      time: 'Just now'
    };
    setRecentSessions(prev => {
      const updated = [newSession, ...prev.slice(0, 9)];
      try {
        const sessionsKey = getUserStorageKey(currentUser, 'recent_sessions');
        localStorage.setItem(sessionsKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleDeleteSession = (id) => {
    setRecentSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      try {
        const sessionsKey = getUserStorageKey(currentUser, 'recent_sessions');
        localStorage.setItem(sessionsKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleSectionChange = (sec) => {
    setActiveSection(sec);
    if (sec) {
      try {
        localStorage.setItem('datamind_active_section', sec);
      } catch (e) {}
    }
  };

  const handleNewChat = () => {
    setWorkspaceQuestion('');
    setWorkspaceActiveQuery(null);
    handleSectionChange('workspace');
  };

  const handleLogout = () => {
    localStorage.removeItem('datamind_token');
    localStorage.removeItem('datamind_user');
    localStorage.removeItem('datamind_active_section');
    setCurrentUser(null);
    setDataSources([]);
    setActiveDataSource(null);
    setWorkspaceQuestion('');
    setWorkspaceActiveQuery(null);
    setWorkspaceRecentQueries([]);
    setGeneralChatMessages(DEFAULT_WELCOME_MESSAGE);
    setRecentSessions([]);
    setActiveSection('landing');
    setIsAuthOpen(true);
  };

  const handleSelectQuery = (queryObj) => {
    const qText = typeof queryObj === 'string' ? queryObj : (queryObj.title || queryObj.lastQuestion || queryObj.question || '');
    if (qText) {
      setWorkspaceQuestion(qText);
    }
    handleSectionChange('workspace');
  };

  return (
    <div className="flex h-screen w-screen bg-[#111318] text-slate-100 overflow-hidden font-sans">
      {/* Navigation Sidebar (Hidden on first/landing page) */}
      {activeSection !== 'landing' && (
        <Sidebar
          activeSection={activeSection}
          setActiveSection={handleSectionChange}
          activeDataSource={activeDataSource}
          recentSessions={recentSessions}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleNewChat}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
          onLogout={handleLogout}
        />
      )}

      {/* Main Active Section View */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col">
        {activeSection === 'landing' && (
          <LandingPage
            onLaunchWorkspace={() => handleSectionChange('workspace')}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}
        {activeSection === 'home' && (
          <HomePage
            activeDataSource={activeDataSource}
            onNavigate={(sec) => handleSectionChange(sec)}
            onSelectQuery={handleSelectQuery}
          />
        )}
        {activeSection === 'workspace' && (
          <DatabaseWorkspace
            activeDataSource={activeDataSource}
            setActiveDataSource={handleSelectDataSource}
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
            onNavigate={(sec) => handleSectionChange(sec)}
          />
        )}
        {activeSection === 'datasources' && (
          <DataSourcesPage
            activeDataSource={activeDataSource}
            onConnectSuccess={(ds) => {
              setDataSources(prev => [ds, ...(prev || [])]);
              handleSelectDataSource(ds);
            }}
            onSelectDataSource={(ds) => {
              handleSelectDataSource(ds);
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
          handleSectionChange('home');
        }}
      />
    </div>
  );
}
