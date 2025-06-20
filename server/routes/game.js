const express = require('express');
const ExcelJS = require('exceljs');
const { authenticateToken } = require('./auth');
const router = express.Router();

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Get current question for team
router.get('/team/:teamId/current-question', async (req, res) => {
  try {
    const team = await knex('teams').where({ id: req.params.teamId }).first();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if event has started
    const event = await knex('events').where({ id: team.event_id }).first();
    const now = new Date();
    if (new Date(event.start_time) > now) {
      return res.status(403).json({ error: 'Event has not started yet' });
    }

    // Get all questions for the event
    let questions = await knex('questions')
      .join('event_questions', 'questions.id', 'event_questions.question_id')
      .where('event_questions.event_id', team.event_id)
      .select('questions.*', 'event_questions.order_index')
      .orderBy(event.use_random_order ? knex.raw('RAND()') : 'event_questions.order_index');

    if (questions.length === 0) {
      return res.status(404).json({ error: 'No questions found for this event' });
    }

    // Get team's progress including incomplete questions
    const allProgress = await knex('team_progress')
      .where({ team_id: req.params.teamId });

    const completedQuestionIds = allProgress
      .filter(p => p.correct)
      .map(p => p.question_id);

    // Check if there's an incomplete question (started but not answered correctly)
    const incompleteProgress = allProgress.find(p => !p.correct);
    
    if (incompleteProgress) {
      // Return the incomplete question with progress
      const incompleteQuestion = questions.find(q => q.id === incompleteProgress.question_id);
      if (incompleteQuestion) {
        const { solution, ...questionData } = incompleteQuestion;
        const attemptsUsed = [incompleteProgress.attempt_1, incompleteProgress.attempt_2, incompleteProgress.attempt_3]
          .filter(Boolean).length;
        
        return res.json({
          ...questionData,
          progress: {
            attemptsUsed,
            usedTip: incompleteProgress.used_tip || 0,
            timeStarted: incompleteProgress.time_started
          }
        });
      }
    }

    // Find next unanswered question
    const nextQuestion = questions.find(q => !completedQuestionIds.includes(q.id));
    
    if (!nextQuestion) {
      return res.json({ completed: true, message: 'All questions completed!' });
    }

    // Check if there's already a progress entry for this question
    let existingProgress = allProgress.find(p => p.question_id === nextQuestion.id);
    
    // Remove solution from response for security
    const { solution, ...questionData } = nextQuestion;
    
    if (existingProgress) {
      // Return existing progress
      const attemptsUsed = [existingProgress.attempt_1, existingProgress.attempt_2, existingProgress.attempt_3]
        .filter(Boolean).length;
      
      res.json({
        ...questionData,
        progress: {
          attemptsUsed,
          usedTip: existingProgress.used_tip || 0,
          timeStarted: existingProgress.time_started
        }
      });
    } else {
      // Fresh question - no progress yet
      res.json(questionData);
    }
  } catch (error) {
    console.error('Get current question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start a question (create progress entry with start time)
router.post('/question/:questionId/start', async (req, res) => {
  try {
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const question = await knex('questions').where({ id: req.params.questionId }).first();
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    console.log(`🔍 Checking progress for team ${teamId}, question ${req.params.questionId}`);

    // Check if progress already exists
    let progress = await knex('team_progress')
      .where({ team_id: teamId, question_id: req.params.questionId })
      .first();

    console.log('📊 Existing progress:', progress);

    if (!progress) {
      console.log('➕ Creating new progress entry...');
      try {
        const [progressId] = await knex('team_progress').insert({
          team_id: teamId,
          question_id: req.params.questionId,
          time_started: new Date()
        });
        progress = await knex('team_progress').where({ id: progressId }).first();
        
        console.log('✅ New progress created:', progress);
        
        res.json({ 
          started: true, 
          timeStarted: progress.time_started,
          message: 'Question started successfully' 
        });
      } catch (insertError) {
        console.log('❌ Insert failed, checking if entry was created by another request...');
        // Maybe another request created it in the meantime
        progress = await knex('team_progress')
          .where({ team_id: teamId, question_id: req.params.questionId })
          .first();
        
        if (progress) {
          console.log('🔄 Found existing progress after failed insert:', progress);
          res.json({ 
            started: true, 
            timeStarted: progress.time_started,
            message: 'Question was already started (race condition)',
            existing: true
          });
        } else {
          throw insertError; // Re-throw if it's a different error
        }
      }
    } else {
      console.log('🔄 Progress already exists, returning existing data');
      // Progress already exists - return existing start time
      res.json({ 
        started: true, 
        timeStarted: progress.time_started,
        message: 'Question was already started',
        existing: true
      });
    }
  } catch (error) {
    console.error('Start question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get already used tips for a question
router.get('/question/:questionId/tips/:teamId', async (req, res) => {
  try {
    const { questionId, teamId } = req.params;

    const question = await knex('questions').where({ id: questionId }).first();
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const progress = await knex('team_progress')
      .where({ team_id: teamId, question_id: questionId })
      .first();

    const tips = [];
    if (progress && progress.used_tip) {
      for (let i = 1; i <= progress.used_tip; i++) {
        const tipField = `tip_${i}`;
        tips.push(question[tipField]);
      }
    }

    res.json({ tips, usedTip: progress?.used_tip || 0 });
  } catch (error) {
    console.error('Get tips error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tip for question
router.post('/question/:questionId/tip', async (req, res) => {
  try {
    const { teamId, tipNumber } = req.body;

    if (!teamId || !tipNumber || tipNumber < 1 || tipNumber > 3) {
      return res.status(400).json({ error: 'Team ID and valid tip number (1-3) are required' });
    }

    const question = await knex('questions').where({ id: req.params.questionId }).first();
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Check if team already used this tip or higher
    let progress = await knex('team_progress')
      .where({ team_id: teamId, question_id: req.params.questionId })
      .first();

    if (!progress) {
      // Create progress record if it doesn't exist
      const [progressId] = await knex('team_progress').insert({
        team_id: teamId,
        question_id: req.params.questionId,
        used_tip: tipNumber,
        time_started: new Date()
      });
      progress = await knex('team_progress').where({ id: progressId }).first();
    } else if (progress.used_tip >= tipNumber) {
      // Already used this tip or higher
    } else {
      // Update tip usage
      await knex('team_progress')
        .where({ id: progress.id })
        .update({ used_tip: tipNumber });
    }

    const tipField = `tip_${tipNumber}`;
    const tip = question[tipField];

    res.json({ tip, tipNumber });
  } catch (error) {
    console.error('Get tip error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit answer
router.post('/question/:questionId/answer', async (req, res) => {
  try {
    const { teamId, answer } = req.body;

    if (!teamId || !answer) {
      return res.status(400).json({ error: 'Team ID and answer are required' });
    }

    const question = await knex('questions').where({ id: req.params.questionId }).first();
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    let progress = await knex('team_progress')
      .where({ team_id: teamId, question_id: req.params.questionId })
      .first();

    if (!progress) {
      // Create progress record with first attempt
      const [progressId] = await knex('team_progress').insert({
        team_id: teamId,
        question_id: req.params.questionId,
        attempt_1: answer,
        time_started: new Date()
      });
      progress = await knex('team_progress').where({ id: progressId }).first();
    } else if (progress.correct) {
      return res.status(400).json({ error: 'Question already answered correctly' });
    } else {
      // Update with next attempt
      let updateData = {};
      if (!progress.attempt_1) {
        updateData.attempt_1 = answer;
      } else if (!progress.attempt_2) {
        updateData.attempt_2 = answer;
      } else if (!progress.attempt_3) {
        updateData.attempt_3 = answer;
      } else {
        return res.status(400).json({ error: 'Maximum attempts reached' });
      }

      await knex('team_progress')
        .where({ id: progress.id })
        .update(updateData);
      
      progress = await knex('team_progress').where({ id: progress.id }).first();
    }

    // Check if answer is correct
    const isCorrect = answer.toLowerCase().trim() === question.solution.toLowerCase().trim();
    
    if (isCorrect) {
      // Calculate points based on time and tips used
      const timeStarted = new Date(progress.time_started);
      const timeAnswered = new Date();
      const timeTaken = (timeAnswered - timeStarted) / 1000; // seconds
      
      let points = 0;
      if (progress.used_tip >= 3) {
        points = 0; // No points if solution tip was used
      } else {
        const basePoints = { easy: 100, medium: 200, hard: 300 }[question.difficulty] || 200;
        const timeBonus = Math.max(0, question.time_limit_seconds - timeTaken) / question.time_limit_seconds;
        const tipPenalty = progress.used_tip * 0.2; // 20% penalty per tip
        
        points = Math.round(basePoints * (1 + timeBonus * 0.5) * (1 - tipPenalty));
        points = Math.max(points, 10); // Minimum points
      }

      await knex('team_progress')
        .where({ id: progress.id })
        .update({
          correct: true,
          time_answered: knex.fn.now(),
          points_awarded: points
        });

      res.json({ correct: true, points });
    } else {
      const attemptsUsed = [progress.attempt_1, progress.attempt_2, progress.attempt_3]
        .filter(Boolean).length;
      
      res.json({ 
        correct: false, 
        attemptsRemaining: 3 - attemptsUsed,
        message: attemptsUsed >= 3 ? 'No more attempts remaining' : 'Incorrect answer'
      });
    }
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get scoreboard for event
router.get('/event/:eventId/scoreboard', async (req, res) => {
  try {
    const scoreboard = await knex('teams')
      .leftJoin('team_progress', 'teams.id', 'team_progress.team_id')
      .where({ 'teams.event_id': req.params.eventId })
      .groupBy('teams.id')
      .select(
        'teams.id',
        'teams.name',
        'teams.logo_url',
        knex.raw('SUM(team_progress.points_awarded) as total_points'),
        knex.raw('COUNT(CASE WHEN team_progress.correct = 1 THEN 1 END) as questions_solved'),
        knex.raw('MAX(team_progress.time_answered) as last_answer_time')
      )
      .orderBy('total_points', 'desc')
      .orderBy('last_answer_time', 'asc');

    res.json(scoreboard);
  } catch (error) {
    console.error('Get scoreboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export game results to Excel
router.get('/event/:eventId/export', authenticateToken, async (req, res) => {
  try {
    const event = await knex('events').where({ id: req.params.eventId }).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const results = await knex('teams')
      .leftJoin('team_progress', 'teams.id', 'team_progress.team_id')
      .leftJoin('questions', 'team_progress.question_id', 'questions.id')
      .leftJoin('event_questions', 'questions.id', 'event_questions.question_id')
      .where({ 
        'teams.event_id': req.params.eventId,
        'event_questions.event_id': req.params.eventId
      })
      .select(
        'teams.name as team_name',
        'questions.title as question_title',
        'questions.difficulty',
        'team_progress.attempt_1',
        'team_progress.attempt_2',
        'team_progress.attempt_3',
        'team_progress.used_tip',
        'team_progress.correct',
        'team_progress.points_awarded',
        'team_progress.time_started',
        'team_progress.time_answered',
        'event_questions.order_index'
      )
      .orderBy('teams.name')
      .orderBy('event_questions.order_index');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Game Results');

    worksheet.columns = [
      { header: 'Team Name', key: 'team_name', width: 20 },
      { header: 'Question', key: 'question_title', width: 30 },
      { header: 'Difficulty', key: 'difficulty', width: 10 },
      { header: 'Attempt 1', key: 'attempt_1', width: 15 },
      { header: 'Attempt 2', key: 'attempt_2', width: 15 },
      { header: 'Attempt 3', key: 'attempt_3', width: 15 },
      { header: 'Tips Used', key: 'used_tip', width: 10 },
      { header: 'Correct', key: 'correct', width: 10 },
      { header: 'Points', key: 'points_awarded', width: 10 },
      { header: 'Time Started', key: 'time_started', width: 20 },
      { header: 'Time Answered', key: 'time_answered', width: 20 }
    ];

    results.forEach(result => {
      worksheet.addRow(result);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${event.name}_results.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 