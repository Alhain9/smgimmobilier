// ============ Icônes 3D (Microsoft Fluent) avec repli sur l'emoji ============
// Remplace automatiquement les emoji par des images 3D réalistes après chaque rendu.
// Si une image manque (hors-ligne, icône absente) -> repli automatique sur l'emoji d'origine.
const Icons = {
  BASE: '../assets/icons3d/',

  // Logo WhatsApp officiel (SVG inline, monochrome blanc — lisible sur le bouton vert)
  WHATSAPP_SVG: '<svg class="wa-logo" viewBox="0 0 32 32" width="17" height="17" '
    + 'style="vertical-align:-3px" aria-hidden="true"><path fill="#fff" d="M16 .4C7.4.4.5 7.3.5 '
    + '15.9c0 2.8.7 5.4 2 7.7L.4 31.6l8.2-2.1c2.2 1.2 4.7 1.9 7.4 1.9 8.6 0 15.5-6.9 15.5-15.5S24.6.4 '
    + '16 .4zm0 28.3c-2.4 0-4.6-.6-6.5-1.8l-.5-.3-4.8 1.3 1.3-4.7-.3-.5c-1.3-2-2-4.3-2-6.8C4.4 9.5 9.6 '
    + '4.3 16 4.3s11.6 5.2 11.6 11.6S22.4 28.7 16 28.7zm6.4-8.7c-.3-.2-2.1-1-2.4-1.2-.3-.1-.6-.2-.8.2-.2.3-.9 '
    + '1.2-1.1 1.4-.2.2-.4.2-.7.1-1.9-.9-3.1-1.7-4.4-3.8-.3-.6.3-.5.9-1.8.1-.2 0-.4 0-.6-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 '
    + '0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.8 5.2.8.3 1.4.5 1.9.7.8.3 1.5.2 '
    + '2.1.1.6-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.1-.3-.2-.6-.4z"/></svg>',

  MAP: {
    '📄': 'page_facing_up', '💰': 'money_bag', '🔧': 'wrench', '✅': 'check_mark_button',
    '🏢': 'office_building', '🗑': 'wastebasket', '✏': 'pencil', '👥': 'busts_in_silhouette',
    '👤': 'bust_in_silhouette', '📋': 'clipboard', '📊': 'bar_chart', '📅': 'calendar',
    '📞': 'telephone_receiver', '🟢': 'green_circle', '🧾': 'receipt', '📎': 'paperclip',
    '🌙': 'crescent_moon', '📈': 'chart_increasing', '👁': 'eye', '🔴': 'red_circle',
    '👷': 'construction_worker', '📷': 'camera', '💵': 'dollar_banknote', '🏠': 'house',
    '⏳': 'hourglass_not_done', '⬆': 'up_arrow', '🛠': 'hammer_and_wrench', '🚪': 'door',
    '🎯': 'direct_hit', '👋': 'waving_hand', '📂': 'open_file_folder', '⚠': 'warning',
    '🔔': 'bell', '🎉': 'party_popper', '🖨': 'printer', '⬇': 'down_arrow',
    '🔄': 'counterclockwise_arrows_button', '📸': 'camera_with_flash', '🔐': 'locked_with_key',
    '🌗': 'last_quarter_moon', '📍': 'round_pushpin', '✉': 'envelope', '©': 'copyright',
    '🪙': 'coin', '🚧': 'construction', '⚖': 'balance_scale', '🧮': 'abacus',
    '🪪': 'identification_card', '💳': 'credit_card', '📁': 'file_folder', '📕': 'closed_book',
    '🖼': 'framed_picture', '🧰': 'toolbox', '➕': 'plus', '❌': 'cross_mark',
    '📧': 'e-mail', '🔖': 'bookmark', '📑': 'bookmark_tabs', '🏦': 'bank',
    '💼': 'briefcase', '🎁': 'wrapped_gift', '➖': 'minus', '🔒': 'locked',
    '🔓': 'unlocked', '🌍': 'globe_showing_europe-africa', '☀': 'sun',
  },

  _re: /\p{Extended_Pictographic}️?/gu,
  _skip: new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'IMG', 'SVG', 'CODE', 'PRE', 'OPTION']),
  _escape(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },

  imgTag(emoji) {
    const base = this.MAP[emoji];
    if (!base) return null;
    // En cas d'échec de chargement, on restaure l'emoji d'origine (repli gracieux)
    return `<img class="emoji3d" src="${this.BASE}${base}.png" alt="${emoji}" draggable="false" ` +
      `onerror="this.replaceWith(document.createTextNode('${emoji}'))">`;
  },

  // Boutons de marque/action : remplace l'emoji générique par le vrai logo (ex. WhatsApp)
  _brandButtons(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.btn-whatsapp:not([data-brand])').forEach((b) => {
      b.setAttribute('data-brand', 'wa');
      if (b.innerHTML.indexOf('🟢') !== -1) b.innerHTML = b.innerHTML.replace('🟢', this.WHATSAPP_SVG);
      else b.innerHTML = this.WHATSAPP_SVG + ' ' + b.innerHTML; // sécurité si l'emoji est absent
    });
  },

  // Icônes d'action des boutons (SVG inline monochrome ; `currentColor` => s'adapte à la couleur du bouton)
  BTN_PATHS: {
    '📞': 'M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z',
    '📄': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 2 4 4h-4V4zM8 13h8v2H8v-2zm0 4h8v2H8v-2zm0-8h4v2H8V9z',
    '⬆': 'M5 20h14v-2H5v2zM12 4 6 10h3.5v5h5v-5H18l-6-6z',
    '✏': 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    '🗑': 'M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7zm9-3 1 1h4v2H4V5h4l1-1h6z',
    '✅': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z',
    '❌': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.5 12.1-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4L10.6 12 8.5 9.9l1.4-1.4L12 10.6l2.1-2.1 1.4 1.4L13.4 12l2.1 2.1z',
    '👁': 'M12 5C6.5 5 2.7 8.6 1 12c1.7 3.4 5.5 7 11 7s9.3-3.6 11-7c-1.7-3.4-5.5-7-11-7zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    '🧾': 'M5 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1zm3 5h8v2H8V7zm0 4h8v2H8v-2zm0 4h5v2H8v-2z',
    '🔄': 'M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z',
    '➕': 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z',
    '👥': 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-6 1.3-6 4v1h8v-1c0-1 .4-1.9 1-2.6-1-.3-2-.4-3-.4zm8 0c-.5 0-1 0-1.5.1.9.8 1.5 1.8 1.5 2.9v1h6v-1c0-2.7-3.3-4-6-4z',
    '👷': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z',
    '📷': 'M9 4 7 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-2-2H9zm3 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  },
  _btnSvg(p) {
    return '<svg class="btn-ic" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px" '
      + 'fill="currentColor" aria-hidden="true"><path d="' + p + '"/></svg>';
  },
  // Remplace les emoji d'action des boutons par les icônes SVG (avant la passe emoji générique)
  _buttonIcons(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.btn:not([data-icon])').forEach((b) => {
      if (b.classList.contains('btn-whatsapp')) return; // logo de marque géré à part
      let html = b.innerHTML.replace(/️/g, ''); // neutralise les sélecteurs de variante
      let changed = false;
      Object.keys(this.BTN_PATHS).forEach((emo) => {
        if (html.indexOf(emo) !== -1) { html = html.split(emo).join(this._btnSvg(this.BTN_PATHS[emo])); changed = true; }
      });
      if (changed) { b.innerHTML = html; b.setAttribute('data-icon', '1'); }
    });
  },

  enhance(root) {
    if (!root || !window.document || !document.createTreeWalker) return;
    this._brandButtons(root); // logos de marque (WhatsApp…)
    this._buttonIcons(root);  // icônes d'action des boutons
    const self = this;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.length > 5000) return NodeFilter.FILTER_REJECT;
        const p = node.parentNode;
        if (!p || self._skip.has(p.nodeName)) return NodeFilter.FILTER_REJECT;
        if (!/\p{Extended_Pictographic}/u.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets = [];
    let n; while ((n = walker.nextNode())) targets.push(n);
    for (const node of targets) {
      const text = node.nodeValue;
      let last = 0, html = '', changed = false, m;
      this._re.lastIndex = 0;
      while ((m = this._re.exec(text))) {
        const emoji = m[0].replace('️', '');
        const tag = this.imgTag(emoji);
        if (!tag) continue;
        html += this._escape(text.slice(last, m.index)) + tag;
        last = m.index + m[0].length;
        changed = true;
      }
      if (!changed) continue;
      html += this._escape(text.slice(last));
      const span = document.createElement('span');
      span.className = 'emoji3d-wrap';
      span.innerHTML = html;
      node.parentNode.replaceChild(span, node);
    }
  },
};
