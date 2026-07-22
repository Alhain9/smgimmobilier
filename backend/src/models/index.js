const { sequelize } = require('../config/database');

const Role = require('./Role');
const User = require('./User');
const Property = require('./Property');
const Apartment = require('./Apartment');
const Tenant = require('./Tenant');
const Lease = require('./Lease');
const Payment = require('./Payment');
const Maintenance = require('./Maintenance');
const MaintenanceImage = require('./MaintenanceImage');
const MaintenanceTechnician = require('./MaintenanceTechnician');
const Equipment = require('./Equipment');
const Expense = require('./Expense');
const Task = require('./Task');
const Upload = require('./Upload');
const CalendarEvent = require('./CalendarEvent');
const CalendarEventParticipant = require('./CalendarEventParticipant');
const Notification = require('./Notification');
const Salary = require('./Salary');
const UtilityBill = require('./UtilityBill');
const PaymentHistory = require('./PaymentHistory');
const TaskHistory = require('./TaskHistory');
// ===== Nouveaux modèles SMG IMMOBILIER =====
const AuditLog = require('./AuditLog');
const RefreshToken = require('./RefreshToken');
const Permission = require('./Permission');
const RolePermission = require('./RolePermission');
const Service = require('./Service');
const Equipe = require('./Equipe');
const Planning = require('./Planning');
const Pointage = require('./Pointage');
const Conge = require('./Conge');
const WorkflowValidation = require('./WorkflowValidation');
const WorkflowEtape = require('./WorkflowEtape');
const MessageInterne = require('./MessageInterne');
const GPSTracking = require('./GPSTracking');

// ============ ASSOCIATIONS ============

// Salary <-> User
User.hasMany(Salary, { foreignKey: 'user_id', as: 'salaries' });
Salary.belongsTo(User, { foreignKey: 'user_id', as: 'employee' });
Salary.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Role <-> User
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// Property <-> Apartment
Property.hasMany(Apartment, { foreignKey: 'property_id', as: 'apartments' });
Apartment.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });

// Tenant <-> User / Apartment
User.hasOne(Tenant, { foreignKey: 'user_id', as: 'tenantProfile' });
Tenant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Apartment.hasMany(Tenant, { foreignKey: 'apartment_id', as: 'tenants' });
Tenant.belongsTo(Apartment, { foreignKey: 'apartment_id', as: 'apartment' });

// Lease
Tenant.hasMany(Lease, { foreignKey: 'tenant_id', as: 'leases' });
Lease.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Apartment.hasMany(Lease, { foreignKey: 'apartment_id', as: 'leases' });
Lease.belongsTo(Apartment, { foreignKey: 'apartment_id', as: 'apartment' });

// Payment
Tenant.hasMany(Payment, { foreignKey: 'tenant_id', as: 'payments' });
Payment.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Apartment.hasMany(Payment, { foreignKey: 'apartment_id', as: 'payments' });
Payment.belongsTo(Apartment, { foreignKey: 'apartment_id', as: 'apartment' });
User.hasMany(Payment, { foreignKey: 'created_by', as: 'declaredPayments' });
Payment.belongsTo(User, { foreignKey: 'created_by', as: 'declarant' });
// Journal des modifications d'un paiement
Payment.hasMany(PaymentHistory, { foreignKey: 'payment_id', as: 'history' });
PaymentHistory.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });
PaymentHistory.belongsTo(User, { foreignKey: 'changed_by', as: 'changedBy' });

// Maintenance (maintenance_requests)
Apartment.hasMany(Maintenance, { foreignKey: 'apartment_id', as: 'maintenances' });
Maintenance.belongsTo(Apartment, { foreignKey: 'apartment_id', as: 'apartment' });
Tenant.hasMany(Maintenance, { foreignKey: 'tenant_id', as: 'maintenances' });
Maintenance.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
User.hasMany(Maintenance, { foreignKey: 'assigned_technician_id', as: 'assignedMaintenances' });
Maintenance.belongsTo(User, { foreignKey: 'assigned_technician_id', as: 'technician' });

// Équipe de techniciens d'un chantier (plusieurs techniciens par maintenance)
Maintenance.belongsToMany(User, { through: MaintenanceTechnician, as: 'team', foreignKey: 'maintenance_id', otherKey: 'user_id' });
User.belongsToMany(Maintenance, { through: MaintenanceTechnician, as: 'interventions', foreignKey: 'user_id', otherKey: 'maintenance_id' });

// Maintenance images
Maintenance.hasMany(MaintenanceImage, { foreignKey: 'maintenance_id', as: 'images' });
MaintenanceImage.belongsTo(Maintenance, { foreignKey: 'maintenance_id', as: 'maintenance' });

