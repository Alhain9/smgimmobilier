// ============ Data Transfer Objects — formatage et masquage des données sortantes ============

/**
 * Supprime les champs sensibles d'un objet (mot de passe, token, etc.)
 */
const stripSensitive = (obj, extraFields = []) => {
  if (!obj) return obj;
  const o = typeof obj.toJSON === 'function' ? obj.toJSON() : { ...obj };
  const remove = ['password', 'password_hash', 'token_hash', 'deleted_at', ...extraFields];
  remove.forEach((f) => delete o[f]);
  return o;
};

// ===== USER DTO =====
const userDTO = (user) => {
  if (!user) return null;
  const u = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone || null,
    avatar: u.avatar || null,
    role_id: u.role_id,
    role: u.role ? { id: u.role.id, name: u.role.name, code: typeof u.role.code === 'function' ? u.role.code() : u.role.role_name } : null,
    status: u.status,
    can_manage_users: !!u.can_manage_users,
    can_view_all_calendars: !!u.can_view_all_calendars,
    can_manage_utilities: !!u.can_manage_utilities,
    can_manage_worksites: !!u.can_manage_worksites,
    can_delete_worksites: !!u.can_delete_worksites,
    can_manage_stock: !!u.can_manage_stock,
    can_delete_stock: !!u.can_delete_stock,
    can_manage_documents: !!u.can_manage_documents,
    can_manage_expenses: !!u.can_manage_expenses,
    created_at: u.created_at || u.createdAt,
    updated_at: u.updated_at || u.updatedAt,
  };
};

// ===== TENANT DTO =====
const tenantDTO = (tenant) => {
  if (!tenant) return null;
  const t = typeof tenant.toJSON === 'function' ? tenant.toJSON() : { ...tenant };
  return {
    id: t.id,
    user_id: t.user_id,
    apartment_id: t.apartment_id,
    national_id: t.national_id,
    profession: t.profession,
    status: t.status,
    emergency_contact: t.emergency_contact || null,
    emergency_phone: t.emergency_phone || null,
    user: t.user ? { id: t.user.id, full_name: t.user.full_name, email: t.user.email, phone: t.user.phone } : null,
    apartment: t.apartment ? {
      id: t.apartment.id,
      apartment_number: t.apartment.apartment_number,
      rent_amount: t.apartment.rent_amount,
      property: t.apartment.property ? { id: t.apartment.property.id, property_name: t.apartment.property.property_name } : null,
    } : null,
    created_at: t.created_at || t.createdAt,
  };
};

// ===== PAYMENT DTO =====
const paymentDTO = (payment) => {
  if (!payment) return null;
  const p = typeof payment.toJSON === 'function' ? payment.toJSON() : { ...payment };
  return {
    id: p.id,
    tenant_id: p.tenant_id,
    apartment_id: p.apartment_id,
    amount: parseFloat(p.amount) || 0,
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    status: p.status,
    reference: p.reference,
    proof_photo: p.proof_photo || null,
    notes: p.notes || null,
    period_month: p.period_month,
    period_year: p.period_year,
    created_by: p.created_by,
    campay_reference: p.campay_reference || null,
    tenant: p.tenant ? {
      id: p.tenant.id,
      user: p.tenant.user ? { id: p.tenant.user.id, full_name: p.tenant.user.full_name, phone: p.tenant.user.phone } : null,
    } : null,
    apartment: p.apartment ? {
      id: p.apartment.id,
      apartment_number: p.apartment.apartment_number,
      property: p.apartment.property ? { id: p.apartment.property.id, property_name: p.apartment.property.property_name } : null,
    } : null,
    declarant: p.declarant ? { id: p.declarant.id, full_name: p.declarant.full_name } : null,
    created_at: p.created_at || p.createdAt,
    updated_at: p.updated_at || p.updatedAt,
  };
};

// ===== LEASE DTO =====
const leaseDTO = (lease) => {
  if (!lease) return null;
  const l = typeof lease.toJSON === 'function' ? lease.toJSON() : { ...lease };
  return {
    id: l.id,
    tenant_id: l.tenant_id,
    apartment_id: l.apartment_id,
    start_date: l.start_date,
    end_date: l.end_date,
    monthly_rent: parseFloat(l.monthly_rent) || 0,
    deposit_amount: parseFloat(l.deposit_amount) || 0,
    status: l.status,
    terms: l.terms || null,
    tenant: l.tenant ? {
      id: l.tenant.id,
      user: l.tenant.user ? { id: l.tenant.user.id, full_name: l.tenant.user.full_name } : null,
    } : null,
    apartment: l.apartment ? {
      id: l.apartment.id,
      apartment_number: l.apartment.apartment_number,
      property: l.apartment.property ? { id: l.apartment.property.id, property_name: l.apartment.property.property_name } : null,
    } : null,
    created_at: l.created_at || l.createdAt,
  };
};

