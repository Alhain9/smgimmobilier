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
const Withdrawal = require('./Withdrawal');
const Worksite = require('./Worksite');
const Receipt = require('./Receipt');
const Supplier = require('./Supplier');
const StockItem = require('./StockItem');
const StockPurchase = require('./StockPurchase');
const StockPurchaseItem = require('./StockPurchaseItem');
const StockMovement = require('./StockMovement');
const MaintenanceMaterial = require('./MaintenanceMaterial');
const WorksiteTask = require('./WorksiteTask');
const WorksiteMaterial = require('./WorksiteMaterial');
const WorksitePhoto = require('./WorksitePhoto');
const EquipmentAllocation = require('./EquipmentAllocation');
const RoleDelegation = require('./RoleDelegation');
const Warehouse = require('./Warehouse');
const WorksiteEquipmentLoan = require('./WorksiteEquipmentLoan');
const ManagerProperty = require('./ManagerProperty');

// ============ ASSOCIATIONS ============

// Worksite <-> Property / User
Property.hasMany(Worksite, { foreignKey: 'property_id', as: 'worksites' });
Worksite.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
User.hasMany(Worksite, { foreignKey: 'manager_id', as: 'managedWorksites' });
Worksite.belongsTo(User, { foreignKey: 'manager_id', as: 'manager' });

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

// Property ↔ Owner (Bailleur)
User.hasMany(Property, { foreignKey: 'owner_id', as: 'ownedProperties' });
Property.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

// ManagerProperty ↔ User / Property (Affectation immeubles aux gestionnaires/comptables)
User.belongsToMany(Property, { through: ManagerProperty, as: 'assignedProperties', foreignKey: 'user_id', otherKey: 'property_id' });
Property.belongsToMany(User, { through: ManagerProperty, as: 'assignedManagers', foreignKey: 'property_id', otherKey: 'user_id' });
User.hasMany(ManagerProperty, { foreignKey: 'user_id', as: 'managerPropertyLinks' });
ManagerProperty.belongsTo(User, { foreignKey: 'user_id', as: 'manager' });
ManagerProperty.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });

// Expense ↔ Property (dépenses directes liées à un immeuble, hors maintenance)
Property.hasMany(Expense, { foreignKey: 'property_id', as: 'directExpenses' });
Expense.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });

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

// Withdrawal
User.hasMany(Withdrawal, { foreignKey: 'created_by', as: 'withdrawals' });
Withdrawal.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Receipt (reçus de paiement)
Payment.hasMany(Receipt, { foreignKey: 'payment_id', as: 'receipts' });
Receipt.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });
Tenant.hasMany(Receipt, { foreignKey: 'tenant_id', as: 'receipts' });
Receipt.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Apartment.hasMany(Receipt, { foreignKey: 'apartment_id', as: 'receipts' });
Receipt.belongsTo(Apartment, { foreignKey: 'apartment_id', as: 'apartment' });
Property.hasMany(Receipt, { foreignKey: 'property_id', as: 'receipts' });
Receipt.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
User.hasMany(Receipt, { foreignKey: 'generated_by', as: 'generatedReceipts' });
Receipt.belongsTo(User, { foreignKey: 'generated_by', as: 'generator' });

// Stock & Fournisseurs
Supplier.hasMany(StockPurchase, { foreignKey: 'supplier_id', as: 'purchases' });
StockPurchase.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
User.hasMany(StockPurchase, { foreignKey: 'created_by', as: 'stockPurchases' });
StockPurchase.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

StockPurchase.hasMany(StockPurchaseItem, { foreignKey: 'purchase_id', as: 'items' });
StockPurchaseItem.belongsTo(StockPurchase, { foreignKey: 'purchase_id', as: 'purchase' });
StockItem.hasMany(StockPurchaseItem, { foreignKey: 'stock_item_id', as: 'purchaseLines' });
StockPurchaseItem.belongsTo(StockItem, { foreignKey: 'stock_item_id', as: 'stockItem' });

StockItem.hasMany(StockMovement, { foreignKey: 'stock_item_id', as: 'movements' });
StockMovement.belongsTo(StockItem, { foreignKey: 'stock_item_id', as: 'stockItem' });
User.hasMany(StockMovement, { foreignKey: 'created_by', as: 'stockMovements' });
StockMovement.belongsTo(User, { foreignKey: 'created_by', as: 'author' });

// Maintenance ↔ Stock Materials
Maintenance.hasMany(MaintenanceMaterial, { foreignKey: 'maintenance_id', as: 'materialsUsed' });
MaintenanceMaterial.belongsTo(Maintenance, { foreignKey: 'maintenance_id', as: 'maintenance' });
StockItem.hasMany(MaintenanceMaterial, { foreignKey: 'stock_item_id', as: 'maintenanceUses' });
MaintenanceMaterial.belongsTo(StockItem, { foreignKey: 'stock_item_id', as: 'stockItem' });
User.hasMany(MaintenanceMaterial, { foreignKey: 'declared_by', as: 'declaredMaterials' });
MaintenanceMaterial.belongsTo(User, { foreignKey: 'declared_by', as: 'declarer' });