// Expense
Maintenance.hasMany(Expense, { foreignKey: 'maintenance_id', as: 'expenses' });
Expense.belongsTo(Maintenance, { foreignKey: 'maintenance_id', as: 'maintenance' });
User.hasMany(Expense, { foreignKey: 'created_by', as: 'createdExpenses' });
Expense.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Task
Maintenance.hasMany(Task, { foreignKey: 'maintenance_id', as: 'tasks' });
Task.belongsTo(Maintenance, { foreignKey: 'maintenance_id', as: 'maintenance' });
User.hasMany(Task, { foreignKey: 'assigned_to', as: 'tasks' });
Task.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
User.hasMany(Task, { foreignKey: 'created_by', as: 'createdTasks' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
// Journal des tâches
Task.hasMany(TaskHistory, { foreignKey: 'task_id', as: 'history' });
TaskHistory.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
TaskHistory.belongsTo(User, { foreignKey: 'changed_by', as: 'changedBy' });

// Calendar
Task.hasMany(CalendarEvent, { foreignKey: 'task_id', as: 'events' });
CalendarEvent.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
User.hasMany(CalendarEvent, { foreignKey: 'created_by', as: 'calendarEvents' });
CalendarEvent.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Calendar : participants à une réunion / événement partagé
CalendarEvent.belongsToMany(User, { through: CalendarEventParticipant, as: 'participants', foreignKey: 'event_id', otherKey: 'user_id' });
User.belongsToMany(CalendarEvent, { through: CalendarEventParticipant, as: 'invitedEvents', foreignKey: 'user_id', otherKey: 'event_id' });

// Upload (polymorphe via related_table/related_id)
User.hasMany(Upload, { foreignKey: 'uploaded_by', as: 'uploads' });
Upload.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// Notification
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Factures de charges (électricité/eau) par logement
Apartment.hasMany(UtilityBill, { foreignKey: 'apartment_id', as: 'utilityBills' });
UtilityBill.belongsTo(Apartment, { foreignKey: 'apartment_id', as: 'apartment' });
User.hasMany(UtilityBill, { foreignKey: 'created_by', as: 'createdUtilityBills' });
UtilityBill.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ===== Nouvelles associations SMG IMMOBILIER =====

// AuditLog <-> User
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// RefreshToken <-> User
User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Role <-> Permission (many-to-many via RolePermission)
Role.belongsToMany(Permission, { through: RolePermission, as: 'permissions', foreignKey: 'role_id', otherKey: 'permission_id' });
Permission.belongsToMany(Role, { through: RolePermission, as: 'roles', foreignKey: 'permission_id', otherKey: 'role_id' });

// User <-> Service / Equipe (RH)
Service.hasMany(User, { foreignKey: 'service_id', as: 'users' });
User.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });

Equipe.hasMany(User, { foreignKey: 'equipe_id', as: 'users' });
User.belongsTo(Equipe, { foreignKey: 'equipe_id', as: 'equipe' });

Equipe.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
Service.hasMany(Equipe, { foreignKey: 'service_id', as: 'equipes' });

// User <-> Planning
User.hasMany(Planning, { foreignKey: 'user_id', as: 'plannings' });
Planning.belongsTo(User, { foreignKey: 'user_id', as: 'employee' });
Planning.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// User <-> Pointage
User.hasMany(Pointage, { foreignKey: 'user_id', as: 'pointages' });
Pointage.belongsTo(User, { foreignKey: 'user_id', as: 'employee' });

// User <-> Conge
User.hasMany(Conge, { foreignKey: 'user_id', as: 'conges' });
Conge.belongsTo(User, { foreignKey: 'user_id', as: 'employee' });
Conge.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

// Workflows
WorkflowValidation.hasMany(WorkflowEtape, { foreignKey: 'workflow_id', as: 'steps' });
WorkflowEtape.belongsTo(WorkflowValidation, { foreignKey: 'workflow_id', as: 'workflow' });
WorkflowEtape.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// Messagerie interne
User.hasMany(MessageInterne, { foreignKey: 'sender_id', as: 'sentMessages' });
User.hasMany(MessageInterne, { foreignKey: 'recipient_id', as: 'receivedMessages' });
MessageInterne.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
MessageInterne.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });

// GPS Tracking
User.hasMany(GPSTracking, { foreignKey: 'user_id', as: 'gpsLogs' });
GPSTracking.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize, Role, User, Property, Apartment, Tenant, Lease, Payment,
  Maintenance, MaintenanceImage, MaintenanceTechnician, Equipment, Expense, Task, Upload, CalendarEvent, CalendarEventParticipant, Notification, Salary, UtilityBill, PaymentHistory, TaskHistory,
  // Nouveaux modèles SMG IMMOBILIER
  AuditLog, RefreshToken, Permission, RolePermission, Service, Equipe, Planning, Pointage, Conge, WorkflowValidation, WorkflowEtape, MessageInterne, GPSTracking,
};
