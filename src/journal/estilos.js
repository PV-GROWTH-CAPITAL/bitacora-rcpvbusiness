// Hoja de estilos del Journal (antes, el bloque <style> de TradingJournal.jsx, copiado tal cual).
export const ESTILOS_JOURNAL = `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .jt-root {
          --bg: #0A0D13;
          --surface: #12161F;
          --surface-2: #171D28;
          --border: #262C39;
          --text: #ECEFF3;
          --text-dim: #8891A1;
          --accent: #C6A15A;
          --accent-dim: #7C6335;
          --win: #2F9670;
          --win-dim: #1D5C46;
          --loss: #B14B3F;
          --loss-dim: #5C2A22;
          --flat: #5686BD; /* operación o día de 0 $: el azul del calendario */
          font-family: 'IBM Plex Sans', sans-serif;
          background-color: var(--bg);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
          color: var(--text);
          min-height: 100vh;
          padding-bottom: 64px;
        }
        .jt-root * { box-sizing: border-box; }
        .jt-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .jt-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        @keyframes jt-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: no-preference) {
          .jt-panel, .jt-stat-card { animation: jt-rise 0.5s ease both; }
        }

        .jt-ticker-wrap {
          border-top: 1px solid #2E2411;
          border-bottom: 1px solid #2E2411;
          background: linear-gradient(180deg, #0D0A05 0%, #060504 100%);
          overflow: hidden;
          white-space: nowrap;
          padding: 9px 0;
        }
        .jt-ticker-track {
          display: inline-flex;
          gap: 10px;
          padding-left: 24px;
          animation: jt-scroll 42s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .jt-ticker-track { animation: none; }
        }
        @keyframes jt-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .jt-pill {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 0.03em;
          padding: 4px 12px;
          border-radius: 999px;
          border: 1px solid rgba(198,161,90,0.18);
          background: linear-gradient(180deg, rgba(198,161,90,0.07), rgba(198,161,90,0));
          white-space: nowrap;
        }
        .jt-pill.win { color: #4CBB93; border-color: rgba(47,150,112,0.35); }
        .jt-pill.loss { color: #D97563; border-color: rgba(177,75,63,0.35); }
        .jt-pill.flat { color: var(--flat); border-color: rgba(86,134,189,0.35); }

        .jt-header {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 24px 8px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .jt-title { font-size: 30px; font-weight: 600; letter-spacing: -0.01em; }
        .jt-subtitle { color: var(--text-dim); font-size: 12px; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.09em; }

        .jt-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .jt-btn:hover { border-color: var(--accent-dim); transform: translateY(-1px); }
        .jt-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .jt-btn.primary {
          background: linear-gradient(180deg, #D8B876, var(--accent));
          color: #1A1408;
          border-color: var(--accent);
          font-weight: 600;
          box-shadow: 0 2px 14px rgba(198,161,90,0.22);
        }
        .jt-btn.primary:hover { background: linear-gradient(180deg, #E2C589, #D8B876); box-shadow: 0 4px 20px rgba(198,161,90,0.32); }

        .jt-select {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 8px;
          padding: 9px 10px;
          font-size: 13px;
        }
        .jt-select:focus-visible { outline: 2px solid var(--accent); }
        .jt-risk-field {
          display: flex; align-items: center; gap: 4px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 8px; padding: 0 10px; height: 37px; box-sizing: border-box;
        }
        .jt-risk-label { font-size: 11px; color: var(--text-dim); white-space: nowrap; margin-right: 2px; }
        .jt-risk-dollar { color: var(--text-dim); font-size: 13px; }
        .jt-risk-field input {
          width: 72px; background: transparent; border: none; color: var(--text); font-size: 13px;
          padding: 8px 2px; outline: none;
        }
        .jt-risk-field:focus-within { border-color: var(--accent-dim); }

        .jt-main { max-width: 1100px; margin: 0 auto; padding: 20px 24px; }

        .jt-stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        @media (max-width: 860px) {
          .jt-stats { grid-template-columns: repeat(2, 1fr); }
        }
        .jt-stat-card {
          position: relative;
          background: linear-gradient(180deg, var(--surface-2), var(--surface));
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 15px 16px;
          overflow: hidden;
          box-shadow: 0 8px 20px -12px rgba(0,0,0,0.6);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .jt-stat-card::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          opacity: 0.7;
        }
        .jt-stat-card:hover { transform: translateY(-2px); box-shadow: 0 14px 26px -14px rgba(0,0,0,0.7); }
        .jt-stat-label {
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: var(--text-dim);
          margin-bottom: 6px;
        }
        .jt-stat-value { font-size: 21px; font-weight: 600; letter-spacing: -0.01em; }

        .jt-panel {
          position: relative;
          background: linear-gradient(180deg, var(--surface-2) 0%, var(--surface) 14%);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 18px 18px 6px;
          margin-bottom: 20px;
          box-shadow: 0 20px 40px -28px rgba(0,0,0,0.75);
        }
        .jt-panel-title {
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: var(--text-dim);
          margin-bottom: 4px;
        }

        table.jt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .jt-table th {
          text-align: left;
          font-weight: 500;
          color: var(--text-dim);
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          padding: 10px 10px;
          border-bottom: 1px solid var(--accent-dim);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .jt-table th:hover { color: var(--accent); }
        .jt-table td {
          padding: 10px 10px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .jt-table tbody tr:nth-child(4n+1) td, .jt-table tbody tr:nth-child(4n+2) td { background: rgba(255,255,255,0.012); }
        .jt-table tr.jt-row:hover td { background: rgba(198,161,90,0.06); cursor: pointer; }
        .jt-row-actions { display: flex; gap: 6px; justify-content: flex-end; }
        .jt-icon-btn {
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: inline-flex;
        }
        .jt-icon-btn:hover { color: var(--text); background: var(--border); }
        .jt-icon-btn:focus-visible { outline: 2px solid var(--accent); }

        .jt-empty {
          text-align: center;
          padding: 48px 20px;
          color: var(--text-dim);
        }

        .jt-expand-row td {
          background: var(--surface-2);
          font-size: 12.5px;
          color: var(--text-dim);
          padding: 12px 14px;
        }

        .jt-modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(6, 9, 13, 0.7);
          display: flex; align-items: flex-start; justify-content: center;
          padding: 40px 16px;
          z-index: 50;
          overflow-y: auto;
        }
        .jt-modal {
          background: linear-gradient(180deg, var(--surface-2), var(--surface));
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 100%;
          max-width: 560px;
          padding: 22px;
          box-shadow: 0 30px 60px -20px rgba(0,0,0,0.8);
        }
        .jt-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .jt-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .jt-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
        .jt-field label { font-size: 12px; color: var(--text-dim); }
        .jt-field input, .jt-field select, .jt-field textarea {
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
          font-family: inherit;
        }
        .jt-field input:focus-visible, .jt-field select:focus-visible, .jt-field textarea:focus-visible {
          outline: 2px solid var(--accent);
        }
        .jt-field textarea { resize: vertical; min-height: 60px; }
        .jt-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
        .jt-acc-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
        .jt-acc-count { margin-left: 6px; font-size: 11px; color: var(--accent); }
        .jt-link-btn {
          background: none; border: none; padding: 2px 0; cursor: pointer;
          font-size: 12px; font-family: inherit; color: var(--accent);
          border-bottom: 1px solid transparent; transition: border-color 0.15s ease, color 0.15s ease;
        }
        .jt-link-btn:hover { color: #D8B876; border-bottom-color: var(--accent-dim); }
        .jt-link-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }
        .jt-acc-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .jt-acc-chip {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 6px 12px 6px 8px; border-radius: 999px; cursor: pointer;
          font-size: 12.5px; font-family: inherit;
          border: 1px solid var(--border); background: var(--surface-2); color: var(--text-dim);
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .jt-acc-chip:hover { border-color: var(--accent-dim); color: var(--text); }
        .jt-acc-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .jt-acc-chip.on {
          color: var(--text); border-color: rgba(198,161,90,0.55);
          background: linear-gradient(180deg, rgba(198,161,90,0.14), rgba(198,161,90,0.05));
        }
        .jt-acc-check {
          width: 15px; height: 15px; border-radius: 4px; flex: none;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid var(--border); color: #1A1408;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .jt-acc-chip.on .jt-acc-check { background: var(--accent); border-color: var(--accent); }
        .jt-acc-hint { font-size: 11.5px; color: var(--text-dim); }
        .jt-acc-list {
          margin-top: 6px; border: 1px solid var(--border); border-radius: 10px;
          background: rgba(10,13,19,0.35); padding: 4px 10px;
        }
        .jt-acc-row {
          display: grid; grid-template-columns: minmax(0, 1fr) 76px 112px 26px;
          gap: 8px; align-items: center; padding: 6px 0;
        }
        .jt-acc-row + .jt-acc-row { border-top: 1px solid rgba(38,44,57,0.6); }
        .jt-acc-row-head span { font-size: 10.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
        .jt-acc-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .jt-field .jt-acc-row input { padding: 6px 8px; min-width: 0; width: 100%; }
        .jt-field .jt-acc-row input.ajustada { border-color: var(--accent-dim); }
        .jt-field input.invalido, .jt-field .jt-acc-row input.invalido { border-color: var(--loss); }
        .jt-hint-error { color: #D97563; margin-bottom: 10px; }
        .jt-acc-reset:disabled { opacity: 0; pointer-events: none; }
        .jt-acc-total {
          display: flex; justify-content: space-between; align-items: center;
          border-top: 1px solid var(--border); margin-top: 2px; padding: 8px 0 4px;
          font-size: 12px; color: var(--text-dim);
        }
        .jt-acc-total .win { color: #4CBB93; }
        .jt-acc-total .loss { color: #D97563; }
        .jt-error-banner {
          background: var(--loss-dim);
          color: #FBD8D2;
          font-size: 12.5px;
          padding: 8px 14px;
          border-radius: 8px;
          margin-bottom: 14px;
        }
        .jt-error-detalle { margin-top: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; opacity: 0.85; word-break: break-word; }
        .jt-captura-drop {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
          border: 1.5px dashed var(--border); border-radius: 10px; padding: 22px 12px; cursor: pointer;
          color: var(--text-dim); font-size: 12.5px; text-align: center; transition: border-color 0.15s ease, color 0.15s ease;
        }
        .jt-captura-drop:hover { border-color: var(--accent-dim); color: var(--text); }
        .jt-captura-preview { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        .jt-captura-preview img {
          max-width: 100%; max-height: 220px; border-radius: 10px; border: 1px solid var(--border); object-fit: cover;
        }
        .jt-captura-thumb-link { display: inline-block; }
        .jt-captura-thumb {
          max-width: 220px; max-height: 140px; border-radius: 8px; border: 1px solid var(--border);
          object-fit: cover; display: block; transition: opacity 0.15s ease;
        }
        .jt-captura-thumb:hover { opacity: 0.85; }
        .jt-pnl-win { color: var(--win); }
        .jt-pnl-loss { color: var(--loss); }
        .jt-pnl-flat { color: var(--flat); }

        .jt-cal-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px; flex-wrap: wrap; gap: 8px;
        }
        .jt-cal-nav { display: flex; align-items: center; gap: 6px; }
        .jt-cal-month {
          font-size: 14px; font-weight: 600; min-width: 150px; text-align: center;
          text-transform: capitalize;
        }
        .jt-cal-total { font-size: 13px; }
        .jt-cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .jt-cal-weekday {
          text-align: center;
          font-size: 10.5px;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding-bottom: 4px;
        }
        .jt-cal-cell {
          min-height: 62px;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 6px;
          cursor: pointer;
          background: var(--surface-2);
          transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .jt-cal-cell:hover { border-color: var(--accent-dim); transform: translateY(-1px); }
        .jt-cal-cell.empty { visibility: hidden; cursor: default; }
        .jt-cal-cell.today { border: 1px dashed var(--accent-dim); }
        .jt-cal-cell.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent), 0 6px 16px -6px rgba(198,161,90,0.5); }
        .jt-cal-cell.risk-exceeded { box-shadow: 0 0 0 2px var(--loss), 0 6px 16px -6px rgba(177,75,63,0.5); }
        .jt-cal-cell.risk-exceeded .jt-cal-daynum::after { content: " ⚠"; }
        .jt-cal-cell:focus-visible { outline: 2px solid var(--accent); }
        .jt-cal-cell.cal-win { background: linear-gradient(155deg, #37A57C, #1F7355); border-color: #1F7355; }
        .jt-cal-cell.cal-loss { background: linear-gradient(155deg, #C4574A, #92352A); border-color: #92352A; }
        .jt-cal-cell.cal-flat { background: linear-gradient(155deg, #5686BD, #325C87); border-color: #325C87; }
        .jt-cal-cell.cal-win:hover, .jt-cal-cell.cal-loss:hover, .jt-cal-cell.cal-flat:hover { filter: brightness(1.12); }
        .jt-cal-cell.cal-win .jt-cal-daynum, .jt-cal-cell.cal-win .jt-cal-amount, .jt-cal-cell.cal-win .jt-cal-count,
        .jt-cal-cell.cal-loss .jt-cal-daynum, .jt-cal-cell.cal-loss .jt-cal-amount, .jt-cal-cell.cal-loss .jt-cal-count,
        .jt-cal-cell.cal-flat .jt-cal-daynum, .jt-cal-cell.cal-flat .jt-cal-amount, .jt-cal-cell.cal-flat .jt-cal-count {
          color: #F7FAFC; text-shadow: 0 1px 2px rgba(0,0,0,0.35);
        }
        .jt-cal-cell.cal-win .jt-cal-amount, .jt-cal-cell.cal-loss .jt-cal-amount, .jt-cal-cell.cal-flat .jt-cal-amount { font-weight: 700; }
        .jt-cal-daynum { font-size: 11px; color: var(--text-dim); font-family: 'IBM Plex Mono', monospace; }
        .jt-cal-amount { font-size: 12px; font-weight: 600; margin-top: 4px; font-family: 'IBM Plex Mono', monospace; }
        .jt-cal-count { font-size: 9.5px; color: var(--text-dim); margin-top: 1px; }

        .jt-day-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--surface-2); border: 1px solid var(--accent-dim);
          color: var(--accent); border-radius: 999px; padding: 4px 10px;
          font-size: 12px; margin-left: 10px; font-family: 'IBM Plex Mono', monospace;
        }
        .jt-day-chip button {
          background: none; border: none; color: inherit; cursor: pointer;
          display: inline-flex; padding: 0;
        }
        .jt-analysis-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }
        @media (max-width: 860px) {
          .jt-analysis-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .jt-analysis-card {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .jt-analysis-sub {
          font-size: 11px;
          color: var(--text-dim);
          margin-top: 4px;
        }
        .jt-analysis-charts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 12px;
        }
        @media (max-width: 860px) {
          .jt-analysis-charts { grid-template-columns: 1fr; }
        }
        .jt-user-chip {
          font-size: 12px; color: var(--text-dim); font-family: 'IBM Plex Mono', monospace;
          display: flex; align-items: center; gap: 10px;
        }

        @media (max-width: 640px) {
          .jt-header { padding: 18px 14px 6px; gap: 10px; }
          .jt-title { font-size: 23px; }
          .jt-main { padding: 12px 14px; }
          .jt-panel { padding: 14px 14px 4px; border-radius: 12px; }
          .jt-risk-field { flex: 1 1 100%; order: 3; }
          .jt-select { flex: 1 1 auto; }
          .jt-btn span, .jt-btn { white-space: nowrap; }
          .jt-field-grid { grid-template-columns: 1fr; }
          .jt-cal-grid { gap: 4px; }
          .jt-cal-cell { min-height: 46px; padding: 4px; border-radius: 7px; }
          .jt-cal-daynum { font-size: 10px; }
          .jt-cal-amount { font-size: 9.5px; margin-top: 2px; line-height: 1.15; }
          .jt-cal-count { display: none; }
          .jt-cal-weekday { font-size: 9px; }
          .jt-modal { padding: 16px; max-height: 90vh; overflow-y: auto; }
          .jt-acc-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) 26px; gap: 4px 6px; }
          .jt-acc-name { grid-column: 1 / -1; white-space: normal; overflow-wrap: anywhere; }
          .jt-acc-row-head span:first-child { display: none; }
          table.jt-table { font-size: 12px; }
          .jt-table th, .jt-table td { padding: 8px 6px; }
        }
      `;
