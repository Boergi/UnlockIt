exports.up = function(knex) {
  return knex.schema.createTable('team_progress', function(table) {
    table.increments('id').primary();
    table.integer('team_id').unsigned().notNullable();
    table.integer('question_id').unsigned().notNullable();
    table.string('attempt_1').nullable();
    table.string('attempt_2').nullable();
    table.string('attempt_3').nullable();
    table.integer('used_tip').defaultTo(0);
    table.boolean('correct').defaultTo(false);
    table.datetime('time_started').nullable();
    table.datetime('time_answered').nullable();
    table.integer('points_awarded').defaultTo(0);
    table.timestamps(true, true);
    
    table.foreign('team_id').references('teams.id').onDelete('CASCADE');
    table.foreign('question_id').references('questions.id').onDelete('CASCADE');
    table.unique(['team_id', 'question_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('team_progress');
}; 