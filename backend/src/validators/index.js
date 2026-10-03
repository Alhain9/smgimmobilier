// ============ Joi Validators — schémas de validation par entité ============
const Joi = require('joi');

// Réutilisable : identifiant numérique positif
const id = Joi.number().integer().positive();
const requiredId = id.required();
const optionalString = (max = 255) => Joi.string().max(max).allow('', null);
const requiredString = (max = 255) => Joi.string().max(max).required();
const money = Joi.number().min(0).precision(2);
const dateStr = Joi.date().iso();
const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  sortBy: Joi.string().max(50).default('created_at'),
  order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
  search: Joi.string().max(200).allow('', null),
};

// Mot de passe fort : min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
const strongPassword = Joi.string()
  .min(8)
  .max(100)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).*$/)
  .messages({
    'string.min': 'Le mot de passe doit comporter au moins 8 caractères.',
    'string.max': 'Le mot de passe ne doit pas dépasser 100 caractères.',
    'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial (!@#$%^&*...).',
    'any.required': 'Le mot de passe est obligatoire.',
  });

// ===== AUTH =====
const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const register = Joi.object({
  full_name: requiredString(150),
  email: Joi.string().email().required(),
  phone: optionalString(30),
  password: strongPassword.required(),
  role_id: id,
});

