import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, X, Check, Copy, Trash2, AlertTriangle } from 'lucide-react';
import { sounds } from '../soundEffects';

export default function ThermalReceipt({ ticket, config, lang, t, onClose, onCancelTicket }) {
  const [qrUrl, setQrUrl] = useState('');
  const [paperWidth, setPaperWidth] = useState('58mm'); // '58mm' or '80mm'
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="receipt-modal-backdrop" onClick={onClose}>
      <div 
        className="receipt-modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: paperWidth === '80mm' ? '460px' : '380px' }}
      >
        {/* Modal Top Actions */}
        <div className="receipt-modal-header no-print">
          <div className="paper-size-toggles">
            <button 
              className={`btn-pill ${paperWidth === '58mm' ? 'active' : ''}`}
              onClick={() => setPaperWidth('58mm')}
            >
              58mm (Pocket)
            </button>
            <button 
              className={`btn-pill ${paperWidth === '80mm' ? 'active' : ''}`}
              onClick={() => setPaperWidth('80mm')}
            >
              80mm (Desktop)
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
          {/* Header */}
          <div className="receipt-header">
            <h2 className="receipt-company">{config?.companyName || "LOTO509"}</h2>
            <p className="receipt-subtitle">{config?.companySubtitle || "Sistèm Tiraj Nasyonal & Entènasyonal"}</p>
            <p className="receipt-branch">{ticket.branchName || config?.branchName}</p>
            <p className="receipt-phone">{config?.phone}</p>
            <div className="receipt-divider-dashed"></div>
          </div>

          {ticket.status === 'cancelled' && (
            <div style={{
              background: '#fee2e2',
              color: '#dc2626',
              border: '2px dashed #ef4444',
              borderRadius: '6px',
              padding: '6px 10px',
              margin: '8px 0',
              textAlign: 'center',
              fontWeight: '900',
              fontSize: '11px',
              letterSpacing: '1px'
            }}>
              ❌ TIKÈ ANILE / BILLET ANNULÉ
            </div>
          )}

          {/* Draw & Ticket Meta */}
          <div className="receipt-meta">
            <div className="receipt-row bold-row">
              <span className="receipt-draw-tag">
                {lang === 'ht' ? ticket.drawNameHt : ticket.drawNameFr}
              </span>
              <span>{ticket.drawDate}</span>
            </div>
            <div className="receipt-row">
              <span>{t.ticketNumber}</span>
              <span className="mono-text">{ticket.id}</span>
            </div>
            <div className="receipt-row">
              <span>{t.securityCode}</span>
              <span className="mono-text bold-text">{ticket.securityCode}</span>
            </div>
            <div className="receipt-row">
              <span>{t.terminal} {ticket.sellerId}</span>
              <span>{formattedDate} {formattedTime}</span>
            </div>
            <div className="receipt-divider-dashed"></div>
          </div>

          {/* Plays Table */}
          <div className="receipt-plays">
            <div className="receipt-table-header">
              <span>{t.gameHeader}</span>
              <span className="text-center">{t.numberHeader}</span>
              <span className="text-right">{t.amountHeader}</span>
            </div>
            <div className="receipt-divider-solid"></div>

            {ticket.plays.map((play, idx) => {
              let gameLabel = "Bòlèt";
              let displayNum = play.numbers[0];
              if (play.gameType === 'mariage') {
                gameLabel = "Maryaj";
                displayNum = `${play.numbers[0]} x ${play.numbers[1]}`;
              } else if (play.gameType === 'loto3') {
                gameLabel = "Loto 3";
                displayNum = play.numbers[0];
              } else if (play.gameType === 'loto4') {
                gameLabel = "Loto 4";
                displayNum = play.numbers[0];
              }

              return (
                <div key={idx} className="receipt-play-row">
                  <span className="play-type">{gameLabel}</span>
                  <span className="play-number mono-text bold-text">{displayNum}</span>
                  <span className="play-amount mono-text text-right">{play.amount} {currencySymbol}</span>
                </div>
              );
            })}

            <div className="receipt-divider-solid"></div>
            
            {/* Total Row */}
            <div className="receipt-total-row">
              <span className="bold-text">TOTAL:</span>
              <span className="mono-text total-amount-text">
                {ticket.totalAmount} {currencySymbol}
              </span>
            </div>
            <div className="receipt-divider-dashed"></div>
          </div>

          {/* Barcode & QR Code Section */}
          <div className="receipt-codes">
            {qrUrl && (
              <div className="qr-container">
                <img src={qrUrl} alt="QR Code Ticket" className="thermal-qr-image" />
              </div>
            )}
            
            {/* Simulated Barcode Code-39 */}
            <div className="barcode-container">
              <div className="simulated-barcode">
                {Array.from(ticket.barcode).map((char, i) => (
                  <span key={i} className={`barcode-bar bar-${(parseInt(char) % 4) + 1}`}></span>
                ))}
              </div>
              <div className="barcode-digits mono-text">*{ticket.barcode}*</div>
            </div>
          </div>

          {/* Footer & Rules */}
          <div className="receipt-footer">
            <p className="rules-text">
              {lang === 'ht' ? (config?.disclaimerHt || t.disclaimer) : (config?.disclaimerFr || t.disclaimer)}
            </p>
            <p className="thank-you-text">*** {t.thankYou} ***</p>
            <p className="print-watermark">POWRD BY LOTO-POS • 58/80MM ESC/POS</p>
          </div>
        </div>

        {/* Modal Bottom Print Actions */}
        <div className="receipt-modal-actions no-print">
          <button 
            className="btn-print-action btn-primary"
            onClick={() => handlePrint(paperWidth)}
          >
            <Printer size={18} />
            <span>{t.validateAndPrint} ({paperWidth})</span>
          </button>

          <button 
            className="btn-copy-code"
            onClick={handleCopyCode}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? "Kopye!" : ticket.securityCode}</span>
          </button>

          {ticket.status !== 'cancelled' && ticket.status !== 'paid' && onCancelTicket && (
            <button 
              type="button"
              className="btn-print-action btn-cancel-receipt"
              onClick={async () => {
                await onCancelTicket(ticket.id);
                onClose();
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.16)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#ef4444',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55rem 0.95rem',
                borderRadius: '8px'
              }}
            >
              <Trash2 size={16} />
              <span>{lang === 'ht' ? "Anile Tikè Sa a" : "Annuler ce Billet"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