// ===== PROPERTY DTO =====
const propertyDTO = (property) => {
  if (!property) return null;
  const p = typeof property.toJSON === 'function' ? property.toJSON() : { ...property };
  return {
    id: p.id,
    property_name: p.property_name,
    property_type: p.property_type,
    address: p.address,
    city: p.city,
    district: p.district,
    description: p.description,
    status: p.status,
    image: p.image,
    latitude: p.latitude,
    longitude: p.longitude,
    utilities_enabled: !!p.utilities_enabled,
    electricity_price: parseFloat(p.electricity_price) || 0,
    water_price: parseFloat(p.water_price) || 0,
    garbage_fee: parseFloat(p.garbage_fee) || 0,
    transport_fee: parseFloat(p.transport_fee) || 0,
    apartments: Array.isArray(p.apartments) ? p.apartments : undefined,
    created_at: p.created_at || p.createdAt,
  };
};

// ===== APARTMENT DTO =====
const apartmentDTO = (apartment) => {
  if (!apartment) return null;
  const a = typeof apartment.toJSON === 'function' ? apartment.toJSON() : { ...apartment };
  return {
    id: a.id,
    property_id: a.property_id,
    apartment_number: a.apartment_number,
    floor: a.floor,
    apartment_type: a.apartment_type,
    surface: a.surface,
    rent_amount: parseFloat(a.rent_amount) || 0,
    status: a.status,
    description: a.description,
    property: a.property ? { id: a.property.id, property_name: a.property.property_name } : null,
    tenants: Array.isArray(a.tenants) ? a.tenants : undefined,
    created_at: a.created_at || a.createdAt,
  };
};

// ===== MAINTENANCE DTO =====
const maintenanceDTO = (maintenance) => {
  if (!maintenance) return null;
  const m = typeof maintenance.toJSON === 'function' ? maintenance.toJSON() : { ...maintenance };
  return {
    id: m.id,
    apartment_id: m.apartment_id,
    tenant_id: m.tenant_id,
    title: m.title,
    description: m.description,
    priority: m.priority,
    status: m.status,
    assigned_technician_id: m.assigned_technician_id,
    estimated_cost: m.estimated_cost,
    scheduled_date: m.scheduled_date,
    completed_at: m.completed_at,
    apartment: m.apartment ? { id: m.apartment.id, apartment_number: m.apartment.apartment_number } : null,
    tenant: m.tenant ? { id: m.tenant.id, user: m.tenant.user ? { full_name: m.tenant.user.full_name } : null } : null,
    technician: m.technician ? { id: m.technician.id, full_name: m.technician.full_name } : null,
    team: Array.isArray(m.team) ? m.team.map((u) => ({ id: u.id, full_name: u.full_name })) : undefined,
    images: Array.isArray(m.images) ? m.images : undefined,
    expenses: Array.isArray(m.expenses) ? m.expenses : undefined,
    tasks: Array.isArray(m.tasks) ? m.tasks : undefined,
    created_at: m.created_at || m.createdAt,
  };
};

// ===== SALARY DTO =====
const salaryDTO = (salary) => {
  if (!salary) return null;
  const s = typeof salary.toJSON === 'function' ? salary.toJSON() : { ...salary };
  return {
    id: s.id,
    user_id: s.user_id,
    period_month: s.period_month,
    period_year: s.period_year,
    base_salary: parseFloat(s.base_salary) || 0,
    bonus: parseFloat(s.bonus) || 0,
    deductions: parseFloat(s.deductions) || 0,
    net_salary: parseFloat(s.net_salary) || 0,
    payment_type: s.payment_type,
    status: s.status,
    paid_date: s.paid_date,
    proof_photo: s.proof_photo,
    notes: s.notes,
    employee: s.employee ? { id: s.employee.id, full_name: s.employee.full_name } : null,
    creator: s.creator ? { id: s.creator.id, full_name: s.creator.full_name } : null,
    created_at: s.created_at || s.createdAt,
  };
};

// ===== AUDIT LOG DTO =====
const auditLogDTO = (log) => {
  if (!log) return null;
  const l = typeof log.toJSON === 'function' ? log.toJSON() : { ...log };
  return {
    id: l.id,
    user_id: l.user_id,
    action: l.action,
    entity: l.entity,
    entity_id: l.entity_id,
    old_values: l.old_values,
    new_values: l.new_values,
    ip_address: l.ip_address,
    created_at: l.created_at || l.createdAt,
    user: l.user ? { id: l.user.id, full_name: l.user.full_name } : null,
  };
};

// ===== SERVICE DTO =====
const serviceDTO = (s) => {
  if (!s) return null;
  const val = typeof s.toJSON === 'function' ? s.toJSON() : { ...s };
  return {
    id: val.id,
    name: val.name,
    created_at: val.created_at || val.createdAt,
    updated_at: val.updated_at || val.updatedAt,
  };
};

// ===== EQUIPE DTO =====
const equipeDTO = (eq) => {
  if (!eq) return null;
  const val = typeof eq.toJSON === 'function' ? eq.toJSON() : { ...eq };
  return {
    id: val.id,
    name: val.name,
    service_id: val.service_id,
    service: val.service ? serviceDTO(val.service) : null,
    created_at: val.created_at || val.createdAt,
    updated_at: val.updated_at || val.updatedAt,
  };
};

