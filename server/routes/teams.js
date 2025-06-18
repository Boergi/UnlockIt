const express = require('express');
const { authenticateToken } = require('./auth');
const router = express.Router();

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Get teams for event
router.get('/event/:eventId', async (req, res) => {
  try {
    const teams = await knex('teams')
      .where({ event_id: req.params.eventId })
      .orderBy('created_at', 'asc');
    
    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register team for event
router.post('/register', async (req, res) => {
  try {
    const { name, event_id, access_code } = req.body;

    if (!name || !event_id) {
      return res.status(400).json({ error: 'Team name and event ID are required' });
    }

    // Check if event exists and registration is open
    const event = await knex('events').where({ id: event_id }).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event.team_registration_open) {
      return res.status(403).json({ error: 'Team registration is closed for this event' });
    }

    // Check access code if required
    if (event.access_code && event.access_code !== access_code) {
      return res.status(403).json({ error: 'Invalid access code' });
    }

    // Check if team name already exists for this event
    const existingTeam = await knex('teams')
      .where({ name, event_id })
      .first();
    
    if (existingTeam) {
      return res.status(409).json({ error: 'Team name already exists for this event' });
    }

    const [teamId] = await knex('teams').insert({
      name,
      event_id
    });

    const team = await knex('teams').where({ id: teamId }).first();
    res.status(201).json(team);
  } catch (error) {
    console.error('Team registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team details
router.get('/:id', async (req, res) => {
  try {
    const team = await knex('teams')
      .where({ id: req.params.id })
      .first();
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update team (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, logo_url } = req.body;
    
    await knex('teams')
      .where({ id: req.params.id })
      .update({
        name,
        logo_url,
        updated_at: knex.fn.now()
      });

    const team = await knex('teams').where({ id: req.params.id }).first();
    res.json(team);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete team (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await knex('teams')
      .where({ id: req.params.id })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team progress
router.get('/:id/progress', async (req, res) => {
  try {
    const progress = await knex('team_progress')
      .join('questions', 'team_progress.question_id', 'questions.id')
      .where({ team_id: req.params.id })
      .select(
        'team_progress.*',
        'questions.title as question_title',
        'questions.difficulty'
      )
      .orderBy('questions.order_index');

    res.json(progress);
  } catch (error) {
    console.error('Get team progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 