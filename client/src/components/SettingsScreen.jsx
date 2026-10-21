import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle, RefreshCcw, Shield, Sliders, Database, Server } from 'lucide-react';
import { sounds } from '../soundEffects';

export default function SettingsScreen({ config, draws, lang, t, onConfigUpdated, onDrawsUpdated }) {
  const [formData, setFormData] = useState({
    companyName: config?.companyName || "LOTO509",
    companySubtitle: config?.companySubtitle || "New York • Florida • Georgia",
    posId: config?.posId || "POS-SUNMI-01",
    branchName: config?.branchName || "Santral Petyonvil",
    phone: config?.phone || "+1 (305) 555-0199",
    currency: config?.currency || "HTG",
    currencySymbol: config?.currencySymbol || "G",
    cancellationWindowMinutes: config?.cancellationWindowMinutes || 15,
    maxBetPerNumber: config?.maxBetPerNumber || 5000,
    multipliers: {
      bolette_lot1: config?.multipliers?.bolette_lot1 || 50,
      bolette_lot2: config?.multipliers?.bolette_lot2 || 20,
      bolette_lot3: config?.multipliers?.bolette_lot3 || 10,
      mariage: config?.multipliers?.mariage || 1000,
      loto3: config?.multipliers?.loto3 || 500,
      loto4: config?.multipliers?.loto4 || 5000
    }
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [dbStatus, setDbStatus] = useState(null);

  useEffect(() => {
    fetch('/api/database/status')
      .then(res => res.json())
      .then(data => setDbStatus(data))
      .catch(err => console.error("Could not fetch DB status", err));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erè nan sove paramèt yo");

      sounds.success();
      setSuccessMsg(t.savedSuccess);
      onConfigUpdated(data);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      sounds.error();
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDraw = async (drawId, status) => {
    try {
      const res = await fetch(`/api/draws/${drawId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        sounds.tap();
        if (onDrawsUpdated) onDrawsUpdated();
      }
    } catch (err) {
      console.error("Error toggling draw", err);
    }
  };

  return (
    <div className="settings-screen-container">
      <div className="settings-header">
        <Settings size={28} className="settings-icon" />
        <div>
          <h2>{t.settingsTitle}</h2>
          <p className="subtext">Jere detay konpayi an, limit yo, ak kofisyan pèyman yo</p>
        </div>
      </div>

      {/* Neon Database Live Status */}
      <div className="neon-db-badge-panel">
        <div className="db-badge-left">
          <div className={`db-status-dot ${dbStatus?.connected ? 'online' : 'offline'}`} />
          <Database size={22} className="db-icon" />
          <div>
            <div className="db-title-row">
              <span className="db-name">{dbStatus?.provider || "Neon PostgreSQL"}</span>
              <span className={`db-status-pill ${dbStatus?.connected ? 'pill-online' : 'pill-offline'}`}>
                {dbStatus?.connected ? (lang === 'ht' ? 'KONEKTE AK NEON (AWS)' : 'CONNECTÉ À NEON (AWS)') : 'OFFLINE'}
              </span>
            </div>
            <div className="db-meta-row">
              <span className="mono-text bold-text">{dbStatus?.database || 'neondb'}</span>
              <span>•</span>
              <span className="mono-text db-host-text">{dbStatus?.host || 'aws.neon.tech'}</span>
            </div>
          </div>
        </div>
        <div className="db-badge-right">
          <div className="db-stat-box">
            <span className="db-stat-label">{lang === 'ht' ? 'Tikè nan Baz la' : 'Billets en Base'}</span>
            <span className="db-stat-val mono-text">{dbStatus?.ticketsCount ?? '...'}</span>
          </div>
          <div className="db-stat-box">
            <span className="db-stat-label">{lang === 'ht' ? 'Tiraj Aktif' : 'Tirages Actifs'}</span>
            <span className="db-stat-val mono-text">{dbStatus?.drawsCount ?? '6'}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="settings-form-grid">
        {/* Company & POS Profile */}
        <div className="settings-card">
          <div className="settings-card-title">
            <Shield size={20} />
            <h4>Pwofil POS & Konpayi</h4>
          </div>

          <div className="form-group">
            <label>{t.companyName}</label>
            <input 
              type="text" 
              className="pos-input" 
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{t.companySubtitle}</label>
            <input 
              type="text" 
              className="pos-input" 
              value={formData.companySubtitle}
              onChange={(e) => setFormData({ ...formData, companySubtitle: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>ID Tèminal POS</label>
              <input 
                type="text" 
                className="pos-input mono-text" 
                value={formData.posId}
                onChange={(e) => setFormData({ ...formData, posId: e.target.value })}
              />
            </div>

            <div className="form-group flex-1">
              <label>{t.branchName}</label>
              <input 
                type="text" 
                className="pos-input" 
                value={formData.branchName}
                onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>{t.phone}</label>
              <input 
                type="text" 
                className="pos-input" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="form-group flex-1">
              <label>{t.currency}</label>
              <select 
                className="pos-select"
                value={formData.currency}
                onChange={(e) => {
                  const curr = e.target.value;
                  const sym = curr === 'HTG' ? 'G' : curr === 'USD' ? '$' : curr === 'MXN' ? 'MX$' : 'RD$';
                  setFormData({ ...formData, currency: curr, currencySymbol: sym });
                }}
              >
                <option value="MXN">MXN (Pesos Mexicains / Peso Mexicano - MX$)</option>
                <option value="HTG">HTG (Gourdes Haïtiennes - G)</option>
                <option value="USD">USD (Dollars Américains - $)</option>
                <option value="DOP">DOP (Pesos Dominicains - RD$)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Multipliers & Limits */}
        <div className="settings-card">
          <div className="settings-card-title">
            <Sliders size={20} />
            <h4>{t.multipliersTitle}</h4>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Premye Lo / 1er Lot (x)</label>
              <input 
                type="number" 
                className="pos-input mono-text" 
                value={formData.multipliers.bolette_lot1}
                onChange={(e) => setFormData({
                  ...formData,
                  multipliers: { ...formData.multipliers, bolette_lot1: Number(e.target.value) }
                })}
              />
            </div>

            <div className="form-group flex-1">
              <label>Dezyèm Lo / 2e Lot (x)</label>
              <input 
                type="number" 
                className="pos-input mono-text" 
                value={formData.multipliers.bolette_lot2}
                onChange={(e) => setFormData({
                  ...formData,
                  multipliers: { ...formData.multipliers, bolette_lot2: Number(e.target.value) }
                })}
              />
            </div>

            <div className="form-group flex-1">
              <label>Twazyèm Lo / 3e Lot (x)</label>
              <input 
                type="number" 
                className="pos-input mono-text" 
                value={formData.multipliers.bolette_lot3}
                onChange={(e) => setFormData({
                  ...formData,
                  multipliers: { ...formData.multipliers, bolette_lot3: Number(e.target.value) }
                })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Maryaj / Mariage (x)</label>
              <input 
                type="number" 
                className="pos-input mono-text" 
                value={formData.multipliers.mariage}
                onChange={(e) => setFormData({
                  ...formData,
                  multipliers: { ...formData.multipliers, mariage: Number(e.target.value) }
                })}
              />
            </div>

            <div className="form-group flex-1">
              <label>Loto 3 Chif (x)</label>
              <input 
                type="number" 
                className="pos-input mono-text" 
                value={formData.multipliers.loto3}
                onChange={(e) => setFormData({
                  ...formData,
                  multipliers: { ...formData.multipliers, loto3: Number(e.target.value) }
                })}
              />
            </div>

            <div className="form-group flex-1">
              <label>Loto 4 Chif (x)</label>
              <input 
                type="number" 
                className="pos-input mono-text" 
                value={formData.multipliers.loto4}
                onChange={(e) => setFormData({
                  ...formData,
                  multipliers: { ...formData.multipliers, loto4: Number(e.target.value) }
                })}
              />
            </div>
          </div>

          <div className="form-row mt-3">
            <div className="form-group flex-1">
              <label>{t.maxBetPerNumber}</label>
              <input 
                type="number" 
                className="pos-input mono-text" 
                value={formData.maxBetPerNumber}
                onChange={(e) => setFormData({ ...formData, maxBetPerNumber: Number(e.target.value) })}
              />
            </div>

            <div className="form-group flex-1">
              <label>{t.cancellationWindow}</label>
              <input 
                type="number" 
                className="pos-input mono-text" 
                value={formData.cancellationWindowMinutes}
                onChange={(e) => setFormData({ ...formData, cancellationWindowMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Manual Draw Overrides */}
        <div className="settings-card full-width">
          <div className="settings-card-title">
            <RefreshCcw size={20} />
            <h4>{t.manualOverrides}</h4>
          </div>

          <div className="draws-override-grid">
            {draws.map(draw => (
              <div key={draw.id} className="override-row">
                <span className="override-draw-name">
                  [{draw.state}] {lang === 'ht' ? draw.nameHt : draw.nameFr} ({draw.cutoffTime})
                </span>
                <div className="override-buttons">
                  <button 
                    type="button" 
                    className={`btn-override ${draw.isOpen ? 'active-open' : ''}`}
                    onClick={() => handleToggleDraw(draw.id, 'open')}
                  >
                    Fòse Louvri (Open)
                  </button>
                  <button 
                    type="button" 
                    className={`btn-override ${!draw.isOpen ? 'active-closed' : ''}`}
                    onClick={() => handleToggleDraw(draw.id, 'closed')}
                  >
                    Fòse Fèmen (Close)
                  </button>
                  <button 
                    type="button" 
                    className="btn-override"
                    onClick={() => handleToggleDraw(draw.id, null)}
                  >
                    Oto (Auto)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="settings-submit-container full-width">
          {successMsg && (
            <div className="form-success-alert mb-2">
              <CheckCircle size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          <button type="submit" className="btn-save-settings" disabled={saving}>
            <Save size={20} />
            <span>{saving ? "..." : t.saveSettings}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
