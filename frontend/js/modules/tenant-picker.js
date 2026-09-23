// ============ Module TenantPicker — SMG IMMOBILIER ============
// Sélecteur intelligent de locataire avec recherche instantanée,
// défilement fluide, affichage de l'immeuble/logement, et
// sélection automatique immédiate du logement associé.

const TenantPicker = {
  // Génère le code HTML du composant
  html(options = {}) {
    const {
      name = 'tenant_id',
      label = 'Locataire *',
      placeholder = '🔍 Rechercher un locataire (nom, tél, immeuble, logement)...',
      required = true,
      half = false,
    } = options;

    return `
      <div class="form-group ${half ? 'half' : ''} tenant-picker-wrap" style="position:relative;">
        <label for="tp_search_input" style="font-weight:600;display:flex;justify-content:space-between;align-items:center;">
          <span>${label}</span>
          <small class="text-muted" style="font-size:11px;font-weight:normal;">Tapez pour chercher ou défilez</small>
        </label>
        
        <div style="position:relative;display:flex;align-items:center;">
          <input 
            type="text" 
            id="tp_search_input" 
            class="form-control" 
            placeholder="${placeholder}" 
            autocomplete="off" 
            style="padding-right: 64px; font-size: 13.5px;"
            ${required ? 'required' : ''}
          />
          <input type="hidden" id="tp_hidden_id" name="${name}" value="" />
          
          <div style="position:absolute;right:8px;display:flex;align-items:center;gap:4px;">
            <button type="button" id="tp_clear_btn" style="display:none;background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px;" title="Effacer la sélection">✕</button>
            <button type="button" id="tp_toggle_btn" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:11px;padding:4px 6px;" title="Afficher la liste">▼</button>
          </div>
        </div>

        <!-- Menu déroulant avec défilement -->
        <div id="tp_dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:1060;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 12px 28px rgba(0,0,0,0.15);max-height:280px;overflow-y:auto;margin-top:4px;">
          <div id="tp_results_header" style="padding:6px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:#64748b;display:flex;justify-content:space-between;">
            <span id="tp_count">Chargement des locataires...</span>
            <span>SMG IMMOBILIER</span>
          </div>
          <div id="tp_list"></div>
        </div>

        <!-- Encart d'information sur le locataire sélectionné et son logement lié -->
        <div id="tp_selected_badge" style="display:none;margin-top:6px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:12.5px;color:#166534;">
          <div style="font-weight:700;display:flex;align-items:center;gap:6px;">
            <span>👤</span> <span id="tp_badge_name">—</span>
          </div>
          <div style="margin-top:2px;font-size:11.5px;color:#15803d;" id="tp_badge_details">
            🏢 Logement lié : —
          </div>
        </div>
      </div>
    `;
  },

  // Initialise le composant après insertion dans le DOM
  init(config = {}) {
    const {
      tenants = [],
      apartments = [],
      selectedTenantId = null,
      apartmentSelectId = null,
      rentInputId = null,
      onSelect = null,
    } = config;

    const searchInput = document.getElementById('tp_search_input');
    const hiddenInput = document.getElementById('tp_hidden_id');
    const dropdown = document.getElementById('tp_dropdown');
    const list = document.getElementById('tp_list');
    const countEl = document.getElementById('tp_count');
    const clearBtn = document.getElementById('tp_clear_btn');
    const toggleBtn = document.getElementById('tp_toggle_btn');
    const badge = document.getElementById('tp_selected_badge');
    const badgeName = document.getElementById('tp_badge_name');
    const badgeDetails = document.getElementById('tp_badge_details');
    const aptSelect = apartmentSelectId ? document.getElementById(apartmentSelectId) : null;
    const rentInput = rentInputId ? document.getElementById(rentInputId) : null;

    if (!searchInput || !hiddenInput) return;

    let allTenants = [...tenants];
    let selectedTenant = null;
    let activeIndex = -1;

    // Helper pour extraire les infos du locataire
    function getTenantMeta(t) {
      const name = t.full_name || t.user?.full_name || `Locataire #${t.id}`;
      const phone = t.phone || t.user?.phone || '';
      
      // Immeuble et logement
      let propertyName = t.property_name || t.apartment?.property?.property_name || '';
      let apartmentNumber = t.apartment?.apartment_number || '';
      let apartmentType = t.apartment?.apartment_type || '';
      let aptId = t.apartment_id || t.apartment?.id || null;
      let monthlyRent = 0;

      // Chercher dans les baux actifs si pas direct
      if (Array.isArray(t.leases) && t.leases.length) {
        const activeLease = t.leases.find(l => l.status === 'active') || t.leases[0];
        if (activeLease) {
          if (!aptId && activeLease.apartment_id) aptId = activeLease.apartment_id;
          if (activeLease.monthly_rent) monthlyRent = parseFloat(activeLease.monthly_rent);
          if (activeLease.apartment) {
            if (!apartmentNumber) apartmentNumber = activeLease.apartment.apartment_number;
            if (!apartmentType) apartmentType = activeLease.apartment.apartment_type;
            if (!propertyName && activeLease.apartment.property) {
              propertyName = activeLease.apartment.property.property_name;
            }
          }
        }
      }

      if (!monthlyRent && t.apartment?.rent_amount) {
        monthlyRent = parseFloat(t.apartment.rent_amount);
      }

      // Si l'immeuble ou le logement manque, tenter de retrouver l'appartement dans apartments[]
      if (aptId && (!propertyName || !apartmentNumber) && Array.isArray(apartments)) {
        const matchingApt = apartments.find(a => String(a.id) === String(aptId));
        if (matchingApt) {
          if (!apartmentNumber) apartmentNumber = matchingApt.apartment_number;
          if (!apartmentType) apartmentType = matchingApt.apartment_type;
          if (!propertyName && matchingApt.property) propertyName = matchingApt.property.property_name;
          if (!monthlyRent && matchingApt.rent_amount) monthlyRent = parseFloat(matchingApt.rent_amount);
        }
      }

      return {
        id: t.id,
        name,
        phone,
        aptId,
        propertyName,
        apartmentNumber,
        apartmentType,
        monthlyRent,
        hasApartment: !!aptId,
      };
    }

    // Rendu de la liste avec filtre
    function renderList(query = '') {
      const q = query.trim().toLowerCase();
      let filtered = allTenants;

      if (q) {
        filtered = allTenants.filter(t => {
          const meta = getTenantMeta(t);
          return (
            meta.name.toLowerCase().includes(q) ||
            meta.phone.toLowerCase().includes(q) ||
            meta.propertyName.toLowerCase().includes(q) ||
            meta.apartmentNumber.toLowerCase().includes(q) ||
            meta.apartmentType.toLowerCase().includes(q)
          );
        });
      }

      countEl.textContent = `${filtered.length} locataire(s) ${q ? 'trouvé(s)' : 'au total'}`;

      if (filtered.length === 0) {
        list.innerHTML = `
          <div style="padding:16px;text-align:center;color:#64748b;font-size:13px;">
            Aucun locataire correspondant à « <b>${Helpers.escapeHtml(query)}</b> »
          </div>
        `;
        return;
      }

      list.innerHTML = filtered.map((t, idx) => {
        const meta = getTenantMeta(t);
        const isCurrent = selectedTenant && selectedTenant.id === t.id;
        return `
          <div 
            class="tp-item" 
            data-index="${idx}" 
            data-id="${t.id}"
            style="padding:10px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background 0.15s;${isCurrent ? 'background:#ecfdf5;' : ''}"
            onmouseover="this.style.background='#f8fafc'"
            onmouseout="this.style.background='${isCurrent ? '#ecfdf5' : '#ffffff'}'"
          >
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="font-weight:700;font-size:13.5px;color:#0f172a;">
                👤 ${Helpers.escapeHtml(meta.name)}
              </div>
              ${meta.hasApartment ? `
                <span class="badge badge-success" style="font-size:11px;padding:2px 6px;">
                  Logement ${Helpers.escapeHtml(meta.apartmentNumber)}
                </span>
              ` : `
                <span class="badge badge-warning" style="font-size:11px;padding:2px 6px;">
                  Sans logement
                </span>
              `}
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px;font-size:12px;color:#475569;">
              <div>
                🏢 <b>${Helpers.escapeHtml(meta.propertyName || 'Immeuble non renseigné')}</b>
                ${meta.apartmentType ? ` · <span class="text-muted">${meta.apartmentType}</span>` : ''}
              </div>
              <div style="font-size:11.5px;color:#0284c7;font-weight:600;">
                ${meta.monthlyRent > 0 ? `${Helpers.formatMoney(meta.monthlyRent)}/mois` : ''}
                ${meta.phone ? ` · 📞 ${meta.phone}` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Attacher l'événement de clic sur chaque élément
      list.querySelectorAll('.tp-item').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
          const tId = itemEl.getAttribute('data-id');
          const chosen = allTenants.find(t => String(t.id) === String(tId));
          if (chosen) selectTenant(chosen);
        });
      });
    }

    // Sélection d'un locataire
    function selectTenant(tenant) {
      selectedTenant = tenant;
      const meta = getTenantMeta(tenant);

      hiddenInput.value = meta.id;
      searchInput.value = meta.name;
      clearBtn.style.display = 'block';
      dropdown.style.display = 'none';

      // Afficher le badge récapitulatif
      badge.style.display = 'block';
      badgeName.textContent = meta.name;
      
      if (meta.hasApartment) {
        badgeDetails.innerHTML = `
          🏢 <b>${Helpers.escapeHtml(meta.propertyName || 'Immeuble')}</b> · Logement <b>${Helpers.escapeHtml(meta.apartmentNumber)}</b>
          ${meta.monthlyRent > 0 ? ` · Loyer : <b>${Helpers.formatMoney(meta.monthlyRent)}</b>` : ''}
          ${meta.phone ? ` · 📞 ${meta.phone}` : ''}
        `;
      } else {
        badgeDetails.innerHTML = `<span style="color:#b45309;">⚠️ Aucun logement n'est actuellement assigné à ce locataire dans le système.</span>`;
      }

      // =========================================================================
      // AUTO-SÉLECTION IMMÉDIATE DU LOGEMENT DE CE LOCATAIRE DANS LE FORMULAIRE !
      // =========================================================================
      if (aptSelect && meta.aptId) {
        aptSelect.value = String(meta.aptId);
        // Émettre un événement change pour déclencher d'éventuels listeners
        aptSelect.dispatchEvent(new Event('change', { bubbles: true }));

        // Indicateur visuel temporaire sur le champ logement
        const oldBorder = aptSelect.style.borderColor;
        aptSelect.style.borderColor = '#16a34a';
        aptSelect.style.boxShadow = '0 0 0 2px rgba(22, 163, 74, 0.2)';
        setTimeout(() => {
          aptSelect.style.borderColor = oldBorder;
          aptSelect.style.boxShadow = '';
        }, 1500);
      }

      // =========================================================================
      // PRÉ-REMPLISSAGE DU MONTANT DU LOYER SI VIDE OU 0
      // =========================================================================
      if (rentInput && meta.monthlyRent > 0) {
        const currentVal = parseFloat(rentInput.value || 0);
        if (!currentVal || currentVal === 0) {
          rentInput.value = meta.monthlyRent;
          rentInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      if (typeof onSelect === 'function') {
        onSelect(tenant, meta);
      }
    }

    // Réinitialisation de la sélection
    function clearSelection() {
      selectedTenant = null;
      hiddenInput.value = '';
      searchInput.value = '';
      clearBtn.style.display = 'none';
      badge.style.display = 'none';
      renderList('');
      searchInput.focus();
    }

    // Événements
    searchInput.addEventListener('focus', () => {
      renderList(searchInput.value);
      dropdown.style.display = 'block';
    });

    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'block' : 'none';
      hiddenInput.value = ''; // Réinitialiser l'ID tant qu'on n'a pas sélectionné un élément précis
      badge.style.display = 'none';
      renderList(searchInput.value);
      dropdown.style.display = 'block';
    });

    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSelection();
    });

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
      } else {
        renderList('');
        dropdown.style.display = 'block';
        searchInput.focus();
      }
    });

    // Fermeture si clic à l'extérieur
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
        dropdown.style.display = 'none';
        // Si l'utilisateur a tapé du texte sans sélectionner, remettre le texte du locataire choisi ou vider
        if (selectedTenant) {
          searchInput.value = getTenantMeta(selectedTenant).name;
          clearBtn.style.display = 'block';
        } else if (!hiddenInput.value) {
          searchInput.value = '';
          clearBtn.style.display = 'none';
        }
      }
    });

    // Navigation au clavier (Entrée pour valider le premier résultat)
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstItem = list.querySelector('.tp-item');
        if (firstItem) {
          firstItem.click();
        }
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      }
    });

    // Si un tenant initial est passé (ex: mode modification)
    if (selectedTenantId) {
      const initial = allTenants.find(t => String(t.id) === String(selectedTenantId));
      if (initial) {
        selectTenant(initial);
      }
    }
  },
};

window.TenantPicker = TenantPicker;

