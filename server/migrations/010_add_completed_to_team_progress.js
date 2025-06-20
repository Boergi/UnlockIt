exports.up = function(knex) {
  return knex.schema.alterTable('team_progress', function(table) {
    table.boolean('completed').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('team_progress', function(table) {
    table.dropColumn('completed');
  });
}; 