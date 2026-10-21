import React, { useState } from 'react';
import { 
  ShieldCheck, Lock, User, KeyRound, ArrowRight, Delete, 
  Sparkles, CheckCircle2, AlertCircle, Laptop, Store, Globe, Sun, Moon 
} from 'lucide-react';
import { sounds } from '../soundEffects';

export default function LoginScreen({ lang, t, theme, onToggleTheme, onToggleLang, onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('agent'); // 'agent' (PIN-pad) or 'admin' (user/pass)
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Handle PIN button click
  const handlePinDigit = (digit) => {
    sounds.tap();
    if (pin.length < 6) {
      setPin(prev => prev + digit);
      setError(null);
    }
  };

  const handlePinClear = () => {
    sounds.tap();
    setPin('');
    setError(null);
  };

  const handlePinBackspace = () => {
    sounds.tap();
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  // Perform login submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = authMode === 'agent' 
        ? { pin: pin.trim() } 
        : { username: username.trim(), password: password.trim() };

      if (authMode === 'agent' && !pin) {
        throw new Error(lang === 'ht' ? "Tanpri tape yon kòd PIN" : "Veuillez saisir un code PIN");
      }
      if (authMode === 'admin' && (!username || !password)) {
        throw new Error(lang === 'ht' ? "Tanpri antre non ak modpas" : "Veuillez entrer nom et mot de passe");
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (lang === 'ht' ? "Koneksyon echwe" : "Échec de connexion"));
      }

      sounds.tap();
      onLoginSuccess(data.user);
    } catch (err) {
      sounds.error();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className={`login-page-container theme-${theme}`}>
      {/* Background Ambient Glow */}
      <div className="login-ambient-glow" />

      {/* Top Header Utilities */}
      <header className="login-top-bar">
        <div className="login-brand-mini">
          <div className="brand-logo-badge small">
            <span className="brand-logo-text">509</span>
          </div>
          <span className="login-system-tag">LOTO509 POS & BANK</span>
        </div>

        <div className="login-top-actions">
          <button 
            className="btn-lang-toggle" 
            onClick={onToggleLang}
            title={lang === 'ht' ? "Chanje an Français" : "Changer en Créole"}
          >
            <Globe size={16} />
            <span className="lang-code-bold">{lang === 'ht' ? 'FR' : 'HT'}</span>
            <span className="lang-name-pill">{lang === 'ht' ? 'Kreyòl' : 'Français'}</span>
          </button>

          <button 
            className="btn-theme-toggle"
            onClick={onToggleTheme}
            title={theme === 'dark' ? "Mòd Klè" : "Mòd Nwa"}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="theme-name-pill">{theme === 'dark' ? 'Klè' : 'Nwa'}</span>
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <div className="login-card-wrapper">
        <div className="login-card">
          {/* Brand & Title */}
          <div className="login-card-header">
            <div className="login-logo-hero">
              <span className="login-logo-number">509</span>
            </div>
            <h1 className="login-title">LOTO509</h1>
            <p className="login-subtitle">
              {lang === 'ht' 
                ? "Sistèm Nasyonal Bòlèt • Tèminal Touch POS & Bank" 
                : "Système National de Borlette • Terminal POS & Banque"}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="login-mode-tabs">
            <button 
              type="button"
              className={`login-tab ${authMode === 'agent' ? 'active' : ''}`}
              onClick={() => { sounds.tap(); setAuthMode('agent'); setError(null); }}
            >
              <Store size={18} />
              <span>{t.tabAgent || "Vandè POS"}</span>
            </button>
            <button 
              type="button"
              className={`login-tab ${authMode === 'admin' ? 'active' : ''}`}
              onClick={() => { sounds.tap(); setAuthMode('admin'); setError(null); }}
            >
              <ShieldCheck size={18} />
              <span>{t.tabAdmin || "Admin Santral"}</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="login-error-alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* FORM: AGENT TOUCH PIN-PAD */}
          {authMode === 'agent' && (
            <div className="login-agent-section">
              <div className="pin-display-wrapper">
                <span className="pin-display-label">
                  {lang === 'ht' ? "KÒD PIN TÈMINAL" : "CODE PIN DU TERMINAL"}
                </span>
                <div className="pin-dots">
                  {[0, 1, 2, 3].map(index => (
                    <div 
                      key={index} 
                      className={`pin-dot ${pin.length > index ? 'filled' : ''}`} 
                    />
                  ))}
                </div>
                <div className="pin-text-preview">
                  {pin ? '•'.repeat(pin.length) : (t.pinPlaceholder || "Tape PIN 4 chif")}
                </div>
              </div>

              {/* Touch Numeric PIN-pad */}
              <div className="pin-keypad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button 
                    key={num} 
                    type="button" 
                    className="pin-key-btn"
                    onClick={() => handlePinDigit(num)}
                  >
                    {num}
                  </button>
                ))}
                <button 
                  type="button" 
                  className="pin-key-btn key-action key-clear"
                  onClick={handlePinClear}
                  title="Efase tout"
                >
                  C
                </button>
                <button 
                  type="button" 
                  className="pin-key-btn"
                  onClick={() => handlePinDigit(0)}
                >
                  0
                </button>
                <button 
                  type="button" 
                  className="pin-key-btn key-action key-backspace"
                  onClick={handlePinBackspace}
                  title="Efase dènye"
                >
                  <Delete size={20} />
                </button>
              </div>

              {/* Submit Button */}
              <button 
                type="button"
                className="btn-login-submit"
                onClick={handleSubmit}
                disabled={loading || pin.length < 4}
              >
                {loading ? (
                  <div className="loading-spinner small"></div>
                ) : (
                  <>
                    <KeyRound size={20} />
                    <span>{t.loginButton || "Konekte Kounye a"}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}

          {/* FORM: ADMIN USERNAME & PASSWORD */}
          {authMode === 'admin' && (
            <form className="login-admin-section" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t.username || "Non Itilizatè"}</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input 
                    type="text" 
                    className="login-input"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.password || "Modpas oswa PIN"}</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input 
                    type="password" 
                    className="login-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="btn-login-submit admin"
                disabled={loading || (!username && !password)}
              >
                {loading ? (
                  <div className="loading-spinner small"></div>
                ) : (
                  <>
                    <ShieldCheck size={20} />
                    <span>{t.loginButton || "Konekte Kounye a"}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
