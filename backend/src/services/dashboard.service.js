const {
  Property, Apartment, Tenant, Lease, Payment, Maintenance, Expense, Task, User, Role,
  Upload, Salary, Equipment, CalendarEvent, CalendarEventParticipant,
} = require('../models');
const { Op, fn, col, where } = require('sequelize');
const calendarService = require('./calendar.service');

// Secteurs d'activité affichés sur le dashboard, et rôles autorisés à les consulter
const SECTORS = {
  patrimoine: { label: 'Patrimoine', icon: '🏢', roles: ['super_admin', 'manager', 'dir_admin', 'gestionnaire'] },
  finances: { label: 'Finances', icon: '💰', roles: ['super_admin', 'manager', 'dir_admin', 'comptable'] },
  technique: { label: 'Technique', icon: '🔧', roles: ['super_admin', 'manager', 'dir_technique', 'gestionnaire'] },
  rh: { label: 'Ressources humaines', icon: '👥', roles: ['super_admin', 'manager', 'comptable'] },
  taches: { label: 'Tâches & agenda', icon: '✅', roles: ['super_admin', 'manager', 'dir_admin', 'dir_technique', 'gestionnaire', 'comptable'] },
};

class DashboardService {
  _hasAccess(role, sectorKey) {
    const sector = SECTORS[sectorKey];
    if (!sector) return false;
    return role === 'super_admin' || sector.roles.includes(role);
  }

  // ===== Secteur Patrimoine : immeubles, logements, occupation, baux =====
  async _patrimoine() {
    const [properties, apartments, occupied, free, maintenanceApts, reservedApts, tenants, activeLeases] = await Promise.all([
      Property.count(), Apartment.count(),
      Apartment.count({ where: { status: 'occupied' } }),
      Apartment.count({ where: { status: 'free' } }),
      Apartment.count({ where: { status: 'maintenance' } }),
      Apartment.count({ where: { status: 'reserved' } }),
      Tenant.count(), Lease.count({ where: { status: 'active' } }),
    ]);
    const occupancyRate = apartments > 0 ? Math.round((occupied / apartments) * 100) : 0;
    return { properties, apartments, occupied, free, maintenanceApts, reservedApts, occupancyRate, tenants, activeLeases };
  }

