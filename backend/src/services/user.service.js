const { User, Role, Property } = require('../models');
const { shapeUser } = require('../utils/shapeUser');

const PRIVILEGED_FIELDS = [
  'can_manage_users',
  'can_view_all_calendars',
  'can_manage_utilities',
  'can_manage_worksites',
  'can_delete_worksites',
  'can_manage_stock',
  'can_delete_stock',
  'can_manage_documents',
  'can_manage_expenses',
];
const stripPrivilegedFields = (data, requesterRole) => {
  const payload = { ...data };
  if (!['manager', 'super_admin'].includes(requesterRole)) {
    PRIVILEGED_FIELDS.forEach((f) => delete payload[f]);
  }
  return payload;
};

class UserService {
  async getAll() {
    const locataireRole = await Role.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { role_name: 'Locataire' },
          { role_name: 'locataire' }
        ]
      }
    });
    const { Op } = require('sequelize');
    const where = {
      status: { [Op.ne]: 'pending_approval' },
    };
    if (locataireRole) {
      where.role_id = { [Op.ne]: locataireRole.id };
    }
    const users = await User.findAll({
      where,
      include: [
        { model: Role, as: 'role' },
        { model: Property, as: 'ownedProperties', attributes: ['id', 'property_name', 'city'] },
      ],
      order: [['created_at', 'DESC']]
    });
    return users.map(shapeUser);
  }

  async getById(id) {
    const u = await User.findByPk(id, {
      include: [
        { model: Role, as: 'role' },
        { model: Property, as: 'ownedProperties', attributes: ['id', 'property_name', 'city'] },
      ]
    });
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    const shaped = shapeUser(u);
    shaped.property_ids = (u.ownedProperties || []).map((p) => p.id);
    return shaped;
  }

  async create(data, requesterRole) {
    if (await User.findOne({ where: { email: data.email } })) throw Object.assign(new Error('Cet email est déjà utilisé'), { status: 400 });
    const payload = stripPrivilegedFields(data, requesterRole);
    const propertyIds = Array.isArray(payload.property_ids) ? payload.property_ids : [];
    delete payload.property_ids;

    const u = await User.create(payload);

    if (propertyIds.length) {
      await Property.update({ owner_id: u.id }, { where: { id: propertyIds } });
    }

    return this.getById(u.id);
  }

  async update(id, data, requesterRole) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    const payload = stripPrivilegedFields(data, requesterRole);
    if (!payload.password) delete payload.password;

    const propertyIds = Array.isArray(payload.property_ids) ? payload.property_ids : null;
    delete payload.property_ids;

    await u.update(payload);

    if (propertyIds !== null) {
      // Réinitialiser les anciens immeubles de cet utilisateur
      await Property.update({ owner_id: null }, { where: { owner_id: id } });
      // Assigner les nouveaux immeubles sélectionnés
      if (propertyIds.length) {
        await Property.update({ owner_id: id }, { where: { id: propertyIds } });
      }
    }

    return this.getById(id);
  }
  async remove(id) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    await u.destroy();
    return true;
  }
  async toggleActive(id) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    u.status = u.status === 'active' ? 'inactive' : 'active';
    await u.save();
    return this.getById(id);
  }
  async toggleAttendance(id, isPresent) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    u.is_present = isPresent !== undefined ? isPresent : !u.is_present;
    u.last_attendance_at = new Date();
    await u.save();
    return this.getById(id);
  }
  async getRoles() {
    const roles = await Role.findAll({ order: [['id', 'ASC']] });
    return roles.map((r) => ({ id: r.id, name: r.code(), label: r.role_name }));
  }

  async getPendingRegistrations() {
    const pending = await User.findAll({
      where: { status: 'pending_approval' },
      include: [
        { model: Role, as: 'role' },
      ],
      order: [['created_at', 'DESC']]
    });
    return pending.map((u) => {
      const shaped = shapeUser(u);
      shaped.requested_role = u.requested_role;
      shaped.registration_note = u.registration_note;
      shaped.city = u.city;
      shaped.created_at = u.created_at;
      return shaped;
    });
  }

  async approveRegistration(id, data, requesterRole) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Demande d\'inscription introuvable'), { status: 404 });
    if (u.status !== 'pending_approval' && u.status !== 'inactive') {
      throw Object.assign(new Error('Ce compte a déjà été validé.'), { status: 400 });
    }

    const { role_id, city, service_id, apartment_id, property_id, monthly_rent, deposit_amount, start_date } = data;
    if (!role_id) {
      throw Object.assign(new Error('Veuillez sélectionner un rôle pour cet utilisateur.'), { status: 400 });
    }

    const role = await Role.findByPk(role_id);
    if (!role) throw Object.assign(new Error('Rôle introuvable'), { status: 400 });

    const roleCode = role.code ? role.code() : (role.role_name || '').toLowerCase();

    // 1. Mise à jour de l'utilisateur
    u.role_id = role_id;
    u.status = 'active';
    if (city) u.city = city;
    if (service_id) u.service_id = service_id;
    await u.save();

    // 2. Si le rôle est Locataire et qu'un logement ou bail est assigné
    if (roleCode === 'locataire' || role.role_name === 'Locataire') {
      const { Tenant, Apartment, Lease } = require('../models');
      let tenant = await Tenant.findOne({ where: { user_id: u.id } });
      const startDate = start_date || new Date().toISOString().slice(0, 10);

      if (!tenant) {
        tenant = await Tenant.create({
          user_id: u.id,
          civility: data.civility || 'Monsieur',
          apartment_id: apartment_id || null,
          national_id: data.cni || null,
          start_date: startDate,
          status: 'active',
        });
      } else if (apartment_id) {
        tenant.apartment_id = apartment_id;
        tenant.status = 'active';
        await tenant.save();
      }

      if (apartment_id) {
        const apt = await Apartment.findByPk(apartment_id);
        if (apt) {
          await apt.update({ status: 'occupied' });
          const rent = parseFloat(monthly_rent) || parseFloat(apt.rent_amount) || 0;
          const deposit = deposit_amount !== undefined ? parseFloat(deposit_amount) : rent;
          const endD = new Date(startDate);
          endD.setFullYear(endD.getFullYear() + 1);

          await Lease.create({
            tenant_id: tenant.id,
            apartment_id: apartment_id,
            start_date: startDate,
            end_date: endD.toISOString().slice(0, 10),
            duration_months: 12,
            monthly_rent: rent,
            deposit_amount: deposit,
            status: 'active',
          });
        }
      }
    }

    // 3. Si rôle Bailleur et des immeubles sont sélectionnés
    if ((roleCode === 'bailleur' || role.role_name === 'Bailleur') && property_id) {
      const pIds = Array.isArray(property_id) ? property_id : [property_id];
      await Property.update({ owner_id: u.id }, { where: { id: pIds } });
    }

    // 4. Notification de bienvenue à l'utilisateur
    try {
      const { Notification } = require('../models');
      await Notification.create({
        user_id: u.id,
        title: '🎉 Bienvenue chez SMG IMMOBILIER !',
        message: `Votre compte a été validé avec succès avec le rôle "${role.role_name}". Vous pouvez désormais vous connecter et accéder à votre espace.`,
      });
    } catch (_) {}

    return this.getById(u.id);
  }

  async rejectRegistration(id, reason) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Demande d\'inscription introuvable'), { status: 404 });
    await u.destroy();
    return { success: true, message: 'Demande d\'inscription refusée et supprimée.' };
  }

  // Liste minimale des techniciens (pour composer une équipe de chantier)
  async getTechnicians() {
    const role = await Role.findOne({ where: { role_name: Role.codeToName('technicien') } });
    if (!role) return [];
    const users = await User.findAll({
      where: { role_id: role.id, status: 'active' },
      attributes: ['id', 'full_name'], order: [['full_name', 'ASC']],
    });
    return users.map((u) => ({ id: u.id, full_name: u.full_name }));
  }
}
module.exports = new UserService();
