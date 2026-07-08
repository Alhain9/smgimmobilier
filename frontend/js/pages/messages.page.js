// ============ Page Messagerie Interne ============
const PageMessages = {
  activeContactId: null,
  contacts: [],
  messages: [],

  register() {
    Router.register('messages', () => this.render());

    // Écouter les nouveaux messages via socket
    if (typeof SocketClient !== 'undefined') {
      SocketClient.on('message:nouveau', (msg) => {
        // Si la conversation active est avec l'expéditeur, on ajoute le message
        if (this.activeContactId && (msg.sender_id === this.activeContactId || msg.recipient_id === this.activeContactId)) {
          this.messages.push(msg);
          this.renderConversation();
          this.scrollToBottom();
        } else {
          Toast.info(`Nouveau message de ${msg.sender?.full_name || 'un utilisateur'}`);
        }
      });
    }
  },

  async render() {
    Layout.setTitle('Messagerie Interne');
    Layout.content(`
      <div style="display:flex; height:calc(100vh - 160px); background:#fff; border-radius:8px; border:1px solid var(--border); overflow:hidden;">
        <!-- Liste de contacts -->
        <div style="width:300px; border-right:1px solid var(--border); display:flex; flex-direction:column; background:#F8F9FA;">
          <div style="padding:15px; border-bottom:1px solid var(--border); font-weight:bold; font-size:16px;">💬 Discussions</div>
          <div id="msgContactList" style="flex:1; overflow-y:auto;"><div class="spinner"></div></div>
        </div>

        <!-- Zone de chat -->
        <div style="flex:1; display:flex; flex-direction:column;">
          <div id="msgChatHeader" style="padding:15px; border-bottom:1px solid var(--border); font-weight:bold; background:#fff;">Sélectionnez une discussion</div>
          <div id="msgChatBody" style="flex:1; padding:20px; overflow-y:auto; background:#F5F7FA; display:flex; flex-direction:column; gap:10px;">
            <div style="margin:auto; color:#999;">Pas de discussion ouverte</div>
          </div>
          <div id="msgChatFooter" style="padding:15px; border-top:1px solid var(--border); background:#fff; display:none;">
            <form id="msgForm" onsubmit="PageMessages.handleSend(event)" style="display:flex; gap:10px;">
              <input type="text" id="msgInput" class="form-control" placeholder="Écrivez votre message..." required style="flex:1;"/>
              <button type="submit" class="btn btn-primary">Envoyer</button>
            </form>
          </div>
        </div>
      </div>
    `);

    await this.loadContacts();
  },

  async loadContacts() {
    const listContainer = document.getElementById('msgContactList');
    if (!listContainer) return;

    try {
      // Pour avoir des contacts, on récupère les autres utilisateurs du système
      const res = await API.get('/users');
      const allUsers = res.data || [];
      const user = Auth.getUser();

      // Exclure l'utilisateur connecté
      this.contacts = allUsers.filter(u => u.id !== user.id);

      listContainer.innerHTML = this.contacts.map(c => `
        <div class="contact-item" id="contact-${c.id}" onclick="PageMessages.openChat(${c.id})" style="padding:12px 15px; border-bottom:1px solid #eee; cursor:pointer; display:flex; gap:10px; align-items:center;">
          <div style="width:36px; height:36px; background:var(--primary); color:#fff; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:bold;">
            ${c.full_name ? c.full_name.charAt(0).toUpperCase() : '?'}
          </div>
          <div style="flex:1; overflow:hidden;">
            <div style="font-weight:bold; font-size:14px; text-overflow:ellipsis; white-space:nowrap; overflow:hidden;">${c.full_name}</div>
            <div style="font-size:11px; color:#999;">${c.role?.role_name || 'Employé'}</div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      listContainer.innerHTML = `<div style="padding:15px; color:red;">${err.message}</div>`;
    }
  },

  async openChat(contactId) {
    this.activeContactId = contactId;
    
    // Activer l'élément visuellement
    document.querySelectorAll('.contact-item').forEach(el => el.style.background = 'none');
    const activeEl = document.getElementById(`contact-${contactId}`);
    if (activeEl) activeEl.style.background = '#E8F0FE';

    const contact = this.contacts.find(c => c.id === contactId);
    document.getElementById('msgChatHeader').textContent = contact ? `💬 ${contact.full_name}` : 'Discussion';
    document.getElementById('msgChatFooter').style.display = 'block';

    const body = document.getElementById('msgChatBody');
    body.innerHTML = '<div class="spinner"></div>';

    try {
      const res = await API.get(`/messages/${contactId}`);
      this.messages = res.data || [];
      this.renderConversation();
      this.scrollToBottom();
    } catch (err) {
      body.innerHTML = `<div style="color:red; margin:auto;">${err.message}</div>`;
    }
  },

  renderConversation() {
    const body = document.getElementById('msgChatBody');
    if (!body) return;

    const user = Auth.getUser();

    body.innerHTML = this.messages.map(m => {
      const isMine = m.sender_id === user.id;
      const align = isMine ? 'align-self: flex-end; background: var(--primary); color: #fff;' : 'align-self: flex-start; background: #fff; color: #333;';
      const name = isMine ? 'Moi' : m.sender?.full_name || 'Autre';
      const time = new Date(m.created_at || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      return `
        <div style="max-width:70%; border-radius:8px; padding:10px 14px; box-shadow:0 1px 2px rgba(0,0,0,0.05); ${align}">
          <div style="font-size:10px; font-weight:bold; opacity:0.8; margin-bottom:4px;">${name}</div>
          <div style="font-size:13px; line-height:1.4;">${m.content}</div>
          <div style="font-size:9px; opacity:0.6; text-align:right; margin-top:4px;">${time}</div>
        </div>
      `;
    }).join('');
  },

  async handleSend(e) {
    e.preventDefault();
    const input = document.getElementById('msgInput');
    const content = input.value.trim();
    if (!content || !this.activeContactId) return;

    input.value = '';

    try {
      const res = await API.post('/messages', {
        recipient_id: this.activeContactId,
        content
      });
      this.messages.push(res.data);
      this.renderConversation();
      this.scrollToBottom();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  scrollToBottom() {
    const body = document.getElementById('msgChatBody');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }
};

window.PageMessages = PageMessages;
