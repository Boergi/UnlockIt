const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Check if a string is a valid UUID format
const isUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Get event by ID or UUID
const getEventByIdOrUuid = async (identifier) => {
  if (isUUID(identifier)) {
    return await knex('events').where({ uuid: identifier }).first();
  } else {
    return await knex('events').where({ id: identifier }).first();
  }
};

// Get team by ID or UUID
const getTeamByIdOrUuid = async (identifier) => {
  if (isUUID(identifier)) {
    return await knex('teams').where({ uuid: identifier }).first();
  } else {
    return await knex('teams').where({ id: identifier }).first();
  }
};

// Get teams by event ID or UUID
const getTeamsByEventIdOrUuid = async (eventIdentifier) => {
  if (isUUID(eventIdentifier)) {
    return await knex('teams').where({ event_uuid: eventIdentifier });
  } else {
    return await knex('teams').where({ event_id: eventIdentifier });
  }
};

// Get questions by event ID or UUID
const getQuestionsByEventIdOrUuid = async (eventIdentifier) => {
  if (isUUID(eventIdentifier)) {
    return await knex('questions')
      .join('event_questions', 'questions.id', 'event_questions.question_id')
      .where('event_questions.event_uuid', eventIdentifier)
      .select('questions.*', 'event_questions.order_index', 'event_questions.id as assignment_id')
      .orderBy('event_questions.order_index');
  } else {
    return await knex('questions')
      .join('event_questions', 'questions.id', 'event_questions.question_id')
      .where('event_questions.event_id', eventIdentifier)
      .select('questions.*', 'event_questions.order_index', 'event_questions.id as assignment_id')
      .orderBy('event_questions.order_index');
  }
};

// Get team progress by team ID or UUID
const getTeamProgressByIdOrUuid = async (teamIdentifier) => {
  if (isUUID(teamIdentifier)) {
    return await knex('questions')
      .join('event_questions', 'questions.id', 'event_questions.question_id')
      .leftJoin('team_progress', function() {
        this.on('questions.id', '=', 'team_progress.question_id')
            .andOn('team_progress.team_uuid', '=', knex.raw('?', [teamIdentifier]));
      })
      .join('teams', function() {
        this.on('teams.uuid', '=', knex.raw('?', [teamIdentifier]))
            .andOn('event_questions.event_uuid', '=', 'teams.event_uuid');
      })
      .select(
        'questions.*',
        'event_questions.order_index',
        'team_progress.attempt_1',
        'team_progress.attempt_2', 
        'team_progress.attempt_3',
        'team_progress.used_tip',
        'team_progress.correct',
        'team_progress.time_started',
        'team_progress.time_answered',
        'team_progress.points_awarded',
        'team_progress.completed'
      )
      .orderBy('event_questions.order_index');
  } else {
    return await knex('questions')
      .join('event_questions', 'questions.id', 'event_questions.question_id')
      .leftJoin('team_progress', function() {
        this.on('questions.id', '=', 'team_progress.question_id')
            .andOn('team_progress.team_id', '=', knex.raw('?', [teamIdentifier]));
      })
      .join('teams', function() {
        this.on('teams.id', '=', knex.raw('?', [teamIdentifier]))
            .andOn('event_questions.event_id', '=', 'teams.event_id');
      })
      .select(
        'questions.*',
        'event_questions.order_index',
        'team_progress.attempt_1',
        'team_progress.attempt_2', 
        'team_progress.attempt_3',
        'team_progress.used_tip',
        'team_progress.correct',
        'team_progress.time_started',
        'team_progress.time_answered',
        'team_progress.points_awarded',
        'team_progress.completed'
      )
      .orderBy('event_questions.order_index');
  }
};

module.exports = {
  isUUID,
  getEventByIdOrUuid,
  getTeamByIdOrUuid,
  getTeamsByEventIdOrUuid,
  getQuestionsByEventIdOrUuid,
  getTeamProgressByIdOrUuid
}; 