import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, Trophy, TrendingUp, ShieldCheck, 
  Store, Clock, AlertTriangle, CheckCircle, XCircle, 
  RefreshCw, Plus, Database, Cloud, FileText, Search,
  Power, Printer, KeyRound, ExternalLink, Activity,
  Ban, ShieldAlert, Trash2, Lock
} from 'lucide-react';
import { sounds } from '../soundEffects';

export default function AdminDashboard({ config, draws, lang, t, onDrawsUpdated }) {
  const [agents, setAgents] = useState([]);
  const [report, setReport] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [s3Status, setS3Status] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    username: '',
    pin: '',
    posId: '',
    branchName: '',
    country: 'HT'
  });
  const [newBlock, setNewBlock] = useState({
    drawId: 'all',
    number: '',
    gameType: 'bolette',
    isFullBlock: true,
    customLimit: '500',
    reason: ''
  });
  const [s3UploadResult, setS3UploadResult] = useState(null);
  const [s3Testing, setS3Testing] = useState(false);

  const currencySymbol = config?.currency === 'MXN' ? 'MX$' : config?.currency === 'HTG' ? 'HTG' : '$';

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      const [agentsRes, reportRes, ticketsRes, dbRes, s3Res, blockedRes] = await Promise.all([
        fetch('/api/auth/agents'),
        fetch('/api/reports/daily'),
        fetch('/api/tickets'),
        fetch('/api/database/status'),
        fetch('/api/storage/status'),
        fetch('/api/blocked-numbers')
      ]);

      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (reportRes.ok) setReport(await reportRes.json());
      if (ticketsRes.ok) setTickets(await ticketsRes.json());
      if (dbRes.ok) setDbStatus(await dbRes.json());
      if (s3Res.ok) setS3Status(await s3Res.json());
      if (blockedRes.ok) setBlockedNumbers(await blockedRes.json());
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    sounds.tap();
    setRefreshing(true);
    fetchDashboardData();
  };

  // Toggle agent active status
  const handleToggleAgent = async (agentId) => {
    sounds.tap();
    try {
      const res = await fetch(`/api/auth/agents/${agentId}/toggle`, { method: 'POST' });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      sounds.error();
      alert(err.message);
    }
  };

  // Add new agent
  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!newAgent.username || !newAgent.pin || !newAgent.name) {
      alert(lang === 'ht' ? "Tanpri ranpli tout chan obligatwa yo" : "Veuillez remplir tous les champs");
      return;
    }
    sounds.tap();
    try {
      const res = await fetch('/api/auth/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAgent,
          posId: newAgent.posId || `POS-${Math.floor(100 + Math.random() * 900)}`,
          branchName: newAgent.branchName || (lang === 'ht' ? 'Sikisal LOTO509' : 'Succursale LOTO509')
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erè nan kreyasyon');
      }
      setShowAddAgent(false);
      setNewAgent({ name: '', username: '', pin: '', posId: '', branchName: '', country: 'HT' });
      fetchDashboardData();
    } catch (err) {
      sounds.error();
      alert(err.message);
    }
  };

  // Add Blocked Number
  const handleCreateBlock = async (e) => {
    e.preventDefault();
    if (!newBlock.number) {
      alert(lang === 'ht' ? "Tanpri antre yon nimewo" : "Veuillez entrer un numéro");
      return;
    }
    sounds.tap();
    try {
      const res = await fetch('/api/blocked-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawId: newBlock.drawId,
          number: newBlock.number.trim(),
          gameType: newBlock.gameType,
          amount: newBlock.isFullBlock ? 0 : Number(newBlock.customLimit || 0),
          reason: newBlock.reason.trim()
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erè nan bloke nimewo");
      }
      setShowAddBlock(false);
      setNewBlock({ drawId: 'all', number: '', gameType: 'bolette', isFullBlock: true, customLimit: '500', reason: '' });
      fetchDashboardData();
    } catch (err) {
      sounds.error();
      alert(err.message);
    }
  };

  // Remove Blocked Number (Unblock)
  const handleRemoveBlock = async (blockId) => {
    sounds.tap();
    try {
      const res = await fetch(`/api/blocked-numbers/${blockId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      sounds.error();
      alert(err.message);
    }
  };

  // Override draw status
  const handleOverrideDraw = async (drawId, status) => {
    sounds.tap();
    try {
      const res = await fetch(`/api/draws/${drawId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        if (onDrawsUpdated) onDrawsUpdated();
        fetchDashboardData();
      }
    } catch (err) {
      sounds.error();
      alert(err.message);
    }
  };

  // Test S3 Upload & Pre-signed URL
  const handleTestS3 = async () => {
    sounds.tap();
    setS3Testing(true);
    try {
      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: "assets",
          key: `uploads/test-${Date.now()}.txt`,
          body: `LOTO509 Test Upload at ${new Date().toISOString()}`
        })
      });
      const data = await res.json();
      setS3UploadResult(data);
      sounds.tap();
    } catch (err) {
      sounds.error();
      alert(err.message);
    } finally {
      setS3Testing(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      t.id.toLowerCase().includes(s) ||
      t.securityCode?.toLowerCase().includes(s) ||
      t.drawNameFr?.toLowerCase().includes(s) ||
      t.drawNameHt?.toLowerCase().includes(s) ||
      t.sellerId?.toLowerCase().includes(s) ||
      t.posId?.toLowerCase().includes(s)
    );
  });

  const totalSales = report?.totalSales || 0;
  const totalPayouts = report?.totalWinningAmount || 0;
  const netBalance = report?.netBalance || 0;
  const marginPercent = totalSales > 0 ? Math.round((netBalance / totalSales) * 100) : 100;

  return (
    <div className="admin-dashboard-container">
      {/* Top Banner */}
      <div className="admin-header-banner">
        <div>
          <div className="admin-badge-pill">
            <ShieldCheck size={14} />
            <span>{lang === 'ht' ? "ADMINISTRASYON SANTRAL" : "ADMINISTRATION CENTRALE"}</span>
          </div>
          <h2 className="admin-header-title">{t.adminDashboardTitle || "Tablo de Bò Administrasyon LOTO509"}</h2>
          <p className="admin-header-subtitle">{t.adminSubtitle || "Siveyans an Dirèk sou Tout Tèminal, Tiraj & Finans"}</p>
        </div>

        <div className="admin-header-actions">
          <button 
            className="btn-refresh-admin"
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spin-icon' : ''} />
            <span>{t.refreshData || "Aktyalize"}</span>
          </button>
        </div>
      </div>

      {/* Financial KPI Cards */}
      <div className="admin-kpi-grid">
        {/* Card 1: Total Sales */}
        <div className="admin-kpi-card sales">
          <div className="kpi-icon-wrap sales">
            <DollarSign size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">{t.totalGrossSales || "Total Vant Brute"}</span>
            <div className="kpi-value">{currencySymbol} {totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <span className="kpi-subtext">
              {report?.activeTicketsCount || 0} {lang === 'ht' ? "tikè anrejistre jodi a" : "billets émis aujourd'hui"}
            </span>
          </div>
        </div>

        {/* Card 2: Total Payouts */}
        <div className="admin-kpi-card payouts">
          <div className="kpi-icon-wrap payouts">
            <Trophy size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">{t.totalPaidOut || "Total Gayan / Pèyman"}</span>
            <div className="kpi-value">{currencySymbol} {totalPayouts.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <span className="kpi-subtext">
              {report?.winningTicketsCount || 0} {lang === 'ht' ? "tikè ki genyen" : "billets gagnants"}
            </span>
          </div>
        </div>

        {/* Card 3: Net Profit */}
        <div className="admin-kpi-card profit">
          <div className="kpi-icon-wrap profit">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">{t.netMargin || "Pwofi Nèt (Balanse)"}</span>
            <div className={`kpi-value ${netBalance < 0 ? 'negative' : ''}`}>
              {currencySymbol} {netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <span className="kpi-subtext">
              {marginPercent}% {lang === 'ht' ? "maje pwofi bank" : "marge bénéficiaire"}
            </span>
          </div>
        </div>

        {/* Card 4: Terminals Online */}
        <div className="admin-kpi-card terminals">
          <div className="kpi-icon-wrap terminals">
            <Store size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">{t.terminalsOnline || "Tèminal Aktif"}</span>
            <div className="kpi-value">{agents.filter(a => a.enabled).length} / {agents.length}</div>
            <span className="kpi-subtext">
              {agents.filter(a => a.role === 'agent').length} {lang === 'ht' ? "vandè an liy" : "vendeurs en ligne"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Agents & Live Draws */}
      <div className="admin-sections-grid">
        {/* Section 1: Agent & POS Terminal Management */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="card-title-group">
              <Users size={20} className="card-icon" />
              <h3>{t.agentsManagement || "Jesyon Vandè & Tèminal POS"}</h3>
            </div>
            <button 
              className="btn-add-agent"
              onClick={() => setShowAddAgent(!showAddAgent)}
            >
              <Plus size={16} />
              <span>{t.addNewAgent || "Ajoute Vandè"}</span>
            </button>
          </div>

          {/* New Agent Form Modal / Collapse */}
          {showAddAgent && (
            <form className="add-agent-form" onSubmit={handleCreateAgent}>
              <h4>{lang === 'ht' ? "Kreye yon Nouvo Vandè" : "Créer un Nouveau Vendeur"}</h4>
              <div className="form-row">
                <input 
                  type="text" 
                  placeholder={lang === 'ht' ? "Non Konplè Vandè a" : "Nom Complet"} 
                  value={newAgent.name} 
                  onChange={e => setNewAgent({...newAgent, name: e.target.value})}
                  required 
                />
                <input 
                  type="text" 
                  placeholder={lang === 'ht' ? "Non Itilizatè (eg. agent3)" : "Identifiant"} 
                  value={newAgent.username} 
                  onChange={e => setNewAgent({...newAgent, username: e.target.value})}
                  required 
                />
              </div>
              <div className="form-row">
                <input 
                  type="text" 
                  maxLength={6} 
                  placeholder={lang === 'ht' ? "Kòd PIN (eg. 4321)" : "Code PIN"} 
                  value={newAgent.pin} 
                  onChange={e => setNewAgent({...newAgent, pin: e.target.value})}
                  required 
                />
                <input 
                  type="text" 
                  placeholder={lang === 'ht' ? "ID Tèminal (eg. POS-SUNMI-03)" : "ID Terminal"} 
                  value={newAgent.posId} 
                  onChange={e => setNewAgent({...newAgent, posId: e.target.value})}
                />
                <input 
                  type="text" 
                  placeholder={lang === 'ht' ? "Sikisal (eg. Kafou)" : "Succursale"} 
                  value={newAgent.branchName} 
                  onChange={e => setNewAgent({...newAgent, branchName: e.target.value})}
                />
              </div>
              <div className="form-row">
                <select
                  value={newAgent.country || 'HT'}
                  onChange={e => setNewAgent({...newAgent, country: e.target.value})}
                  style={{padding:'10px',borderRadius:'8px',background:'var(--bg-card)',color:'var(--text-primary)',border:'1px solid var(--border-color)',fontSize:'0.95rem'}}
                >
                  <option value="HT">🇭🇹 Haiti</option>
                  <option value="DO">🇩🇴 Rep. Dominicana</option>
                  <option value="BR">🇧🇷 Brasil</option>
                  <option value="MX">🇲🇽 México</option>
                  <option value="US">🇺🇸 Estados Unidos</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-confirm-add">
                  {lang === 'ht' ? "Anrejistre Vandè" : "Enregistrer Vendeur"}
                </button>
                <button type="button" className="btn-cancel-add" onClick={() => setShowAddAgent(false)}>
                  {lang === 'ht' ? "Anile" : "Annuler"}
                </button>
              </div>
            </form>
          )}

          {/* Agents Table */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t.agentName || "Vandè"}</th>
                  <th>{t.terminalId || "Tèminal POS"}</th>
                  <th>{t.branch || "Sikisal"}</th>
                  <th>{t.todaySales || "Vant Jodi a"}</th>
                  <th>{t.status || "Eta"}</th>
                  <th>{t.action || "Aksyon"}</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id} className={!a.enabled ? 'row-disabled' : ''}>
                    <td>
                      <div className="agent-name-cell">
                        <span className="agent-display-name">{a.countryFlag || '👤'} {a.name}</span>
                        <span className="agent-user-tag">@{a.username} • {a.role === 'admin' ? '👑 Admin' : '👤 Vandè'} • {a.countryLabel || 'Haiti'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge-pos-id">{a.posId}</span>
                    </td>
                    <td>{a.branchName}</td>
                    <td>
                      <strong className="agent-sales-val">
                        {currencySymbol} {(a.todaySales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td>
                      <span className={`status-pill ${a.enabled ? 'active' : 'disabled'}`}>
                        {a.enabled ? (t.active || "Aktif") : (t.disabled || "Bloke")}
                      </span>
                    </td>
                    <td>
                      {a.role !== 'admin' && (
                        <button 
                          className={`btn-toggle-status ${a.enabled ? 'deactivate' : 'activate'}`}
                          onClick={() => handleToggleAgent(a.id)}
                          title={t.toggleStatus || "Chanje Eta"}
                        >
                          <Power size={14} />
                          <span>{a.enabled ? (lang === 'ht' ? 'Bloke' : 'Désactiver') : (lang === 'ht' ? 'Debloke' : 'Activer')}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Real-time Draw Controls & Overrides */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="card-title-group">
              <Clock size={20} className="card-icon" />
              <h3>{t.drawOverrides || "Kontwòl Tiraj an Dirèk"}</h3>
            </div>
          </div>

          <div className="admin-draws-grid">
            {draws.map(draw => {
              const name = lang === 'ht' ? draw.nameHt : draw.nameFr;
              const isClosed = draw.manualOverride === 'closed' || (!draw.manualOverride && !draw.isOpen);
              return (
                <div key={draw.id} className={`admin-draw-item ${isClosed ? 'closed' : 'open'}`}>
                  <div className="draw-item-header">
                    <div>
                      <h4 className="draw-item-name">{name}</h4>
                      <span className="draw-item-time">{draw.drawTime}</span>
                    </div>
                    <span className={`draw-state-tag ${isClosed ? 'closed' : 'open'}`}>
                      {isClosed ? (t.drawClosed || "FÈMEN") : (t.drawOpen || "OUVÈ")}
                    </span>
                  </div>

                  <div className="draw-override-buttons">
                    <button 
                      className={`btn-override ${draw.manualOverride === 'open' ? 'selected' : ''}`}
                      onClick={() => handleOverrideDraw(draw.id, 'open')}
                    >
                      {t.forceOpen || "Fòse Ouvri"}
                    </button>
                    <button 
                      className={`btn-override ${draw.manualOverride === 'closed' ? 'selected' : ''}`}
                      onClick={() => handleOverrideDraw(draw.id, 'closed')}
                    >
                      {t.forceClose || "Fòse Fèmen"}
                    </button>
                    <button 
                      className={`btn-override ${!draw.manualOverride ? 'selected' : ''}`}
                      onClick={() => handleOverrideDraw(draw.id, null)}
                    >
                      {t.autoSchedule || "Otomatik"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section: Blocked Numbers & Risk Management */}
      <div className="admin-card blocked-numbers-card">
        <div className="admin-card-header">
          <div className="card-title-group">
            <Ban size={20} className="card-icon text-rose" />
            <div>
              <h3>{t.blockedNumbersTitle || "Nimewo Bloke & Limit Risk"}</h3>
              <p className="card-subtitle-small">
                {t.blockedNumbersSubtitle || "Kontwòl Risk Bank sou Nimewo Cho & Konbinezon"}
              </p>
            </div>
          </div>
          <button 
            className="btn-add-block"
            onClick={() => setShowAddBlock(!showAddBlock)}
          >
            <Plus size={16} />
            <span>{t.addBlockedNumber || "Bloke yon Nimewo"}</span>
          </button>
        </div>

        {/* Modal / Inline Form to Add a Block */}
        {showAddBlock && (
          <form className="add-block-form" onSubmit={handleCreateBlock}>
            <h4>{lang === 'ht' ? "Ajoute yon Nimewo Bloke oswa Plafon Risk" : "Bloquer un Numéro ou Définir un Plafond"}</h4>
            
            <div className="form-row">
              <div className="form-field-group">
                <label>{lang === 'ht' ? "Tiraj ki Konsène" : "Tirage Concerné"}</label>
                <select 
                  value={newBlock.drawId} 
                  onChange={e => setNewBlock({ ...newBlock, drawId: e.target.value })}
                >
                  <option value="all">{t.allDraws || "Tout Tiraj (Global)"}</option>
                  {draws.map(d => (
                    <option key={d.id} value={d.id}>{lang === 'ht' ? d.nameHt : d.nameFr}</option>
                  ))}
                </select>
              </div>

              <div className="form-field-group">
                <label>{lang === 'ht' ? "Kalite Jwèt" : "Type de Jeu"}</label>
                <select 
                  value={newBlock.gameType} 
                  onChange={e => setNewBlock({ ...newBlock, gameType: e.target.value })}
                >
                  <option value="bolette">{t.gameBolette || "Bòlèt (2 Chif)"}</option>
                  <option value="mariage">{t.gameMariage || "Maryaj"}</option>
                  <option value="loto3">{t.gameLoto3 || "Loto 3 Chif"}</option>
                  <option value="loto4">{t.gameLoto4 || "Loto 4 Chif"}</option>
                  <option value="all">{t.allGames || "Tout Kalite Jwèt"}</option>
                </select>
              </div>

              <div className="form-field-group">
                <label>{t.blockedNumberLabel || "Nimewo pou Bloke"}</label>
                <input 
                  type="text"
                  placeholder="egz: 24 oswa 24x88"
                  value={newBlock.number}
                  onChange={e => setNewBlock({ ...newBlock, number: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field-group radio-group">
                <label>{lang === 'ht' ? "Nivo Blokaj" : "Niveau de Blocage"}</label>
                <div className="block-type-pills">
                  <button 
                    type="button" 
                    className={`block-pill ${newBlock.isFullBlock ? 'selected' : ''}`}
                    onClick={() => setNewBlock({ ...newBlock, isFullBlock: true })}
                  >
                    <Ban size={14} />
                    <span>{t.blockCompletely || "Bloke Nèt (0 MX$)"}</span>
                  </button>
                  <button 
                    type="button" 
                    className={`block-pill ${!newBlock.isFullBlock ? 'selected' : ''}`}
                    onClick={() => setNewBlock({ ...newBlock, isFullBlock: false })}
                  >
                    <Lock size={14} />
                    <span>{t.customLimit || "Plafon Risk"}</span>
                  </button>
                </div>
              </div>

              {!newBlock.isFullBlock && (
                <div className="form-field-group">
                  <label>{lang === 'ht' ? "Montan Maksimòm (MX$)" : "Montant Maximal (MX$)"}</label>
                  <input 
                    type="number" 
                    min="1" 
                    placeholder="500" 
                    value={newBlock.customLimit}
                    onChange={e => setNewBlock({ ...newBlock, customLimit: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-field-group flex-2">
                <label>{t.reasonLabel || "Rezon (Opsyonèl)"}</label>
                <input 
                  type="text" 
                  placeholder={lang === 'ht' ? "egz: Nimewo cho / Rèv popilè" : "ex: Numéro très demandé"}
                  value={newBlock.reason}
                  onChange={e => setNewBlock({ ...newBlock, reason: e.target.value })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-confirm-block">
                <Ban size={15} />
                <span>{t.confirmBlock || "Konfime & Bloke"}</span>
              </button>
              <button type="button" className="btn-cancel-add" onClick={() => setShowAddBlock(false)}>
                {lang === 'ht' ? "Anile" : "Annuler"}
              </button>
            </div>
          </form>
        )}

        {/* Blocked Numbers Cards / Grid */}
        <div className="blocked-numbers-grid">
          {blockedNumbers.map(item => {
            const drawObj = draws.find(d => d.id === item.drawId);
            const drawLabel = item.drawId === 'all' 
              ? (t.allDraws || "Tout Tiraj (Global)") 
              : (drawObj ? (lang === 'ht' ? drawObj.nameHt : drawObj.nameFr) : item.drawId);

            return (
              <div key={item.id} className="blocked-number-chip">
                <div className="blocked-chip-left">
                  <div className="blocked-num-badge">
                    {item.number}
                  </div>
                  <div className="blocked-meta">
                    <div className="blocked-draw-label">{drawLabel}</div>
                    <div className="blocked-game-tag">
                      {item.gameType === 'bolette' ? 'Bòlèt' : 
                       item.gameType === 'mariage' ? 'Maryaj' : 
                       item.gameType === 'loto3' ? 'Loto 3' : 
                       item.gameType === 'loto4' ? 'Loto 4' : 'Tout Kalite'}
                    </div>
                  </div>
                </div>

                <div className="blocked-chip-right">
                  <div className="blocked-status-tag">
                    {item.amount === 0 ? (
                      <span className="badge-fully-blocked">
                        <Ban size={12} />
                        <span>BLOKE NÈT</span>
                      </span>
                    ) : (
                      <span className="badge-capped">
                        <Lock size={12} />
                        <span>Maks: {currencySymbol} {item.amount}</span>
                      </span>
                    )}
                    {item.reason && <span className="blocked-reason-tag" title={item.reason}>"{item.reason}"</span>}
                  </div>

                  <button 
                    className="btn-unblock-item"
                    onClick={() => handleRemoveBlock(item.id)}
                    title={t.unblock || "Debloke"}
                  >
                    <Trash2 size={15} />
                    <span>{t.unblock || "Debloke"}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {blockedNumbers.length === 0 && (
            <div className="no-blocked-empty-state">
              <CheckCircle size={28} className="text-emerald" />
              <div>
                <p className="empty-title">{t.noBlockedNumbers || "Pa gen okenn nimewo bloke kounye a."}</p>
                <p className="empty-subtitle">{lang === 'ht' ? "Tout nimewo lib pou tout tiraj yo san limitasyon." : "Tous les numéros sont disponibles pour la vente."}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Infrastructure & Cloud Storage Status */}
      <div className="admin-infra-grid">
        {/* Neon PostgreSQL Card */}
        <div className="admin-infra-card">
          <div className="infra-card-header">
            <div className="infra-title-wrap">
              <Database size={20} className="infra-icon db" />
              <h4>Neon PostgreSQL Database</h4>
            </div>
            <span className="infra-status-pill green">
              <CheckCircle size={14} />
              <span>{dbStatus?.database || "Connected"}</span>
            </span>
          </div>
          <div className="infra-body">
            <div className="infra-stat-row">
              <span className="stat-label">Host:</span>
              <span className="stat-val mono">{dbStatus?.host || "ep-shiny-band-b7457fiw-pooler.c-13.us-east-1.aws.neon.tech"}</span>
            </div>
            <div className="infra-stat-row">
              <span className="stat-label">Tables:</span>
              <span className="stat-val">{dbStatus?.tables?.join(', ') || "loto_config, loto_draws, loto_tickets, loto_results, loto_users"}</span>
            </div>
            <div className="infra-stat-row">
              <span className="stat-label">Total Tickets Stored:</span>
              <span className="stat-val bold">{tickets.length}</span>
            </div>
          </div>
        </div>

        {/* S3 Object Storage Card */}
        <div className="admin-infra-card">
          <div className="infra-card-header">
            <div className="infra-title-wrap">
              <Cloud size={20} className="infra-icon s3" />
              <h4>AWS S3 Object Storage</h4>
            </div>
            <span className="infra-status-pill green">
              <CheckCircle size={14} />
              <span>{s3Status?.status || "Active"}</span>
            </span>
          </div>
          <div className="infra-body">
            <div className="infra-stat-row">
              <span className="stat-label">Bucket:</span>
              <span className="stat-val mono">{s3Status?.bucket || "assets"}</span>
            </div>
            <div className="infra-stat-row">
              <span className="stat-label">Endpoint:</span>
              <span className="stat-val mono">{s3Status?.endpoint || "http://localhost:4000/s3"}</span>
            </div>
            <div className="infra-test-action">
              <button 
                className="btn-test-s3"
                onClick={handleTestS3}
                disabled={s3Testing}
              >
                <Cloud size={14} />
                <span>{s3Testing ? "Uploading..." : "Test S3 Upload & Pre-sign"}</span>
              </button>
              {s3UploadResult && (
                <div className="s3-success-box">
                  <span className="mono-link" title={s3UploadResult.url}>
                    [view] {s3UploadResult.key}
                  </span>
                  <a href={s3UploadResult.url} target="_blank" rel="noreferrer" className="s3-external-link">
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Recent Ticket Audit & Bank Search */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div className="card-title-group">
            <FileText size={20} className="card-icon" />
            <h3>{t.recentAuditLog || "Dènye Tikè & Odit Bank"}</h3>
          </div>
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder={lang === 'ht' ? "Chèche pa ID, kòd, tèminal..." : "Rechercher par ID, terminal..."}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t.ticketNumber || "Tikè #"}</th>
                <th>{t.draw || "Tiraj"}</th>
                <th>{t.hour || "Lè"}</th>
                <th>{t.terminalId || "Tèminal"}</th>
                <th>{t.playsCount || "Jwèt"}</th>
                <th>{t.totalTicket || "Montan"}</th>
                <th>{t.status || "Eta"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.slice(0, 15).map(ticket => (
                <tr key={ticket.id}>
                  <td>
                    <span className="ticket-id-bold mono">{ticket.id}</span>
                    <span className="sec-code-sub">{ticket.securityCode}</span>
                  </td>
                  <td>{lang === 'ht' ? ticket.drawNameHt : ticket.drawNameFr}</td>
                  <td>{ticket.drawTime}</td>
                  <td>
                    <span className="badge-pos-id">{ticket.posId || 'POS-01'}</span>
                  </td>
                  <td>{ticket.plays?.length || 0}</td>
                  <td>
                    <strong>{currencySymbol} {ticket.totalAmount?.toFixed(2)}</strong>
                  </td>
                  <td>
                    <span className={`status-pill ${ticket.status}`}>
                      {ticket.status === 'won' ? '🎉 GAYAN' : 
                       ticket.status === 'paid' ? '✅ PEYE' : 
                       ticket.status === 'cancelled' ? '❌ ANILE' : 'VALAB'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-4">
                    {lang === 'ht' ? "Pa gen tikè jwenn" : "Aucun billet trouvé"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
