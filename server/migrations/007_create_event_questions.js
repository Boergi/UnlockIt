exports.up = function(knex) {
  return knex.schema.createTable('event_questions', function(table) {
    table.increments('id').primary();
    table.integer('event_id').unsigned().notNullable();
    table.integer('question_id').unsigned().notNullable();
    table.integer('order_index').notNullable(); // Reihenfolge der Fragen im Event
    table.timestamps(true, true);
    
    table.foreign('event_id').references('events.id').onDelete('CASCADE');
    table.foreign('question_id').references('questions.id').onDelete('CASCADE');
    
    // Verhindert doppelte Zuordnungen
    table.unique(['event_id', 'question_id']);
    // Verhindert doppelte Reihenfolge im selben Event
    table.unique(['event_id', 'order_index']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('event_questions');
}; 