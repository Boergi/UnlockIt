exports.up = async function(knex) {
  // Make event_uuid nullable
  await knex.schema.alterTable('event_questions', function(table) {
    table.string('event_uuid', 36).nullable().alter();
  });
};

exports.down = async function(knex) {
  // Make event_uuid not nullable again
  await knex.schema.alterTable('event_questions', function(table) {
    table.string('event_uuid', 36).notNullable().alter();
  });
}; 