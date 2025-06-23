exports.up = async function(knex) {
  // First, add UUID extension if not exists (for PostgreSQL, MySQL uses CHAR(36))
  await knex.raw('SET @uuid_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "events" AND column_name = "uuid")');
  
  // Add UUID column to events table
  await knex.schema.alterTable('events', function(table) {
    table.string('uuid', 36).nullable();
    table.index('uuid');
  });
  
  // Generate UUIDs for existing events
  const events = await knex('events').select('id');
  for (const event of events) {
    const uuid = require('crypto').randomUUID();
    await knex('events').where('id', event.id).update({ uuid });
  }
  
  // Make UUID not nullable
  await knex.schema.alterTable('events', function(table) {
    table.string('uuid', 36).notNullable().alter();
    table.unique('uuid');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('events', function(table) {
    table.dropColumn('uuid');
  });
}; 