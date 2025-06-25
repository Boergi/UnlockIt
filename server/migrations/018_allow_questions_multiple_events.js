exports.up = async function(knex) {
  // Remove the unique constraint that prevents questions from being assigned to multiple events
  await knex.schema.alterTable('event_questions', function(table) {
    table.dropUnique(['event_id', 'question_id']);
  });
  
  console.log('✅ Removed unique constraint - questions can now be assigned to multiple events');
};

exports.down = async function(knex) {
  // Re-add the unique constraint if we need to rollback
  await knex.schema.alterTable('event_questions', function(table) {
    table.unique(['event_id', 'question_id']);
  });
}; 