// ===== PLANNING DTO =====
const planningDTO = (p) => {
  if (!p) return null;
  const val = typeof p.toJSON === 'function' ? p.toJSON() : { ...p };
  return {
    id: val.id,
    user_id: val.user_id,
    title: val.title,
    description: val.description || null,
    start_datetime: val.start_datetime,
    end_datetime: val.end_datetime,
    created_by: val.created_by,
    employee: val.employee ? { id: val.employee.id, full_name: val.employee.full_name } : null,
    creator: val.creator ? { id: val.creator.id, full_name: val.creator.full_name } : null,
    created_at: val.created_at || val.createdAt,
  };
};

// ===== POINTAGE DTO =====
const pointageDTO = (pt) => {
  if (!pt) return null;
  const val = typeof pt.toJSON === 'function' ? pt.toJSON() : { ...pt };
  return {
    id: val.id,
    user_id: val.user_id,
    entry_time: val.entry_time,
    exit_time: val.exit_time || null,
    status: val.status,
    notes: val.notes || null,
    employee: val.employee ? { id: val.employee.id, full_name: val.employee.full_name } : null,
    created_at: val.created_at || val.createdAt,
  };
};

// ===== CONGE DTO =====
const congeDTO = (c) => {
  if (!c) return null;
  const val = typeof c.toJSON === 'function' ? c.toJSON() : { ...c };
  return {
    id: val.id,
    user_id: val.user_id,
    type: val.type,
    start_date: val.start_date,
    end_date: val.end_date,
    status: val.status,
    reason: val.reason || null,
    approved_by: val.approved_by || null,
    employee: val.employee ? { id: val.employee.id, full_name: val.employee.full_name } : null,
    approver: val.approver ? { id: val.approver.id, full_name: val.approver.full_name } : null,
    created_at: val.created_at || val.createdAt,
  };
};

// ===== WORKFLOW DTO =====
const workflowValidationDTO = (w) => {
  if (!w) return null;
  const val = typeof w.toJSON === 'function' ? w.toJSON() : { ...w };
  return {
    id: val.id,
    name: val.name,
    module: val.module,
    description: val.description || null,
    steps: Array.isArray(val.steps) ? val.steps.map(workflowEtapeDTO) : undefined,
    created_at: val.created_at || val.createdAt,
  };
};

const workflowEtapeDTO = (e) => {
  if (!e) return null;
  const val = typeof e.toJSON === 'function' ? e.toJSON() : { ...e };
  return {
    id: val.id,
    workflow_id: val.workflow_id,
    step_order: val.step_order,
    role_id: val.role_id,
    description: val.description || null,
    role: val.role ? { id: val.role.id, role_name: val.role.role_name } : null,
  };
};

// ===== MESSAGE DTO =====
const messageInterneDTO = (m) => {
  if (!m) return null;
  const val = typeof m.toJSON === 'function' ? m.toJSON() : { ...m };
  return {
    id: val.id,
    sender_id: val.sender_id,
    recipient_id: val.recipient_id,
    content: val.content,
    is_read: !!val.is_read,
    sender: val.sender ? { id: val.sender.id, full_name: val.sender.full_name } : null,
    recipient: val.recipient ? { id: val.recipient.id, full_name: val.recipient.full_name } : null,
    created_at: val.created_at || val.createdAt,
  };
};

// ===== GPS DTO =====
const gpsTrackingDTO = (g) => {
  if (!g) return null;
  const val = typeof g.toJSON === 'function' ? g.toJSON() : { ...g };
  return {
    id: val.id,
    user_id: val.user_id,
    latitude: parseFloat(val.latitude),
    longitude: parseFloat(val.longitude),
    recorded_at: val.recorded_at,
    user: val.user ? { id: val.user.id, full_name: val.user.full_name } : null,
  };
};

// ===== Fonction utilitaire pour transformer un tableau =====
const listDTO = (items, dtoFn) => {
  if (!Array.isArray(items)) return [];
  return items.map(dtoFn);
};

// ===== Réponse paginée =====
const paginatedDTO = (result, dtoFn) => ({
  data: listDTO(result.rows || result.data || [], dtoFn),
  pagination: {
    total: result.count || result.total || 0,
    page: result.page || 1,
    limit: result.limit || 20,
    totalPages: result.totalPages || Math.ceil((result.count || 0) / (result.limit || 20)),
  },
});

module.exports = {
  stripSensitive,
  userDTO,
  tenantDTO,
  paymentDTO,
  leaseDTO,
  propertyDTO,
  apartmentDTO,
  maintenanceDTO,
  salaryDTO,
  auditLogDTO,
  serviceDTO,
  equipeDTO,
  planningDTO,
  pointageDTO,
  congeDTO,
  workflowValidationDTO,
  workflowEtapeDTO,
  messageInterneDTO,
  gpsTrackingDTO,
  listDTO,
  paginatedDTO,
};
