exports.up = function(knex) {
  return knex.schema.createTable('events', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.datetime('start_time').notNullable();
    table.boolean('use_random_order').defaultTo(false);
    table.boolean('team_registration_open').defaultTo(true);
    table.string('access_code').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('events');
}; 