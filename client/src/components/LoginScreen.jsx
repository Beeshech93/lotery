import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, User, KeyRound, ArrowRight, Delete, 
  AlertCircle, Store, Globe, Sun, Moon, Smartphone, Check, X 
} from 'lucide-react';
import { sounds } from '../soundEffects';

export default function LoginScreen({ lang, t, theme, config, onToggleTheme, onToggleLang, onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('agent'); // 'agent' (PIN-pad) or 'admin' (user/pass)
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Device / POS Terminal Locking state
  const [deviceId, setDeviceId] = useState(() => {
    return localStorage.getItem('loto509_device_id') || config?.posId || 'POS-SUNMI-01';
  });
  const [showDeviceConfig, setShowDeviceConfig] = useState(false);
  const [tempDeviceId, setTempDeviceId] = useState('');
  const [deviceConfigSuccess, setDeviceConfigSuccess] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('loto509_device_id');
    if (!stored && config?.posId) {
      setDeviceId(config.posId);
      localStorage.setItem('loto509_device_id', config.posId);
    }
  }, [config]);

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
      const currentDevId = localStorage.getItem('loto509_device_id') || deviceId || config?.posId || 'POS-SUNMI-01';
      const payload = authMode === 'agent' 
        ? { pin: pin.trim(), deviceId: currentDevId } 
        : { username: username.trim(), password: password.trim(), deviceId: currentDevId };

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

          {/* Quick Demo Accounts Helper */}
          <div className="login-demo-helper" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, display: 'block', marginBottom: '0.5rem' }}>
              {t.demoCredentials || "Kont Demo pou Tès :"}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="demo-chip"
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#facc15', fontSize: '0.75rem', cursor: 'pointer' }}
                onClick={() => {
                  sounds.tap();
                  setAuthMode('agent');
                  setPin('5090');
                  setError(null);
                }}
              >
                👑 Admin (5090)
              </button>
              <button
                type="button"
                className="demo-chip"
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer' }}
                onClick={() => {
                  sounds.tap();
                  setAuthMode('agent');
                  setPin('4040');
                  setError(null);
                }}
              >
                🛡️ Lidè Ekip / Mod (4040)
              </button>
              <button
                type="button"
                className="demo-chip"
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', fontSize: '0.75rem', cursor: 'pointer' }}
                onClick={() => {
                  sounds.tap();
                  setAuthMode('agent');
                  setPin('1234');
                  setError(null);
                }}
              >
                👤 Vandè 1 (1234)
              </button>
              <button
                type="button"
                className="demo-chip"
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', fontSize: '0.75rem', cursor: 'pointer' }}
                onClick={() => {
                  sounds.tap();
                  setAuthMode('agent');
                  setPin('5678');
                  setError(null);
                }}
              >
                👤 Vandè 2 (5678)
              </button>
            </div>
          </div>

          {/* Registered Device / Terminal POS ID Banner */}
          <div style={{
            marginTop: '1.25rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.7)'
          }}>
            <Smartphone size={15} color="#60a5fa" />
            <span>
              {lang === 'ht' ? "Aparèy / Tèminal:" : "Appareil / Terminal:"}{' '}
              <strong style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: '0.85rem' }}>{deviceId}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                sounds.tap();
                setTempDeviceId(deviceId);
                setShowDeviceConfig(true);
                setDeviceConfigSuccess('');
              }}
              style={{
                background: 'rgba(234, 179, 8, 0.15)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                color: '#facc15',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
                marginLeft: '4px'
              }}
              title={lang === 'ht' ? "Konfigire ID Aparèy sa a" : "Configurer ID de cet Appareil"}
            >
              {lang === 'ht' ? "Chanje" : "Changer"}
            </button>
          </div>

          {/* Device ID Configuration Modal */}
          {showDeviceConfig && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.82)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem'
              }}
              onClick={() => setShowDeviceConfig(false)}
            >
              <div 
                style={{
                  background: 'var(--bg-card, #121826)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  borderRadius: '16px',
                  maxWidth: '400px',
                  width: '100%',
                  padding: '1.5rem',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                  color: 'var(--text-primary, #f8fafc)'
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Smartphone size={20} color="#60a5fa" />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                      {lang === 'ht' ? "ID Tèminal / Aparèy" : "ID du Terminal / Appareil"}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setShowDeviceConfig(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <p style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: '1rem', lineHeight: '1.4' }}>
                  {lang === 'ht' 
                    ? "Chak ajan gen yon ID aparèy espesifik kote PIN li otorize. Chwazi oswa tape ID aparèy fizik sa a:" 
                    : "Chaque agent a un ID terminal spécifique où son PIN est autorisé. Choisissez ou tapez l'ID de cet appareil:"}
                </p>

                {/* Quick device selectors */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem' }}>
                  {['POS-SUNMI-01', 'POS-SUNMI-02', 'POS-SUNMI-03'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTempDeviceId(preset)}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        borderRadius: '6px',
                        border: tempDeviceId === preset ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                        background: tempDeviceId === preset ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.04)',
                        color: tempDeviceId === preset ? '#60a5fa' : 'inherit',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="eg. POS-SUNMI-01"
                  value={tempDeviceId}
                  onChange={e => setTempDeviceId(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: '1rem',
                    fontWeight: 700,
                    marginBottom: '1rem'
                  }}
                />

                {deviceConfigSuccess && (
                  <div style={{ color: '#4ade80', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={14} />
                    <span>{deviceConfigSuccess}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowDeviceConfig(false)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'inherit',
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    {lang === 'ht' ? "Anile" : "Annuler"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const clean = tempDeviceId.trim().toUpperCase();
                      if (!clean) return;
                      localStorage.setItem('loto509_device_id', clean);
                      setDeviceId(clean);
                      sounds.tap();
                      setDeviceConfigSuccess(lang === 'ht' ? `✅ Aparèy anrejistre kòm ${clean}!` : `✅ Appareil enregistré sous ${clean}!`);
                      setTimeout(() => {
                        setShowDeviceConfig(false);
                        setDeviceConfigSuccess('');
                      }, 1000);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {lang === 'ht' ? "Anrejistre Aparèy" : "Enregistrer Appareil"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
