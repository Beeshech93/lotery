import React, { useState, useEffect } from 'react';
import { BarChart3, Printer, DollarSign, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { sounds } from '../soundEffects';

export default function DailyReportScreen({ config, lang, t }) {
  const today = new Date().toISOString().split('T')[0];
  const [reportDate, setReportDate] = useState(today);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const currencySymbol = config?.currencySymbol || (config?.currency === 'HTG' ? 'G' : config?.currency === 'MXN' ? 'MX$' : '$');

  const fetchReport = async (dateStr) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/daily?date=${dateStr}`);
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      console.error("Error fetching report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(reportDate);
  }, [reportDate]);

  const handlePrintReport = () => {
    sounds.tap();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="report-screen-container">
      {/* Top Filter Bar */}
      <div className="report-top-bar no-print">
        <div>
          <h2>{t.reportsTitle}</h2>
          <p className="subtext">{t.todaySummary}</p>
        </div>
        <div className="report-filter-controls">
          <input 
            type="date"
            className="pos-input"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />
          <button className="btn-refresh-report" onClick={() => fetchReport(reportDate)}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
          <button className="btn-print-report" onClick={handlePrintReport}>
            <Printer size={18} />
            <span>{t.printReport}</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="metrics-cards-grid">
        <div className="metric-card card-sales">
          <div className="metric-icon-box">
            <TrendingUp size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t.totalSales}</span>
            <h3 className="metric-value mono-text">
              {reportData?.totalSales || 0} {currencySymbol}
            </h3>
            <span className="metric-sub">{reportData?.activeTicketsCount || 0} {t.ticketsSold}</span>
          </div>
        </div>

        <div className="metric-card card-payouts">
          <div className="metric-icon-box">
            <DollarSign size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t.totalPayouts}</span>
            <h3 className="metric-value mono-text text-amber">
              {reportData?.totalWinningAmount || 0} {currencySymbol}
            </h3>
            <span className="metric-sub">{reportData?.winningTicketsCount || 0} {t.winningTickets}</span>
          </div>
        </div>

        <div className={`metric-card ${(reportData?.netBalance || 0) >= 0 ? 'card-profit' : 'card-loss'}`}>
          <div className="metric-icon-box">
            <CheckCircle size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t.netProfit}</span>
            <h3 className="metric-value mono-text">
              {reportData?.netBalance || 0} {currencySymbol}
            </h3>
            <span className="metric-sub">
              {(reportData?.netBalance || 0) >= 0 ? "Balanse Pozitif" : "Balanse Negatif"}
            </span>
          </div>
        </div>

        <div className="metric-card card-cancelled">
          <div className="metric-icon-box">
            <AlertTriangle size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t.ticketsCancelled}</span>
            <h3 className="metric-value mono-text text-muted">
              {reportData?.cancelledCount || 0}
            </h3>
            <span className="metric-sub">{reportData?.totalCancelled || 0} {currencySymbol}</span>
          </div>
        </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="breakdowns-grid">
        {/* Sales By Draw */}
        <div className="breakdown-card">
          <h4>{t.salesByDraw}</h4>
          <div className="breakdown-table-wrapper">
            <table className="breakdown-table">
              <thead>
                <tr>
                  <th>Tiraj / Tirage</th>
                  <th className="text-center">Tikè</th>
                  <th className="text-right">Montan ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {reportData?.salesByDraw && Object.keys(reportData.salesByDraw).length > 0 ? (
                  Object.entries(reportData.salesByDraw).map(([key, drawInfo]) => (
                    <tr key={key}>
                      <td className="bold-text">
                        {lang === 'ht' ? drawInfo.nameHt : drawInfo.nameFr}
                      </td>
                      <td className="text-center mono-text">{drawInfo.count}</td>
                      <td className="text-right mono-text bold-text">{drawInfo.total} {currencySymbol}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="no-data-cell">Pa gen vant anrejistre pou dat sa a</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales By Game Type */}
        <div className="breakdown-card">
          <h4>{t.salesByGame}</h4>
          <div className="breakdown-table-wrapper">
            <table className="breakdown-table">
              <thead>
                <tr>
                  <th>Jwèt / Type de Jeu</th>
                  <th className="text-right">Total ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t.gameBolette}</td>
                  <td className="text-right mono-text bold-text">
                    {reportData?.salesByGameType?.bolette || 0} {currencySymbol}
                  </td>
                </tr>
                <tr>
                  <td>{t.gameMariage}</td>
                  <td className="text-right mono-text bold-text">
                    {reportData?.salesByGameType?.mariage || 0} {currencySymbol}
                  </td>
                </tr>
                <tr>
                  <td>{t.gameLoto3}</td>
                  <td className="text-right mono-text bold-text">
                    {reportData?.salesByGameType?.loto3 || 0} {currencySymbol}
                  </td>
                </tr>
                <tr>
                  <td>{t.gameLoto4}</td>
                  <td className="text-right mono-text bold-text">
                    {reportData?.salesByGameType?.loto4 || 0} {currencySymbol}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Printable Thermal Cash Report Slip (Hidden on screen, shown in print) */}
      <div className="printable-shift-report print-only">
        <div className="thermal-receipt-paper paper-58mm">
          <div className="receipt-header">
            <h2>{config?.companyName}</h2>
            <p>RAPÒ BALANSE KÈS / RAPPORT DE FIN DE JOURNÉE</p>
            <p>Dat: {reportDate}</p>
            <p>POS: {config?.posId} • {config?.branchName}</p>
            <div className="receipt-divider-dashed"></div>
          </div>

          <div className="receipt-meta">
            <div className="receipt-row bold-row">
              <span>TOTAL VANT:</span>
              <span className="mono-text">{reportData?.totalSales || 0} {currencySymbol}</span>
            </div>
            <div className="receipt-row">
              <span>TIKÈ VANN:</span>
              <span className="mono-text">{reportData?.activeTicketsCount || 0}</span>
            </div>
            <div className="receipt-row">
              <span>TOTAL PÈYMAN:</span>
              <span className="mono-text">{reportData?.totalWinningAmount || 0} {currencySymbol}</span>
            </div>
            <div className="receipt-row bold-row">
              <span>BALANSE NÈT:</span>
              <span className="mono-text">{reportData?.netBalance || 0} {currencySymbol}</span>
            </div>
            <div className="receipt-divider-dashed"></div>
          </div>

          <div className="receipt-footer">
            <p>Siyati Responsab Caisse: ____________________</p>
            <p>LOTO509 POS EXPRESS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
