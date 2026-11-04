import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, Trophy, TrendingUp, ShieldCheck, 
  Store, Clock, AlertTriangle, CheckCircle, 
  RefreshCw, Plus, Database, Cloud, FileText, Search,
  Power, Printer, ExternalLink,
  Ban, Trash2, Lock, Eye, EyeOff, X, Copy, Check, Key
} from 'lucide-react';
import { sounds } from '../soundEffects';

export default function AdminDashboard({ config, draws, lang, t, onDrawsUpdated, onReprintTicket, onCancelTicket, currentUser }) {
  const isModerator = currentUser?.role === 'moderator';
  const [agents, setAgents] = useState([]);
  const [report, setReport] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [s3Status, setS3Status] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedTicketModal, setSelectedTicketModal] = useState(null);
  const [selectedUserModal, setSelectedUserModal] = useState(null);
  const [userPinRevealed, setUserPinRevealed] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [userTxFilter, setUserTxFilter] = useState('all');
  const [userTxSearch, setUserTxSearch] = useState('');
  const [pinChangeTarget, setPinChangeTarget] = useState(null);
  const [newPinInput, setNewPinInput] = useState('');
  const [pinUpdating, setPinUpdating] = useState(false);
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');
  const [pinErrorMsg, setPinErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    username: '',
    pin: '',
    posId: '',
    branchName: '',
    role: 'agent',
    teamName: isModerator ? (currentUser?.teamName || 'Ekip Nò') : '',
    supervisorId: isModerator ? currentUser?.id : '',
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

  const currencySymbol = config?.currencySymbol || (config?.currency === 'HTG' ? 'G' : config?.currency === 'MXN' ? 'MX$' : '$');

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      const agentUrl = isModerator && currentUser?.id 
        ? `/api/auth/agents?supervisorId=${encodeURIComponent(currentUser.id)}` 
        : '/api/auth/agents';
      const reportUrl = isModerator && currentUser?.id 
        ? `/api/reports/daily?supervisorId=${encodeURIComponent(currentUser.id)}` 
        : '/api/reports/daily';
      const ticketUrl = isModerator && currentUser?.id 
        ? `/api/tickets?supervisorId=${encodeURIComponent(currentUser.id)}` 
        : '/api/tickets';

      const calls = [
        fetch(agentUrl),
        fetch(reportUrl),
        fetch(ticketUrl),
        fetch('/api/blocked-numbers')
      ];

      if (!isModerator) {
        calls.push(fetch('/api/database/status'));
        calls.push(fetch('/api/storage/status'));
      }

      const results = await Promise.all(calls);
      const [agentsRes, reportRes, ticketsRes, blockedRes] = results;

      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (reportRes.ok) setReport(await reportRes.json());
      if (ticketsRes.ok) setTickets(await ticketsRes.json());
      if (blockedRes.ok) setBlockedNumbers(await blockedRes.json());

      if (!isModerator && results[4] && results[5]) {
        if (results[4].ok) setDbStatus(await results[4].json());
        if (results[5].ok) setS3Status(await results[5].json());
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
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
      const payload = {
        ...newAgent,
        role: isModerator ? 'agent' : (newAgent.role || 'agent'),
        teamName: isModerator 
          ? (currentUser?.teamName || 'Ekip Nò') 
          : (newAgent.teamName || 'Ekip Prensipal'),
        supervisorId: isModerator 
          ? currentUser?.id 
          : (newAgent.supervisorId || null),
        posId: newAgent.posId || `POS-${Math.floor(100 + Math.random() * 900)}`,
        branchName: newAgent.branchName || (lang === 'ht' ? 'Sikisal LOTO509' : 'Succursale LOTO509')
      };

      const res = await fetch('/api/auth/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erè nan kreyasyon');
      }
      setShowAddAgent(false);
      setNewAgent({ 
        name: '', 
        username: '', 
        pin: '', 
        posId: '', 
        branchName: '', 
        role: 'agent',
        teamName: isModerator ? (currentUser?.teamName || 'Ekip Nò') : '',
        supervisorId: isModerator ? currentUser?.id : '',
        country: 'HT' 
      });
      fetchDashboardData();
    } catch (err) {
      sounds.error();
      alert(err.message);
    }
  };

  // Change PIN handler (Admin only)
  const handleUpdatePin = async (e) => {
    if (e) e.preventDefault();
    if (!pinChangeTarget || !newPinInput) return;
    const clean = newPinInput.trim();
    if (clean.length < 4 || clean.length > 20) {
      setPinErrorMsg(lang === 'ht' ? 'PIN dwe genyen ant 4 ak 20 karaktè' : 'Le PIN doit contenir entre 4 et 20 caractères');
      return;
    }

    setPinUpdating(true);
    setPinErrorMsg('');
    try {
      const res = await fetch(`/api/auth/agents/${pinChangeTarget.id}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPin: clean,
          requesterRole: currentUser?.role
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erè pandan modifikasyon PIN');
      }

      sounds.tap();
      setPinSuccessMsg(lang === 'ht' ? `✅ Kòd PIN chanje avèk siksè pou ${pinChangeTarget.name}!` : `✅ Code PIN modifié avec succès pour ${pinChangeTarget.name}!`);

      // Update agents list in local state
      setAgents(prev => prev.map(a => a.id === pinChangeTarget.id ? { ...a, pin: clean } : a));

      // If currently inspecting this user in modal, update that as well
      setSelectedUserModal(prev => prev && prev.id === pinChangeTarget.id ? { ...prev, pin: clean } : prev);

      setTimeout(() => {
        setPinChangeTarget(null);
        setNewPinInput('');
        setPinSuccessMsg('');
      }, 1400);
    } catch (err) {
      sounds.error();
      setPinErrorMsg(err.message);
    } finally {
      setPinUpdating(false);
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

  const availableTeams = Array.from(new Set(agents.map(a => a.teamName).filter(Boolean)));
  const availableSupervisors = agents.filter(a => a.role === 'moderator' || a.role === 'admin');
  const visibleAgents = agents.filter(a => {
    if (selectedTeam !== 'all' && a.teamName !== selectedTeam) return false;
    return true;
  });

  const filteredTickets = tickets.filter(t => {
    if (selectedTeam !== 'all') {
      const teamAgentUsernames = agents.filter(a => a.teamName === selectedTeam).map(a => a.username);
      const teamAgentPosIds = agents.filter(a => a.teamName === selectedTeam).map(a => a.posId);
      if (!teamAgentUsernames.includes(t.sellerId) && !teamAgentPosIds.includes(t.posId)) return false;
    }
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
            {isModerator ? <Users size={14} /> : <ShieldCheck size={14} />}
            <span>
              {isModerator 
                ? `${t.navModerator || "SIPÈVIZYON EKIP"} • ${currentUser?.teamName || "EKIP NÒ"}` 
                : (lang === 'ht' ? "ADMINISTRASYON SANTRAL" : "ADMINISTRATION CENTRALE")}
            </span>
          </div>
          <h2 className="admin-header-title">
            {isModerator 
              ? (t.moderatorDashboardTitle || "Tablo de Bò Sipèvizyon Ekip") 
              : (t.adminDashboardTitle || "Tablo de Bò Administrasyon LOTO509")}
          </h2>
          <p className="admin-header-subtitle">
            {isModerator 
              ? `${t.moderatorSubtitle || "Siveyans Vandè, Vant ak Pèyman nan Ekip Ou a"} (${currentUser?.name || ''})` 
              : (t.adminSubtitle || "Siveyans an Dirèk sou Tout Tèminal, Tiraj & Finans")}
          </p>
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

      {/* Admin Team Filter Chips (Shown for Super Admin to quickly filter by team) */}
      {!isModerator && availableTeams.length > 0 && (
        <div className="admin-team-filter-bar" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            🏷️ {t.allTeams || "Ekip:"}
          </span>
          <button
            type="button"
            className={`team-chip-btn ${selectedTeam === 'all' ? 'active' : ''}`}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              fontSize: '0.82rem',
              cursor: 'pointer',
              border: selectedTeam === 'all' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.12)',
              background: selectedTeam === 'all' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
              color: selectedTeam === 'all' ? '#60a5fa' : 'var(--text-primary)',
              fontWeight: selectedTeam === 'all' ? 600 : 400
            }}
            onClick={() => setSelectedTeam('all')}
          >
            {t.allTeams || "Tout Ekip yo"} ({agents.length})
          </button>
          {availableTeams.map(tm => {
            const count = agents.filter(a => a.teamName === tm).length;
            const isSel = selectedTeam === tm;
            return (
              <button
                key={tm}
                type="button"
                className={`team-chip-btn ${isSel ? 'active' : ''}`}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  border: isSel ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.12)',
                  background: isSel ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.04)',
                  color: isSel ? '#facc15' : 'var(--text-primary)',
                  fontWeight: isSel ? 600 : 400
                }}
                onClick={() => setSelectedTeam(tm)}
              >
                🛡️ {tm} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Financial KPI Cards */}
      <div className="admin-kpi-grid">
        {/* Card 1: Total Sales */}
        <div className="admin-kpi-card sales">
          <div className="kpi-icon-wrap sales">
            <DollarSign size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">
              {isModerator ? (t.teamSales || "Vant Ekip la") : (t.totalGrossSales || "Total Vant Brute")}
            </span>
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
            <span className="kpi-label">
              {isModerator ? (t.teamBalance || "Pèyman Ekip la") : (t.totalPaidOut || "Total Gayan / Pèyman")}
            </span>
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
            <span className="kpi-label">
              {isModerator ? (t.teamBalance || "Balanse Nèt Ekip") : (t.netMargin || "Pwofi Nèt (Balanse)")}
            </span>
            <div className={`kpi-value ${netBalance < 0 ? 'negative' : ''}`}>
              {currencySymbol} {netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <span className="kpi-subtext">
              {marginPercent}% {lang === 'ht' ? "maje pwofi" : "marge bénéficiaire"}
            </span>
          </div>
        </div>

        {/* Card 4: Terminals Online */}
        <div className="admin-kpi-card terminals">
          <div className="kpi-icon-wrap terminals">
            <Store size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">
              {isModerator ? (t.teamAgents || "Vandè nan Ekip la") : (t.terminalsOnline || "Tèminal Aktif")}
            </span>
            <div className="kpi-value">
              {visibleAgents.filter(a => a.enabled).length} / {visibleAgents.length}
            </div>
            <span className="kpi-subtext">
              {visibleAgents.filter(a => a.role === 'agent').length} {lang === 'ht' ? "vandè an liy" : "vendeurs en ligne"}
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
              <h3>
                {isModerator 
                  ? (t.teamAgents || "Vandè nan Ekip la") 
                  : (t.agentsManagement || "Jesyon Vandè & Tèminal POS")}
              </h3>
            </div>
            <button 
              className="btn-add-agent"
              onClick={() => setShowAddAgent(!showAddAgent)}
            >
              <Plus size={16} />
              <span>
                {isModerator 
                  ? (t.addNewTeamAgent || "Ajoute nan Ekip Ou") 
                  : (t.addNewAgent || "Ajoute Vandè")}
              </span>
            </button>
          </div>

          {/* New Agent Form Modal / Collapse */}
          {showAddAgent && (
            <form className="add-agent-form" onSubmit={handleCreateAgent}>
              <h4>
                {isModerator 
                  ? (lang === 'ht' ? `Kreye yon Vandè nan ${currentUser?.teamName || "Ekip Ou"}` : `Créer un Vendeur dans ${currentUser?.teamName || "votre Équipe"}`)
                  : (lang === 'ht' ? "Kreye yon Nouvo Vandè oswa Moderatè" : "Créer un Vendeur ou Modérateur")}
              </h4>
              
              {!isModerator && (
                <div className="form-row">
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.25rem' }}>
                      {t.role || "Wòl:"}
                    </label>
                    <select
                      value={newAgent.role}
                      onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    >
                      <option value="agent">👤 {t.roleAgent || "Ajan / Vandè POS"}</option>
                      <option value="moderator">🛡️ {t.roleModerator || "Moderatè / Lidè Ekip"}</option>
                    </select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.25rem' }}>
                      {t.assignTeam || "Non Ekip la:"}
                    </label>
                    <input 
                      type="text" 
                      placeholder="eg. Ekip Nò, Ekip Petyonvil..." 
                      value={newAgent.teamName} 
                      onChange={e => setNewAgent({ ...newAgent, teamName: e.target.value })}
                    />
                  </div>

                  {newAgent.role === 'agent' && (
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.25rem' }}>
                        {t.supervisor || "Sipèvizè / Moderatè:"}
                      </label>
                      <select
                        value={newAgent.supervisorId}
                        onChange={e => setNewAgent({ ...newAgent, supervisorId: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="">-- {t.selectSupervisor || "Chwazi Moderatè"} --</option>
                        {availableSupervisors.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.role === 'admin' ? '👑' : '🛡️'} {s.name} ({s.teamName})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

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
                  <th>{t.team || "Ekip"}</th>
                  <th>{t.terminalId || "Tèminal POS"}</th>
                  <th>{t.branch || "Sikisal"}</th>
                  <th>{t.todaySales || "Vant Jodi a"}</th>
                  <th>{t.status || "Eta"}</th>
                  <th>{t.action || "Aksyon"}</th>
                </tr>
              </thead>
              <tbody>
                {visibleAgents.map(a => (
                  <tr key={a.id} className={!a.enabled ? 'row-disabled' : ''}>
                    <td>
                      <div 
                        className="agent-name-cell"
                        onClick={() => { setSelectedUserModal(a); setUserPinRevealed(false); }}
                        style={{ cursor: 'pointer' }}
                        title="Klike pou wè tout enfòmasyon ak tranzaksyon"
                      >
                        <span className="agent-display-name" style={{ color: '#60a5fa', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                          {a.role === 'admin' ? '👑' : a.role === 'moderator' ? '🛡️' : (a.countryFlag || '👤')} {a.name}
                        </span>
                        <span className="agent-user-tag">
                          @{a.username} • {a.role === 'admin' ? (t.roleAdmin || 'Admin') : a.role === 'moderator' ? (t.roleModerator || 'Lidè Ekip') : (t.roleAgent || 'Vandè')} • {a.countryLabel || 'Haiti'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge-team" style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', fontSize: '0.8rem', fontWeight: 600 }}>
                        🏷️ {a.teamName || 'Ekip Prensipal'}
                      </span>
                      {a.supervisorName && (
                        <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: '2px' }}>
                          Sip: {a.supervisorName}
                        </div>
                      )}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => { setSelectedUserModal(a); setUserPinRevealed(false); }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px'
                          }}
                          title="Gade Pwofil & Tout Tranzaksyon"
                        >
                          <Eye size={13} />
                          <span>{lang === 'ht' ? "Pwofil & Vant" : "Profil & Ventes"}</span>
                        </button>
                        {!isModerator && (
                          <button
                            type="button"
                            onClick={() => {
                              setPinChangeTarget(a);
                              setNewPinInput('');
                              setPinErrorMsg('');
                              setPinSuccessMsg('');
                            }}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid rgba(234, 179, 8, 0.4)',
                              background: 'rgba(234, 179, 8, 0.15)',
                              color: '#facc15',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px'
                            }}
                            title={lang === 'ht' ? "Chanje Kòd PIN sa a" : "Modifier le Code PIN"}
                          >
                            <Key size={13} />
                            <span>PIN</span>
                          </button>
                        )}
                        {a.role !== 'admin' && (!isModerator || a.supervisorId === currentUser?.id || a.teamName === currentUser?.teamName) && (
                          <button 
                            className={`btn-toggle-status ${a.enabled ? 'deactivate' : 'activate'}`}
                            onClick={() => handleToggleAgent(a.id)}
                            title={t.toggleStatus || "Chanje Eta"}
                          >
                            <Power size={14} />
                            <span>{a.enabled ? (lang === 'ht' ? 'Bloke' : 'Désactiver') : (lang === 'ht' ? 'Debloke' : 'Activer')}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Real-time Draw Controls & Overrides (Admin only) */}
        {!isModerator && (
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
        )}
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

      {/* Infrastructure & Cloud Storage Status (Admin Only) */}
      {!isModerator && (
        <div className="admin-infra-grid">
          {/* Neon PostgreSQL Card */}
          <div className="admin-infra-card">
            <div className="infra-card-header">
              <div className="infra-title-wrap">
                <Database size={20} className="infra-icon db" />
                <h4>Neon PostgreSQL Database</h4>
              </div>
              <span className={`infra-status-pill ${dbStatus?.connected ? 'green' : 'red'}`}>
                {dbStatus?.connected ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                <span>{dbStatus?.connected ? (dbStatus.database || "Connected") : "Offline"}</span>
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
              <span className={`infra-status-pill ${s3Status?.connected ? 'green' : 'red'}`}>
                {s3Status?.connected ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                <span>{s3Status?.connected ? "Connected" : (s3Status?.error || "Offline")}</span>
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
      )}

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
                <th>{t.sellerLabel || "Vandè / Ajan"}</th>
                <th>{t.draw || "Tiraj"}</th>
                <th>{t.hour || "Lè"}</th>
                <th>{t.terminalId || "Tèminal"}</th>
                <th>{t.playsCount || "Jwèt"}</th>
                <th>{t.totalTicket || "Montan"}</th>
                <th>{t.status || "Eta"}</th>
                <th>{lang === 'ht' ? "Aksyon" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.slice(0, 20).map(ticket => (
                <tr key={ticket.id}>
                  <td>
                    <span className="ticket-id-bold mono">{ticket.id}</span>
                    <span className="sec-code-sub">{ticket.securityCode}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#60a5fa' }}>
                        👤 {ticket.sellerName || ticket.sellerId || "Agent POS"}
                      </strong>
                      <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>
                        @{ticket.sellerId || 'agent'} • {ticket.branchName || 'Sikisal'}
                      </span>
                    </div>
                  </td>
                  <td>{lang === 'ht' ? ticket.drawNameHt : ticket.drawNameFr}</td>
                  <td>{ticket.drawTime || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}</td>
                  <td>
                    <span className="badge-pos-id">{ticket.posId || 'POS-01'}</span>
                  </td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', fontWeight: 600 }}>
                      {ticket.plays?.length || 0} {lang === 'ht' ? 'pari' : 'paris'}
                    </span>
                  </td>
                  <td>
                    <strong>{currencySymbol} {ticket.totalAmount?.toFixed(2)}</strong>
                  </td>
                  <td>
                    <span className={`status-pill ${ticket.status}`}>
                      {ticket.status === 'won' ? '🎉 GAYAN' : 
                       ticket.status === 'paid' ? '✅ PEYE' : 
                       ticket.status === 'cancelled' ? '❌ ANILE' : 
                       ticket.status === 'lost' ? 'PÈDI' : 'VALAB'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={() => setSelectedTicketModal(ticket)}
                        title={lang === 'ht' ? "Wè detay tout paryaj yo ak vandè a" : "Voir le détail des paris et du vendeur"}
                        style={{
                          padding: '4px 8px',
                          background: 'rgba(59, 130, 246, 0.15)',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          color: '#60a5fa',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        <Eye size={13} />
                        <span>{lang === 'ht' ? "Detay" : "Détails"}</span>
                      </button>

                      {onReprintTicket && (
                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={() => onReprintTicket(ticket)}
                          title={lang === 'ht' ? "Gade / Enprime resi a" : "Voir / Imprimer le reçu"}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(6, 182, 212, 0.15)',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            color: '#06b6d4',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          <Printer size={13} />
                          <span>{lang === 'ht' ? "Resi" : "Reçu"}</span>
                        </button>
                      )}
                      {(ticket.status === 'active' || ticket.status === 'pending') && onCancelTicket && (
                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={async () => {
                            await onCancelTicket(ticket.id);
                            fetchDashboardData();
                          }}
                          title={lang === 'ht' ? "Anile tikè sa a" : "Annuler ce billet"}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#ef4444',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          <Trash2 size={13} />
                          <span>{lang === 'ht' ? "Anile" : "Annuler"}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-4">
                    {lang === 'ht' ? "Pa gen tikè jwenn" : "Aucun billet trouvé"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Bet & Agent Inspection Modal */}
      {selectedTicketModal && (
        <div 
          className="ticket-inspect-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => setSelectedTicketModal(null)}
        >
          <div 
            className="ticket-inspect-modal-card"
            style={{
              background: 'var(--bg-card, #121826)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
              borderRadius: '16px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
              color: 'var(--text-primary, #f8fafc)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Eye size={20} color="#3b82f6" />
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                    {lang === 'ht' ? "Detay Konplè Tikè & Paryaj" : "Détails Complets du Billet & Paris"}
                  </h3>
                </div>
                <span className="mono" style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: 600 }}>
                  {selectedTicketModal.id} • Sec: {selectedTicketModal.securityCode}
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedTicketModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Agent / Cashier Attribution Box */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#60a5fa', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                  {lang === 'ht' ? "VANDÈ KI TE FÈ PARI A" : "AGENT AYANT ENREGISTRÉ LE BILLET"}
                </span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                  👤 {selectedTicketModal.sellerName || selectedTicketModal.sellerId || "Agent POS"}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '2px' }}>
                  Identifiant: <span className="mono">@{selectedTicketModal.sellerId}</span> • Tèminal: <span className="mono">{selectedTicketModal.posId}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', opacity: 0.7, display: 'block' }}>
                  {lang === 'ht' ? "Sikisal / Ekip:" : "Succursale / Équipe:"}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#facc15' }}>
                  🏷️ {selectedTicketModal.branchName || "Santral"}
                </span>
                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>
                  {new Date(selectedTicketModal.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Draw & Financial Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', opacity: 0.6, display: 'block' }}>{t.draw || "Tiraj"}</span>
                <strong style={{ fontSize: '0.95rem' }}>{lang === 'ht' ? selectedTicketModal.drawNameHt : selectedTicketModal.drawNameFr}</strong>
                <span style={{ fontSize: '0.72rem', opacity: 0.6, display: 'block' }}>{selectedTicketModal.drawDate}</span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', opacity: 0.6, display: 'block' }}>{t.status || "Eta"}</span>
                <span className={`status-pill ${selectedTicketModal.status}`} style={{ display: 'inline-block', marginTop: '4px' }}>
                  {selectedTicketModal.status === 'won' ? '🎉 GAYAN' : 
                   selectedTicketModal.status === 'paid' ? '✅ PEYE' : 
                   selectedTicketModal.status === 'cancelled' ? '❌ ANILE' : 
                   selectedTicketModal.status === 'lost' ? 'PÈDI' : 'VALAB'}
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', opacity: 0.6, display: 'block' }}>{t.totalTicket || "Total Mise"}</span>
                <strong style={{ fontSize: '1.1rem', color: '#4ade80' }}>
                  {currencySymbol} {selectedTicketModal.totalAmount?.toFixed(2)}
                </strong>
              </div>

              {selectedTicketModal.winnings?.totalWon > 0 && (
                <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                  <span style={{ fontSize: '0.72rem', color: '#facc15', display: 'block' }}>{t.totalWon || "Total Gayan"}</span>
                  <strong style={{ fontSize: '1.1rem', color: '#facc15' }}>
                    {currencySymbol} {selectedTicketModal.winnings.totalWon?.toFixed(2)}
                  </strong>
                </div>
              )}
            </div>

            {/* Detailed Plays Breakdown Table */}
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
                {lang === 'ht' ? "Detay Chak Pari ki nan Tikè Sa a" : "Détail de Chaque Pari"} ({selectedTicketModal.plays?.length || 0})
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '8px 12px' }}>#</th>
                      <th style={{ padding: '8px 12px' }}>{lang === 'ht' ? "Jwèt" : "Jeu"}</th>
                      <th style={{ padding: '8px 12px' }}>{lang === 'ht' ? "Nimewo Jwe" : "Numéros"}</th>
                      <th style={{ padding: '8px 12px' }}>{lang === 'ht' ? "Mise" : "Mise"}</th>
                      <th style={{ padding: '8px 12px' }}>{lang === 'ht' ? "Rezilta Pari" : "Résultat"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedTicketModal.plays || []).map((play, idx) => {
                      const gameLabel = play.gameType === 'bolette' ? 'Bòlèt' : 
                                        play.gameType === 'mariage' ? 'Maryaj' : 
                                        play.gameType === 'loto3' ? 'Loto 3' : 
                                        play.gameType === 'loto4' ? 'Loto 4' : play.gameType;
                      const numsFormatted = play.numbers ? play.numbers.join(' × ') : '-';
                      
                      // Check if this play won
                      const winningPlay = selectedTicketModal.winnings?.winningPlays?.find(wp => 
                        wp.gameType === play.gameType && 
                        JSON.stringify(wp.numbers) === JSON.stringify(play.numbers)
                      );

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: winningPlay ? 'rgba(234, 179, 8, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px', opacity: 0.6 }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{gameLabel}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, color: winningPlay ? '#facc15' : '#60a5fa' }}>
                              {numsFormatted}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                            {currencySymbol} {Number(play.amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {winningPlay ? (
                              <span style={{ color: '#facc15', fontWeight: 700 }}>
                                🎉 {winningPlay.lot ? `${winningPlay.lot}: ` : ''}+{currencySymbol} {winningPlay.wonAmount}
                              </span>
                            ) : selectedTicketModal.status === 'lost' ? (
                              <span style={{ opacity: 0.5 }}>❌ Pèdi</span>
                            ) : selectedTicketModal.status === 'cancelled' ? (
                              <span style={{ color: '#ef4444' }}>❌ Anile</span>
                            ) : (
                              <span style={{ opacity: 0.7 }}>⏳ Ap tann tiraj</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {onReprintTicket && (
                <button
                  type="button"
                  onClick={() => {
                    onReprintTicket(selectedTicketModal);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(6, 182, 212, 0.5)',
                    background: 'rgba(6, 182, 212, 0.2)',
                    color: '#06b6d4',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={16} />
                  <span>{lang === 'ht' ? "Enprime Resi" : "Imprimer Reçu"}</span>
                </button>
              )}

              {(selectedTicketModal.status === 'active' || selectedTicketModal.status === 'pending') && onCancelTicket && (
                <button
                  type="button"
                  onClick={async () => {
                    await onCancelTicket(selectedTicketModal.id);
                    setSelectedTicketModal(null);
                    fetchDashboardData();
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={16} />
                  <span>{lang === 'ht' ? "Anile Tikè Sa a" : "Annuler le Billet"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedTicketModal(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {lang === 'ht' ? "Fèmen" : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Agent & Moderator Profile & Exclusive Transactions */}
      {selectedUserModal && (() => {
        const userTickets = tickets.filter(t => 
          t.sellerId === selectedUserModal.username ||
          t.posId === selectedUserModal.posId ||
          (t.sellerName && t.sellerName === selectedUserModal.name)
        );

        const totalUserSales = userTickets
          .filter(t => t.status !== 'cancelled')
          .reduce((sum, t) => sum + (Number(t.totalCost) || 0), 0);

        const totalUserPayouts = userTickets
          .filter(t => t.status === 'won' || t.status === 'paid')
          .reduce((sum, t) => sum + (Number(t.winnings?.totalWon) || 0), 0);

        const netBalance = totalUserSales - totalUserPayouts;
        const totalTicketsCount = userTickets.length;
        const winningTicketsCount = userTickets.filter(t => t.status === 'won' || t.status === 'paid').length;

        const supervisedAgents = agents.filter(a => 
          a.supervisorId === selectedUserModal.id || 
          (a.role === 'agent' && a.teamName === selectedUserModal.teamName && a.id !== selectedUserModal.id)
        );

        const filteredUserTickets = userTickets.filter(t => {
          if (userTxFilter !== 'all') {
            if (userTxFilter === 'won') {
              if (t.status !== 'won' && t.status !== 'paid') return false;
            } else if (t.status !== userTxFilter) {
              return false;
            }
          }
          if (!userTxSearch) return true;
          const s = userTxSearch.toLowerCase();
          return (
            t.id.toLowerCase().includes(s) ||
            t.securityCode?.toLowerCase().includes(s) ||
            t.drawNameFr?.toLowerCase().includes(s) ||
            t.drawNameHt?.toLowerCase().includes(s) ||
            t.customerName?.toLowerCase().includes(s) ||
            t.customerPhone?.toLowerCase().includes(s)
          );
        });

        const copyPin = () => {
          if (selectedUserModal.pin) {
            navigator.clipboard.writeText(selectedUserModal.pin);
            setPinCopied(true);
            setTimeout(() => setPinCopied(false), 2000);
          }
        };

        return (
          <div 
            className="user-inspect-modal-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.82)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem'
            }}
            onClick={() => setSelectedUserModal(null)}
          >
            <div 
              className="user-inspect-modal-card"
              style={{
                background: 'var(--bg-card, #121826)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                borderRadius: '16px',
                maxWidth: '850px',
                width: '100%',
                maxHeight: '94vh',
                overflowY: 'auto',
                padding: '1.5rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                color: 'var(--text-primary, #f8fafc)'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                    background: selectedUserModal.role === 'admin' 
                      ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.3), rgba(234, 179, 8, 0.1))'
                      : selectedUserModal.role === 'moderator'
                      ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(168, 85, 247, 0.1))'
                      : 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.1))',
                    border: '1px solid rgba(255,255,255,0.15)'
                  }}>
                    {selectedUserModal.role === 'admin' ? '👑' : selectedUserModal.role === 'moderator' ? '🛡️' : (selectedUserModal.countryFlag || '👤')}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                        {selectedUserModal.name}
                      </h3>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: selectedUserModal.role === 'admin' ? 'rgba(234, 179, 8, 0.2)' : selectedUserModal.role === 'moderator' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: selectedUserModal.role === 'admin' ? '#facc15' : selectedUserModal.role === 'moderator' ? '#c084fc' : '#60a5fa',
                        border: '1px solid currentColor'
                      }}>
                        {selectedUserModal.role === 'admin' ? '👑 Admin Santral' : selectedUserModal.role === 'moderator' ? '🛡️ Moderatè / Lidè Ekip' : '👤 Vandè / Ajan POS'}
                      </span>
                      <span className={`status-pill ${selectedUserModal.enabled ? 'active' : 'disabled'}`} style={{ fontSize: '0.75rem' }}>
                        {selectedUserModal.enabled ? (lang === 'ht' ? 'Aktif' : 'Actif') : (lang === 'ht' ? 'Bloke' : 'Bloqué')}
                      </span>
                    </div>
                    <div style={{ opacity: 0.7, fontSize: '0.88rem', marginTop: '2px' }}>
                      @{selectedUserModal.username} • {selectedUserModal.countryLabel || 'Haiti'} • {selectedUserModal.branchName || 'Sikisal Prensipal'}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedUserModal(null)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Exclusive Profile Details Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="#60a5fa" />
                  <span>{lang === 'ht' ? "Enfòmasyon & Idantifyan Eksklizif" : "Informations & Identifiants Exclusifs"}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.88rem' }}>
                  {/* Secret PIN */}
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ opacity: 0.65, fontSize: '0.75rem', marginBottom: '3px' }}>
                      🔑 {lang === 'ht' ? "Kòd PIN / Modpas:" : "Code PIN / Mot de passe:"}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="mono" style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: userPinRevealed ? '2px' : '4px', color: '#facc15' }}>
                        {userPinRevealed ? (selectedUserModal.pin || 'Pa genyen') : '••••••'}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setUserPinRevealed(!userPinRevealed)}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}
                          title={userPinRevealed ? "Kache PIN" : "Montre PIN"}
                        >
                          {userPinRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button
                          type="button"
                          onClick={copyPin}
                          style={{ background: 'transparent', border: 'none', color: pinCopied ? '#22c55e' : '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}
                          title="Kopye PIN"
                        >
                          {pinCopied ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                        {!isModerator && (
                          <button
                            type="button"
                            onClick={() => {
                              setPinChangeTarget(selectedUserModal);
                              setNewPinInput('');
                              setPinErrorMsg('');
                              setPinSuccessMsg('');
                            }}
                            style={{
                              background: 'rgba(234, 179, 8, 0.15)',
                              border: '1px solid rgba(234, 179, 8, 0.4)',
                              borderRadius: '6px',
                              color: '#facc15',
                              cursor: 'pointer',
                              padding: '2px 7px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              marginLeft: '4px'
                            }}
                            title={lang === 'ht' ? "Chanje Kòd PIN sa a" : "Modifier ce Code PIN"}
                          >
                            <Key size={12} />
                            <span>{lang === 'ht' ? "Chanje" : "Modifier"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* POS Terminal ID */}
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ opacity: 0.65, fontSize: '0.75rem', marginBottom: '3px' }}>
                      📠 {lang === 'ht' ? "ID Tèminal POS:" : "ID Terminal POS:"}
                    </div>
                    <span className="mono" style={{ fontWeight: 700, color: '#60a5fa' }}>
                      {selectedUserModal.posId || 'N/A'}
                    </span>
                  </div>

                  {/* Team */}
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ opacity: 0.65, fontSize: '0.75rem', marginBottom: '3px' }}>
                      🏷️ {lang === 'ht' ? "Ekip Asiyen:" : "Équipe Assignée:"}
                    </div>
                    <span style={{ fontWeight: 600, color: '#facc15' }}>
                      {selectedUserModal.teamName || 'Ekip Prensipal'}
                    </span>
                  </div>

                  {/* Supervisor */}
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ opacity: 0.65, fontSize: '0.75rem', marginBottom: '3px' }}>
                      🛡️ {lang === 'ht' ? "Sipèvizè Responsab:" : "Superviseur:"}
                    </div>
                    <span style={{ fontWeight: 600 }}>
                      {selectedUserModal.supervisorName || (selectedUserModal.role === 'admin' ? '👑 Santral' : 'Pa asiyen')}
                    </span>
                  </div>

                  {/* Country & Timezone */}
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ opacity: 0.65, fontSize: '0.75rem', marginBottom: '3px' }}>
                      🌐 {lang === 'ht' ? "Peyi & Zòn Lè:" : "Pays & Fuseau:"}
                    </div>
                    <span style={{ fontWeight: 600 }}>
                      {selectedUserModal.countryFlag} {selectedUserModal.countryLabel || selectedUserModal.country} ({selectedUserModal.timezone || 'HT'})
                    </span>
                  </div>

                  {/* Last Login */}
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ opacity: 0.65, fontSize: '0.75rem', marginBottom: '3px' }}>
                      ⏰ {lang === 'ht' ? "Dènye Koneksyon:" : "Dernière Connexion:"}
                    </div>
                    <span style={{ fontSize: '0.82rem', opacity: 0.9 }}>
                      {selectedUserModal.lastLogin ? new Date(selectedUserModal.lastLogin).toLocaleString() : (lang === 'ht' ? 'Okenn koneksyon' : 'Aucune')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Performance KPI Boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, color: '#60a5fa', marginBottom: '4px' }}>
                    💰 {lang === 'ht' ? "Vant Total" : "Ventes Totales"}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#60a5fa' }}>
                    {currencySymbol} {totalUserSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: '2px' }}>
                    {totalTicketsCount} {lang === 'ht' ? "tikè emèt" : "billets émis"}
                  </div>
                </div>

                <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, color: '#facc15', marginBottom: '4px' }}>
                    🏆 {lang === 'ht' ? "Prim Gayan" : "Gains Payés"}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#facc15' }}>
                    {currencySymbol} {totalUserPayouts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: '2px' }}>
                    {winningTicketsCount} {lang === 'ht' ? "tikè gayan" : "billets gagnants"}
                  </div>
                </div>

                <div style={{ 
                  background: netBalance >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  border: `1px solid ${netBalance >= 0 ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`, 
                  borderRadius: '10px', 
                  padding: '12px' 
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, color: netBalance >= 0 ? '#4ade80' : '#f87171', marginBottom: '4px' }}>
                    📈 {lang === 'ht' ? "Balans Nèt" : "Bénéfice Net"}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: netBalance >= 0 ? '#4ade80' : '#f87171' }}>
                    {currencySymbol} {netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: '2px' }}>
                    {lang === 'ht' ? "Vant mwens prim" : "Ventes moins gains"}
                  </div>
                </div>

                <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, color: '#c084fc', marginBottom: '4px' }}>
                    ⚡ {lang === 'ht' ? "Vant Jodi a" : "Ventes Aujourd'hui"}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#c084fc' }}>
                    {currencySymbol} {(selectedUserModal.todaySales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: '2px' }}>
                    {lang === 'ht' ? "Sesyon aktif" : "Session active"}
                  </div>
                </div>
              </div>

              {/* Moderator Supervised Agents Roster */}
              {selectedUserModal.role === 'moderator' && (
                <div style={{
                  background: 'rgba(168, 85, 247, 0.05)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      👥 {lang === 'ht' ? `Ekip Sipèvize pa ${selectedUserModal.name}` : `Équipe Supervisée par ${selectedUserModal.name}`}
                      <span style={{ fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.2)', padding: '2px 8px', borderRadius: '10px' }}>
                        {supervisedAgents.length} {lang === 'ht' ? 'vandè' : 'vendeurs'}
                      </span>
                    </div>
                  </div>

                  {supervisedAgents.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', opacity: 0.6, padding: '8px 0' }}>
                      {lang === 'ht' ? "Pa gen okenn ajan ki anrejistre anba moderatè sa a ankò." : "Aucun agent assigné à ce modérateur pour l'instant."}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                      {supervisedAgents.map(subAgent => (
                        <div 
                          key={subAgent.id}
                          onClick={() => {
                            setSelectedUserModal(subAgent);
                            setUserPinRevealed(false);
                          }}
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'border-color 0.2s'
                          }}
                          title="Klike pou wè detay ajan sa a"
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                              {subAgent.countryFlag || '👤'} {subAgent.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', opacity: 0.6 }}>
                              @{subAgent.username} • {subAgent.posId}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa' }}>
                              {currencySymbol} {(subAgent.todaySales || 0).toLocaleString()}
                            </div>
                            <span style={{ fontSize: '0.68rem', color: subAgent.enabled ? '#22c55e' : '#ef4444' }}>
                              {subAgent.enabled ? 'Aktif' : 'Bloke'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Transactions Section */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} color="#60a5fa" />
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                      {lang === 'ht' ? `Istorik Tranzaksyon & Tikè (${filteredUserTickets.length})` : `Historique des Transactions (${filteredUserTickets.length})`}
                    </h4>
                  </div>

                  {/* Filter Pills */}
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {[
                      { id: 'all', label: lang === 'ht' ? 'Tout' : 'Tous' },
                      { id: 'active', label: lang === 'ht' ? 'Valab' : 'Actifs' },
                      { id: 'won', label: lang === 'ht' ? 'Gayan' : 'Gagnants' },
                      { id: 'cancelled', label: lang === 'ht' ? 'Anile' : 'Annulés' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setUserTxFilter(f.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: userTxFilter === f.id ? 'var(--primary, #3b82f6)' : 'transparent',
                          color: userTxFilter === f.id ? '#fff' : 'rgba(255,255,255,0.7)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Bar for transactions */}
                <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', opacity: 0.5 }} />
                  <input
                    type="text"
                    placeholder={lang === 'ht' ? "Chèche pa ID tikè, tiraj, kliyan..." : "Rechercher par ID billet, tirage, client..."}
                    value={userTxSearch}
                    onChange={e => setUserTxSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                {/* Transactions Table */}
                <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '8px 10px' }}>Tikè ID</th>
                        <th style={{ padding: '8px 10px' }}>Tiraj</th>
                        <th style={{ padding: '8px 10px' }}>Dat & Lè</th>
                        <th style={{ padding: '8px 10px' }}>Jwèt</th>
                        <th style={{ padding: '8px 10px' }}>Montan</th>
                        <th style={{ padding: '8px 10px' }}>Statut</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Aksyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUserTickets.map(ticket => {
                        const isWon = ticket.status === 'won' || ticket.status === 'paid';
                        const isCancelled = ticket.status === 'cancelled';
                        const wonAmt = ticket.winnings?.totalWon || 0;

                        return (
                          <tr key={ticket.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isWon ? 'rgba(234, 179, 8, 0.05)' : 'transparent' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <span className="mono" style={{ fontWeight: 700, color: '#60a5fa' }}>
                                #{ticket.id}
                              </span>
                              {ticket.securityCode && (
                                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                                  Kòd: {ticket.securityCode}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                              {lang === 'ht' ? ticket.drawNameHt : ticket.drawNameFr}
                            </td>
                            <td style={{ padding: '8px 10px', opacity: 0.7, fontSize: '0.75rem' }}>
                              {ticket.drawDate || ticket.createdAt?.slice(0, 10)}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                {ticket.plays?.length || 0} {lang === 'ht' ? "jwèt" : "jeux"}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                              {currencySymbol} {Number(ticket.totalCost).toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              {isWon ? (
                                <span style={{ color: '#facc15', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  🏆 +{currencySymbol} {wonAmt}
                                </span>
                              ) : isCancelled ? (
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                  ❌ Anile
                                </span>
                              ) : (
                                <span style={{ color: '#22c55e', fontWeight: 600 }}>
                                  ✓ Valab
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTicketModal(ticket)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    color: '#60a5fa',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '11px',
                                    fontWeight: 600
                                  }}
                                  title="Gade detay tout pari yo"
                                >
                                  <Eye size={12} />
                                  <span>{lang === 'ht' ? "Detay" : "Détails"}</span>
                                </button>
                                {onReprintTicket && (
                                  <button
                                    type="button"
                                    onClick={() => onReprintTicket(ticket)}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(6, 182, 212, 0.4)',
                                      background: 'rgba(6, 182, 212, 0.15)',
                                      color: '#06b6d4',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontSize: '11px',
                                      fontWeight: 600
                                    }}
                                    title="Enprime resi"
                                  >
                                    <Printer size={12} />
                                    <span>{lang === 'ht' ? "Resi" : "Reçu"}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUserTickets.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.6 }}>
                            {lang === 'ht' ? "Pa gen okenn tranzaksyon ki koresponn." : "Aucune transaction correspondante trouvée."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  type="button"
                  onClick={() => setSelectedUserModal(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {lang === 'ht' ? "Fèmen" : "Fermer"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Change PIN Modal */}
      {pinChangeTarget && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.84)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={() => { if (!pinUpdating) setPinChangeTarget(null); }}
        >
          <div 
            style={{
              background: 'var(--bg-card, #121826)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
              color: 'var(--text-primary, #f8fafc)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#facc15'
                }}>
                  <Key size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                    {lang === 'ht' ? "Chanje Kòd PIN" : "Modifier le Code PIN"}
                  </h3>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '2px' }}>
                    {pinChangeTarget.name} (@{pinChangeTarget.username})
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { if (!pinUpdating) setPinChangeTarget(null); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Target info card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem'
            }}>
              <div>
                <span style={{ opacity: 0.6, fontSize: '0.75rem', display: 'block' }}>
                  {lang === 'ht' ? "PIN Aktyèl la:" : "PIN Actuel:"}
                </span>
                <span className="mono" style={{ fontWeight: 700, color: '#facc15', fontSize: '1rem', letterSpacing: '2px' }}>
                  {pinChangeTarget.pin || '••••'}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: pinChangeTarget.role === 'admin' ? 'rgba(234, 179, 8, 0.2)' : pinChangeTarget.role === 'moderator' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  color: pinChangeTarget.role === 'admin' ? '#facc15' : pinChangeTarget.role === 'moderator' ? '#c084fc' : '#60a5fa'
                }}>
                  {pinChangeTarget.role === 'admin' ? '👑 Admin' : pinChangeTarget.role === 'moderator' ? '🛡️ Moderatè' : '👤 Ajan'}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdatePin}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', opacity: 0.9 }}>
                  {lang === 'ht' ? "Nouvo Kòd PIN (4 a 8 chif):" : "Nouveau Code PIN (4 à 8 chiffres):"}
                </label>
                <input
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="eg. 5090"
                  value={newPinInput}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setNewPinInput(val);
                    setPinErrorMsg('');
                  }}
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: pinErrorMsg ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '1.3rem',
                    letterSpacing: '4px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 700
                  }}
                />
              </div>

              {/* Error / Success messages */}
              {pinErrorMsg && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertTriangle size={15} />
                  <span>{pinErrorMsg}</span>
                </div>
              )}

              {pinSuccessMsg && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#4ade80',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <CheckCircle size={15} />
                  <span>{pinSuccessMsg}</span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={pinUpdating}
                  onClick={() => setPinChangeTarget(null)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {lang === 'ht' ? "Anile" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={pinUpdating || newPinInput.trim().length < 4}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    background: newPinInput.trim().length >= 4 ? 'linear-gradient(135deg, #eab308, #ca8a04)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#000',
                    fontWeight: 700,
                    cursor: newPinInput.trim().length >= 4 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {pinUpdating ? (
                    <span>{lang === 'ht' ? "Ap chanje..." : "Modification..."}</span>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{lang === 'ht' ? "Anrejistre PIN" : "Enregistrer PIN"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