// Worksite Enhancements
Worksite.hasMany(WorksiteTask, { foreignKey: 'worksite_id', as: 'tasks' });
WorksiteTask.belongsTo(Worksite, { foreignKey: 'worksite_id', as: 'worksite' });
User.hasMany(WorksiteTask, { foreignKey: 'assigned_to', as: 'assignedWorksiteTasks' });
WorksiteTask.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });

Worksite.hasMany(WorksiteMaterial, { foreignKey: 'worksite_id', as: 'materialsUsed' });
WorksiteMaterial.belongsTo(Worksite, { foreignKey: 'worksite_id', as: 'worksite' });
StockItem.hasMany(WorksiteMaterial, { foreignKey: 'stock_item_id', as: 'worksiteUses' });
WorksiteMaterial.belongsTo(StockItem, { foreignKey: 'stock_item_id', as: 'stockItem' });
User.hasMany(WorksiteMaterial, { foreignKey: 'declared_by', as: 'worksiteDeclaredMaterials' });
WorksiteMaterial.belongsTo(User, { foreignKey: 'declared_by', as: 'declarer' });

Worksite.hasMany(WorksitePhoto, { foreignKey: 'worksite_id', as: 'photos' });
WorksitePhoto.belongsTo(Worksite, { foreignKey: 'worksite_id', as: 'worksite' });
User.hasMany(WorksitePhoto, { foreignKey: 'uploaded_by', as: 'worksitePhotos' });
WorksitePhoto.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// Equipment Allocations (outillage affecté aux techniciens / chantiers)
Equipment.hasMany(EquipmentAllocation, { foreignKey: 'equipment_id', as: 'allocations' });
EquipmentAllocation.belongsTo(Equipment, { foreignKey: 'equipment_id', as: 'equipment' });
User.hasMany(EquipmentAllocation, { foreignKey: 'assigned_to_user_id', as: 'assignedEquipments' });
EquipmentAllocation.belongsTo(User, { foreignKey: 'assigned_to_user_id', as: 'technician' });
Worksite.hasMany(EquipmentAllocation, { foreignKey: 'worksite_id', as: 'equipmentAllocations' });
EquipmentAllocation.belongsTo(Worksite, { foreignKey: 'worksite_id', as: 'worksite' });
Maintenance.hasMany(EquipmentAllocation, { foreignKey: 'maintenance_id', as: 'equipmentAllocations' });
EquipmentAllocation.belongsTo(Maintenance, { foreignKey: 'maintenance_id', as: 'maintenance' });

// Role Delegations (Suppléance de rôle temporaire)
User.hasMany(RoleDelegation, { foreignKey: 'user_id', as: 'delegations' });
RoleDelegation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(RoleDelegation, { foreignKey: 'granted_by', as: 'grantedDelegations' });
RoleDelegation.belongsTo(User, { foreignKey: 'granted_by', as: 'granter' });

// ===== Multi-Entrepôts & Prêt d'Équipements Chantiers =====
Warehouse.hasMany(StockItem, { foreignKey: 'warehouse_id', as: 'items' });
StockItem.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
User.hasMany(Warehouse, { foreignKey: 'manager_id', as: 'managedWarehouses' });
Warehouse.belongsTo(User, { foreignKey: 'manager_id', as: 'manager' });
Property.hasMany(Warehouse, { foreignKey: 'property_id', as: 'warehouses' });
Warehouse.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });

Worksite.hasMany(WorksiteEquipmentLoan, { foreignKey: 'worksite_id', as: 'equipmentLoans' });
WorksiteEquipmentLoan.belongsTo(Worksite, { foreignKey: 'worksite_id', as: 'worksite' });
StockItem.hasMany(WorksiteEquipmentLoan, { foreignKey: 'stock_item_id', as: 'worksiteLoans' });
WorksiteEquipmentLoan.belongsTo(StockItem, { foreignKey: 'stock_item_id', as: 'stockItem' });

Warehouse.hasMany(WorksiteEquipmentLoan, { foreignKey: 'warehouse_id', as: 'loansFrom' });
WorksiteEquipmentLoan.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'sourceWarehouse' });
Warehouse.hasMany(WorksiteEquipmentLoan, { foreignKey: 'return_warehouse_id', as: 'returnsTo' });
WorksiteEquipmentLoan.belongsTo(Warehouse, { foreignKey: 'return_warehouse_id', as: 'returnWarehouse' });

User.hasMany(WorksiteEquipmentLoan, { foreignKey: 'created_by', as: 'createdLoans' });
WorksiteEquipmentLoan.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

module.exports = {
  sequelize, Role, User, Property, Apartment, Tenant, Lease, Payment, ManagerProperty,
  Maintenance, MaintenanceImage, MaintenanceTechnician, Equipment, Expense, Task, Upload, CalendarEvent, CalendarEventParticipant, Notification, Salary, UtilityBill, PaymentHistory, TaskHistory,
  // Nouveaux modèles SMG IMMOBILIER
  AuditLog, RefreshToken, Permission, RolePermission, Service, Equipe, Planning, Pointage, Conge, WorkflowValidation, WorkflowEtape, MessageInterne, GPSTracking, Withdrawal, Worksite,
  Receipt,
  Supplier, StockItem, StockPurchase, StockPurchaseItem, StockMovement,
  MaintenanceMaterial,
  WorksiteTask, WorksiteMaterial, WorksitePhoto,
  EquipmentAllocation,
  RoleDelegation,
  Warehouse,
  WorksiteEquipmentLoan,
};
