import React, { useState, useEffect } from 'react';
import { 
  Ticket, CheckSquare, Trophy, BarChart3, Settings, 
  Globe, Volume2, VolumeX, Shield, Clock, Sun, Moon,
  ShieldCheck, LogOut, User, Store
} from 'lucide-react';
import { translations } from './i18n';
import { sounds } from './soundEffects';
import PosScreen from './components/PosScreen';
import VerifyScreen from './components/VerifyScreen';
import ResultsManagerScreen from './components/ResultsManagerScreen';
import DailyReportScreen from './components/DailyReportScreen';
import SettingsScreen from './components/SettingsScreen';
import AdminDashboard from './components/AdminDashboard';
import LoginScreen from './components/LoginScreen';
import ThermalReceipt from './components/ThermalReceipt';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialLang = urlParams.get('lang') || localStorage.getItem('loto_lang') || 'ht';
  const initialTab = urlParams.get('tab') || 'pos';

  // Theme: 'dark' (Ultra-dark obsidian luxury) or 'light'
  const [theme, setTheme] = useState(() => {
    const param = urlParams.get('theme');
    if (param) return param;
    return 'dark'; // Always default to ultra-dark mode
  });

  // Language: 'ht' (Kreyòl Ayisyen) or 'fr' (Français)
  const [lang, setLang] = useState(initialLang);
  const [activeTab, setActiveTab] = useState(initialTab); // 'pos', 'admin', 'verify', 'results', 'reports', 'settings'
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Authenticated user state
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('loto509_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null; // Will trigger LoginScreen
  });

  // App data state
  const [config, setConfig] = useState(null);
  const [draws, setDraws] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);
  const [printModalTicket, setPrintModalTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  const t = translations[lang] || translations.ht;

  // Theme switch
  const toggleTheme = () => {
    sounds.tap();
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('loto_theme', nextTheme);
  };

  // Language switch
  const toggleLanguage = () => {
    sounds.tap();
    const nextLang = lang === 'ht' ? 'fr' : 'ht';
    setLang(nextLang);
    localStorage.setItem('loto_lang', nextLang);
  };

  // Logout handler
  const handleLogout = () => {
    sounds.tap();
    setCurrentUser(null);
    localStorage.removeItem('loto509_user');
    setActiveTab('pos');
  };

  // Login success handler
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('loto509_user', JSON.stringify(user));
    if (user.role === 'admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('pos');
    }
  };

  // Initial data loading
  const loadInitialData = async () => {
    try {
      const tzParam = currentUser?.timezone ? `?agentTz=${encodeURIComponent(currentUser.timezone)}` : '';
      const [configRes, drawsRes, ticketsRes] = await Promise.all([
        fetch('/api/config'),
        fetch(`/api/draws${tzParam}`),
        fetch('/api/tickets?status=active')
      ]);

      const configData = await configRes.json();
      const drawsData = await drawsRes.json();
      const ticketsData = await ticketsRes.json();

      setConfig(configData);
      setDraws(drawsData);
      setRecentTickets(ticketsData);

      const receiptId = urlParams.get('receipt');
      if (receiptId) {
        try {
          const rRes = await fetch(`/api/tickets/${receiptId}`);
          if (rRes.ok) {
            const rData = await rRes.json();
            setPrintModalTicket(rData);
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error("Failed to load initial data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Poll draws every 30 seconds for real-time status and time updates
    const interval = setInterval(async () => {
      try {
        const tzParam = currentUser?.timezone ? `?agentTz=${encodeURIComponent(currentUser.timezone)}` : '';
        const res = await fetch(`/api/draws${tzParam}`);
        if (res.ok) {
          const data = await res.json();
          setDraws(data);
        }
      } catch (err) {
        // silent
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Safeguard: Ensure agents/cashiers cannot access admin or settings tab
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      if (activeTab === 'settings' || activeTab === 'admin') {
        setActiveTab('pos');
      }
    }
  }, [currentUser, activeTab]);

  // When a ticket is created in POS
  const handleTicketCreated = (ticket) => {
    setRecentTickets(prev => [ticket, ...prev]);
    setPrintModalTicket(ticket);
  };

  // Cancel ticket action
  const handleCancelTicket = async (ticketId) => {
    if (!window.confirm(t.confirmCancel || "Èske ou vle anile tikè sa a? / Confirmer l'annulation?")) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: currentUser?.role || 'agent' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erè nan anilasyon tikè");

      sounds.tap();
      // Update local state
      setRecentTickets(prev => prev.map(t => t.id === ticketId ? data.ticket : t));
      alert(data.message);
    } catch (err) {
      sounds.error();
      alert(err.message);
    }
  };

  // Reprint ticket
  const handleReprintTicket = (ticket) => {
    sounds.tap();
    setPrintModalTicket(ticket);
  };

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-spinner"></div>
        <h2>{lang === 'ht' ? "Chajman Sistèm LOTO509..." : "Chargement du Système LOTO509..."}</h2>
        <p>New York • Florida • Georgia</p>
      </div>
    );
  }

  // If not logged in, present tactile PIN / Admin login screen
  if (!currentUser) {
    return (
      <LoginScreen 
        lang={lang}
        t={t}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleLang={toggleLanguage}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className={`pos-app-wrapper theme-${theme}`}>
      {/* Top Main Navigation Bar */}
      <header className="pos-navbar no-print">
        <div className="navbar-brand">
          <div className="brand-logo-badge" title="LOTO509">
            <span className="brand-logo-text">509</span>
          </div>
          <div>
            <h1 className="brand-title">{config?.companyName || t.appTitle}</h1>
            <p className="brand-subtitle">{config?.companySubtitle || t.appSubtitle}</p>
          </div>
        </div>

        {/* Tab Links */}
        <nav className="navbar-tabs">
          {/* Admin Central Tab (Exclusive to Admin Role or accessible by admin) */}
          {currentUser.role === 'admin' && (
            <button 
              className={`nav-tab-btn admin-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => { sounds.tap(); setActiveTab('admin'); }}
            >
              <ShieldCheck size={18} />
              <span>{t.navAdmin || "Admin Santral"}</span>
            </button>
          )}

          <button 
            className={`nav-tab-btn ${activeTab === 'pos' ? 'active' : ''}`}
            onClick={() => { sounds.tap(); setActiveTab('pos'); }}
          >
            <Ticket size={18} />
            <span>{t.navPos}</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'verify' ? 'active' : ''}`}
            onClick={() => { sounds.tap(); setActiveTab('verify'); }}
          >
            <CheckSquare size={18} />
            <span>{t.navVerify}</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => { sounds.tap(); setActiveTab('results'); }}
          >
            <Trophy size={18} />
            <span>{t.navResults}</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => { sounds.tap(); setActiveTab('reports'); }}
          >
            <BarChart3 size={18} />
            <span>{t.navReports}</span>
          </button>

          {currentUser.role === 'admin' && (
            <button 
              className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => { sounds.tap(); setActiveTab('settings'); }}
            >
              <Settings size={18} />
              <span>{t.navSettings}</span>
            </button>
          )}
        </nav>

        {/* Right Tools (User Pill, Language, Theme, Logout) */}
        <div className="navbar-actions">
          {/* Active User Pill */}
          <div className="user-nav-badge" title={`${currentUser.name} (${currentUser.branchName || ''}) ${currentUser.countryLabel || ''}`}>
            {currentUser.role === 'admin' ? (
              <span className="user-role-icon admin">👑</span>
            ) : (
              <span className="user-role-icon agent">{currentUser.countryFlag || '👤'}</span>
            )}
            <div className="user-nav-details">
              <span className="user-nav-name">{currentUser.name?.split(' ')[0] || currentUser.username}</span>
              <span className="user-nav-pos">{currentUser.posId || config?.posId || 'POS-01'}</span>
            </div>
          </div>

          {/* Language Toggle Button */}
          <button 
            className="btn-lang-toggle" 
            onClick={toggleLanguage}
            title={lang === 'ht' ? "Chanje an Français" : "Changer en Créole"}
          >
            <Globe size={18} />
            <span className="lang-code-bold">{lang === 'ht' ? 'FR' : 'HT'}</span>
            <span className="lang-name-pill">{lang === 'ht' ? 'Kreyòl' : 'Français'}</span>
          </button>

          {/* Theme Toggle Button (Light / Dark) */}
          <button 
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? "Mòd Klè (Light Mode)" : "Mòd Nwa (Dark Mode)"}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span className="theme-name-pill">{theme === 'dark' ? 'Klè' : 'Nwa'}</span>
          </button>

          {/* Logout / Switch Cashier Button */}
          <button 
            className="btn-logout"
            onClick={handleLogout}
            title={t.logoutButton || "Dekonekte"}
          >
            <LogOut size={16} />
            <span className="logout-text">{t.logoutButton || "Sòti"}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pos-main-content">
        {activeTab === 'admin' && currentUser.role === 'admin' && (
          <AdminDashboard 
            config={config}
            draws={draws}
            lang={lang}
            t={t}
            onDrawsUpdated={loadInitialData}
            onReprintTicket={handleReprintTicket}
            onCancelTicket={handleCancelTicket}
          />
        )}

        {activeTab === 'pos' && (
          <PosScreen 
            draws={draws}
            config={config}
            lang={lang}
            t={t}
            currentUser={currentUser}
            recentTickets={recentTickets}
            onTicketCreated={handleTicketCreated}
            onCancelTicket={handleCancelTicket}
            onReprintTicket={handleReprintTicket}
          />
        )}

        {activeTab === 'verify' && (
          <VerifyScreen 
            config={config}
            lang={lang}
            t={t}
            currentUser={currentUser}
            onReprintTicket={handleReprintTicket}
            onCancelTicket={handleCancelTicket}
          />
        )}

        {activeTab === 'results' && (
          <ResultsManagerScreen 
            draws={draws}
            lang={lang}
            t={t}
            onResultPublished={loadInitialData}
          />
        )}

        {activeTab === 'reports' && (
          <DailyReportScreen 
            config={config}
            lang={lang}
            t={t}
          />
        )}

        {activeTab === 'settings' && currentUser.role === 'admin' && (
          <SettingsScreen 
            config={config}
            draws={draws}
            lang={lang}
            t={t}
            onConfigUpdated={(newCfg) => setConfig(newCfg)}
            onDrawsUpdated={loadInitialData}
          />
        )}
      </main>

      {/* Printable Thermal Receipt Modal */}
      {printModalTicket && (
        <ThermalReceipt 
          ticket={printModalTicket}
          config={config}
          lang={lang}
          t={t}
          onClose={() => setPrintModalTicket(null)}
          onCancelTicket={handleCancelTicket}
        />
      )}
    </div>
  );
}
