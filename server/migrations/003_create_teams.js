exports.up = function(knex) {
  return knex.schema.createTable('teams', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.integer('event_id').unsigned().notNullable();
    table.string('logo_url').nullable();
    table.timestamps(true, true);
    
    table.foreign('event_id').references('events.id').onDelete('CASCADE');
    table.unique(['name', 'event_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('teams');
}; 