const refreshToken = Joi.object({
  refreshToken: Joi.string().required(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email().required(),
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  newPassword: strongPassword.required(),
});

const changePassword = Joi.object({
  currentPassword: Joi.string(),
  oldPassword: Joi.string(),
  newPassword: strongPassword.required(),
}).or('currentPassword', 'oldPassword');

// ===== USERS =====
const createUser = Joi.object({
  full_name: requiredString(150),
  email: Joi.string().email().required(),
  phone: optionalString(30),
  password: strongPassword.required(),
  role_id: requiredId,
  service_id: id.allow(null),
  equipe_id: id.allow(null),
  status: Joi.string().valid('active', 'inactive').default('active'),
  can_manage_users: Joi.boolean().default(false),
  can_view_all_calendars: Joi.boolean().default(false),
  can_manage_utilities: Joi.boolean().default(false),
  can_manage_worksites: Joi.boolean().default(false),
  can_delete_worksites: Joi.boolean().default(false),
  can_manage_stock: Joi.boolean().default(false),
  can_delete_stock: Joi.boolean().default(false),
  can_manage_documents: Joi.boolean().default(false),
  can_manage_expenses: Joi.boolean().default(false),
});

const updateUser = Joi.object({
  full_name: optionalString(150),
  email: Joi.string().email(),
  phone: optionalString(30),
  password: strongPassword.allow('', null),
  role_id: id,
  service_id: id.allow(null),
  equipe_id: id.allow(null),
  status: Joi.string().valid('active', 'inactive'),
  can_manage_users: Joi.boolean(),
  can_view_all_calendars: Joi.boolean(),
  can_manage_utilities: Joi.boolean(),
  can_manage_worksites: Joi.boolean(),
  can_delete_worksites: Joi.boolean(),
  can_manage_stock: Joi.boolean(),
  can_delete_stock: Joi.boolean(),
  can_manage_documents: Joi.boolean(),
  can_manage_expenses: Joi.boolean(),
}).min(1);

// ===== PROPERTIES =====
const createProperty = Joi.object({
  property_name: requiredString(200),
  property_type: Joi.string().valid('immeuble', 'maison', 'terrain').default('immeuble'),
  address: optionalString(255),
  city: optionalString(100),
  district: optionalString(100),
  description: optionalString(1000),
  status: Joi.string().valid('active', 'inactive').default('active'),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  utilities_enabled: Joi.boolean().default(false),
  electricity_price: money.default(0),
  water_price: money.default(0),
  garbage_fee: money.default(0),
  transport_fee: money.default(0),
});

const updateProperty = Joi.object({
  property_name: optionalString(200),
  property_type: Joi.string().valid('immeuble', 'maison', 'terrain'),
  address: optionalString(255),
  city: optionalString(100),
  district: optionalString(100),
  description: optionalString(1000),
  status: Joi.string().valid('active', 'inactive'),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  utilities_enabled: Joi.boolean(),
  electricity_price: money,
  water_price: money,
  garbage_fee: money,
  transport_fee: money,
}).min(1);

// ===== APARTMENTS =====
const createApartment = Joi.object({
  property_id: requiredId,
  apartment_number: requiredString(50),
  floor: Joi.number().integer().allow(null),
  apartment_type: optionalString(50),
  surface: Joi.number().min(0).precision(2).allow(null),
  rent_amount: money.required(),
  status: Joi.string().valid('free', 'occupied', 'maintenance', 'reserved').default('free'),
  description: optionalString(1000),
});

const updateApartment = Joi.object({
  property_id: id,
  apartment_number: optionalString(50),
  floor: Joi.number().integer().allow(null),
  apartment_type: optionalString(50),
  surface: Joi.number().min(0).precision(2).allow(null),
  rent_amount: money,
  status: Joi.string().valid('free', 'occupied', 'maintenance', 'reserved'),
  description: optionalString(1000),
}).min(1);

// ===== TENANTS =====
const createTenant = Joi.object({
  user_id: id,
  apartment_id: id,
  full_name: optionalString(150),
  email: Joi.string().email().allow('', null),
  phone: optionalString(30),
  password: strongPassword.allow('', null),
  national_id: optionalString(50),
  profession: optionalString(100),
  status: Joi.string().valid('active', 'inactive').default('active'),
  emergency_contact: optionalString(150),
  emergency_phone: optionalString(30),
});

const updateTenant = Joi.object({
  user_id: id,
  apartment_id: id,
  full_name: optionalString(150),
  email: Joi.string().email().allow('', null),
  phone: optionalString(30),
  password: strongPassword.allow('', null),
  national_id: optionalString(50),
  profession: optionalString(100),
  status: Joi.string().valid('active', 'inactive'),
  emergency_contact: optionalString(150),
  emergency_phone: optionalString(30),
}).min(1);

// ===== LEASES =====
const createLease = Joi.object({
  tenant_id: requiredId,
  apartment_id: requiredId,
  start_date: dateStr.required(),
  end_date: dateStr.required(),
  monthly_rent: money.required(),
  deposit_amount: money.default(0),
  status: Joi.string().valid('active', 'expired', 'terminated', 'pending').default('active'),
  terms: optionalString(5000),
});

const updateLease = Joi.object({
  tenant_id: id,
  apartment_id: id,
  start_date: dateStr,
  end_date: dateStr,
  monthly_rent: money,
  deposit_amount: money,
  status: Joi.string().valid('active', 'expired', 'terminated', 'pending'),
  terms: optionalString(5000),
}).min(1);

// ===== PAYMENTS =====
const createPayment = Joi.object({
  tenant_id: requiredId,
  apartment_id: requiredId,
  amount: money.required(),
  payment_date: dateStr.required(),
  payment_method: Joi.string().valid('orange_money', 'mtn_mobile_money', 'bank_transfer', 'cash', 'campay').required(),
  status: Joi.string().valid('pending', 'awaiting_confirmation', 'completed', 'failed', 'refunded').default('pending'),
  reference: optionalString(100),
  notes: optionalString(1000),
  period_month: Joi.number().integer().min(1).max(12),
  period_year: Joi.number().integer().min(2020).max(2100),
});

const updatePayment = Joi.object({
  amount: money,
  payment_date: dateStr,
  payment_method: Joi.string().valid('orange_money', 'mtn_mobile_money', 'bank_transfer', 'cash', 'campay'),
  status: Joi.string().valid('pending', 'awaiting_confirmation', 'completed', 'failed', 'refunded'),
  reference: optionalString(100),
  notes: optionalString(1000),
  period_month: Joi.number().integer().min(1).max(12),
  period_year: Joi.number().integer().min(2020).max(2100),
}).min(1);

// ===== MAINTENANCE =====
const createMaintenance = Joi.object({
  apartment_id: requiredId,
  tenant_id: id,
  title: requiredString(200),
  description: optionalString(5000),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  status: Joi.string().valid('reported', 'validated', 'in_progress', 'completed', 'cancelled').default('reported'),
  assigned_technician_id: id,
  estimated_cost: money,
  scheduled_date: dateStr,
});

const updateMaintenance = Joi.object({
  apartment_id: id,
  tenant_id: id,
  title: optionalString(200),
  description: optionalString(5000),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  status: Joi.string().valid('reported', 'validated', 'in_progress', 'completed', 'cancelled'),
  assigned_technician_id: id.allow(null),
  estimated_cost: money,
  scheduled_date: dateStr,
  completed_at: dateStr.allow(null),
}).min(1);

// ===== EXPENSES =====
const createExpense = Joi.object({
  maintenance_id: id,
  item_name: requiredString(200),
  category: optionalString(80),
  quantity: Joi.number().integer().min(1).default(1),
  unit_price: money.required(),
  total_price: money,
  supplier: optionalString(150),
  notes: optionalString(1000),
});

const updateExpense = Joi.object({
  maintenance_id: id,
  item_name: optionalString(200),
  category: optionalString(80),
  quantity: Joi.number().integer().min(1),
  unit_price: money,
  total_price: money,
  supplier: optionalString(150),
  notes: optionalString(1000),
}).min(1);

// ===== SALARIES =====
const createSalary = Joi.object({
  user_id: requiredId,
  period_month: Joi.number().integer().min(1).max(12).required(),
  period_year: Joi.number().integer().min(2020).max(2100).required(),
  base_salary: money.required(),
  bonus: money.default(0),
  deductions: money.default(0),
  payment_type: Joi.string().valid('deposit', 'cash').default('deposit'),
  status: Joi.string().valid('pending', 'paid').default('pending'),
  paid_date: dateStr.allow(null),
  notes: optionalString(1000),
});

const updateSalary = Joi.object({
  base_salary: money,
  bonus: money,
  deductions: money,
  payment_type: Joi.string().valid('deposit', 'cash'),
  status: Joi.string().valid('pending', 'paid'),
  paid_date: dateStr.allow(null),
  notes: optionalString(1000),
}).min(1);

// ===== UTILITY BILLS =====
const createUtilityBill = Joi.object({
  apartment_id: requiredId,
  type: Joi.string().valid('electricity', 'water').required(),
  period_month: Joi.number().integer().min(1).max(12).required(),
  period_year: Joi.number().integer().min(2020).max(2100).required(),
  previous_index: Joi.number().min(0).required(),
  current_index: Joi.number().min(0).required(),
  unit_price: money.required(),
  garbage_fee: money.default(0),
  transport_fee: money.default(0),
  impayer: money.default(0),
  other_fee: money.default(0),
  other_label: optionalString(80),
  due_date: dateStr.allow(null, ''),
  payment_method: optionalString(50),
  receipt_number: optionalString(50),
  notes: optionalString(1000),
});

const updateUtilityBill = Joi.object({
  previous_index: Joi.number().min(0),
  current_index: Joi.number().min(0),
  unit_price: money,
  garbage_fee: money,
  transport_fee: money,
  impayer: money,
  other_fee: money,
  other_label: optionalString(80),
  due_date: dateStr.allow(null, ''),
  payment_method: optionalString(50),
  receipt_number: optionalString(50),
  status: Joi.string().valid('pending', 'paid'),
  paid_date: dateStr.allow(null),
  notes: optionalString(1000),
}).min(1);

// ===== TASKS =====
const createTask = Joi.object({
  maintenance_id: id,
  title: requiredString(200),
  description: optionalString(5000),
  assigned_to: id,
  start_date: dateStr,
  end_date: dateStr,
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'not_done', 'cancelled').default('pending'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
});

const updateTask = Joi.object({
  title: optionalString(200),
  description: optionalString(5000),
  assigned_to: id.allow(null),
  start_date: dateStr,
  end_date: dateStr,
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'not_done', 'cancelled'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  done_at: dateStr.allow(null),
  completion_note: optionalString(2000),
}).min(1);

// ===== CALENDAR EVENTS =====
const createCalendarEvent = Joi.object({
  title: requiredString(200),
  description: optionalString(5000),
  start_datetime: Joi.date().iso().required(),
  end_datetime: Joi.date().iso().required(),
  task_id: id,
  is_meeting: Joi.boolean().default(false),
  participants: Joi.array().items(id),
});

const updateCalendarEvent = Joi.object({
  title: optionalString(200),
  description: optionalString(5000),
  start_datetime: Joi.date().iso(),
  end_datetime: Joi.date().iso(),
  is_meeting: Joi.boolean(),
  participants: Joi.array().items(id),
}).min(1);

// ===== NOTIFICATIONS =====
const createNotification = Joi.object({
  user_id: requiredId,
  title: requiredString(200),
  message: requiredString(2000),
  type: Joi.string().valid('info', 'warning', 'error', 'success').default('info'),
  link: optionalString(500),
});

// ===== SERVICES =====
const createService = Joi.object({
  name: requiredString(100),
});

const updateService = Joi.object({
  name: requiredString(100),
});

// ===== EQUIPES =====
const createEquipe = Joi.object({
  name: requiredString(100),
  service_id: requiredId,
});

const updateEquipe = Joi.object({
  name: optionalString(100),
  service_id: id,
}).min(1);

// ===== PLANNINGS =====
const createPlanning = Joi.object({
  user_id: requiredId,
  title: requiredString(200),
  description: optionalString(1000),
  start_datetime: Joi.date().iso().required(),
  end_datetime: Joi.date().iso().required(),
});

const updatePlanning = Joi.object({
  user_id: id,
  title: optionalString(200),
  description: optionalString(1000),
  start_datetime: Joi.date().iso(),
  end_datetime: Joi.date().iso(),
}).min(1);

// ===== POINTAGES =====
const createPointage = Joi.object({
  user_id: requiredId,
  entry_time: Joi.date().iso().required(),
  exit_time: Joi.date().iso().allow(null),
  status: Joi.string().valid('present', 'absent', 'late', 'half_day').default('present'),
  notes: optionalString(1000),
});

const updatePointage = Joi.object({
  entry_time: Joi.date().iso(),
  exit_time: Joi.date().iso().allow(null),
  status: Joi.string().valid('present', 'absent', 'late', 'half_day'),
  notes: optionalString(1000),
}).min(1);

// ===== CONGES =====
const createConge = Joi.object({
  user_id: requiredId,
  type: Joi.string().valid('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other').required(),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().required(),
  reason: optionalString(1000),
});

const updateConge = Joi.object({
  type: Joi.string().valid('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other'),
  start_date: Joi.date().iso(),
  end_date: Joi.date().iso(),
  status: Joi.string().valid('pending', 'approved', 'rejected', 'cancelled'),
  reason: optionalString(1000),
  approved_by: id,
}).min(1);

// ===== WORKFLOWS =====
const createWorkflowValidation = Joi.object({
  name: requiredString(150),
  module: requiredString(50),
  description: optionalString(1000),
});

const createWorkflowEtape = Joi.object({
  workflow_id: requiredId,
  step_order: Joi.number().integer().min(1).required(),
  role_id: requiredId,
  description: optionalString(255),
});

// ===== MESSAGES =====
const createMessageInterne = Joi.object({
  recipient_id: requiredId,
  content: Joi.string().required(),
});

// ===== GPS =====
const createGPSTracking = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
});

