const { Warehouse, CalendarEvent, User } = require('../src/models');

async function testAll() {
  console.log('=== TEST WAREHOUSES ===');
  const whs = await Warehouse.findAll();
  console.log('Warehouses count:', whs.length);
  whs.forEach((w) => {
    console.log(`- [${w.city}] ${w.name} | Type: ${w.warehouse_type} | Description: ${w.description}`);
  });

  console.log('\n=== TEST CALENDAR EVENT WITH DESCRIPTION ===');
  const user = await User.findOne();
  const ev = await CalendarEvent.create({
    title: 'Audit Chantier Akwa & Point Magasin',
    description: "Vérification complète de l'outillage lourd, état des bétonnières et stock de ciment.",
    start_datetime: new Date(),
    created_by: user.id,
    is_meeting: false,
  });
  console.log(`Created event ID: ${ev.id} | Title: ${ev.title} | Desc: ${ev.description}`);

  const fetched = await CalendarEvent.findByPk(ev.id);
  console.log(`Fetched event desc: ${fetched.description}`);

  await fetched.destroy();
  console.log('Cleaned up test event');
  process.exit(0);
}

testAll().catch((e) => {
  console.error('Error in verification:', e);
  process.exit(1);
});
