exports.up = function(knex) {
  return knex.schema.table('events', function(table) {
    table.string('logo_url').nullable();
    table.boolean('ai_logo_generated').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.table('events', function(table) {
    table.dropColumn('logo_url');
    table.dropColumn('ai_logo_generated');
  });
}; 