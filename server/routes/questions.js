const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('./auth');
const router = express.Router();

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Get all questions (for admin - independent question catalog)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const questions = await knex('questions')
      .select('*')
      .orderBy('created_at', 'desc');
    
    res.json(questions);
  } catch (error) {
    console.error('Get all questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get questions for a specific event (with order)
router.get('/event/:eventId', async (req, res) => {
  try {
    const questions = await knex('questions')
      .join('event_questions', 'questions.id', 'event_questions.question_id')
      .where('event_questions.event_id', req.params.eventId)
      .select('questions.*', 'event_questions.order_index')
      .orderBy('event_questions.order_index');
    
    res.json(questions);
  } catch (error) {
    console.error('Get event questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single question
router.get('/:id', async (req, res) => {
  try {
    const question = await knex('questions')
      .where({ id: req.params.id })
      .first();
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(question);
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new question (independent of events)
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const {
      title,
      description,
      solution,
      difficulty,
      time_limit_minutes,
      tip_1,
      tip_2
    } = req.body;

    if (!title || !solution) {
      return res.status(400).json({ error: 'Title and solution are required' });
    }

    const questionData = {
      title,
      description: description || null,
      difficulty: difficulty || 'medium',
      solution,
      tip_1: tip_1 || null,
      tip_2: tip_2 || null,
      tip_3: solution, // Tip 3 is always the solution (gives 0 points)
      time_limit_seconds: parseInt(time_limit_minutes) * 60 || 600 // Convert minutes to seconds
    };

    if (req.file) {
      questionData.image_path = req.file.filename;
    }

    const [questionId] = await knex('questions').insert(questionData);
    const question = await knex('questions').where({ id: questionId }).first();
    
    res.status(201).json(question);
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update question
router.put('/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const {
      title,
      description,
      difficulty,
      solution,
      tip_1,
      tip_2,
      time_limit_minutes
    } = req.body;

    const updateData = {
      title,
      description,
      difficulty,
      solution,
      tip_1,
      tip_2,
      tip_3: solution, // Tip 3 is always the solution
      time_limit_seconds: parseInt(time_limit_minutes) * 60 || 600,
      updated_at: knex.fn.now()
    };

    if (req.file) {
      updateData.image_path = req.file.filename;
    }

    await knex('questions')
      .where({ id: req.params.id })
      .update(updateData);

    const question = await knex('questions').where({ id: req.params.id }).first();
    res.json(question);
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete question
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if question is used in any events
    const usedInEvents = await knex('event_questions')
      .where({ question_id: req.params.id })
      .count('* as count')
      .first();

    if (usedInEvents.count > 0) {
      return res.status(400).json({ 
        error: 'Question cannot be deleted because it is used in one or more events' 
      });
    }

    const deleted = await knex('questions')
      .where({ id: req.params.id })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 