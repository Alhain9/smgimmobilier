// ============ Point d'entrée du dashboard ============
(function init() {
  if (!Auth.requireAuth()) return;

  Layout.renderSidebar();
  Layout.renderUser();
  // Icônes 3D : convertit aussi les emoji statiques du shell (logo, cloche, etc.)
  if (typeof Icons !== 'undefined') Icons.enhance(document.body);

  // Enregistrement des pages (chaque page s'auto-enregistre via window)
  PageDashboard.register();
  PageActivity.register();
  PageProperties.register();
  PageApartments.register();
  PageTenants.register();
  PageSituation.register();
  PageLeases.register();
  PagePayments.register();
  PageUtilities.register();
  PageMaintenance.register();
  PageExpenses.register();
  PageEquipment.register();
  PageTasks.register();
  PageCalendar.register();
  PageUsers.register();
  PageDocuments.register();
  if (typeof PageReports !== 'undefined') PageReports.register();
  PageSalaries.register();
  PageProfile.register();
  PageRh.register();
  PageKanban.register();
  if (typeof PageMessages !== 'undefined') PageMessages.register();
  if (typeof PageWhatsappGroups !== 'undefined') PageWhatsappGroups.register();
  PageWorkflows.register();
  PageReceipts.register();
  PageManagementReports.register();
  PageStock.register();
  if (typeof PageSuppliers !== 'undefined') PageSuppliers.register();
  PageWorksites.register();
  if (typeof PageGps !== 'undefined') PageGps.register();
  if (typeof PageCompanySettings !== 'undefined') PageCompanySettings.register();

  // Notifications (cloche topbar) — pas pour le locataire (menu réduit, mais on l'active quand même)
  if (typeof Notifications !== 'undefined') Notifications.start();

  // Ferme le panneau notifications et le menu utilisateur au clic extérieur
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('notifDropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
    const um = document.getElementById('userMenu');
    if (um && !um.contains(e.target)) um.classList.remove('open');
  });

  // Route initiale (depuis le hash ou dashboard)
  const initial = window.location.hash.replace('#', '') || 'dashboard';
  Router.go(Router.routes[initial] ? initial : 'dashboard');
})();