  // ===== Secteur Finances : revenus, impayés, paiements par méthode =====
  async _finances() {
    const [revenue, unpaid, awaiting, expenses, awaitingCount, pendingCount] = await Promise.all([
      Payment.sum('amount', { where: { status: 'completed' } }),
      Payment.sum('amount', { where: { status: { [Op.in]: ['pending', 'failed'] } } }),
      Payment.sum('amount', { where: { status: 'awaiting_confirmation' } }),
      Expense.sum('total_price'),
      Payment.count({ where: { status: 'awaiting_confirmation' } }),
      Payment.count({ where: { status: { [Op.in]: ['pending', 'failed'] } } }),
    ]);
    const byMethodRows = await Payment.findAll({
      attributes: ['payment_method', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
      where: { status: 'completed' }, group: ['payment_method'], raw: true,
    });
    const byMethod = byMethodRows.map((r) => ({ method: r.payment_method, total: +r.total, count: +r.count }));
    return {
      revenue: +revenue || 0, unpaid: +unpaid || 0, awaiting: +awaiting || 0, expenses: +expenses || 0,
      byMethod, awaitingCount, pendingCount,
    };
  }

  // ===== Secteur Technique : maintenances, équipements, dépenses =====
  async _technique() {
    const [reported, validated, ongoing, completed, cancelled, equipment] = await Promise.all([
      Maintenance.count({ where: { status: 'reported' } }),
      Maintenance.count({ where: { status: 'validated' } }),
      Maintenance.count({ where: { status: 'in_progress' } }),
      Maintenance.count({ where: { status: 'completed' } }),
      Maintenance.count({ where: { status: 'cancelled' } }),
      Equipment.count(),
    ]);
    const expensesTotal = await Expense.sum('total_price') || 0;
    const byCategoryRows = await Expense.findAll({
      attributes: ['category', [fn('SUM', col('total_price')), 'total']],
      group: ['category'], raw: true,
    });
    const byCategory = byCategoryRows.map((r) => ({ category: r.category || 'Autre', total: +r.total }));
    return {
      maintenances: { reported, validated, ongoing, completed, cancelled, active: reported + validated + ongoing },
      equipment, expensesTotal: +expensesTotal, byCategory,
    };
  }

  // ===== Secteur RH : salaires payés / à payer par employé =====
  async _rh() {
    const salaries = await Salary.findAll({ include: [{ model: User, as: 'employee', attributes: ['id', 'full_name'] }] });
    let salariesPaid = 0, salariesPending = 0;
    const byEmployee = {};
    salaries.forEach((s) => {
      const id = s.user_id;
      if (!byEmployee[id]) byEmployee[id] = { user_id: id, full_name: s.employee ? s.employee.full_name : '—', paid: 0, pending: 0, proof: null, paidDate: null };
      const amount = +s.net_salary || 0;
      if (s.status === 'paid') {
        salariesPaid += amount; byEmployee[id].paid += amount;
        // Conserve la preuve du paiement le plus récent
        if (s.proof_photo && (!byEmployee[id].paidDate || (s.paid_date && s.paid_date > byEmployee[id].paidDate))) {
          byEmployee[id].proof = s.proof_photo; byEmployee[id].paidDate = s.paid_date;
        }
      } else { salariesPending += amount; byEmployee[id].pending += amount; }
    });
    return { salariesPaid, salariesPending, byEmployee: Object.values(byEmployee) };
  }

  // ===== Secteur Tâches & agenda : tâches par statut, événements à venir =====
  async _taches() {
    const [pending, inProgress, completed, cancelled] = await Promise.all([
      Task.count({ where: { status: 'pending' } }),
      Task.count({ where: { status: 'in_progress' } }),
      Task.count({ where: { status: 'completed' } }),
      Task.count({ where: { status: 'cancelled' } }),
    ]);
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = await CalendarEvent.findAll({
      where: { start_datetime: { [Op.between]: [now, in7days] } },
      include: [{ model: User, as: 'creator', attributes: ['id', 'full_name'] }],
      order: [['start_datetime', 'ASC']], limit: 10,
    });
    return {
      tasks: { pending, inProgress, completed, cancelled, active: pending + inProgress },
      upcomingEvents: upcoming.map((e) => ({
        id: e.id, title: e.title, start_datetime: e.start_datetime, is_meeting: e.is_meeting,
        creator: e.creator ? e.creator.full_name : null,
      })),
    };
  }

  constructor() {
    this._statsCache = null;
    this._statsCacheTime = 0;
    this.CACHE_DURATION = 60000; // 1 minute in ms
  }

  invalidateCache() {
    this._statsCache = null;
    this._statsCacheTime = 0;
  }

  // Statistiques globales (manager / super_admin) — format inchangé pour compat. UI existante
  async getStats() {
    if (this._statsCache && (Date.now() - this._statsCacheTime < this.CACHE_DURATION)) {
      return this._statsCache;
    }

    const [patrimoine, finances, technique, rh, taches, users, documents] = await Promise.all([
      this._patrimoine(), this._finances(), this._technique(), this._rh(), this._taches(),
      User.count(), Upload.count(),
    ]);
    const totalCharges = finances.expenses + rh.salariesPaid;
    const stats = {
      properties: patrimoine.properties, apartments: patrimoine.apartments, occupied: patrimoine.occupied, free: patrimoine.free,
      maintenanceApts: patrimoine.maintenanceApts, reservedApts: patrimoine.reservedApts, occupancyRate: patrimoine.occupancyRate,
      tenants: patrimoine.tenants, activeLeases: patrimoine.activeLeases, users, documents,
      equipment: technique.equipment, tasksOpen: taches.tasks.active,
      maintenances: {
        pending: technique.maintenances.reported, validated: technique.maintenances.validated,
        ongoing: technique.maintenances.ongoing, completed: technique.maintenances.completed,
        active: technique.maintenances.active,
      },
      finance: {
        revenue: finances.revenue, unpaid: finances.unpaid, expenses: finances.expenses,
        salariesPaid: rh.salariesPaid, salariesPending: rh.salariesPending,
        charges: totalCharges, balance: finances.revenue - totalCharges,
      },
      generatedAt: new Date().toISOString(),
    };

    this._statsCache = stats;
    this._statsCacheTime = Date.now();
    return stats;
  }

  // Borne datetime [start 00:00:00 ; end 23:59:59] pour comparer dates ET datetimes
  _range(start, end) {
    return [`${start} 00:00:00`, `${end} 23:59:59`];
  }

  // ===== Statistiques agrégées sur une plage de dates =====
  async getPeriodStats(start, end) {
    const range = this._range(start, end);
    const [revenue, expenses, salariesPaid, paymentsCount, newTenants, newLeases, maintenanceOpened, maintenanceCompleted, apartments, occupied] = await Promise.all([
      Payment.sum('amount', { where: { status: 'completed', payment_date: { [Op.between]: range } } }),
      Expense.sum('total_price', { where: { created_at: { [Op.between]: range } } }),
      Salary.sum('net_salary', { where: { status: 'paid', paid_date: { [Op.between]: range } } }),
      Payment.count({ where: { status: 'completed', payment_date: { [Op.between]: range } } }),
      Tenant.count({ where: { created_at: { [Op.between]: range } } }),
      Lease.count({ where: { start_date: { [Op.between]: range } } }),
      Maintenance.count({ where: { created_at: { [Op.between]: range } } }),
      Maintenance.count({ where: { completed_at: { [Op.between]: range } } }),
      Apartment.count(),
      Apartment.count({ where: { status: 'occupied' } }),
    ]);
    const rev = +revenue || 0, exp = +expenses || 0, sal = +salariesPaid || 0;
    return {
      start, end,
      revenue: rev, expenses: exp, salaries: sal,
      charges: exp + sal, balance: rev - exp - sal,
      paymentsCount, newTenants, newLeases, maintenanceOpened, maintenanceCompleted,
      occupancyRate: apartments > 0 ? Math.round((occupied / apartments) * 100) : 0,
    };
  }

  // ===== Série temporelle revenus vs dépenses (granularité auto) =====
  async getRevenueSeries(start, end) {
    const range = this._range(start, end);
    const paymentDateFn = fn('DATE_FORMAT', col('payment_date'), '%Y-%m-%d');
    const createdDateFn = fn('DATE_FORMAT', col('created_at'), '%Y-%m-%d');

    const [revRows, expRows] = await Promise.all([
      Payment.findAll({
        attributes: [[paymentDateFn, 'd'], [fn('SUM', col('amount')), 'total']],
        where: { status: 'completed', payment_date: { [Op.between]: range } }, group: ['d'], raw: true,
      }),
      Expense.findAll({
        attributes: [[createdDateFn, 'd'], [fn('SUM', col('total_price')), 'total']],
        where: { created_at: { [Op.between]: range } }, group: ['d'], raw: true,
      }),
    ]);
    const dayRev = {}; revRows.forEach((r) => { dayRev[r.d] = +r.total || 0; });
    const dayExp = {}; expRows.forEach((r) => { dayExp[r.d] = +r.total || 0; });

    const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dm = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const startD = new Date(`${start}T00:00:00`);
    const endD = new Date(`${end}T00:00:00`);
    const days = Math.round((endD - startD) / 86400000) + 1;
    const gran = days <= 31 ? 'day' : (days <= 180 ? 'week' : 'month');

    // Construit les tranches (buckets) selon la granularité
    const buckets = [];
    if (gran === 'month') {
      let cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
      while (cur <= endD) {
        buckets.push({ label: `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`, prefix: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}` });
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
    } else {
      const step = gran === 'week' ? 7 : 1;
      let cur = new Date(startD);
      while (cur <= endD) {
        const bEnd = new Date(cur); bEnd.setDate(bEnd.getDate() + step - 1);
        const realEnd = bEnd > endD ? endD : bEnd;
        buckets.push({ label: gran === 'week' ? `sem. ${dm(cur)}` : dm(cur), from: key(cur), to: key(realEnd) });
        cur = new Date(cur); cur.setDate(cur.getDate() + step);
      }
    }

    const sumIn = (map, b) => {
      let total = 0;
      for (const d of Object.keys(map)) {
        if (b.prefix ? d.slice(0, 7) === b.prefix : (d >= b.from && d <= b.to)) total += map[d];
      }
      return total;
    };
    return {
      granularity: gran,
      labels: buckets.map((b) => b.label),
      revenue: buckets.map((b) => sumIn(dayRev, b)),
      expenses: buckets.map((b) => sumIn(dayExp, b)),
    };
  }

  async getMonthlyRevenue() {
    const year = new Date().getFullYear();
    const monthFunc = fn('MONTH', col('payment_date'));
    const yearFunc = fn('YEAR', col('payment_date'));

    const rows = await Payment.findAll({
      attributes: [[monthFunc, 'month'], [fn('SUM', col('amount')), 'total']],
      where: { status: 'completed', [Op.and]: [where(yearFunc, year)] },
      group: [monthFunc], raw: true,
    });
    const months = Array(12).fill(0);
    rows.forEach((r) => { if (r.month) months[Math.round(r.month) - 1] = +r.total; });
    return months;
  }

  async getTechnicianStats(userId) {
    const [assigned, ongoing, completed] = await Promise.all([
      Maintenance.count({ where: { assigned_technician_id: userId } }),
      Maintenance.count({ where: { assigned_technician_id: userId, status: 'in_progress' } }),
      Maintenance.count({ where: { assigned_technician_id: userId, status: 'completed' } }),
    ]);
    const pendingTasks = await Task.count({ where: { assigned_to: userId, status: { [Op.notIn]: ['completed', 'cancelled'] } } });
    return { assigned, ongoing, completed, pendingTasks };
  }

  // ===== Productivité d'un employé (réalisations + taux de complétion) =====
  async getWorkerProductivity(userId, start, end) {
    const range = this._range(start, end);
    const [tasksCompleted, maintenancesCompleted, totalAssigned, totalCompleted] = await Promise.all([
      Task.count({ where: { assigned_to: userId, status: 'completed', updated_at: { [Op.between]: range } } }),
      Maintenance.count({ where: { assigned_technician_id: userId, status: 'completed', completed_at: { [Op.between]: range } } }),
      Task.count({ where: { assigned_to: userId } }),
      Task.count({ where: { assigned_to: userId, status: 'completed' } }),
    ]);
    return {
      tasksCompleted, maintenancesCompleted,
      tasksAssigned: totalAssigned, tasksCompletedAllTime: totalCompleted,
      completionRate: totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0,
    };
  }

  // ===== Activité d'un employé sur une journée (tâches groupées + événements) =====
  async _userDay(member, dayStart, dayEnd) {
    const startMs = new Date(dayStart).getTime();
    const endMs = new Date(dayEnd).getTime();
    const tasks = await Task.findAll({
      where: { assigned_to: member.id },
      include: [{ model: Maintenance, as: 'maintenance', attributes: ['id', 'title'] }],
      order: [['start_date', 'ASC']],
    });
    const todo = [], doing = [], doneToday = [];
    tasks.forEach((t) => {
      const item = {
        id: t.id, title: t.title, status: t.status, start_date: t.start_date, end_date: t.end_date,
        maintenance: t.maintenance ? { id: t.maintenance.id, title: t.maintenance.title } : null,
      };
      if (t.status === 'in_progress') doing.push(item);
      else if (t.status === 'pending') todo.push(item);
      else if (t.status === 'completed') {
        const u = new Date(t.updatedAt).getTime();
        if (u >= startMs && u <= endMs) doneToday.push(item);
      }
    });
    // Événements du jour : créés par le membre OU auxquels il participe
    const partRows = await CalendarEventParticipant.findAll({ where: { user_id: member.id }, attributes: ['event_id'] });
    const partIds = partRows.map((r) => r.event_id);
    const orConds = [{ created_by: member.id }];
    if (partIds.length) orConds.push({ id: { [Op.in]: partIds } });
    const events = await CalendarEvent.findAll({
      where: { [Op.and]: [{ start_datetime: { [Op.between]: [dayStart, dayEnd] } }, { [Op.or]: orConds }] },
      order: [['start_datetime', 'ASC']],
    });
    return {
      user: { id: member.id, full_name: member.full_name, role: member.role || null },
      todo, doing, doneToday,
      events: events.map((e) => ({ id: e.id, title: e.title, start_datetime: e.start_datetime, end_datetime: e.end_datetime, is_meeting: e.is_meeting })),
      counts: { todo: todo.length, doing: doing.length, done: doneToday.length, events: events.length },
    };
  }

  async getDayActivity(currentUser, dateStr, scope = 'me') {
    const date = dateStr || new Date().toISOString().slice(0, 10);
    const dayStart = `${date} 00:00:00`;
    const dayEnd = `${date} 23:59:59`;

    if (scope === 'team') {
      const ownerIds = await calendarService._visibleOwnerIds(currentUser);
      const users = await User.findAll({ where: { id: { [Op.in]: ownerIds } }, include: [{ model: Role, as: 'role' }] });
      const workers = users.filter((u) => (u.role ? u.role.code() : null) !== 'locataire');
      const members = [];
      for (const u of workers) {
        members.push(await this._userDay({ id: u.id, full_name: u.full_name, role: u.role ? u.role.code() : null }, dayStart, dayEnd));
      }
      // Tri : ceux qui ont le plus à faire / en cours d'abord
      members.sort((a, b) => (b.counts.doing + b.counts.todo) - (a.counts.doing + a.counts.todo));
      return { date, scope: 'team', members };
    }

    const day = await this._userDay({ id: currentUser.id, full_name: currentUser.full_name, role: currentUser.role }, dayStart, dayEnd);
    // Productivité personnelle (7 et 30 derniers jours)
    const today = new Date(`${date}T00:00:00`);
    const wk = new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    const mo = new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10);
    const [week, month] = await Promise.all([
      this.getWorkerProductivity(currentUser.id, wk, date),
      this.getWorkerProductivity(currentUser.id, mo, date),
    ]);
    return { date, scope: 'me', day, productivity: { week, month } };
  }

  // Résumé par secteur (cartes du dashboard), filtré selon les secteurs autorisés pour `role`
  async getSectorSummary(role) {
    const result = [];
    for (const key of Object.keys(SECTORS)) {
      if (!this._hasAccess(role, key)) continue;
      const def = SECTORS[key];
      result.push({ key, label: def.label, icon: def.icon, headline: await this._headline(key) });
    }
    return result;
  }

  async _headline(key) {
    switch (key) {
      case 'patrimoine': {
        const d = await this._patrimoine();
        return [
          { label: 'Immeubles', value: d.properties },
          { label: 'Logements libres', value: d.free },
          { label: "Taux d'occupation", value: d.occupancyRate + '%' },
        ];
      }
      case 'finances': {
        const d = await this._finances();
        return [
          { label: 'Revenus encaissés', value: d.revenue, money: true },
          { label: 'Impayés', value: d.unpaid, money: true },
          { label: 'Paiements à vérifier', value: d.awaitingCount },
        ];
      }
      case 'technique': {
        const d = await this._technique();
        return [
          { label: 'Maintenances actives', value: d.maintenances.active },
          { label: 'Signalées', value: d.maintenances.reported },
          { label: 'Équipements', value: d.equipment },
        ];
      }
      case 'rh': {
        const d = await this._rh();
        return [
          { label: 'Salaires payés', value: d.salariesPaid, money: true },
          { label: 'Salaires à payer', value: d.salariesPending, money: true },
          { label: 'Employés', value: d.byEmployee.length },
        ];
      }
      case 'taches': {
        const d = await this._taches();
        return [
          { label: 'Tâches actives', value: d.tasks.active },
          { label: 'Terminées', value: d.tasks.completed },
          { label: '7 prochains jours', value: d.upcomingEvents.length },
        ];
      }
      default: return [];
    }
  }

  // Détail complet d'un secteur (drill-down)
  async getSectorDetail(sector, role) {
    if (!SECTORS[sector]) throw Object.assign(new Error('Secteur inconnu'), { status: 404 });
    if (!this._hasAccess(role, sector)) throw Object.assign(new Error('Accès refusé à ce secteur'), { status: 403 });
    switch (sector) {
      case 'patrimoine': return this._patrimoine();
      case 'finances': return this._finances();
      case 'technique': return this._technique();
      case 'rh': return this._rh();
      case 'taches': return this._taches();
      default: return {};
    }
  }

  // ===== Synthèse par immeuble sur une période (start -> end) =====
  async getPropertiesBreakdown(start, end) {
    const range = this._range(start, end);
    const properties = await Property.findAll({
      include: [
        {
          model: Apartment,
          as: 'apartments',
          include: [
            { model: Tenant, as: 'tenants', where: { status: 'active' }, required: false },
          ]
        }
      ],
      order: [['property_name', 'ASC']]
    });

    const breakdown = [];

    for (const prop of properties) {
      const apts = prop.apartments || [];
      const aptIds = apts.map(a => a.id);
      const totalApartments = apts.length;
      const occupiedApartments = apts.filter(a => a.status === 'occupied').length;
      const occupancyRate = totalApartments > 0 ? Math.round((occupiedApartments / totalApartments) * 100) : 0;

      let revenue = 0;
      let unpaid = 0;
      let expenses = 0;
      let activeMaintenances = 0;

      if (aptIds.length) {
        const [revSum, unpSum, expSum, maintCount] = await Promise.all([
          Payment.sum('amount', { where: { apartment_id: aptIds, status: 'completed', payment_date: { [Op.between]: range } } }),
          Payment.sum('amount', { where: { apartment_id: aptIds, status: { [Op.in]: ['pending', 'failed'] } } }),
          Expense.sum('total_price', {
            where: { created_at: { [Op.between]: range } },
            include: [{ model: Maintenance, as: 'maintenance', where: { apartment_id: aptIds }, required: true }]
          }),
          Maintenance.count({ where: { apartment_id: aptIds, status: { [Op.in]: ['reported', 'validated', 'in_progress'] } } }),
        ]);
        revenue = +revSum || 0;
        unpaid = +unpSum || 0;
        expenses = +expSum || 0;
        activeMaintenances = +maintCount || 0;
      }

      breakdown.push({
        id: prop.id,
        property_name: prop.property_name,
        property_type: prop.property_type,
        city: prop.city,
        district: prop.district,
        totalApartments,
        occupiedApartments,
        occupancyRate,
        revenue,
        unpaid,
        expenses,
        balance: revenue - expenses,
        activeMaintenances,
      });
    }

    return { start, end, breakdown };
  }

  // ===== Détail d'un immeuble sur une période =====
  async getPropertyDetail(propertyId, start, end) {
    const range = this._range(start, end);
    const property = await Property.findByPk(propertyId, {
      include: [
        {
          model: Apartment,
          as: 'apartments',
          include: [
            {
              model: Tenant,
              as: 'tenants',
              where: { status: 'active' },
              required: false,
              include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] }]
            },
            {
              model: Lease,
              as: 'leases',
              where: { status: 'active' },
              required: false
            }
          ]
        }
      ]
    });

    if (!property) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });

    const apts = property.apartments || [];
    const aptIds = apts.map(a => a.id);

    let payments = [];
    let expenses = [];
    let maintenances = [];

    if (aptIds.length) {
      [payments, expenses, maintenances] = await Promise.all([
        Payment.findAll({
          where: { apartment_id: aptIds, payment_date: { [Op.between]: range } },
          include: [
            { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number'] },
            { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name'] }] }
          ],
          order: [['payment_date', 'DESC']],
          limit: 100
        }),
        Expense.findAll({
          include: [
            {
              model: Maintenance,
              as: 'maintenance',
              where: { apartment_id: aptIds },
              required: true,
              include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number'] }]
            }
          ],
          order: [['created_at', 'DESC']],
          limit: 100
        }),
        Maintenance.findAll({
          where: { apartment_id: aptIds },
          include: [
            { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number'] },
            { model: User, as: 'technician', attributes: ['id', 'full_name'] }
          ],
          order: [['created_at', 'DESC']],
          limit: 50
        })
      ]);
    }

    const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalUnpaid = payments.filter(p => ['pending', 'failed'].includes(p.status)).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.total_price || 0), 0);

    return {
      property,
      start,
      end,
      stats: {
        totalApartments: apts.length,
        occupiedApartments: apts.filter(a => a.status === 'occupied').length,
        revenue: totalRevenue,
        unpaid: totalUnpaid,
        expenses: totalExpenses,
        balance: totalRevenue - totalExpenses,
      },
      apartments: apts,
      payments,
      expenses,
      maintenances,
    };
  }

  // ===== Dashboard spécifique bailleur : vision limitée à ses propres biens =====
  async bailleurDashboard(userId) {
    // Récupérer les propriétés du bailleur
    const properties = await Property.findAll({
      where: { owner_id: userId },
      include: [{
        model: Apartment, as: 'apartments',
        attributes: ['id', 'apartment_number', 'rent_amount', 'status', 'apartment_type'],
        include: [{
          model: Tenant, as: 'tenants', required: false, where: { status: 'active' },
          include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }],
        }],
      }],
    });

    if (!properties.length) {
      return {
        patrimoine: { properties: 0, apartments: 0, occupied: 0, free: 0, occupancyRate: 0, tenants: 0 },
        finances: { revenue: 0, unpaid: 0, expenses: 0, balance: 0 },
        maintenances: { active: 0, completed: 0, total: 0 },
        properties: [],
      };
    }

    const propertyIds = properties.map((p) => p.id);
    const allApts = properties.flatMap((p) => p.apartments || []);
    const aptIds = allApts.map((a) => a.id);
    const occupied = allApts.filter((a) => a.status === 'occupied').length;

    // Finances : paiements liés aux appartements du bailleur
    const [payments, maintenances, expenses, directExpenses] = await Promise.all([
      Payment.findAll({ where: { apartment_id: { [Op.in]: aptIds } } }),
      Maintenance.findAll({ where: { apartment_id: { [Op.in]: aptIds } } }),
      Expense.findAll({
        where: { maintenance_id: { [Op.not]: null } },
        include: [{
          model: Maintenance, as: 'maintenance', required: true,
          where: { apartment_id: { [Op.in]: aptIds } },
          attributes: ['id', 'apartment_id'],
        }],
      }),
      // Dépenses directement rattachées à une propriété du bailleur
      Expense.findAll({ where: { property_id: { [Op.in]: propertyIds } } }),
    ]);

    const revenue = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const unpaid = payments.filter((p) => ['pending', 'failed', 'awaiting_confirmation'].includes(p.status)).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const totalExpenses = [...expenses, ...directExpenses].reduce((s, e) => s + parseFloat(e.total_price || 0), 0);

    const activeMaint = maintenances.filter((m) => ['reported', 'validated', 'in_progress'].includes(m.status)).length;
    const completedMaint = maintenances.filter((m) => m.status === 'completed').length;

    // Détail par immeuble
    const byProperty = properties.map((prop) => {
      const apts = prop.apartments || [];
      const aIds = apts.map((a) => a.id);
      const propPayments = payments.filter((p) => aIds.includes(p.apartment_id));
      const propRev = propPayments.filter((p) => p.status === 'completed').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const propUnpaid = propPayments.filter((p) => ['pending', 'failed', 'awaiting_confirmation'].includes(p.status)).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const propMaint = maintenances.filter((m) => aIds.includes(m.apartment_id));
      const loyerAttendu = apts.filter((a) => a.status === 'occupied').reduce((s, a) => s + parseFloat(a.rent_amount || 0), 0);

      return {
        id: prop.id,
        property_name: prop.property_name,
        address: prop.address,
        city: prop.city,
        apartments: apts.length,
        occupied: apts.filter((a) => a.status === 'occupied').length,
        free: apts.filter((a) => a.status === 'free').length,
        loyer_attendu: loyerAttendu,
        revenue: propRev,
        unpaid: propUnpaid,
        maintenances_active: propMaint.filter((m) => ['reported', 'validated', 'in_progress'].includes(m.status)).length,
        maintenances_completed: propMaint.filter((m) => m.status === 'completed').length,
      };
    });

    return {
      patrimoine: {
        properties: properties.length,
        apartments: allApts.length,
        occupied,
        free: allApts.filter((a) => a.status === 'free').length,
        occupancyRate: allApts.length > 0 ? Math.round((occupied / allApts.length) * 100) : 0,
        tenants: allApts.reduce((s, a) => s + ((a.tenants || []).length), 0),
      },
      finances: {
        revenue,
        unpaid,
        expenses: totalExpenses,
        balance: revenue - totalExpenses,
      },
      maintenances: { active: activeMaint, completed: completedMaint, total: maintenances.length },
      properties: byProperty,
    };
  }

  // ===== Échéances de loyer imminentes (J-10 à J-1 et retards) =====
  async getUpcomingRentDues(ownerPropertyIds = null) {
    const ledgerService = require('./ledger.service');
    const tenants = await Tenant.findAll({
      where: { status: 'active' },
      include: [
        { model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] },
        {
          model: Apartment, as: 'apartment',
          include: [{ model: Property, as: 'property', attributes: ['id', 'property_name', 'city'] }],
        },
        {
          model: Lease, as: 'leases',
          where: { status: 'active' },
          required: false,
        },
        {
          model: Payment, as: 'payments',
          attributes: ['id', 'amount', 'status', 'payment_date'],
        },
      ],
    });

    const dues = [];
    for (const t of tenants) {
      const o = t.toJSON();
      const apt = o.apartment;
      const prop = apt?.property;
      if (Array.isArray(ownerPropertyIds) && prop && !ownerPropertyIds.includes(Number(prop.id))) {
        continue;
      }

      const led = ledgerService.computeFromTenant(t);
      if (!led.prochaine_echeance) continue;

      // Filtrer : imminents (<= 10 jours) ou aujourd'hui (0) ou retards (< 0)
      if (led.jours_restants !== null && led.jours_restants <= 10) {
        dues.push({
          tenant_id: o.id,
          nom: o.user ? o.user.full_name : '—',
          telephone: o.user ? o.user.phone : null,
          logement: apt ? apt.apartment_number : '—',
          immeuble: prop ? prop.property_name : '—',
          property_id: prop ? prop.id : null,
          loyer_mensuel: led.loyer_mensuel,
          solde: led.solde,
          prochaine_echeance: led.prochaine_echeance,
          jours_restants: led.jours_restants,
          statut_echeance: led.statut_echeance,
          echeance_message: led.echeance_message,
        });
      }
    }

    // Trier par urgence : les retards d'abord, puis aujourd'hui, puis 1 jour, 4 jours, 7 jours, 10 jours
    dues.sort((a, b) => a.jours_restants - b.jours_restants);
    return dues;
  }
}
module.exports = new DashboardService();
