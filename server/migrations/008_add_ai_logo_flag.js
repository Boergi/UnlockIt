exports.up = function(knex) {
  return knex.schema.table('teams', function(table) {
    table.boolean('ai_logo_generated').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.table('teams', function(table) {
    table.dropColumn('ai_logo_generated');
  });
}; 