exports.up = async function(knex) {
  // Add team_uuid column to team_progress table
  await knex.schema.alterTable('team_progress', function(table) {
    table.string('team_uuid', 36).nullable();
    table.index('team_uuid');
  });
  
  // Update team_progress records with team UUIDs
  const progressRecords = await knex('team_progress')
    .select('team_progress.id', 'team_progress.team_id', 'teams.uuid as team_uuid')
    .join('teams', 'team_progress.team_id', 'teams.id');
    
  for (const record of progressRecords) {
    await knex('team_progress').where('id', record.id).update({ 
      team_uuid: record.team_uuid 
    });
  }
  
  // Make team_uuid not nullable
  await knex.schema.alterTable('team_progress', function(table) {
    table.string('team_uuid', 36).notNullable().alter();
  });
  
  // Add foreign key constraint for team_uuid
  await knex.schema.alterTable('team_progress', function(table) {
    table.foreign('team_uuid').references('teams.uuid').onDelete('CASCADE');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('team_progress', function(table) {
    table.dropForeign('team_uuid');
    table.dropColumn('team_uuid');
  });
}; 