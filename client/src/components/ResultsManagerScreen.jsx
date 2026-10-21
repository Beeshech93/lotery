import React, { useState, useEffect } from 'react';
import { Trophy, CheckCircle, Calendar, Hash, Send, RefreshCw, AlertCircle } from 'lucide-react';
import { sounds } from '../soundEffects';

export default function ResultsManagerScreen({ draws, lang, t, onResultPublished }) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDrawId, setSelectedDrawId] = useState(draws[0]?.id || 'ny_midday');
  const [drawDate, setDrawDate] = useState(today);
  const [lot1, setLot1] = useState('');
  const [lot2, setLot2] = useState('');
  const [lot3, setLot3] = useState('');
  const [pick3, setPick3] = useState('');
  const [pick4, setPick4] = useState('');

  const [resultsList, setResultsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch results history
  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/results');
      const data = await res.json();
      setResultsList(data);
    } catch (err) {
      console.error("Error fetching results", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  // When user types lot1, suggest Pick 3 default if empty
  const handleLot1Change = (val) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    setLot1(clean);
  };

  // Submit result
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!lot1 || !lot2 || !lot3) {
      setErrorMsg("Tanpri antre tout 3 lo yo (Premye, Dezyèm, Twazyèm lo)");
      sounds.error();
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        drawId: selectedDrawId,
        drawDate,
        lot1: lot1.padStart(2, '0'),
        lot2: lot2.padStart(2, '0'),
        lot3: lot3.padStart(2, '0'),
        pick3: pick3.trim() || undefined,
        pick4: pick4.trim() || undefined
      };

      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erè nan pibliye rezilta a");

      sounds.winner();
      setSuccessMsg(`Rezilta pibliye! ${data.winnersCount} tikè gayan idantifye (Total Pèyman: ${data.totalPayout} G)`);
      setLot1('');
      setLot2('');
      setLot3('');
      setPick3('');
      setPick4('');
      fetchResults();
      if (onResultPublished) onResultPublished();
    } catch (err) {
      sounds.error();
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="results-screen-grid">
      {/* FORM: Publish Result */}
      <div className="results-form-card">
        <div className="card-header-icon">
          <Trophy size={28} className="gold-icon" />
          <div>
            <h3>{t.enterResults}</h3>
            <p className="card-sub">{t.calculatingNotice}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="results-entry-form">
          <div className="form-row">
            <div className="form-group flex-1">
              <label>{t.drawSelect}</label>
              <select 
                className="pos-select"
                value={selectedDrawId}
                onChange={(e) => setSelectedDrawId(e.target.value)}
              >
                {draws.map(d => (
                  <option key={d.id} value={d.id}>
                    [{d.state}] {lang === 'ht' ? d.nameHt : d.nameFr}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label>{t.drawDate}</label>
              <input 
                type="date"
                className="pos-input"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
              />
            </div>
          </div>

          {/* 3 Main Lots */}
          <div className="lots-input-grid">
            <div className="lot-input-box lot-1">
              <label>{t.lot1} (00-99)</label>
              <input 
                type="text" 
                pattern="[0-9]*" 
                inputMode="numeric"
                className="pos-input-big mono-text" 
                placeholder="00" 
                maxLength={2}
                value={lot1}
                onChange={(e) => handleLot1Change(e.target.value)}
                required
              />
            </div>

            <div className="lot-input-box lot-2">
              <label>{t.lot2} (00-99)</label>
              <input 
                type="text" 
                pattern="[0-9]*" 
                inputMode="numeric"
                className="pos-input-big mono-text" 
                placeholder="00" 
                maxLength={2}
                value={lot2}
                onChange={(e) => setLot2(e.target.value.replace(/\D/g, '').slice(0, 2))}
                required
              />
            </div>

            <div className="lot-input-box lot-3">
              <label>{t.lot3} (00-99)</label>
              <input 
                type="text" 
                pattern="[0-9]*" 
                inputMode="numeric"
                className="pos-input-big mono-text" 
                placeholder="00" 
                maxLength={2}
                value={lot3}
                onChange={(e) => setLot3(e.target.value.replace(/\D/g, '').slice(0, 2))}
                required
              />
            </div>
          </div>

          {/* Optional Pick 3 & Pick 4 Exact Numbers */}
          <div className="form-row mt-3">
            <div className="form-group flex-1">
              <label>{t.pick3} (Ex: 428)</label>
              <input 
                type="text" 
                className="pos-input mono-text" 
                placeholder="428"
                maxLength={3}
                value={pick3}
                onChange={(e) => setPick3(e.target.value.replace(/\D/g, '').slice(0, 3))}
              />
            </div>

            <div className="form-group flex-1">
              <label>{t.pick4} (Ex: 9165)</label>
              <input 
                type="text" 
                className="pos-input mono-text" 
                placeholder="9165"
                maxLength={4}
                value={pick4}
                onChange={(e) => setPick4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="form-error-alert">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="form-success-alert">
              <CheckCircle size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="btn-publish-results"
            disabled={submitting}
          >
            <Send size={18} />
            <span>{submitting ? "..." : t.publishResults}</span>
          </button>
        </form>
      </div>

      {/* RIGHT: Results History List */}
      <div className="results-history-card">
        <div className="card-header-between">
          <h3>{t.resultsHistory}</h3>
          <button className="btn-refresh" onClick={fetchResults} title="Refresh">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>

        <div className="results-list-scroll">
          {resultsList.length === 0 ? (
            <p className="no-data-msg">{t.noResultsYet}</p>
          ) : (
            resultsList.map(item => {
              const drawObj = draws.find(d => d.id === item.drawId);
              const drawName = lang === 'ht' ? drawObj?.nameHt : drawObj?.nameFr;
              return (
                <div key={item.id} className="result-item-card">
                  <div className="result-item-header">
                    <span className="result-draw-name">{drawName || item.drawId}</span>
                    <span className="result-draw-date mono-text">{item.drawDate}</span>
                  </div>

                  <div className="result-lots-display">
                    <div className="ball-lot lot-premye">
                      <span className="ball-title">1ER</span>
                      <span className="ball-number mono-text">{item.lot1}</span>
                    </div>
                    <div className="ball-lot lot-dezyem">
                      <span className="ball-title">2E</span>
                      <span className="ball-number mono-text">{item.lot2}</span>
                    </div>
                    <div className="ball-lot lot-twazyem">
                      <span className="ball-title">3E</span>
                      <span className="ball-number mono-text">{item.lot3}</span>
                    </div>
                  </div>

                  {(item.pick3 || item.pick4) && (
                    <div className="result-picks-meta mono-text">
                      {item.pick3 && <span>Pick 3: <strong>{item.pick3}</strong></span>}
                      {item.pick4 && <span>Pick 4: <strong>{item.pick4}</strong></span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
