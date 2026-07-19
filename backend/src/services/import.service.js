const ExcelJS = require('exceljs');
const { Property, Apartment, Tenant, User, Lease, Payment, Role, sequelize } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../config/logger');

// Helper pour calculer le nombre de mois écoulés depuis une date (mois courant inclus)
function monthsElapsed(startDate) {
  if (!startDate) return 0;
  const s = new Date(startDate);
  const n = new Date();
  if (isNaN(s) || s > n) return 0;
  return (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth()) + 1;
}

// Convertisseur pour récupérer les valeurs numériques d'une cellule Excel
const getNumVal = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return 0;
  if (typeof cell.value === 'number') return cell.value;
  if (typeof cell.value === 'object' && cell.value.result !== undefined) {
    return parseFloat(cell.value.result) || 0;
  }
  const parsed = parseFloat(cell.value);
  return isNaN(parsed) ? 0 : parsed;
};

// Convertisseur pour récupérer la valeur textuelle d'une cellule Excel
const getStrVal = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if (cell.value.result !== undefined) return cell.value.result.toString().trim();
    if (cell.value.text !== undefined) return cell.value.text.toString().trim();
    return JSON.stringify(cell.value);
  }
  return cell.value.toString().trim();
};

// Convertisseur pour récupérer la date d'une cellule Excel
const getDateVal = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  if (cell.value instanceof Date) return cell.value;
  if (typeof cell.value === 'object' && cell.value.result instanceof Date) return cell.value.result;
  const str = getStrVal(cell);
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

// Mapper du mode de paiement
const mapPaymentMethod = (method) => {
  if (!method) return 'cash';
  const m = method.toLowerCase();
  if (m.includes('orange') || m.includes('om')) return 'orange_money';
  if (m.includes('mtn') || m.includes('momo') || m.includes('mobile')) return 'mtn_mobile_money';
  if (m.includes('transfer') || m.includes('virement') || m.includes('bank')) return 'bank_transfer';
  return 'cash';
};

class ImportService {
  /**
   * Importe la situation d'un immeuble depuis un fichier Excel.
   * @param {string} filePath - Chemin absolu du fichier temporaire Excel.
   * @param {object} options - Options de localisation de l'immeuble { address, city, district }.
   * @returns {object} - Résumé de l'importation.
   */
  async importBuildingSituation(filePath, options = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // On récupère la première feuille de calcul
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error("Le fichier Excel ne contient aucune feuille de calcul valide.");
    }

    // Extraction du nom de l'immeuble depuis la cellule A1 (ex: "Situation — Résidence Concorde")
    const titleVal = worksheet.getCell('A1').value;
    let propertyName = '';
    if (typeof titleVal === 'string') {
      if (titleVal.startsWith('Situation — ')) {
        propertyName = titleVal.replace('Situation — ', '').trim();
      } else {
        propertyName = titleVal.trim();
      }
    }

    if (!propertyName) {
      propertyName = worksheet.name || 'Immeuble Importé';
    }

    // Statistiques d'importation
    const stats = {
      property: propertyName,
      created: false,
      updated: false,
      apartments: { total: 0, created: 0, updated: 0 },
      tenants: { total: 0, created: 0, updated: 0, terminated: 0 },
      payments: { totalCreated: 0 },
    };

