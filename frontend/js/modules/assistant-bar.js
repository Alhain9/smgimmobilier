/* ============================================================================
   Assistant SMG — Barre de commande (Ctrl/Cmd+K)
   Autonome : CSS + SVG inline, aucune ressource externe.
   - Texte + voix (Web Speech, fr-FR), alertes proactives, confirmation d'écriture.
   - Réservé au personnel (caché pour les locataires).
   ========================================================================== */
(function () {
  'use strict';

  // --- Utilitaires d'accès (adaptés à cette SPA) ---
  const apiBase = () => (window.CONFIG && CONFIG.API_URL) || 'http://localhost:5000/api';
  const getToken = () => localStorage.getItem((window.CONFIG && CONFIG.TOKEN_KEY) || 'smg_token');
  const getRole = () => {
    try { return (window.Auth && Auth.getRole && Auth.getRole()) || (JSON.parse(localStorage.getItem('smg_user') || '{}').role || {}).name; }
    catch (_) { return null; }
  };

  // Le personnel uniquement (jamais les locataires)
  if (getRole() === 'locataire') return;

  const SUGGESTIONS = [
    "Qui n'a pas payé ce mois-ci ?",
    'Quels biens sont vacants ?',
    'Détaille mon chiffre d\'affaires de ce mois',
    'Quels incidents ouverts en ce moment ?',
  ];

  let historique = [];          // [{role, content}] texte seul (suivi de conversation)
  let pendingAction = null;     // action d'écriture en attente de confirmation
  let recognizing = false;
  let recognition = null;
  let enabled = false;          // la barre n'est active que si l'IA est configurée (clé présente)

  // ---------- Styles (injectés une fois) ----------
  function injectStyles() {
    if (document.getElementById('smg-asst-style')) return;
    const css = `
    .asst-fab{position:fixed;right:20px;bottom:20px;z-index:900;display:flex;align-items:center;gap:8px;
      padding:11px 16px;border:none;border-radius:999px;cursor:pointer;font-size:14px;font-weight:600;
      color:#fff;background:var(--primary,#0ea5e9);box-shadow:0 6px 20px rgba(2,132,199,.4);}
    .asst-fab:hover{filter:brightness(1.05);} .asst-fab kbd{background:rgba(255,255,255,.22);border-radius:5px;padding:1px 6px;font-size:11px;}
    .asst-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.55);display:none;
      align-items:flex-start;justify-content:center;padding:9vh 16px 16px;}
    .asst-overlay.open{display:flex;}
    .asst-panel{width:100%;max-width:640px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;
      background:var(--bg-surface,#fff);color:var(--text-primary,#0f172a);border:1px solid var(--border,#e2e8f0);
      border-radius:16px;box-shadow:0 24px 60px rgba(2,6,23,.35);}
    .asst-inputrow{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--border,#e2e8f0);}
    .asst-inputrow svg{flex-shrink:0;opacity:.6;}
    .asst-input{flex:1;border:none;outline:none;background:transparent;font-size:16px;color:inherit;font-family:inherit;}
    .asst-iconbtn{border:none;background:transparent;cursor:pointer;width:38px;height:38px;border-radius:10px;
      display:flex;align-items:center;justify-content:center;color:var(--text-secondary,#475569);}
    .asst-iconbtn:hover{background:var(--bg-hover,#f1f5f9);}
    .asst-iconbtn.mic.on{color:#fff;background:var(--danger,#ef4444);}
    .asst-body{padding:12px 14px;overflow-y:auto;}
    .asst-section-title{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted,#94a3b8);
      font-weight:700;margin:6px 2px 8px;}
    .asst-alert{display:flex;gap:10px;padding:10px 12px;border-radius:10px;margin-bottom:8px;
      background:var(--bg-surface-2,#f8fafc);border:1px solid var(--border,#e2e8f0);}
    .asst-alert .ic{font-size:18px;line-height:1.4;}
    .asst-alert .ttl{font-weight:600;font-size:14px;}
    .asst-alert .det{font-size:12.5px;color:var(--text-secondary,#475569);margin-top:2px;}
    .asst-alert.danger{border-left:3px solid var(--danger,#ef4444);}
    .asst-alert.warning{border-left:3px solid var(--warning,#f59e0b);}
    .asst-alert.info{border-left:3px solid var(--info,#0ea5e9);}
    .asst-sugg{display:flex;flex-wrap:wrap;gap:8px;}
    .asst-chip{border:1px solid var(--border,#e2e8f0);background:var(--bg-surface,#fff);border-radius:999px;
      padding:7px 13px;font-size:13px;cursor:pointer;color:inherit;font-family:inherit;}
    .asst-chip:hover,.asst-chip:focus{background:var(--bg-hover,#f1f5f9);outline:2px solid var(--primary,#0ea5e9);outline-offset:1px;}
    .asst-msg{padding:10px 12px;border-radius:12px;margin-bottom:10px;font-size:14px;line-height:1.5;white-space:pre-wrap;max-width:90%;}
    .asst-msg.user{background:var(--primary,#0ea5e9);color:#fff;margin-left:auto;border-bottom-right-radius:4px;}
    .asst-msg.bot{background:var(--bg-surface-2,#f1f5f9);border-bottom-left-radius:4px;}
    .asst-msg .actions{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;}
    .asst-btn{border:none;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
    .asst-btn.primary{background:var(--primary,#0ea5e9);color:#fff;} .asst-btn.ghost{background:var(--bg-hover,#e2e8f0);color:var(--text-primary,#0f172a);}
    .asst-btn.danger{background:var(--danger,#ef4444);color:#fff;}
    .asst-confirm{margin-top:8px;padding:10px 12px;border:1px dashed var(--warning,#f59e0b);border-radius:10px;
      background:rgba(245,158,11,.08);}
    .asst-typing{display:inline-flex;gap:4px;padding:4px 2px;}
    .asst-typing i{width:7px;height:7px;border-radius:50%;background:var(--text-muted,#94a3b8);animation:asstb 1s infinite;}
    .asst-typing i:nth-child(2){animation-delay:.15s;} .asst-typing i:nth-child(3){animation-delay:.3s;}
    @keyframes asstb{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}
    .asst-hint{font-size:11.5px;color:var(--text-muted,#94a3b8);padding:8px 14px;border-top:1px solid var(--border,#e2e8f0);}
    @media (max-width:560px){.asst-fab span{display:none;} .asst-overlay{padding-top:4vh;}}
    @media (prefers-reduced-motion:reduce){.asst-typing i{animation:none;}}
    `;
    const style = document.createElement('style');
    style.id = 'smg-asst-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- Construction du DOM ----------
  let els = {};
  function build() {
    const fab = document.createElement('button');
    fab.className = 'asst-fab';
    fab.setAttribute('aria-label', "Ouvrir l'assistant");
    fab.innerHTML = sparkleSvg() + '<span>Assistant <kbd>Ctrl K</kbd></span>';
    fab.addEventListener('click', open);

    const overlay = document.createElement('div');
    overlay.className = 'asst-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Assistant SMG');
    overlay.innerHTML = `
      <div class="asst-panel" role="document">
        <div class="asst-inputrow">
          ${sparkleSvg(20)}
          <input class="asst-input" type="text" autocomplete="off" placeholder="Posez une question ou donnez un ordre…" aria-label="Votre demande"/>
          <button class="asst-iconbtn mic" title="Dicter (fr-FR)" aria-label="Dicter">${micSvg()}</button>
          <button class="asst-iconbtn close" title="Fermer (Échap)" aria-label="Fermer">${closeSvg()}</button>
        </div>
        <div class="asst-body"></div>
        <div class="asst-hint">Entrée pour envoyer · Maj+Entrée nouvelle ligne · Échap pour fermer</div>
      </div>`;
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

    document.body.appendChild(fab);
    document.body.appendChild(overlay);

    els = {
      fab, overlay,
      input: overlay.querySelector('.asst-input'),
      body: overlay.querySelector('.asst-body'),
      mic: overlay.querySelector('.asst-iconbtn.mic'),
      close: overlay.querySelector('.asst-iconbtn.close'),
    };
    els.close.addEventListener('click', close);
    els.input.addEventListener('keydown', onInputKey);
    els.mic.addEventListener('click', toggleMic);
    setupSpeech();
  }

  // ---------- Ouverture / fermeture ----------
  function open() {
    els.overlay.classList.add('open');
    els.input.focus();
    if (!historique.length) renderHome();
  }
  function close() {
    els.overlay.classList.remove('open');
    if (recognizing && recognition) recognition.stop();
  }
  function isOpen() { return els.overlay.classList.contains('open'); }

  // Raccourcis globaux (inactifs tant que la barre n'est pas activée)
  document.addEventListener('keydown', (e) => {
    if (!enabled) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); isOpen() ? close() : open(); }
    else if (e.key === 'Escape' && isOpen()) { close(); }
  });

  // ---------- Écran d'accueil : alertes + suggestions ----------
  async function renderHome() {
    els.body.innerHTML = `<div class="asst-section-title">À votre attention</div>
      <div id="asstAlerts"><div class="asst-typing"><i></i><i></i><i></i></div></div>
      <div class="asst-section-title" style="margin-top:14px">Suggestions</div>
      <div class="asst-sugg">${SUGGESTIONS.map((s, i) => `<button class="asst-chip" data-sugg="${i}" tabindex="0">${escapeHtml(s)}</button>`).join('')}</div>`;
    els.body.querySelectorAll('.asst-chip').forEach((c) => {
      c.addEventListener('click', () => { els.input.value = SUGGESTIONS[c.dataset.sugg]; send(); });
    });
    enableArrowNav(els.body.querySelectorAll('.asst-chip'));
    try {
      const res = await fetch(apiBase() + '/assistant/alertes', { headers: { Authorization: 'Bearer ' + getToken() } });
      const data = await res.json().catch(() => ({}));
      const box = document.getElementById('asstAlerts');
      if (!box) return;
      const list = (data && data.alertes) || [];
      box.innerHTML = list.length ? list.map(renderAlert).join('')
        : '<div class="asst-alert info"><span class="ic">✅</span><div><div class="ttl">Rien à signaler</div><div class="det">Aucune alerte pour le moment.</div></div></div>';
    } catch (_) {
      const box = document.getElementById('asstAlerts');
      if (box) box.innerHTML = '<div class="det" style="color:var(--text-muted)">Alertes indisponibles.</div>';
    }
  }
  function renderAlert(a) {
    const niveau = a.niveau || 'info';
    const det = (a.details || []).slice(0, 3).map((d) => Object.values(d).filter((v) => v != null).join(' · ')).join('<br>');
    return `<div class="asst-alert ${niveau}"><span class="ic">${a.icone || '🔔'}</span>
      <div><div class="ttl">${escapeHtml(a.titre || '')}</div>${det ? `<div class="det">${det}</div>` : ''}</div></div>`;
  }

  // ---------- Conversation ----------
  function ensureThread() {
    if (!els.body.querySelector('.asst-thread')) {
      els.body.innerHTML = '<div class="asst-thread"></div>';
    }
    return els.body.querySelector('.asst-thread');
  }
  function addMsg(role, html) {
    const thread = ensureThread();
    const div = document.createElement('div');
    div.className = 'asst-msg ' + (role === 'user' ? 'user' : 'bot');
    div.innerHTML = html;
    thread.appendChild(div);
    els.body.scrollTop = els.body.scrollHeight;
    return div;
  }
  function addTyping() {
    const thread = ensureThread();
    const div = document.createElement('div');
    div.className = 'asst-msg bot';
    div.innerHTML = '<span class="asst-typing"><i></i><i></i><i></i></span>';
    thread.appendChild(div);
    els.body.scrollTop = els.body.scrollHeight;
    return div;
  }

  function onInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  async function send(confirmPayload) {
    const text = confirmPayload ? '' : els.input.value.trim();
    if (!confirmPayload && !text) return;

    if (!confirmPayload) { addMsg('user', escapeHtml(text)); historique.push({ role: 'user', content: text }); }
    els.input.value = '';
    const typing = addTyping();

    try {
      const body = confirmPayload
        ? { confirmer: true, action: confirmPayload }
        : { message: text, historique: historique.slice(-10) };
      const res = await fetch(apiBase() + '/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();

      if (res.status === 403) { addMsg('bot', '🔒 Assistant réservé au personnel.'); return; }
      if (res.status === 503) { addMsg('bot', '⚙️ ' + (data.reponse || "Assistant IA non configuré (clé API manquante).")); return; }

      const reponse = (data && data.reponse) || "Je n'ai pas pu produire de réponse.";
      const msg = addMsg('bot', escapeHtml(reponse) + documentActions(reponse));
      historique.push({ role: 'assistant', content: reponse });

      // Action d'écriture à confirmer
      if (data && data.action_en_attente) {
        pendingAction = data.action_en_attente;
        renderConfirm(msg, data.action_en_attente);
      }
      bindDocExport(msg, reponse);
    } catch (err) {
      typing.remove();
      addMsg('bot', '⚠️ Impossible de joindre le serveur. Vérifiez qu\'il est démarré (dans backend : <b>npm run dev</b>) puis réessayez.');
    }
  }

  function renderConfirm(msgEl, action) {
    const box = document.createElement('div');
    box.className = 'asst-confirm';
    box.innerHTML = `<div style="font-size:13px;margin-bottom:8px">⚠️ ${escapeHtml(action.resume || 'Confirmer cette action ?')}</div>
      <div class="actions"><button class="asst-btn primary" data-act="ok">Confirmer</button>
      <button class="asst-btn ghost" data-act="no">Annuler</button></div>`;
    msgEl.appendChild(box);
    els.body.scrollTop = els.body.scrollHeight;
    box.querySelector('[data-act="ok"]').addEventListener('click', () => {
      box.remove();
      const act = pendingAction; pendingAction = null;
      send(act);
    });
    box.querySelector('[data-act="no"]').addEventListener('click', () => {
      box.remove(); pendingAction = null;
      addMsg('bot', 'Action annulée.');
    });
  }

  // Bouton d'export PDF sur les réponses un peu longues (documents rédigés)
  function documentActions(text) {
    if (!window.PDF || !window.PDF.document || (text || '').length < 180) return '';
    return '<div class="actions"><button class="asst-btn ghost" data-pdf="1">📄 Exporter en PDF</button></div>';
  }
  function bindDocExport(msgEl, text) {
    const btn = msgEl.querySelector('[data-pdf="1"]');
    if (btn) btn.addEventListener('click', () => window.PDF.document('Document', text));
  }

  // ---------- Voix (Web Speech) ----------
  function setupSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { els.mic.style.display = 'none'; return; } // pas de micro si l'API est absente
    recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.addEventListener('result', (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      els.input.value = txt;
    });
    recognition.addEventListener('end', () => { recognizing = false; els.mic.classList.remove('on'); });
    recognition.addEventListener('error', () => { recognizing = false; els.mic.classList.remove('on'); });
  }
  function toggleMic() {
    if (!recognition) return;
    if (recognizing) { recognition.stop(); return; }
    try { recognition.start(); recognizing = true; els.mic.classList.add('on'); els.input.focus(); } catch (_) { /* déjà démarré */ }
  }

  // ---------- Navigation clavier (flèches sur les suggestions) ----------
  function enableArrowNav(nodeList) {
    const items = Array.from(nodeList);
    items.forEach((el, idx) => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); (items[idx + 1] || items[0]).focus(); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); (items[idx - 1] || items[items.length - 1]).focus(); }
      });
    });
  }

  // ---------- SVG inline ----------
  function sparkleSvg(s = 18) { return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.8 4.6L18.5 8.4 13.8 10 12 14.7 10.2 10 5.5 8.4l4.7-1.8L12 2zm6 12l.9 2.3 2.3.9-2.3.9L18 20.4l-.9-2.3-2.3-.9 2.3-.9L18 14zM6 14l.9 2.3 2.3.9-2.3.9L6 20.4l-.9-2.3L2.8 17l2.3-.9L6 14z"/></svg>`; }
  function micSvg() { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>'; }
  function closeSvg() { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/></svg>'; }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Init ----------
  // La barre ne s'affiche que si l'IA est configurée côté serveur (clé présente).
  // Sinon elle reste invisible ; elle réapparaît automatiquement dès qu'une clé est ajoutée.
  async function init() {
    try {
      const res = await fetch(apiBase() + '/assistant/status', { headers: { Authorization: 'Bearer ' + getToken() } });
      const data = await res.json().catch(() => ({}));
      if (!data || !data.configured) return; // pas de clé → barre masquée
    } catch (_) {
      return; // serveur injoignable → on n'affiche rien (pas de bouton mort)
    }
    injectStyles();
    build();
    enabled = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
