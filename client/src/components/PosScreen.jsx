import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Printer, RotateCcw, Clock, 
  CheckCircle2, AlertCircle, Sparkles, DollarSign,
  ChevronRight, Delete, X, Ban, Lock
} from 'lucide-react';
import { sounds } from '../soundEffects';

export default function PosScreen({ 
  draws, 
  config, 
  lang, 
  t, 
  currentUser,
  recentTickets, 
  onTicketCreated, 
  onCancelTicket, 
  onReprintTicket 
}) {
  // Selected lottery draw
  const [selectedDrawId, setSelectedDrawId] = useState(draws[0]?.id || 'ny_midday');
  
  // Game mode: 'bolette', 'mariage', 'loto3', 'loto4'
  const [gameMode, setGameMode] = useState('bolette');

  // Input fields
  const urlQuery = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const [num1, setNum1] = useState(() => urlQuery.get('num') || '');
  const [num2, setNum2] = useState(() => urlQuery.get('num2') || ''); // used in mariage
  const [amount, setAmount] = useState('25');
  const [activeInput, setActiveInput] = useState('num1'); // 'num1', 'num2', 'amount'

  // Cart plays
  const [cartPlays, setCartPlays] = useState([]);
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // References
  const num1Ref = useRef(null);
  const num2Ref = useRef(null);
  const amountRef = useRef(null);

  // Fetch active blocked numbers
  const fetchBlocked = async () => {
    try {
      const res = await fetch('/api/blocked-numbers');
      if (res.ok) setBlockedNumbers(await res.json());
    } catch (e) {}
  };

  useEffect(() => {
    fetchBlocked();
    const interval = setInterval(fetchBlocked, 12000);
    return () => clearInterval(interval);
  }, []);

  // Keep selected draw valid
  useEffect(() => {
    if (draws.length > 0 && !draws.find(d => d.id === selectedDrawId)) {
      setSelectedDrawId(draws[0].id);
    }
  }, [draws, selectedDrawId]);

  const currentDraw = draws.find(d => d.id === selectedDrawId) || draws[0];
  const currencySymbol = config?.currencySymbol || (config?.currency === 'HTG' ? 'G' : config?.currency === 'MXN' ? 'MX$' : '$');

  // Keyboard shortcut listener (Enter, F2, F4, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleValidateTicket();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClearCart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartPlays, selectedDrawId]);

  // Helper to check if a specific number is blocked or restricted for the selected draw
  const getBlockedRule = (gMode, n1, n2, drawId) => {
    if (!blockedNumbers || blockedNumbers.length === 0) return null;
    let clean = '';
    if (gMode === 'bolette') clean = String(n1 || '').trim().padStart(2, '0');
    else if (gMode === 'mariage') {
      const c1 = String(n1 || '').trim().padStart(2, '0');
      const c2 = String(n2 || '').trim().padStart(2, '0');
      clean = `${c1}x${c2}`;
    } else if (gMode === 'loto3') clean = String(n1 || '').trim().padStart(3, '0');
    else if (gMode === 'loto4') clean = String(n1 || '').trim().padStart(4, '0');

    for (const b of blockedNumbers) {
      const drawMatches = b.drawId === 'all' || b.drawId === drawId;
      const gameMatches = b.gameType === 'all' || b.gameType === gMode;
      if (!drawMatches || !gameMatches) continue;

      if (gMode === 'mariage') {
        const c1 = String(n1 || '').trim().padStart(2, '0');
        const c2 = String(n2 || '').trim().padStart(2, '0');
        const m1 = `${c1}x${c2}`;
        const m2 = `${c2}x${c1}`;
        if (b.number === m1 || b.number === m2 || b.number === c1 || b.number === c2) {
          return { ...b, matchedNumber: b.number };
        }
      } else {
        if (b.number === clean) {
          return { ...b, matchedNumber: clean };
        }
      }
    }
    return null;
  };

  // Live blocked info as cashier is typing
  const activeBlockedInfo = (() => {
    const isNum1Ready = 
      (gameMode === 'bolette' && num1.length === 2) ||
      (gameMode === 'loto3' && num1.length === 3) ||
      (gameMode === 'loto4' && num1.length === 4) ||
      (gameMode === 'mariage' && num1.length === 2);
    
    if (!isNum1Ready) return null;

    if (gameMode === 'mariage') {
      if (num2.length === 2) {
        return getBlockedRule('mariage', num1, num2, selectedDrawId);
      } else {
        const c1 = num1.trim().padStart(2, '0');
        const singleRule = blockedNumbers.find(b => 
          (b.drawId === 'all' || b.drawId === selectedDrawId) && 
          (b.gameType === 'all' || b.gameType === 'bolette') && 
          b.number === c1
        );
        if (singleRule) return { ...singleRule, matchedNumber: c1 };
        return null;
      }
    } else {
      return getBlockedRule(gameMode, num1, '', selectedDrawId);
    }
  })();

  // Handle adding a play
  const handleAddPlay = (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!currentDraw?.isOpen) {
      setErrorMsg(t.drawIsClosed);
      sounds.error();
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg(t.enterValidAmount);
      sounds.error();
      return;
    }

    // Format & validate numbers
    if (gameMode === 'bolette') {
      const cleanNum = num1.trim().padStart(2, '0');
      if (!/^\d{2}$/.test(cleanNum)) {
        setErrorMsg(t.enterValidNumber);
        sounds.error();
        return;
      }

      // Check if blocked
      const blockedRule = getBlockedRule('bolette', cleanNum, '', selectedDrawId);
      if (blockedRule) {
        if (blockedRule.amount === 0) {
          setErrorMsg(`${t.numberIsBlockedAlert} [${cleanNum}] — ${blockedRule.reason || (lang === 'ht' ? 'Bloke pa Bank lan' : 'Bloqué par la Banque')}`);
          sounds.error();
          return;
        } else if (blockedRule.amount > 0 && amt > blockedRule.amount) {
          setErrorMsg(`${t.numberLimitExceededAlert} [${cleanNum}] — Maks: ${blockedRule.amount} ${currencySymbol}`);
          sounds.error();
          return;
        }
      }

      setCartPlays(prev => [...prev, { gameType: 'bolette', numbers: [cleanNum], amount: amt }]);
      sounds.add();
      setNum1('');
      num1Ref.current?.focus();
    } else if (gameMode === 'mariage') {
      const clean1 = num1.trim().padStart(2, '0');
      const clean2 = num2.trim().padStart(2, '0');
      if (!/^\d{2}$/.test(clean1) || !/^\d{2}$/.test(clean2)) {
        setErrorMsg(t.enterValidNumber);
        sounds.error();
        return;
      }

      // Check if blocked
      const blockedRule = getBlockedRule('mariage', clean1, clean2, selectedDrawId);
      if (blockedRule) {
        if (blockedRule.amount === 0) {
          setErrorMsg(`${t.numberIsBlockedAlert} [${clean1}x${clean2}] — ${blockedRule.reason || (lang === 'ht' ? 'Bloke pa Bank lan' : 'Bloqué par la Banque')}`);
          sounds.error();
          return;
        } else if (blockedRule.amount > 0 && amt > blockedRule.amount) {
          setErrorMsg(`${t.numberLimitExceededAlert} [${clean1}x${clean2}] — Maks: ${blockedRule.amount} ${currencySymbol}`);
          sounds.error();
          return;
        }
      }

      setCartPlays(prev => [...prev, { gameType: 'mariage', numbers: [clean1, clean2], amount: amt }]);
      sounds.add();
      setNum1('');
      setNum2('');
      setActiveInput('num1');
      num1Ref.current?.focus();
    } else if (gameMode === 'loto3') {
      const clean = num1.trim().padStart(3, '0');
      if (!/^\d{3}$/.test(clean)) {
        setErrorMsg(t.enterValidNumber);
        sounds.error();
        return;
      }

      const blockedRule = getBlockedRule('loto3', clean, '', selectedDrawId);
      if (blockedRule) {
        if (blockedRule.amount === 0) {
          setErrorMsg(`${t.numberIsBlockedAlert} [${clean}] — ${blockedRule.reason || (lang === 'ht' ? 'Bloke pa Bank lan' : 'Bloqué par la Banque')}`);
          sounds.error();
          return;
        } else if (blockedRule.amount > 0 && amt > blockedRule.amount) {
          setErrorMsg(`${t.numberLimitExceededAlert} [${clean}] — Maks: ${blockedRule.amount} ${currencySymbol}`);
          sounds.error();
          return;
        }
      }

      setCartPlays(prev => [...prev, { gameType: 'loto3', numbers: [clean], amount: amt }]);
      sounds.add();
      setNum1('');
      num1Ref.current?.focus();
    } else if (gameMode === 'loto4') {
      const clean = num1.trim().padStart(4, '0');
      if (!/^\d{4}$/.test(clean)) {
        setErrorMsg(t.enterValidNumber);
        sounds.error();
        return;
      }

      const blockedRule = getBlockedRule('loto4', clean, '', selectedDrawId);
      if (blockedRule) {
        if (blockedRule.amount === 0) {
          setErrorMsg(`${t.numberIsBlockedAlert} [${clean}] — ${blockedRule.reason || (lang === 'ht' ? 'Bloke pa Bank lan' : 'Bloqué par la Banque')}`);
          sounds.error();
          return;
        } else if (blockedRule.amount > 0 && amt > blockedRule.amount) {
          setErrorMsg(`${t.numberLimitExceededAlert} [${clean}] — Maks: ${blockedRule.amount} ${currencySymbol}`);
          sounds.error();
          return;
        }
      }

      setCartPlays(prev => [...prev, { gameType: 'loto4', numbers: [clean], amount: amt }]);
      sounds.add();
      setNum1('');
      num1Ref.current?.focus();
    }
  };

  // Remove a single play from cart
  const handleRemovePlay = (idx) => {
    sounds.tap();
    setCartPlays(prev => prev.filter((_, i) => i !== idx));
  };

  // Clear cart
  const handleClearCart = () => {
    sounds.tap();
    setCartPlays([]);
    setErrorMsg('');
    setNum1('');
    setNum2('');
  };

  // Repeat last ticket's plays
  const handleRepeatLast = () => {
    if (recentTickets && recentTickets.length > 0) {
      const last = recentTickets[0];
      setCartPlays(last.plays.map(p => ({ ...p })));
      sounds.add();
    }
  };

  // Submit and create ticket
  const handleValidateTicket = async () => {
    if (cartPlays.length === 0) {
      setErrorMsg(t.emptyCart);
      sounds.error();
      return;
    }
    if (!currentDraw?.isOpen) {
      setErrorMsg(t.drawIsClosed);
      sounds.error();
      return;
    }

    // Check if any cart item is blocked
    for (const play of cartPlays) {
      const bRule = getBlockedRule(play.gameType, play.numbers[0] || '', play.numbers[1] || '', selectedDrawId);
      if (bRule && bRule.amount === 0) {
        setErrorMsg(`${t.numberIsBlockedAlert} [${bRule.matchedNumber}] — Retire l nan panye a.`);
        sounds.error();
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        drawId: selectedDrawId,
        drawDate: new Date().toISOString().split('T')[0],
        sellerId: currentUser?.username || config?.posId || "POS-01",
        sellerName: currentUser?.name || "Agent POS",
        posId: currentUser?.posId || config?.posId || "POS-01",
        plays: cartPlays
      };

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erè nan kreye tikè a");
      }

      sounds.success();
      setCartPlays([]);
      setNum1('');
      setNum2('');
      onTicketCreated(data);
    } catch (err) {
      sounds.error();
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Touch on-screen keypad handler
  const handleKeypadPress = (val) => {
    sounds.tap();
    if (val === 'DEL') {
      if (activeInput === 'num1') setNum1(prev => prev.slice(0, -1));
      else if (activeInput === 'num2') setNum2(prev => prev.slice(0, -1));
      else if (activeInput === 'amount') setAmount(prev => prev.slice(0, -1) || '0');
    } else if (val === 'CLR') {
      if (activeInput === 'num1') setNum1('');
      else if (activeInput === 'num2') setNum2('');
      else if (activeInput === 'amount') setAmount('0');
    } else if (val === 'NEXT') {
      if (gameMode === 'mariage' && activeInput === 'num1') {
        setActiveInput('num2');
        num2Ref.current?.focus();
      } else if (activeInput !== 'amount') {
        setActiveInput('amount');
        amountRef.current?.focus();
      } else {
        handleAddPlay();
      }
    } else {
      // Append number
      if (activeInput === 'num1') {
        const maxLen = gameMode === 'loto4' ? 4 : gameMode === 'loto3' ? 3 : 2;
        if (num1.length < maxLen) {
          const next = num1 + val;
          setNum1(next);
          // Auto advance if full
          if (next.length === maxLen) {
            if (gameMode === 'mariage') {
              setActiveInput('num2');
              num2Ref.current?.focus();
            } else {
              setActiveInput('amount');
              amountRef.current?.focus();
            }
          }
        }
      } else if (activeInput === 'num2') {
        if (num2.length < 2) {
          const next = num2 + val;
          setNum2(next);
          if (next.length === 2) {
            setActiveInput('amount');
            amountRef.current?.focus();
          }
        }
      } else if (activeInput === 'amount') {
        if (amount === '0') setAmount(val);
        else setAmount(prev => (prev + val).slice(0, 6));
      }
    }
  };

  const cartTotal = cartPlays.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="pos-screen-grid">
      {/* LEFT COLUMN: Draw Selector & Keypad / Plays Entry */}
      <div className="pos-input-section">
        {/* Draw Badges / Selector Cards */}
        <div className="lottery-draws-container">
          <div className="section-label">
            <span>{t.selectDraw} (NY • FL • GA)</span>
            <span className="live-clock mono-text">
              <Clock size={14} /> {currentDraw?.currentTimeStr || "LIVE"}
            </span>
          </div>

          <div className="draw-cards-grid">
            {draws.map(draw => {
              const isSelected = draw.id === selectedDrawId;
              const stateColor = draw.state === 'NY' ? 'state-ny' : draw.state === 'FL' ? 'state-fl' : 'state-ga';
              return (
                <div 
                  key={draw.id}
                  className={`draw-card ${stateColor} ${isSelected ? 'selected' : ''} ${!draw.isOpen ? 'closed' : ''}`}
                  onClick={() => {
                    sounds.tap();
                    setSelectedDrawId(draw.id);
                  }}
                >
                  <div className="draw-card-top">
                    <span className="draw-state-badge">{draw.state}</span>
                    <span className={`draw-status-pill ${draw.isOpen ? 'status-open' : 'status-closed'}`}>
                      {draw.isOpen ? t.drawOpen : t.drawClosed}
                    </span>
                  </div>
                  <div className="draw-name">
                    {lang === 'ht' ? draw.nameHt : draw.nameFr}
                  </div>
                  <div className="draw-time-info">
                    <span>{t.closesAt}: {draw.localCutoffTime || draw.cutoffTime}</span>
                    {draw.agentTzLabel && draw.originalCutoffTime !== draw.localCutoffTime && (
                      <span className="draw-tz-original" style={{fontSize:'0.7em',opacity:0.6,display:'block',marginTop:'2px'}}>
                        🇺🇸 {draw.originalCutoffTime} (NY)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Mode Tabs */}
        <div className="game-modes-nav">
          {[
            { id: 'bolette', label: t.gameBolette, key: '1' },
            { id: 'mariage', label: t.gameMariage, key: '2' },
            { id: 'loto3', label: t.gameLoto3, key: '3' },
            { id: 'loto4', label: t.gameLoto4, key: '4' }
          ].map(m => (
            <button
              key={m.id}
              className={`game-mode-tab ${gameMode === m.id ? 'active' : ''}`}
              onClick={() => {
                sounds.tap();
                setGameMode(m.id);
                setNum1('');
                setNum2('');
                setActiveInput('num1');
                num1Ref.current?.focus();
              }}
            >
              <span className="shortcut-num">{m.key}</span>
              <span className="tab-title">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleAddPlay} className="pos-play-form">
          {/* Real-time Blocked Number Warning Banner */}
          {activeBlockedInfo && (
            <div className={`pos-blocked-alert-banner ${activeBlockedInfo.amount === 0 ? 'banner-blocked' : 'banner-limit'}`}>
              <div className="blocked-alert-icon">
                <Ban size={20} />
              </div>
              <div className="blocked-alert-content">
                <div className="blocked-alert-title">
                  {activeBlockedInfo.amount === 0 ? t.numberIsBlockedAlert : t.numberLimitExceededAlert}
                </div>
                <div className="blocked-alert-desc">
                  {lang === 'ht' ? 'Nimewo' : 'Numéro'} <span className="highlight-num">[{activeBlockedInfo.matchedNumber}]</span>
                  {activeBlockedInfo.amount === 0 
                    ? ` — ${activeBlockedInfo.reason || (lang === 'ht' ? 'Bloke nèt pa Bank Santral la' : 'Bloqué par la Banque Centrale')}`
                    : ` — Plafon Maksimòm: ${activeBlockedInfo.amount} ${currencySymbol}`}
                </div>
              </div>
            </div>
          )}

          <div className="inputs-row">
            {/* Number 1 Input */}
            <div className="form-group flex-1">
              <label>{gameMode === 'mariage' ? t.number1 : t.number}</label>
              <input
                ref={num1Ref}
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                className={`pos-input mono-text ${activeInput === 'num1' ? 'focused-input' : ''}`}
                placeholder={gameMode === 'loto4' ? "0000" : gameMode === 'loto3' ? "000" : "00"}
                maxLength={gameMode === 'loto4' ? 4 : gameMode === 'loto3' ? 3 : 2}
                value={num1}
                onFocus={() => setActiveInput('num1')}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setNum1(val);
                  const max = gameMode === 'loto4' ? 4 : gameMode === 'loto3' ? 3 : 2;
                  if (val.length === max) {
                    if (gameMode === 'mariage') {
                      setActiveInput('num2');
                      num2Ref.current?.focus();
                    } else {
                      setActiveInput('amount');
                      amountRef.current?.focus();
                    }
                  }
                }}
                autoFocus
              />
            </div>

            {/* Number 2 Input (Mariage only) */}
            {gameMode === 'mariage' && (
              <div className="form-group flex-1">
                <label>{t.number2}</label>
                <input
                  ref={num2Ref}
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  className={`pos-input mono-text ${activeInput === 'num2' ? 'focused-input' : ''}`}
                  placeholder="00"
                  maxLength={2}
                  value={num2}
                  onFocus={() => setActiveInput('num2')}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNum2(val);
                    if (val.length === 2) {
                      setActiveInput('amount');
                      amountRef.current?.focus();
                    }
                  }}
                />
              </div>
            )}

            {/* Amount Input */}
            <div className="form-group flex-1">
              <label>{t.amount} ({currencySymbol})</label>
              <input
                ref={amountRef}
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                className={`pos-input mono-text ${activeInput === 'amount' ? 'focused-input' : ''}`}
                placeholder="25"
                value={amount}
                onFocus={() => setActiveInput('amount')}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            {/* Add Button */}
            <div className="form-group submit-btn-wrapper">
              <button type="submit" className="btn-add-play">
                <Plus size={20} />
                <span>{t.addPlay}</span>
              </button>
            </div>
          </div>

          {/* Quick Amounts Pills */}
          <div className="quick-amounts-bar">
            <span className="quick-label">{t.quickAmounts}:</span>
            {[5, 10, 25, 50, 100, 250, 500].map(val => (
              <button
                type="button"
                key={val}
                className={`btn-quick-amt ${amount === String(val) ? 'selected' : ''}`}
                onClick={() => {
                  sounds.tap();
                  setAmount(String(val));
                }}
              >
                +{val} {currencySymbol}
              </button>
            ))}
          </div>
        </form>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="pos-error-banner">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* On-screen Touch Keypad (Optimized for Sunmi / Pax POS & Touchscreens) */}
        <div className="pos-touch-keypad">
          <div className="keypad-grid">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'DEL'].map((key) => (
              <button
                key={key}
                type="button"
                className={`keypad-btn ${key === 'CLR' || key === 'DEL' ? 'keypad-action' : 'keypad-digit'}`}
                onClick={() => handleKeypadPress(key)}
              >
                {key === 'DEL' ? <Delete size={20} /> : key === 'CLR' ? 'C' : key}
              </button>
            ))}
          </div>
          <button 
            type="button" 
            className="keypad-enter-btn" 
            onClick={handleAddPlay}
          >
            <CheckCircle2 size={20} />
            <span>{t.addPlay} (ENTER)</span>
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Ticket Cart & Print Terminal Actions */}
      <div className="pos-cart-section">
        <div className="cart-card">
          {/* Cart Header */}
          <div className="cart-header">
            <div className="cart-title-info">
              <h3>{t.cartTitle}</h3>
              <span className="cart-draw-pill">
                {lang === 'ht' ? currentDraw?.nameHt : currentDraw?.nameFr}
              </span>
            </div>
            {cartPlays.length > 0 && (
              <button className="btn-clear-cart" onClick={handleClearCart} title={t.clearCart}>
                <Trash2 size={16} />
                <span>{t.clearCart}</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="cart-items-scroll">
            {cartPlays.length === 0 ? (
              <div className="empty-cart-state">
                <Sparkles size={40} className="empty-cart-icon" />
                <p>{t.emptyCart}</p>
                {recentTickets && recentTickets.length > 0 && (
                  <button className="btn-repeat-last" onClick={handleRepeatLast}>
                    <RotateCcw size={16} />
                    <span>{t.repeatLast}</span>
                  </button>
                )}
              </div>
            ) : (
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>{t.gameHeader}</th>
                    <th className="text-center">{t.numberHeader}</th>
                    <th className="text-right">{t.amountHeader}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cartPlays.map((play, idx) => (
                    <tr key={idx} className="cart-row">
                      <td className="play-badge">
                        {play.gameType === 'mariage' ? 'Maryaj' : play.gameType === 'loto3' ? 'Loto 3' : play.gameType === 'loto4' ? 'Loto 4' : 'Bòlèt'}
                      </td>
                      <td className="mono-text bold-text text-center play-num">
                        <div className="cart-num-container">
                          <span>{play.numbers.join(' x ')}</span>
                          {(() => {
                            const itemBlocked = getBlockedRule(play.gameType, play.numbers[0] || '', play.numbers[1] || '', selectedDrawId);
                            if (itemBlocked && itemBlocked.amount === 0) {
                              return (
                                <span className="cart-blocked-badge" title={itemBlocked.reason || "Nimewo sa a bloke"}>
                                  <Ban size={11} /> {t.unblock ? 'BLOKE' : 'BLOCKED'}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="mono-text bold-text text-right">
                        {play.amount} {currencySymbol}
                      </td>
                      <td className="text-right">
                        <button 
                          className="btn-remove-item"
                          onClick={() => handleRemovePlay(idx)}
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Cart Total & Action Buttons */}
          <div className="cart-footer">
            <div className="cart-summary-row">
              <span className="summary-plays-count">
                {cartPlays.length} {t.playsCount}
              </span>
              <div className="summary-total-wrapper">
                <span className="total-label">{t.totalTicket}</span>
                <span className="total-val mono-text">
                  {cartTotal} {currencySymbol}
                </span>
              </div>
            </div>

            <button
              className="btn-validate-print"
              disabled={cartPlays.length === 0 || isSubmitting || !currentDraw?.isOpen}
              onClick={handleValidateTicket}
            >
              <Printer size={22} />
              <span>{isSubmitting ? "..." : `${t.validateAndPrint} (F2)`}</span>
            </button>
          </div>
        </div>

        {/* Recent Tickets Quick Drawer / List */}
        <div className="recent-tickets-panel">
          <div className="recent-header">
            <h4>{t.recentTickets}</h4>
          </div>
          <div className="recent-list-scroll">
            {recentTickets?.length === 0 ? (
              <p className="no-recent-text">{t.noRecentTickets}</p>
            ) : (
              recentTickets?.slice(0, 5).map(ticket => (
                <div key={ticket.id} className={`recent-ticket-item status-${ticket.status}`}>
                  <div className="recent-item-meta">
                    <span className="recent-id mono-text">{ticket.id}</span>
                    <span className="recent-time">
                      {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="recent-item-info">
                    <span className="recent-draw">
                      {lang === 'ht' ? ticket.drawNameHt : ticket.drawNameFr}
                    </span>
                    <span className="recent-total mono-text">
                      {ticket.totalAmount} {currencySymbol}
                    </span>
                  </div>
                  <div className="recent-actions">
                    <button 
                      className="btn-recent-action btn-reprint" 
                      onClick={() => onReprintTicket(ticket)}
                      title={t.reprint}
                    >
                      <Printer size={14} />
                      <span>{t.reprint}</span>
                    </button>
                    {ticket.status === 'active' && (
                      <button 
                        className="btn-recent-action btn-cancel" 
                        onClick={() => onCancelTicket(ticket.id)}
                        title={t.cancelTicket}
                      >
                        <RotateCcw size={14} />
                        <span>{t.cancelTicket}</span>
                      </button>
                    )}
                    {ticket.status === 'cancelled' && (
                      <span className="badge-cancelled">{t.ticketCancelled}</span>
                    )}
                    {ticket.status === 'won' && (
                      <span className="badge-won">GAYAN!</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
