exports.up = async function(knex) {
  // Add UUID column to teams table
  await knex.schema.alterTable('teams', function(table) {
    table.string('uuid', 36).nullable();
    table.string('event_uuid', 36).nullable();
    table.index('uuid');
    table.index('event_uuid');
  });
  
  // Generate UUIDs for existing teams and link to event UUIDs
  const teams = await knex('teams')
    .select('teams.id', 'teams.event_id', 'events.uuid as event_uuid')
    .join('events', 'teams.event_id', 'events.id');
    
  for (const team of teams) {
    const uuid = require('crypto').randomUUID();
    await knex('teams').where('id', team.id).update({ 
      uuid,
      event_uuid: team.event_uuid 
    });
  }
  
  // Make UUIDs not nullable
  await knex.schema.alterTable('teams', function(table) {
    table.string('uuid', 36).notNullable().alter();
    table.string('event_uuid', 36).notNullable().alter();
    table.unique('uuid');
  });
  
  // Add foreign key constraint for event_uuid
  await knex.schema.alterTable('teams', function(table) {
    table.foreign('event_uuid').references('events.uuid').onDelete('CASCADE');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('teams', function(table) {
    table.dropForeign('event_uuid');
    table.dropColumn('uuid');
    table.dropColumn('event_uuid');
  });
}; 