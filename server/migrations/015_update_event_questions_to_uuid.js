exports.up = async function(knex) {
  // Add event_uuid column to event_questions table
  await knex.schema.alterTable('event_questions', function(table) {
    table.string('event_uuid', 36).nullable();
    table.index('event_uuid');
  });
  
  // Update event_questions records with event UUIDs
  const eventQuestions = await knex('event_questions')
    .select('event_questions.id', 'event_questions.event_id', 'events.uuid as event_uuid')
    .join('events', 'event_questions.event_id', 'events.id');
    
  for (const record of eventQuestions) {
    await knex('event_questions').where('id', record.id).update({ 
      event_uuid: record.event_uuid 
    });
  }
  
  // Make event_uuid not nullable
  await knex.schema.alterTable('event_questions', function(table) {
    table.string('event_uuid', 36).notNullable().alter();
  });
  
  // Add foreign key constraint for event_uuid
  await knex.schema.alterTable('event_questions', function(table) {
    table.foreign('event_uuid').references('events.uuid').onDelete('CASCADE');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('event_questions', function(table) {
    table.dropForeign('event_uuid');
    table.dropColumn('event_uuid');
  });
}; 