// ===== Middleware de validation ============
/**
 * Crée un middleware Express de validation Joi.
 * @param {Joi.Schema} schema — schéma Joi
 * @param {'body'|'query'|'params'} source — source des données
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, ''),
      }));
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: details,
      });
    }
    req[source] = value; // remplace par les données nettoyées
    next();
  };
};

// ===== Query params pagination (réutilisable) =====
const paginationQuery = Joi.object(pagination);

module.exports = {
  validate,
  schemas: {
    // Auth
    login, register, refreshToken, forgotPassword, resetPassword, changePassword,
    // Users
    createUser, updateUser,
    // Properties
    createProperty, updateProperty,
    // Apartments
    createApartment, updateApartment,
    // Tenants
    createTenant, updateTenant,
    // Leases
    createLease, updateLease,
    // Payments
    createPayment, updatePayment,
    // Maintenance
    createMaintenance, updateMaintenance,
    // Expenses
    createExpense, updateExpense,
    // Salaries
    createSalary, updateSalary,
    // Utility Bills
    createUtilityBill, updateUtilityBill,
    // Tasks
    createTask, updateTask,
    // Calendar Events
    createCalendarEvent, updateCalendarEvent,
    // Notifications
    createNotification,
    // RH
    createService, updateService,
    createEquipe, updateEquipe,
    createPlanning, updatePlanning,
    createPointage, updatePointage,
    createConge, updateConge,
    // Workflows
    createWorkflowValidation, createWorkflowEtape,
    // Messages
    createMessageInterne,
    // GPS
    createGPSTracking,
    // Pagination query
    paginationQuery,
  },
};
