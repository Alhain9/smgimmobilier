const PageCalendar = {
  register() { Router.register('calendar', () => this.render()); },
  current: new Date(), events: [], calendars: [], selectedOwner: '',
  async render() {
    Layout.setTitle('Calendrier');
    if (!this._loadedCalendars) {
      try { this.calendars = (await API.get('/calendar/calendars')).data; } catch { this.calendars = []; }
      this._loadedCalendars = true;
    }
    await this.loadEvents();
    this.draw();
  },
  async loadEvents() {
    const y = this.current.getFullYear(), m = this.current.getMonth();
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m + 2, 0).toISOString();
    let url = `/calendar?start=${start}&end=${end}`;
    if (this.selectedOwner && this.selectedOwner !== 'all') url += `&owner_id=${this.selectedOwner}`;
    try { this.events = (await API.get(url)).data; } catch { this.events = []; }
  },
  changeOwner(val) { this.selectedOwner = val; this.render(); },
  monthName() { return this.current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); },
  prev() { this.current = new Date(this.current.getFullYear(), this.current.getMonth() - 1, 1); this.render(); },
  next() { this.current = new Date(this.current.getFullYear(), this.current.getMonth() + 1, 1); this.render(); },
  today() { this.current = new Date(); this.render(); },
  selectorHtml() {
    if (!this.calendars || !this.calendars.length) return '';
    const opts = [
      `<option value="" ${!this.selectedOwner ? 'selected' : ''}>Mon calendrier</option>`,
      `<option value="all" ${this.selectedOwner === 'all' ? 'selected' : ''}>Tous les calendriers visibles</option>`,
      ...this.calendars.map((c) => `<option value="${c.id}" ${String(this.selectedOwner) === String(c.id) ? 'selected' : ''}>${c.full_name}</option>`),
    ].join('');
    return `<div class="form-group" style="max-width:280px;margin:0 0 16px">
      <label>Afficher</label>
      <select class="form-control" onchange="PageCalendar.changeOwner(this.value)">${opts}</select>
    </div>`;
  },
  draw() {
    const y = this.current.getFullYear(), m = this.current.getMonth();
    const startDay = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayStr = new Date().toDateString();
    const me = Auth.getUser();
    const dayNames = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    let cells = dayNames.map((d) => `<div class="cal-day-name">${d}</div>`).join('');
    for (let i = 0; i < startDay; i++) cells += '<div class="cal-cell other-month"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const isToday = date.toDateString() === todayStr;
      const dayEvents = this.events.filter((e) => new Date(e.start_datetime).toDateString() === date.toDateString());
      const evHtml = dayEvents.map((e) => {
        const isMine = me && e.created_by === me.id;
        const meetingTag = e.is_meeting ? '👥 ' : '';
        const ownerTag = (!isMine && e.creator) ? ` · ${e.creator.full_name.split(' ')[0]}` : '';
        const descSnippet = e.description ? `\n📝 ${e.description.slice(0, 120)}` : '';
        return `
          <div class="cal-event" style="background:var(--primary)" title="${e.title}${descSnippet}" onclick="event.stopPropagation();PageCalendar.viewEvent(${e.id})">
            <div style="font-weight:600;font-size:11.5px">${meetingTag}${e.title}${ownerTag}</div>
            ${e.description ? `<div style="font-size:10px;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.description}</div>` : ''}
          </div>
        `;
      }).join('');
      const iso = date.toISOString().slice(0, 10);
      cells += `<div class="cal-cell ${isToday ? 'today' : ''}" onclick="PageCalendar.addEvent('${iso}')"><div class="cal-date">${d}</div>${evHtml}</div>`;
    }
    Layout.content(`
      <div class="page-head"><div><h2>Calendrier & Agenda des Tâches</h2><div class="subtitle">Planification, tâches journalières, échéances et réunions d'équipe</div></div>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" onclick="PageCalendar.prev()">←</button>
          <button class="btn btn-outline btn-sm" onclick="PageCalendar.today()">Aujourd'hui</button>
          <button class="btn btn-outline btn-sm" onclick="PageCalendar.next()">→</button>
          <button class="btn btn-primary btn-sm" onclick="PageCalendar.addEvent()">+ Événement</button>
        </div></div>
      ${this.selectorHtml()}
      <div class="card"><div class="card-header"><h3 style="text-transform:capitalize">${this.monthName()}</h3></div>
        <div class="card-body"><div class="calendar-grid">${cells}</div></div></div>`);
  },
  addEvent(date = '') {
    this._participantOptions = null;
    Modal.open('Nouvel événement / Tâche', `
      <div class="form-group"><label>Titre de l'événement ou de la tâche *</label><input class="form-control" id="evTitle" required placeholder="ex: Visite de chantier Douala, Point financier Bastos..."/></div>
      <div class="form-group">
        <label>Description / Détails de la tâche</label>
        <textarea class="form-control" id="evDescription" rows="3" placeholder="Décrivez la tâche de la journée, les consignes, objectifs ou matériels nécessaires..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Début</label><input type="datetime-local" class="form-control" id="evStart" value="${date ? date + 'T09:00' : ''}"/></div>
        <div class="form-group"><label>Fin</label><input type="datetime-local" class="form-control" id="evEnd"/></div>
      </div>
      <div class="form-group">
        <label class="flex items-center gap-2" style="cursor:pointer;font-weight:400">
          <input type="checkbox" id="evMeeting" style="width:auto" onchange="PageCalendar.toggleMeeting(this.checked)"/> Réunion / événement partagé
        </label>
      </div>
      <div id="evParticipants" style="display:none">
        <div class="flex items-center gap-2" style="justify-content:space-between;margin-bottom:8px">
          <label style="margin:0">Participants</label>
          <button type="button" class="btn btn-sm btn-outline" onclick="PageCalendar.selectAllParticipants()">Tout le personnel</button>
        </div>
        <div id="evParticipantsList" style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px"></div>
      </div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageCalendar.submitEvent()">Créer</button>`);
  },
  async toggleMeeting(checked) {
    const box = document.getElementById('evParticipants');
    box.style.display = checked ? '' : 'none';
    if (checked && !this._participantOptions) {
      try { this._participantOptions = (await API.get('/calendar/participant-options')).data; } catch { this._participantOptions = []; }
      const list = document.getElementById('evParticipantsList');
      list.innerHTML = this._participantOptions.map((u) => `
        <label class="flex items-center gap-2" style="cursor:pointer;font-weight:400;padding:2px 0">
          <input type="checkbox" class="ev-participant" value="${u.id}" style="width:auto"/> ${u.full_name}
        </label>`).join('') || '<div class="text-muted">Aucun autre utilisateur</div>';
    }
  },
  selectAllParticipants() {
    document.querySelectorAll('.ev-participant').forEach((cb) => { cb.checked = true; });
  },
  async submitEvent() {
    const isMeeting = document.getElementById('evMeeting').checked;
    const desc = document.getElementById('evDescription')?.value?.trim() || null;
    const payload = {
      title: document.getElementById('evTitle').value,
      description: desc,
      start_datetime: document.getElementById('evStart').value,
      end_datetime: document.getElementById('evEnd').value || null,
      is_meeting: isMeeting,
    };
    if (isMeeting) {
      payload.participant_ids = [...document.querySelectorAll('.ev-participant:checked')].map((cb) => Number(cb.value));
    }
    try {
      await API.post('/calendar', payload);
      Modal.close(); Toast.success('Événement créé avec succès'); PageCalendar.render();
    } catch (e) { Toast.error(e.message); }
  },
  viewEvent(id) {
    const e = this.events.find((x) => x.id === id);
    if (!e) return;
    const me = Auth.getUser();
    const isMine = me && e.created_by === me.id;
    // Seul le manager et super_admin ont le droit de supprimer
    const canDelete = Auth.hasRole('manager', 'super_admin');
    const rows = [];

    if (e.description) {
      rows.push(`
        <div style="background:var(--bg-surface-2);border-left:4px solid var(--primary);padding:12px 14px;border-radius:4px;margin-bottom:14px">
          <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:4px">📝 Description / Consignes de la tâche</div>
          <div style="white-space:pre-wrap;font-size:13.5px;color:var(--text);line-height:1.45">${e.description}</div>
        </div>
      `);
    }

    rows.push(
      `<div class="list-item"><div style="flex:1">Début</div><b>${Helpers.formatDateTime(e.start_datetime)}</b></div>`,
      `<div class="list-item"><div style="flex:1">Fin</div><b>${e.end_datetime ? Helpers.formatDateTime(e.end_datetime) : '—'}</b></div>`
    );

    if (!isMine && e.creator) rows.push(`<div class="list-item"><div style="flex:1">Organisateur</div><b>${e.creator.full_name}</b></div>`);
    if (e.is_meeting) {
      const names = (e.participants || []).map((p) => p.full_name).join(', ') || '—';
      rows.push(`<div class="list-item"><div style="flex:1">👥 Participants</div><b>${names}</b></div>`);
    }
    const footer = canDelete
      ? `<button class="btn btn-danger" onclick="PageCalendar.deleteEvent(${id})">Supprimer</button><button class="btn btn-outline" onclick="Modal.close()">Fermer</button>`
      : `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>`;
    Modal.open((e.is_meeting ? '👥 ' : '') + e.title, rows.join(''), footer);
  },
  async deleteEvent(id) {
    if (!Auth.hasRole('manager', 'super_admin')) {
      Toast.error('Seul le Manager a le droit de supprimer un événement.');
      return;
    }
    if (!confirm('Voulez-vous vraiment supprimer cet événement ?')) return;
    try {
      await API.delete('/calendar/' + id);
      Modal.close();
      Toast.success('Événement supprimé');
      PageCalendar.render();
    } catch (e) {
      Toast.error(e.message);
    }
  },
};
