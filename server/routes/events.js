const express = require('express');
const { authenticateToken } = require('./auth');
const router = express.Router();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { formatDateForMySQL } = require('../utils/dateUtils');

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENABLED = process.env.OPENAI_ENABLED === 'true';

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const logosDir = path.join(uploadsDir, 'logos');

const ensureDirectories = async () => {
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
  
  try {
    await fs.access(logosDir);
  } catch {
    await fs.mkdir(logosDir, { recursive: true });
  }
};

ensureDirectories();

// Get all events
router.get('/', authenticateToken, async (req, res) => {
  try {
    const events = await knex('events')
      .select('*')
      .orderBy('created_at', 'desc');
    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard stats (must be before /:id route)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [totalEvents, activeEvents, totalTeams, totalQuestions] = await Promise.all([
      knex('events').count('id as count').first(),
      knex('events')
        .where('team_registration_open', true)
        .andWhere('start_time', '>', knex.fn.now())
        .count('id as count').first(),
      knex('teams').count('id as count').first(),
      knex('questions').count('id as count').first()
    ]);

    res.json({
      totalEvents: parseInt(totalEvents.count),
      activeEvents: parseInt(activeEvents.count),
      totalTeams: parseInt(totalTeams.count),
      totalQuestions: parseInt(totalQuestions.count)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get AI configuration (must be before /:id route)
router.get('/ai-config', (req, res) => {
  res.json({
    aiEnabled: OPENAI_ENABLED && !!OPENAI_API_KEY
  });
});

// Get single event
router.get('/:id', async (req, res) => {
  try {
    const event = await knex('events')
      .where({ id: req.params.id })
      .first();
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, start_time, use_random_order, team_registration_open, access_code, logo_url, generate_ai_logo } = req.body;

    if (!name || !start_time) {
      return res.status(400).json({ error: 'Name and start time are required' });
    }

    let finalLogoUrl = logo_url || null;
    let aiLogoGenerated = false;

    // Generate AI logo if requested
    if (generate_ai_logo && OPENAI_ENABLED && OPENAI_API_KEY) {
      try {
        const prompt = `Create a colorful, modern logo for a corporate event titled '${name}'. The logo should include the full event name '${name}' as clearly readable, centered text in bold geometric sans-serif font. Incorporate a circular emblem or badge design featuring dynamic, abstract business-themed elements like gears, arrows, bar charts, or rising curves. Use a vibrant and professional color palette (e.g. deep blue, coral red, orange, turquoise, gold). Ensure a well-balanced composition with good contrast and visual clarity. The overall style should be sleek, eye-catching, and suitable for event branding.`;

        console.log('🎨 Generating AI logo for event:', name);

        const response = await axios.post(
          'https://api.openai.com/v1/images/generations',
          {
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'hd',
            style: 'vivid',
            response_format: 'url'
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const imageUrl = response.data.data[0].url;

        // Download and save the image locally
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer'
        });

        const fileName = `event_logo_${name.replace(/[^a-zA-Z0-9]/g, '_')}_v1.png`;
        const filePath = path.join(logosDir, fileName);

        await fs.writeFile(filePath, imageResponse.data);

        finalLogoUrl = `/uploads/logos/${fileName}`;
        aiLogoGenerated = true;

        console.log('✅ AI logo generated and saved:', finalLogoUrl);
      } catch (error) {
        console.error('Error generating AI logo:', error);
        // Continue with event creation without logo if AI generation fails
        finalLogoUrl = null;
        
        // Handle specific API errors but don't fail the event creation
        if (error.response?.status === 401) {
          console.error('❌ OpenAI API key is invalid or expired');
        } else if (error.response?.status === 429) {
          console.error('❌ OpenAI API rate limit exceeded');
        }
      }
    }

    const [eventId] = await knex('events').insert({
      name,
      start_time: formatDateForMySQL(start_time),
      use_random_order: use_random_order || false,
      team_registration_open: team_registration_open !== false,
      access_code,
      logo_url: finalLogoUrl,
      ai_logo_generated: aiLogoGenerated
    });

    const event = await knex('events').where({ id: eventId }).first();
    res.status(201).json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update event
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, start_time, use_random_order, team_registration_open, access_code, logo_url, generate_ai_logo } = req.body;
    
    const event = await knex('events').where({ id: req.params.id }).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let finalLogoUrl = logo_url;
    let aiLogoGenerated = event.ai_logo_generated;

    // Generate AI logo if requested
    if (generate_ai_logo && OPENAI_ENABLED && OPENAI_API_KEY) {
      try {
        const prompt = `Create a colorful, modern logo for a corporate event titled '${name || event.name}'. The logo should include the full event name '${name || event.name}' as clearly readable, centered text in bold geometric sans-serif font. Incorporate a circular emblem or badge design featuring dynamic, abstract business-themed elements like gears, arrows, bar charts, or rising curves. Use a vibrant and professional color palette (e.g. deep blue, coral red, orange, turquoise, gold). Ensure a well-balanced composition with good contrast and visual clarity. The overall style should be sleek, eye-catching, and suitable for event branding.`;

        console.log('🎨 Generating AI logo for event:', name || event.name);

        const response = await axios.post(
          'https://api.openai.com/v1/images/generations',
          {
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'hd',
            style: 'vivid',
            response_format: 'url'
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const imageUrl = response.data.data[0].url;

        // Download and save the image locally
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer'
        });

        const fileName = `event_logo_${(name || event.name).replace(/[^a-zA-Z0-9]/g, '_')}_v1.png`;
        const filePath = path.join(logosDir, fileName);

        await fs.writeFile(filePath, imageResponse.data);

        finalLogoUrl = `/uploads/logos/${fileName}`;
        aiLogoGenerated = true;

        console.log('✅ AI logo generated and saved:', finalLogoUrl);
      } catch (error) {
        console.error('Error generating AI logo:', error);
        // Continue with event update without logo change if AI generation fails
        finalLogoUrl = event.logo_url;
        
        // Handle specific API errors
        if (error.response?.status === 401) {
          console.error('❌ OpenAI API key is invalid or expired');
          return res.status(400).json({ 
            error: 'AI-Logo-Generierung fehlgeschlagen: Ungültiger API-Schlüssel. Bitte wenden Sie sich an den Administrator.' 
          });
        } else if (error.response?.status === 429) {
          console.error('❌ OpenAI API rate limit exceeded');
          return res.status(400).json({ 
            error: 'AI-Logo-Generierung fehlgeschlagen: API-Limit erreicht. Bitte versuchen Sie es später erneut.' 
          });
        }
      }
    }
    
    await knex('events')
      .where({ id: req.params.id })
      .update({
        name,
        start_time: formatDateForMySQL(start_time),
        use_random_order,
        team_registration_open,
        access_code,
        logo_url: finalLogoUrl,
        ai_logo_generated: aiLogoGenerated,
        updated_at: knex.fn.now()
      });

    const updatedEvent = await knex('events').where({ id: req.params.id }).first();
    res.json(updatedEvent);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete event
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await knex('events')
      .where({ id: req.params.id })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get event statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await knex('teams')
      .where({ event_id: req.params.id })
      .count('id as team_count')
      .first();

    const questionCount = await knex('event_questions')
      .where({ event_id: req.params.id })
      .count('id as question_count')
      .first();

    res.json({
      teams: stats.team_count || 0,
      questions: questionCount.question_count || 0
    });
  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get questions assigned to event (public for teams)
router.get('/:id/questions', async (req, res) => {
  try {
    const questions = await knex('questions')
      .join('event_questions', 'questions.id', 'event_questions.question_id')
      .where('event_questions.event_id', req.params.id)
      .select('questions.*', 'event_questions.order_index', 'event_questions.id as assignment_id')
      .orderBy('event_questions.order_index');
    
    res.json(questions);
  } catch (error) {
    console.error('Get event questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get questions assigned to event (admin only)
router.get('/:id/questions/admin', authenticateToken, async (req, res) => {
  try {
    const questions = await knex('questions')
      .join('event_questions', 'questions.id', 'event_questions.question_id')
      .where('event_questions.event_id', req.params.id)
      .select('questions.*', 'event_questions.order_index', 'event_questions.id as assignment_id')
      .orderBy('event_questions.order_index');
    
    res.json(questions);
  } catch (error) {
    console.error('Get event questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign questions to event
router.post('/:id/questions', authenticateToken, async (req, res) => {
  try {
    const { questionIds } = req.body; // Array of question IDs in desired order
    
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'Question IDs array is required' });
    }

    // Start transaction
    await knex.transaction(async (trx) => {
      // Remove existing question assignments
      await trx('event_questions')
        .where({ event_id: req.params.id })
        .del();

      // Add new assignments with order
      const assignments = questionIds.map((questionId, index) => ({
        event_id: parseInt(req.params.id),
        question_id: parseInt(questionId),
        order_index: index + 1
      }));

      await trx('event_questions').insert(assignments);
    });

    // Return updated questions
    const questions = await knex('questions')
      .join('event_questions', 'questions.id', 'event_questions.question_id')
      .where('event_questions.event_id', req.params.id)
      .select('questions.*', 'event_questions.order_index')
      .orderBy('event_questions.order_index');
    
    res.json(questions);
  } catch (error) {
    console.error('Assign questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove question from event
router.delete('/:id/questions/:questionId', authenticateToken, async (req, res) => {
  try {
    const deleted = await knex('event_questions')
      .where({ 
        event_id: req.params.id,
        question_id: req.params.questionId 
      })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Question assignment not found' });
    }

    res.json({ message: 'Question removed from event successfully' });
  } catch (error) {
    console.error('Remove question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 