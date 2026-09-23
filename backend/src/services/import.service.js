const ExcelJS = require('exceljs');
const { Property, Apartment, Tenant, User, Lease, Payment, UtilityBill, Role, sequelize } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../config/logger');

function monthsElapsed(startDate) {
  if (!startDate) return 0;
  const s = new Date(startDate);
  const n = new Date();
  if (isNaN(s) || s > n) return 0;
  return (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth()) + 1;
}

const getNumVal = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return 0;
  if (typeof cell.value === 'number') return cell.value;
  if (typeof cell.value === 'object' && cell.value.result !== undefined) {
    const val = parseFloat(cell.value.result);
    return isNaN(val) ? 0 : val;
  }
  const parsed = parseFloat(cell.value.toString().replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

const getStrVal = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if (cell.value.result !== undefined && cell.value.result !== null) return cell.value.result.toString().trim();
    if (cell.value.text !== undefined && cell.value.text !== null) return cell.value.text.toString().trim();
    return JSON.stringify(cell.value);
  }
  return cell.value.toString().trim();
};

const getDateVal = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  if (cell.value instanceof Date) return cell.value;
  if (typeof cell.value === 'object' && cell.value.result instanceof Date) return cell.value.result;
  const str = getStrVal(cell);
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

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
   * Importe la situation d'un ou plusieurs immeubles depuis un fichier Excel (multi-feuilles / multi-colonnes).
   */
  async importBuildingSituation(filePath, options = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      throw new Error("Le fichier Excel ne contient aucune feuille de calcul valide.");
    }

    const overallStats = {
      propertiesCount: 0,
      properties: [],
      apartments: { total: 0, created: 0, updated: 0 },
      tenants: { total: 0, created: 0, updated: 0, terminated: 0 },
      payments: { totalCreated: 0 },
    };

    await sequelize.transaction(async (transaction) => {
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

      for (const worksheet of workbook.worksheets) {
        if (!worksheet || worksheet.rowCount < 2) continue;

        // Determination du nom de l'immeuble
        let propertyName = '';
        const titleVal = worksheet.getCell('A1').value;
        if (typeof titleVal === 'string' && titleVal.trim()) {
          if (titleVal.startsWith('Situation — ')) {
            propertyName = titleVal.replace('Situation — ', '').trim();
          } else if (titleVal.toLowerCase().includes('situation') || titleVal.toLowerCase().includes('immeuble')) {
            propertyName = titleVal.replace(/situation\s*(de\s*l'|de\s*|d'|—|-)*\s*/i, '').trim();
          } else {
            propertyName = titleVal.trim();
          }
        }
        if (!propertyName || propertyName.length > 80 || propertyName.includes('\n')) {
          propertyName = worksheet.name || 'Immeuble Importé';
        }

        // Créer ou réutiliser l'immeuble
        let property = await Property.findOne({ where: { property_name: propertyName }, transaction });
        let isNewProp = false;
        if (!property) {
          property = await Property.create({
            property_name: propertyName,
            property_type: 'immeuble',
            address: options.address || 'Non spécifiée',
            city: options.city || 'Douala',
            district: options.district || '',
            status: 'active',
          }, { transaction });
          isNewProp = true;
          overallStats.propertiesCount++;
        } else {
          const updateData = {};
          if (options.address) updateData.address = options.address;
          if (options.city) updateData.city = options.city;
          if (options.district) updateData.district = options.district;
          if (Object.keys(updateData).length > 0) {
            await property.update(updateData, { transaction });
          }
        }
        overallStats.properties.push(propertyName);

        // Analyse dynamique de l'en-tête (lignes 1 à 10)
        let headerRowIndex = 5;
        const colMap = {
          room: 1,
          tenant: 2,
          phone: 3,
          date: 4,
          rent: 5,
          caution: 0,
          arriere: 6,
          avance: 0,
          dette: 7,
          anticipation: 8,
          versement: 9,
          periode: 10,
          mode: 11,
          type: 0,
          chateau: 0,
          obs: 0,
        };

        for (let r = 1; r <= Math.min(12, worksheet.rowCount); r++) {
          const row = worksheet.getRow(r);
          let matchCount = 0;
          row.eachCell((cell, colNum) => {
            const val = getStrVal(cell).toLowerCase();
            if (val.includes('chambre') || val.includes('logement') || val.includes('code') || val.includes('n°') || val.includes('numéro')) {
              colMap.room = colNum; matchCount++;
            } else if (val.includes('locataire') || val.includes('nom') || val.includes('client')) {
              colMap.tenant = colNum; matchCount++;
            } else if (val.includes('téléphone') || val.includes('contact') || val.includes('tel') || val.includes('phone')) {
              colMap.phone = colNum; matchCount++;
            } else if (val.includes('date') || val.includes('entrée') || val.includes('occupation')) {
              colMap.date = colNum; matchCount++;
            } else if (val.includes('loyer') || val.includes('montant attendu') || val.includes('mensuel')) {
              colMap.rent = colNum; matchCount++;
            } else if (val.includes('caution') || val.includes('dépôt')) {
              colMap.caution = colNum; matchCount++;
            } else if (val.includes('arriéré') || val.includes('arriere')) {
              colMap.arriere = colNum; matchCount++;
            } else if (val.includes('avance sur arriéré') || val.includes('avance')) {
              colMap.avance = colNum; matchCount++;
            } else if (val.includes('dette')) {
              colMap.dette = colNum; matchCount++;
            } else if (val.includes('anticipation')) {
              colMap.anticipation = colNum; matchCount++;
            } else if (val.includes('versement') || val.includes('payé') || val.includes('reçu')) {
              colMap.versement = colNum; matchCount++;
            } else if (val.includes('période') || val.includes('periode')) {
              colMap.periode = colNum; matchCount++;
            } else if (val.includes('mode') || val.includes('moyen')) {
              colMap.mode = colNum; matchCount++;
            } else if (val.includes('description') || val.includes('type')) {
              colMap.type = colNum; matchCount++;
            } else if (val.includes('château') || val.includes('chateau') || val.includes('entretien')) {
              colMap.chateau = colNum; matchCount++;
            } else if (val.includes('observation') || val.includes('remarque')) {
              colMap.obs = colNum; matchCount++;
            }
          });
          if (matchCount >= 3) {
            headerRowIndex = r + 1;
            break;
          }
        }

        // Parcourir les lignes de données
        for (let i = headerRowIndex; i <= worksheet.rowCount; i++) {
          const row = worksheet.getRow(i);
          const roomVal = getStrVal(row.getCell(colMap.room));
          if (!roomVal) continue;
          if (roomVal.toUpperCase() === 'TOTAL' || roomVal.toUpperCase().startsWith('GENERATED') || roomVal.toUpperCase().includes('SYNTHESE')) {
            break;
          }

          overallStats.apartments.total++;

          const tenantName = colMap.tenant ? getStrVal(row.getCell(colMap.tenant)) : '';
          const telephone = colMap.phone ? getStrVal(row.getCell(colMap.phone)) : '';
          const dateOccupation = (colMap.date ? getDateVal(row.getCell(colMap.date)) : null) || new Date();
          const rentAmount = colMap.rent ? getNumVal(row.getCell(colMap.rent)) : 0;
          const cautionAmount = colMap.caution ? getNumVal(row.getCell(colMap.caution)) : 0;
          const arriere = colMap.arriere ? getNumVal(row.getCell(colMap.arriere)) : 0;
          const avanceArriere = colMap.avance ? getNumVal(row.getCell(colMap.avance)) : 0;
          const dette = colMap.dette ? getNumVal(row.getCell(colMap.dette)) : 0;
          const anticipation = colMap.anticipation ? getNumVal(row.getCell(colMap.anticipation)) : 0;
          const versementMois = colMap.versement ? getNumVal(row.getCell(colMap.versement)) : 0;
          const modePaiement = colMap.mode ? getStrVal(row.getCell(colMap.mode)) : '';
          const descType = colMap.type ? getStrVal(row.getCell(colMap.type)) : '';
          const chateauFee = colMap.chateau ? getNumVal(row.getCell(colMap.chateau)) : 0;

          // Déterminer le type de logement
          let aptType = 'appartement';
          const rLower = (roomVal + ' ' + descType).toLowerCase();
          if (rLower.includes('stu')) aptType = 'studio';
          else if (rLower.includes('ch')) aptType = 'chambre';
          else if (rLower.includes('dup')) aptType = 'duplex';
          else if (rLower.includes('vil')) aptType = 'villa';
          else if (rLower.includes('btq') || rLower.includes('bout')) aptType = 'boutique';
          else if (rLower.includes('bur')) aptType = 'bureau';
          else if (rLower.includes('mag')) aptType = 'magasin';

          // A. Recherche ou création du logement (Apartment)
          let apartment = await Apartment.findOne({
            where: { property_id: property.id, apartment_number: roomVal },
            transaction
          });

          if (!apartment) {
            apartment = await Apartment.create({
              property_id: property.id,
              apartment_number: roomVal,
              apartment_type: aptType,
              rent_amount: rentAmount,
              status: tenantName ? 'occupied' : 'free',
            }, { transaction });
            overallStats.apartments.created++;
          } else {
            const updateData = { status: tenantName ? 'occupied' : 'free' };
            if (rentAmount > 0) updateData.rent_amount = rentAmount;
            if (aptType) updateData.apartment_type = aptType;
            await apartment.update(updateData, { transaction });
            overallStats.apartments.updated++;
          }

          // B. Gestion du locataire si présent
          if (tenantName) {
            overallStats.tenants.total++;

            let activeTenant = await Tenant.findOne({
              where: { apartment_id: apartment.id, status: 'active' },
              include: [{ model: User, as: 'user' }],
              transaction
            });

            let user;
            if (activeTenant && activeTenant.user && activeTenant.user.full_name !== tenantName) {
              await activeTenant.update({ status: 'inactive' }, { transaction });
              await Lease.update({ status: 'terminated', end_date: new Date() }, {
                where: { tenant_id: activeTenant.id, apartment_id: apartment.id, status: 'active' },
                transaction
              });
              overallStats.tenants.terminated++;
              activeTenant = null;
            }

            if (!activeTenant) {
              user = await User.findOne({ where: { full_name: tenantName }, transaction });
              if (!user) {
                const slug = tenantName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanPhone = telephone ? telephone.replace(/[^0-9]/g, '') : '';
                let email = cleanPhone.length >= 6
                  ? `${cleanPhone}@smg-immobilier.com`
                  : `${slug || 'locataire'}_${Math.round(Math.random() * 1e6)}@smg-immobilier.com`;

                const existingUserByEmail = await User.findOne({ where: { email }, transaction });
                if (existingUserByEmail) {
                  email = `${slug || 'locataire'}_${Math.round(Math.random() * 1e6)}@smg-immobilier.com`;
                }

                user = await User.create({
                  full_name: tenantName,
                  phone: telephone,
                  email,
                  password: 'SmgPassword2026!',
                  role_id: roleId,
                  status: 'active',
                }, { transaction });
              } else if (telephone) {
                await user.update({ phone: telephone }, { transaction });
              }

              activeTenant = await Tenant.create({
                user_id: user.id,
                apartment_id: apartment.id,
                start_date: dateOccupation,
                status: 'active',
              }, { transaction });
              overallStats.tenants.created++;
            } else {
              user = activeTenant.user;
              if (telephone && user.phone !== telephone) {
                await user.update({ phone: telephone }, { transaction });
              }
              overallStats.tenants.updated++;
            }

            // C. Création / Mise à jour du bail (Lease)
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
                deposit_amount: cautionAmount || 0,
                status: 'active',
              }, { transaction });
            } else {
              const leaseUpdates = {};
              if (rentAmount > 0) leaseUpdates.monthly_rent = rentAmount;
              if (cautionAmount > 0) leaseUpdates.deposit_amount = cautionAmount;
              if (Object.keys(leaseUpdates).length) {
                await lease.update(leaseUpdates, { transaction });
              }
            }

            // D. Alignement des soldes et des paiements
            await Payment.destroy({
              where: { tenant_id: activeTenant.id, apartment_id: apartment.id },
              transaction
            });

            const months = monthsElapsed(lease.start_date);
            const totalDue = months * (rentAmount || lease.monthly_rent);
            const sheetDette = Math.max(arriere - avanceArriere, dette);
            const solde = sheetDette - anticipation;

            const targetTotalValide = Math.max(0, totalDue - solde);
            const targetPastValide = Math.max(0, targetTotalValide - versementMois);

            if (targetPastValide > 0) {
              const today = new Date();
              const pastDate = new Date(today.getFullYear(), today.getMonth(), 0);
              await Payment.create({
                tenant_id: activeTenant.id,
                apartment_id: apartment.id,
                amount: targetPastValide,
                payment_method: 'cash',
                payment_date: pastDate,
                status: 'completed',
              }, { transaction });
              overallStats.payments.totalCreated++;
            }

            if (versementMois > 0) {
              await Payment.create({
                tenant_id: activeTenant.id,
                apartment_id: apartment.id,
                amount: versementMois,
                payment_method: mapPaymentMethod(modePaiement),
                payment_date: new Date(),
                status: 'completed',
              }, { transaction });
              overallStats.payments.totalCreated++;
            }

            // Frais entretien château d'eau si spécifié
            if (chateauFee > 0) {
              const now = new Date();
              await UtilityBill.create({
                apartment_id: apartment.id,
                type: 'water',
                period_month: now.getMonth() + 1,
                period_year: now.getFullYear(),
                previous_index: 0,
                current_index: 1,
                unit_price: chateauFee,
                total_amount: chateauFee,
                other_fee: chateauFee,
                other_label: "Entretien du château",
                status: 'pending',
              }, { transaction });
            }

          } else {
            // Si le logement est vide
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
              overallStats.tenants.terminated++;
            }
          }
        }
      }
    });

    return overallStats;
  }
}

module.exports = new ImportService();
