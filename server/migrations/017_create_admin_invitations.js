exports.up = function(knex) {
  return knex.schema.createTable('admin_invitations', function(table) {
    table.increments('id').primary();
    table.string('token', 255).notNullable().unique();
    table.string('email', 255).notNullable();
    table.integer('created_by').unsigned().notNullable();
    table.boolean('used').defaultTo(false);
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('used_at').nullable();
    
    table.foreign('created_by').references('id').inTable('users').onDelete('CASCADE');
    table.index('token');
    table.index('email');
    table.index('expires_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('admin_invitations');
}; 