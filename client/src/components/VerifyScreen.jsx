import React, { useState } from 'react';
import { 
  Search, CheckCircle2, XCircle, Award, DollarSign, 
  Clock, ShieldCheck, Printer, AlertTriangle 
} from 'lucide-react';
import { sounds } from '../soundEffects';

export default function VerifyScreen({ config, lang, t, onReprintTicket }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const currencySymbol = config?.currencySymbol || (config?.currency === 'HTG' ? 'G' : config?.currency === 'MXN' ? 'MX$' : '$');

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setResult(null);
    setPayoutSuccess(false);

    try {
      const res = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Tikè pa jwenn");
      }

      setResult(data);
      if (data.isWinner && !data.isPaid) {
        sounds.winner();
      } else {
        sounds.tap();
      }
    } catch (err) {
      setErrorMsg(err.message);
      sounds.error();
    } finally {
      setLoading(false);
    }
  };

  const handlePayout = async () => {
    if (!result?.ticket?.id) return;
    if (!window.confirm(t.payoutConfirmation)) return;

    try {
      const res = await fetch(`/api/tickets/${result.ticket.id}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashierName: config?.posId || "Agent Caisse" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erè nan pèyman");

      sounds.success();
      setPayoutSuccess(true);
      setResult(prev => ({
        ...prev,
        isPaid: true,
        ticket: { ...prev.ticket, status: 'paid', paidAt: new Date().toISOString() }
      }));
    } catch (err) {
      setErrorMsg(err.message);
      sounds.error();
    }
  };

  return (
    <div className="verify-screen-container">
      {/* Search Bar & Barcode Scanner Simulator */}
      <div className="verify-card-header">
        <h2>{t.verifyTitle}</h2>
        <form onSubmit={handleSearch} className="verify-search-form">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={22} />
            <input 
              type="text" 
              className="verify-search-input mono-text"
              placeholder={t.enterBarcodeOrSec}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button type="button" className="btn-clear-search" onClick={() => setQuery('')}>
                ✕
              </button>
            )}
          </div>
          <button type="submit" className="btn-search-verify" disabled={loading || !query.trim()}>
            {loading ? "..." : t.verifyButton}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="verify-error-box">
          <XCircle size={22} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Verification Result Display */}
      {result && result.ticket && (
        <div className="verify-result-card">
          {/* Status Banner */}
          {result.isWinner && !result.isPaid && (
            <div className="status-banner banner-winner">
              <Award size={36} className="bounce-anim" />
              <div className="banner-text">
                <h3>{t.winnerBadge}</h3>
                <p>{t.totalWon} <strong className="big-amount mono-text">{result.winnings?.totalWon} {currencySymbol}</strong></p>
              </div>
            </div>
          )}

          {result.isPaid && (
            <div className="status-banner banner-paid">
              <CheckCircle2 size={32} />
              <div className="banner-text">
                <h3>{t.alreadyPaidBadge}</h3>
                <p>{t.totalWon} {result.winnings?.totalWon} {currencySymbol} • Peye a: {new Date(result.ticket.paidAt).toLocaleTimeString()}</p>
              </div>
            </div>
          )}

          {result.isCancelled && (
            <div className="status-banner banner-cancelled">
              <AlertTriangle size={32} />
              <div className="banner-text">
                <h3>{t.cancelledBadge}</h3>
                <p>Tikè sa a te anile nan dat: {new Date(result.ticket.cancelledAt).toLocaleString()}</p>
              </div>
            </div>
          )}

          {!result.isWinner && !result.isCancelled && (
            <div className="status-banner banner-lost">
              <Clock size={32} />
              <div className="banner-text">
                <h3>{t.loserBadge}</h3>
                <p>Mèsi paske w te patisipe. Bon chans pou pwochen tiraj la!</p>
              </div>
            </div>
          )}

          {/* Ticket Details Grid */}
          <div className="verify-ticket-details">
            <div className="details-header">
              <div>
                <span className="ticket-id-tag mono-text">{result.ticket.id}</span>
                <span className="ticket-draw-tag">
                  {lang === 'ht' ? result.ticket.drawNameHt : result.ticket.drawNameFr}
                </span>
              </div>
              <div className="details-actions">
                <button 
                  className="btn-pill" 
                  onClick={() => onReprintTicket(result.ticket)}
                >
                  <Printer size={16} />
                  <span>{t.reprint}</span>
                </button>
              </div>
            </div>

            <div className="meta-grid">
              <div>
                <span className="meta-label">{t.securityCode}:</span>
                <strong className="mono-text">{result.ticket.securityCode}</strong>
              </div>
              <div>
                <span className="meta-label">Barcode:</span>
                <strong className="mono-text">{result.ticket.barcode}</strong>
              </div>
              <div>
                <span className="meta-label">{t.date}:</span>
                <span>{result.ticket.drawDate}</span>
              </div>
              <div>
                <span className="meta-label">Mise Total:</span>
                <strong className="mono-text">{result.ticket.totalAmount} {currencySymbol}</strong>
              </div>
            </div>

            {/* If Winning Plays exist, list them */}
            {result.winnings?.winningPlays?.length > 0 && (
              <div className="winning-plays-box">
                <h4>{t.winningPlays}</h4>
                <div className="winning-plays-list">
                  {result.winnings.winningPlays.map((wp, i) => (
                    <div key={i} className="winning-play-row">
                      <span className="wp-type">{wp.gameType === 'mariage' ? 'Maryaj' : 'Bòlèt'}</span>
                      <span className="wp-num mono-text bold-text">{wp.numbers.join(' x ')}</span>
                      <span className="wp-lot badge-lot">{wp.lotWon}</span>
                      <span className="wp-mult mono-text">{wp.multiplier}x</span>
                      <span className="wp-payout mono-text bold-text text-green">
                        +{wp.payout} {currencySymbol}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payout Action Button */}
            {result.isWinner && !result.isPaid && (
              <div className="payout-action-container">
                <button 
                  className="btn-payout-large" 
                  onClick={handlePayout}
                >
                  <DollarSign size={24} />
                  <span>{t.payoutNow} ({result.winnings?.totalWon} {currencySymbol})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
