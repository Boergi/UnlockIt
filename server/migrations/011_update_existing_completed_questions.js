exports.up = function(knex) {
  return knex.raw('UPDATE team_progress SET completed = true WHERE correct = true');
};

exports.down = function(knex) {
  return knex.raw('UPDATE team_progress SET completed = false WHERE correct = true');
}; 