    // Lancer la transaction SQL
    await sequelize.transaction(async (transaction) => {
      // 1. Recherche ou création de l'immeuble (Property)
      let property = await Property.findOne({ where: { property_name: propertyName }, transaction });
      if (!property) {
        property = await Property.create({
          property_name: propertyName,
          property_type: 'immeuble',
          address: options.address || 'Non spécifiée',
          city: options.city || 'Douala',
          district: options.district || '',
          status: 'active',
        }, { transaction });
        stats.created = true;
      } else {
        // Mise à jour de la localisation si fournie
        const updateData = {};
        if (options.address) updateData.address = options.address;
        if (options.city) updateData.city = options.city;
        if (options.district) updateData.district = options.district;
        
        if (Object.keys(updateData).length > 0) {
          await property.update(updateData, { transaction });
        }
        stats.updated = true;
      }

      // 2. Recherche du rôle Locataire
      const locataireRole = await Role.findOne({
        where: {
          [Op.or]: [
            { role_name: 'Locataire' },
            { role_name: 'locataire' }
          ]
        },
        transaction
      });
      const roleId = locataireRole ? locataireRole.id : 8;

      // 3. Lecture des lignes de données (à partir de la ligne 5)
      const startRow = 5;
      const rowCount = worksheet.rowCount;

      for (let i = startRow; i <= rowCount; i++) {
        const row = worksheet.getRow(i);
        const roomNumberVal = row.getCell(1).value;
        if (!roomNumberVal) continue;

        const roomNumber = roomNumberVal.toString().trim();
        if (roomNumber.toUpperCase() === 'TOTAL' || roomNumber.toUpperCase().startsWith('GENERATED')) {
          break; // Fin du tableau
        }

        stats.apartments.total++;

        // Lecture des colonnes
        const tenantName = getStrVal(row.getCell(2));
        const telephone = getStrVal(row.getCell(3));
        const dateOccupation = getDateVal(row.getCell(4)) || new Date();
        const rentAmount = getNumVal(row.getCell(5));
        const arriere = getNumVal(row.getCell(6));
        const dette = getNumVal(row.getCell(7));
        const anticipation = getNumVal(row.getCell(8));
        const versementMois = getNumVal(row.getCell(9));
        const modePaiement = getStrVal(row.getCell(11)) || getStrVal(row.getCell(10)) || ''; // mode de paiement si renseigné

        // A. Recherche ou création de l'appartement (Apartment)
        let apartment = await Apartment.findOne({
          where: { property_id: property.id, apartment_number: roomNumber },
          transaction
        });

        if (!apartment) {
          apartment = await Apartment.create({
            property_id: property.id,
            apartment_number: roomNumber,
            apartment_type: roomNumber.toLowerCase().includes('stu') ? 'studio' : (roomNumber.toLowerCase().includes('ch') ? 'chambre' : 'appartement'),
            rent_amount: rentAmount,
            status: tenantName ? 'occupied' : 'free',
          }, { transaction });
          stats.apartments.created++;
        } else {
          const updateData = {};
          if (rentAmount > 0) updateData.rent_amount = rentAmount;
          updateData.status = tenantName ? 'occupied' : 'free';
          await apartment.update(updateData, { transaction });
          stats.apartments.updated++;
        }

        // B. Gestion de l'occupation
        if (tenantName) {
          stats.tenants.total++;

          // Chercher s'il y a déjà un locataire actif pour ce logement
          let activeTenant = await Tenant.findOne({
            where: { apartment_id: apartment.id, status: 'active' },
            include: [{ model: User, as: 'user' }],
            transaction
          });

          let user;
          // Si le locataire actif a un nom différent, on le désactive pour installer le nouveau
          if (activeTenant && activeTenant.user && activeTenant.user.full_name !== tenantName) {
            await activeTenant.update({ status: 'inactive' }, { transaction });
            await Lease.update({ status: 'terminated', end_date: new Date() }, {
              where: { tenant_id: activeTenant.id, apartment_id: apartment.id, status: 'active' },
              transaction
            });
            stats.tenants.terminated++;
            activeTenant = null;
          }

          if (!activeTenant) {
            // Création ou récupération de l'utilisateur par nom complet
            user = await User.findOne({ where: { full_name: tenantName }, transaction });
            if (!user) {
              const slug = tenantName.toLowerCase().replace(/[^a-z0-9]/g, '');
              const cleanPhone = telephone ? telephone.replace(/[^0-9]/g, '') : '';
              let email = cleanPhone.length >= 6
                ? `${cleanPhone}@smg-immobilier.com`
                : `${slug || 'locataire'}_${Math.round(Math.random() * 1e6)}@smg-immobilier.com`;

              // Vérification d'unicité de l'email
              const existingUserByEmail = await User.findOne({ where: { email }, transaction });
              if (existingUserByEmail) {
                email = `${slug || 'locataire'}_${Math.round(Math.random() * 1e6)}@smg-immobilier.com`;
              }

              user = await User.create({
                full_name: tenantName,
                phone: telephone,
                email,
                password: 'SmgPassword2026!', // sera hashé par hook
                role_id: roleId,
                status: 'active',
              }, { transaction });
            } else if (telephone) {
              await user.update({ phone: telephone }, { transaction });
            }

            // Création du profil Locataire
            activeTenant = await Tenant.create({
              user_id: user.id,
              apartment_id: apartment.id,
              start_date: dateOccupation,
              status: 'active',
            }, { transaction });
            stats.tenants.created++;
          } else {
            user = activeTenant.user;
            if (telephone && user.phone !== telephone) {
              await user.update({ phone: telephone }, { transaction });
            }
            stats.tenants.updated++;
          }

          // C. Création ou mise à jour du bail (Lease)
          let lease = await Lease.findOne({
            where: { tenant_id: activeTenant.id, apartment_id: apartment.id, status: 'active' },
            transaction
          });

          if (!lease) {
            lease = await Lease.create({
              tenant_id: activeTenant.id,
              apartment_id: apartment.id,
              start_date: dateOccupation,
              monthly_rent: rentAmount || apartment.rent_amount,
              deposit_amount: 0,
              status: 'active',
            }, { transaction });
          } else if (rentAmount > 0 && lease.monthly_rent !== rentAmount) {
            await lease.update({ monthly_rent: rentAmount }, { transaction });
          }

          // D. Alignement des soldes et paiements
          // 1. Suppression de tous les paiements associés pour éviter les conflits
          await Payment.destroy({
            where: { tenant_id: activeTenant.id, apartment_id: apartment.id },
            transaction
          });

          // 2. Calcul du montant total théorique dû à ce jour
          const leaseStart = lease.start_date;
          const months = monthsElapsed(leaseStart);
          const totalDue = months * (rentAmount || lease.monthly_rent);

          // Solde cible selon l'Excel
          const sheetDette = Math.max(arriere, dette);
          const solde = sheetDette - anticipation;

          // Somme des paiements devant être validés en base
          const targetTotalValide = Math.max(0, totalDue - solde);

          // Paiements passés (avant le mois en cours)
          const targetPastValide = Math.max(0, targetTotalValide - versementMois);

          // Insérer le paiement historique (passé) si applicable
          if (targetPastValide > 0) {
            const today = new Date();
            const pastDate = new Date(today.getFullYear(), today.getMonth(), 0); // dernier jour du mois précédent
            await Payment.create({
              tenant_id: activeTenant.id,
              apartment_id: apartment.id,
              amount: targetPastValide,
              payment_method: 'cash',
              payment_date: pastDate,
              status: 'completed',
            }, { transaction });
            stats.payments.totalCreated++;
          }

          // Insérer le paiement du mois en cours si applicable
          if (versementMois > 0) {
            await Payment.create({
              tenant_id: activeTenant.id,
              apartment_id: apartment.id,
              amount: versementMois,
              payment_method: mapPaymentMethod(modePaiement),
              payment_date: new Date(),
              status: 'completed',
            }, { transaction });
            stats.payments.totalCreated++;
          }

        } else {
          // Si le logement est marqué vide dans l'Excel, résilier tout locataire actif
          const activeTenants = await Tenant.findAll({
            where: { apartment_id: apartment.id, status: 'active' },
            transaction
          });

          for (const t of activeTenants) {
            await t.update({ status: 'inactive' }, { transaction });
            await Lease.update({ status: 'terminated', end_date: new Date() }, {
              where: { tenant_id: t.id, apartment_id: apartment.id, status: 'active' },
              transaction
            });
            stats.tenants.terminated++;
          }
        }
      }
    });

    return stats;
  }
}

module.exports = new ImportService();
