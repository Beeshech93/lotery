import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, X, Check, Copy, Trash2, Share2, ShieldCheck } from 'lucide-react';
import { sounds } from '../soundEffects';

export default function ThermalReceipt({ ticket, config, lang, t, onClose, onCancelTicket }) {
  const [qrUrl, setQrUrl] = useState('');
  const [paperWidth, setPaperWidth] = useState('58mm'); // '58mm' or '80mm'
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (ticket) {
      // Build QR verification payload
      const qrData = JSON.stringify({
        id: ticket.id,
        sec: ticket.securityCode,
        draw: ticket.drawId,
        date: ticket.drawDate,
        total: ticket.totalAmount
      });

      QRCode.toDataURL(qrData, {
        margin: 1,
        width: 140,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }).then(url => {
        setQrUrl(url);
      }).catch(err => {
        console.error("QR Error", err);
      });
    }
  }, [ticket]);

  if (!ticket) return null;

  const handlePrint = (width = '58mm') => {
    setPaperWidth(width);
    sounds.tap();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ticket.securityCode);
    setCopied(true);
    sounds.tap();
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const formattedTime = new Date(ticket.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const currencySymbol = config?.currencySymbol || (config?.currency === 'HTG' ? 'G' : config?.currency === 'MXN' ? 'MX$' : '$');
  const drawTitle = lang === 'ht' ? ticket.drawNameHt : ticket.drawNameFr;

  // Build text receipt for WhatsApp / Sharing
  const handleShareWhatsApp = () => {
    sounds.tap();
    const playsSummary = ticket.plays.map((p) => {
      let gName = p.gameType === 'mariage' ? 'Maryaj' : p.gameType === 'loto3' ? 'Loto 3' : p.gameType === 'loto4' ? 'Loto 4' : 'Bòlèt';
      let numStr = p.gameType === 'mariage' ? `${p.numbers[0]}×${p.numbers[1]}` : p.numbers[0];
      return `• ${gName}: *${numStr}* = ${p.amount} ${currencySymbol}`;
    }).join('\n');

    const msg = `🎟️ *${config?.companyName || 'LOTO509'} - TIKÈ OFISYÈL*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🎯 *Tiraj:* ${drawTitle}\n` +
      `📅 *Dat:* ${ticket.drawDate}\n` +
      `🔢 *Tikè ID:* \`${ticket.id}\`\n` +
      `🔑 *Kòd Sekirite:* \`${ticket.securityCode}\`\n` +
      `📍 *Sikisal:* ${ticket.branchName || config?.branchName}\n` +
      `📠 *Tèminal:* ${ticket.posId || 'POS-01'}\n` +
      `👤 *Vandè:* ${ticket.sellerName || ticket.sellerId}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📋 *JWÈT OU YO:*\n${playsSummary}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💰 *TOTAL APWÈSTE:* *${ticket.totalAmount} ${currencySymbol}*\n` +
      `⏰ *Lè:* ${formattedDate} ${formattedTime}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✨ *BON CHANS! MÈSI POU PATISIPASYON OU!*`;

    if (navigator.share) {
      navigator.share({
        title: `${config?.companyName || 'LOTO509'} - Tikè #${ticket.id}`,
        text: msg
      }).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }

    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <div className="receipt-modal-backdrop" onClick={onClose}>
      <div 
        className="receipt-modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: paperWidth === '80mm' ? '460px' : '390px' }}
      >
        {/* Modal Top Actions */}
        <div className="receipt-modal-header no-print">
          <div className="paper-size-toggles">
            <button 
              className={`btn-pill ${paperWidth === '58mm' ? 'active' : ''}`}
              onClick={() => setPaperWidth('58mm')}
            >
              58mm (Sunmi / Mobil)
            </button>
            <button 
              className={`btn-pill ${paperWidth === '80mm' ? 'active' : ''}`}
              onClick={() => setPaperWidth('80mm')}
            >
              80mm (Desktop / Epson)
            </button>
          </div>
          <button className="btn-close-modal" onClick={onClose} title={t.closePreview}>
            <X size={20} />
          </button>
        </div>

        {/* Printable Thermal Slip */}
        <div 
          id="printable-receipt" 
          className={`thermal-receipt-paper paper-${paperWidth}`}
        >
          {/* Top Sawtooth Tear Edge Effect */}
          <div className="receipt-tear-edge top"></div>

          {/* Header & Brand Emblem */}
          <div className="receipt-header">
            <div className="receipt-emblem-badge">
              <span className="receipt-emblem-star">★</span>
              <span className="receipt-emblem-text">509</span>
              <span className="receipt-emblem-star">★</span>
            </div>
            <h2 className="receipt-company">{config?.companyName || "LOTO509"}</h2>
            <p className="receipt-subtitle">{config?.companySubtitle || "SISTÈM TIRAJ NASYONAL & ENTÈNASYONAL"}</p>
            <div className="receipt-branch-box">
              <span className="receipt-branch-name">📍 {ticket.branchName || config?.branchName || "Santral Petyonvil"}</span>
              {config?.phone && <span className="receipt-branch-phone">📞 Tel: {config?.phone}</span>}
            </div>
            <div className="receipt-divider-double"></div>
          </div>

          {ticket.status === 'cancelled' && (
            <div className="receipt-cancelled-banner">
              ⚠️ TIKÈ ANILE / BILLET ANNULÉ ⚠️
            </div>
          )}

          {/* Draw Spotlight Card */}
          <div className="receipt-draw-spotlight">
            <div className="spotlight-title">★ {drawTitle?.toUpperCase()} ★</div>
            <div className="spotlight-date">
              <span>DAT: <strong>{ticket.drawDate}</strong></span>
              {ticket.drawTime && <span>LÈ: <strong>{ticket.drawTime}</strong></span>}
            </div>
          </div>

          {/* Ticket Metadata Table */}
          <div className="receipt-meta">
            <div className="receipt-meta-grid">
              <div className="meta-item">
                <span className="meta-label">TIKÈ #:</span>
                <span className="meta-value mono-text bold-text">{ticket.id}</span>
              </div>
              <div className="meta-item text-right">
                <span className="meta-label">KÒD KONTWÒL:</span>
                <span className="meta-value mono-text bold-text">{ticket.securityCode}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">TÈMINAL:</span>
                <span className="meta-value mono-text">{ticket.posId || "POS-01"}</span>
              </div>
              <div className="meta-item text-right">
                <span className="meta-label">VANDÈ:</span>
                <span className="meta-value">{ticket.sellerName || ticket.sellerId || "Caissier"}</span>
              </div>
            </div>
            <div className="receipt-timestamp-row">
              <span>EMISYON:</span>
              <span className="mono-text">{formattedDate} {formattedTime}</span>
            </div>
            <div className="receipt-divider-dashed"></div>
          </div>

          {/* Plays Table */}
          <div className="receipt-plays">
            <div className="receipt-table-header">
              <span className="col-game">JWÈT</span>
              <span className="col-num text-center">NIMEWO</span>
              <span className="col-amount text-right">MONTAN</span>
            </div>
            <div className="receipt-divider-solid"></div>

            <div className="receipt-plays-list">
              {ticket.plays.map((play, idx) => {
                let gameLabel = "BÒLÈT";
                let displayNum = `[ ${play.numbers[0]} ]`;
                if (play.gameType === 'mariage') {
                  gameLabel = "MARYAJ";
                  displayNum = `${play.numbers[0]} × ${play.numbers[1]}`;
                } else if (play.gameType === 'loto3') {
                  gameLabel = "LOTO 3";
                  displayNum = `${play.numbers[0]}`;
                } else if (play.gameType === 'loto4') {
                  gameLabel = "LOTO 4";
                  displayNum = play.numbers[1] ? `${play.numbers[0]} × ${play.numbers[1]}` : `${play.numbers[0]}`;
                }

                return (
                  <div key={idx} className="receipt-play-row">
                    <span className="play-type">{gameLabel}</span>
                    <span className="play-dots">. . . . . . . .</span>
                    <span className="play-number mono-text bold-text">{displayNum}</span>
                    <span className="play-amount mono-text text-right">
                      {Number(play.amount).toFixed(2)} {currencySymbol}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="receipt-divider-double"></div>
            
            {/* Total Highlight Box */}
            <div className="receipt-total-box">
              <div className="total-qty-row">
                <span>KANTITE JWÈT:</span>
                <span className="bold-text">{ticket.plays.length}</span>
              </div>
              <div className="total-amount-row">
                <span className="total-label">MONTAN TOTAL:</span>
                <span className="total-amount-val mono-text">
                  {Number(ticket.totalAmount).toFixed(2)} {currencySymbol}
                </span>
              </div>
            </div>
            <div className="receipt-divider-double"></div>
          </div>

          {/* Barcode & QR Code Section */}
          <div className="receipt-codes">
            {qrUrl && (
              <div className="qr-container">
                <img src={qrUrl} alt="QR Code Ticket" className="thermal-qr-image" />
                <span className="qr-hint">★ ESKANE POU KONTWÒL / VÉRIFICATION ★</span>
              </div>
            )}
            
            {/* Simulated Barcode */}
            <div className="barcode-container">
              <div className="simulated-barcode">
                {Array.from(ticket.barcode || '10293847').map((char, i) => (
                  <span key={i} className={`barcode-bar bar-${(parseInt(char) % 4) + 1}`}></span>
                ))}
              </div>
              <div className="barcode-digits mono-text">*{ticket.barcode || ticket.id}*</div>
            </div>
          </div>

          {/* Footer & Rules */}
          <div className="receipt-footer">
            <div className="security-guarantee">
              <ShieldCheck size={13} />
              <span>TIKÈ OTORIZE & ANREJISTRE NAN BAZ DONE</span>
            </div>
            <p className="rules-text">
              {lang === 'ht' 
                ? (config?.disclaimerHt || "Tikè sa a valab pandan 90 jou. Pa gen rati, pa gen chire pou touche prim ou.") 
                : (config?.disclaimerFr || "Ce billet est valide pendant 90 jours. Aucun paiement sans le billet original non raturé.")}
            </p>
            <p className="thank-you-text">★ MÈSI POU PATISIPASYON OU! BON CHANS! ★</p>
            <p className="print-watermark">LOTO509 POS ENTERPRISE • ESC/POS HIGH RESOLUTION THERMAL</p>
          </div>

          {/* Bottom Sawtooth Tear Edge Effect */}
          <div className="receipt-tear-edge bottom"></div>
        </div>

        {/* Modal Bottom Print Actions */}
        <div className="receipt-modal-actions no-print">
          <button 
            className="btn-print-action btn-primary"
            onClick={() => handlePrint(paperWidth)}
          >
            <Printer size={18} />
            <span>{t.validateAndPrint || "Enprime"} ({paperWidth})</span>
          </button>

          <button 
            className="btn-share-whatsapp"
            onClick={handleShareWhatsApp}
            title="Pataje tikè sa a sou WhatsApp"
          >
            <Share2 size={16} />
            <span>{shared ? "Pataje!" : "WhatsApp"}</span>
          </button>

          <button 
            className="btn-copy-code"
            onClick={handleCopyCode}
            title="Kopye Kòd Sekirite Tikè a"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? "Kopye!" : "Kòd"}</span>
          </button>

          {ticket.status !== 'cancelled' && ticket.status !== 'paid' && onCancelTicket && (
            <button 
              type="button"
              className="btn-cancel-receipt"
              onClick={async () => {
                await onCancelTicket(ticket.id);
                onClose();
              }}
              title="Anile tikè sa a si tiraj la poko kòmanse"
            >
              <Trash2 size={16} />
              <span>{lang === 'ht' ? "Anile" : "Annuler"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
