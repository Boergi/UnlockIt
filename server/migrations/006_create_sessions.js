exports.up = function(knex) {
  return knex.schema.createTable('sessions', function(table) {
    table.string('session_id', 128).primary();
    table.text('session_data').notNullable();
    table.timestamp('expires').notNullable();
    table.timestamps(true, true);
    
    // Index for cleanup of expired sessions
    table.index('expires');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('sessions');
}; 