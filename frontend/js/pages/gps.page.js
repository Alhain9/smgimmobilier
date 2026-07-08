// ============ Page Géolocalisation (GPS Tracking) ============
const PageGps = {
  positions: [],

  register() {
    Router.register('gps', () => this.render());

    // Écouter les mises à jour de position en temps réel
    if (typeof SocketClient !== 'undefined') {
      SocketClient.on('gps:position', (data) => {
        // Mettre à jour la liste des positions
        const idx = this.positions.findIndex(p => p.user_id === data.userId);
        if (idx !== -1) {
          this.positions[idx].latitude = data.latitude;
          this.positions[idx].longitude = data.longitude;
          this.positions[idx].recorded_at = data.recorded_at;
        } else {
          this.positions.push({
            user_id: data.userId,
            latitude: data.latitude,
            longitude: data.longitude,
            recorded_at: data.recorded_at,
            user: { full_name: 'Agent terrain' } // placeholder temporaire avant re-fetch
          });
        }
        
        const activePage = window.location.hash.replace('#', '') || 'dashboard';
        if (activePage === 'gps') {
          this.renderList();
        }
      });
    }
  },

  async render() {
    Layout.setTitle('Géolocalisation');
    Layout.content('<div class="spinner"></div>');

    try {
      const res = await API.get('/gps/latest');
      this.positions = res.data || [];
      this.renderList();
    } catch (err) {
      Layout.content(`<div class="alert alert-danger">${err.message}</div>`);
    }
  },

  renderList() {
    const rows = this.positions.map(p => `
      <tr>
        <td><strong>${p.user?.full_name || 'Agent Terrain'}</strong></td>
        <td><code>${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}</code></td>
        <td>${new Date(p.recorded_at).toLocaleString('fr-FR')}</td>
        <td>
          <a class="btn btn-sm btn-outline" href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}" target="_blank" rel="noopener">🌍 Voir sur Maps</a>
        </td>
      </tr>
    `).join('');

    Layout.content(`
      <div class="page-head" style="margin-bottom:20px;">
        <div>
          <h2>Géolocalisation des agents</h2>
          <div class="subtitle">Position en direct et suivi des déplacements terrain</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr; gap:20px;">
        <div class="card" style="padding:20px; text-align:center; background:#EBF4FA; border:1px dashed var(--accent);">
          <div style="font-size:32px; margin-bottom:10px;">📍</div>
          <h3>Suivi en Temps Réel Actif</h3>
          <p style="color:#666; max-width:600px; margin:5px auto 15px auto;">Les positions des agents terrain se mettent à jour automatiquement sur cette page dès qu'un signal GPS est émis.</p>
        </div>

        <div class="card">
          <div class="card-header">👥 Dernières positions signalées (24h)</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Coordonnées</th>
                  <th>Dernier signalement</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>${rows || '<tr><td colspan="4" class="text-center">Aucune position signalée récemment</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  }
};

window.PageGps = PageGps;
