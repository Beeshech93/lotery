"use client";

import { useMemo, useState } from "react";

type Language = "fr" | "ht";

const copy = {
  fr: {
    title: "Lotery POS", subtitle: "Espace de démonstration", demo: "MODE DÉMO · SANS VALEUR",
    dashboard: "Tableau de bord", newReceipt: "Créer un reçu de test", history: "Historique de test", settings: "Paramètres",
    state: "Juridiction", terminal: "Terminal", language: "Langue", chooseState: "Choisir un État",
    ny: "New York", florida: "Floride", georgia: "Géorgie", create: "Générer un reçu de démonstration",
    recent: "Reçus de démonstration récents", noReceipts: "Aucun reçu de test pour le moment.",
    print: "Aperçu / imprimer", receipt: "REÇU DE TEST", disclaimer: "DÉMO UNIQUEMENT — SANS VALEUR MONÉTAIRE",
    legal: "Les mises et paiements réels sont désactivés. Vérifiez les licences et autorisations applicables avant toute activité réelle.",
    ready: "Prêt pour les tests d’interface", admin: "Administrateur", cashier: "Caissier", role: "Rôle",
  },
  ht: {
    title: "Lotery POS", subtitle: "Espas demonstrasyon", demo: "MÒD DEMO · SAN VALÈ",
    dashboard: "Tablo kontwòl", newReceipt: "Kreye yon resi tès", history: "Istwa tès yo", settings: "Paramèt",
    state: "Eta / jiridiksyon", terminal: "Tèminal", language: "Lang", chooseState: "Chwazi yon eta",
    ny: "New York", florida: "Florid", georgia: "Jòji", create: "Kreye yon resi demonstrasyon",
    recent: "Dènye resi demonstrasyon yo", noReceipts: "Pa gen resi tès pou kounye a.",
    print: "Gade / enprime", receipt: "RESI TÈS", disclaimer: "DEMO SÈLMAN — SAN VALÈ LAJAN",
    legal: "Peman ak paryaj reyèl dezaktive. Verifye lisans ak otorizasyon ki nesesè yo anvan nenpòt aktivite reyèl.",
    ready: "Pare pou teste koòdone a", admin: "Administratè", cashier: "Kesye", role: "Wòl",
  },
} as const;

type DemoReceipt = { id: string; state: string; createdAt: string };

export default function Home() {
  const [language, setLanguage] = useState<Language>("fr");
  const [state, setState] = useState("NY");
  const [receipts, setReceipts] = useState<DemoReceipt[]>([]);
  const [lastReceipt, setLastReceipt] = useState<DemoReceipt | null>(null);
  const t = useMemo(() => copy[language], [language]);

  function createReceipt() {
    const receipt: DemoReceipt = {
      id: `DEMO-${Date.now().toString().slice(-8)}`,
      state,
      createdAt: new Date().toLocaleString(language === "fr" ? "fr-FR" : "ht-HT"),
    };
    setReceipts((previous) => [receipt, ...previous].slice(0, 10));
    setLastReceipt(receipt);
  }

  const stateLabel = state === "NY" ? t.ny : state === "FL" ? t.florida : t.georgia;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">L</span><span><strong>{t.title}</strong><small>Retail terminal</small></span></div>
        <div className="nav-item active">▦ <span>{t.dashboard}</span></div>
        <div className="nav-item">＋ <span>{t.newReceipt}</span></div>
        <div className="nav-item">◷ <span>{t.history}</span></div>
        <div className="nav-item">⚙ <span>{t.settings}</span></div>
        <div className="sidebar-foot"><span className="status-dot" /> {t.ready}</div>
      </aside>

      <section className="content">
        <header className="topbar"><div><p className="eyebrow">LOTTERY RETAIL · PROTOTYPE</p><h1>{t.dashboard}</h1></div>
          <div className="top-actions"><label className="language-control"><span>{t.language}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="fr">Français</option><option value="ht">Kreyòl ayisyen</option></select></label><span className="user-chip">● {t.admin}</span></div>
        </header>

        <div className="demo-banner"><span className="demo-icon">!</span><div><strong>{t.demo}</strong><p>{t.legal}</p></div></div>

        <div className="stats-grid"><article className="stat-card"><span>{t.terminal}</span><strong>POS-001</strong><small>Prototype · Android ready</small></article><article className="stat-card"><span>{t.state}</span><strong>{stateLabel}</strong><small>Configuration de test</small></article><article className="stat-card"><span>{t.history}</span><strong>{receipts.length}</strong><small>Reçus créés dans cette session</small></article></div>

        <div className="main-grid"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">WORKSPACE</p><h2>{t.newReceipt}</h2></div><span className="pill">TEST</span></div>
          <label className="field-label" htmlFor="jurisdiction">{t.state}</label><select id="jurisdiction" className="state-select" value={state} onChange={(event) => setState(event.target.value)}><option value="NY">{t.ny}</option><option value="FL">{t.florida}</option><option value="GA">{t.georgia}</option></select>
          <button className="primary-button" onClick={createReceipt}>{t.create} <span>→</span></button>
          {lastReceipt && <div className="receipt-preview"><div className="receipt-top"><strong>{t.receipt}</strong><span>{lastReceipt.id}</span></div><p>{stateLabel}</p><p>{lastReceipt.createdAt}</p><div className="receipt-warning">{t.disclaimer}</div><button className="secondary-button" onClick={() => window.print()}>{t.print}</button></div>}
        </section>

        <section className="panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>{t.recent}</h2></div><span className="count">{receipts.length}</span></div>
          {receipts.length === 0 ? <div className="empty-state"><div className="empty-icon">▤</div><p>{t.noReceipts}</p></div> : <div className="receipt-list">{receipts.map((receipt) => <div className="receipt-row" key={receipt.id}><div className="receipt-symbol">▤</div><div className="receipt-meta"><strong>{receipt.id}</strong><span>{receipt.state} · {receipt.createdAt}</span></div><span className="pill">DEMO</span></div>)}</div>}
        </section></div>
        <footer>Lotery POS · Prototype non autorisé pour des opérations réelles · © {new Date().getFullYear()}</footer>
      </section>
    </main>
  );
}
