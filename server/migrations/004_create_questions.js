exports.up = function(knex) {
  return knex.schema.createTable('questions', function(table) {
    table.increments('id').primary();
    table.string('title').notNullable();
    table.text('description').nullable();
    table.string('image_path').nullable();
    table.enum('difficulty', ['easy', 'medium', 'hard']).defaultTo('medium');
    table.string('solution').notNullable();
    table.text('tip_1').nullable();
    table.text('tip_2').nullable();
    table.text('tip_3').nullable();
    table.integer('time_limit_seconds').defaultTo(300);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('questions');
}; 