exports.up = async function(knex) {
    // Make event_id nullable to support UUID-only events
    await knex.schema.alterTable('event_questions', function(table) {
      table.integer('event_id').unsigned().nullable().alter();
    });
  };
  
  exports.down = async function(knex) {
    // Make event_id not nullable again (this might fail if there are NULL values)
    await knex.schema.alterTable('event_questions', function(table) {
      table.integer('event_id').unsigned().notNullable().alter();
    });
  };