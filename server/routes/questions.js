const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('./auth');
const router = express.Router();

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Get all questions (for admin)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const questions = await knex('questions')
      .select('*')
      .orderBy('event_id')
      .orderBy('order_index')
      .orderBy('created_at');
    
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

// Get questions for event
router.get('/event/:eventId', async (req, res) => {
  try {
    const questions = await knex('questions')
      .where({ event_id: req.params.eventId })
      .orderBy('order_index')
      .orderBy('created_at');
    
    res.json(questions);
  } catch (error) {
    console.error('Get questions error:', error);
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

// Create new question
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const {
      event_id,
      question_text,
      solution,
      difficulty_level,
      time_limit_minutes,
      tip1,
      tip2,
      order_index
    } = req.body;

    if (!event_id || !question_text || !solution) {
      return res.status(400).json({ error: 'Event ID, question text, and solution are required' });
    }

    // Map frontend fields to database fields
    const questionData = {
      event_id: parseInt(event_id),
      title: question_text, // Frontend sends question_text, DB expects title
      description: question_text, // Use question_text for both title and description
      difficulty: difficulty_level === '1' ? 'easy' : difficulty_level === '2' || difficulty_level === '3' ? 'medium' : 'hard',
      solution,
      tip_1: tip1 || null,
      tip_2: tip2 || null,
      tip_3: solution, // Tip 3 is always the solution (gives 0 points)
      time_limit_seconds: parseInt(time_limit_minutes) * 60 || 600, // Convert minutes to seconds
      order_index: order_index ? parseInt(order_index) : null
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
      tip_3,
      time_limit_seconds,
      order_index
    } = req.body;

    const updateData = {
      title,
      description,
      difficulty,
      solution,
      tip_1,
      tip_2,
      tip_3,
      time_limit_seconds: parseInt(time_limit_seconds) || 300,
      order_index: order_index ? parseInt(order_index) : null,
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