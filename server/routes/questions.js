const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('./auth');
const { processQuestionImage } = require('../utils/imageUtils');
const router = express.Router();

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Ensure uploads/questions directory exists
const questionsUploadDir = '../uploads/questions';
if (!fs.existsSync(questionsUploadDir)) {
  fs.mkdirSync(questionsUploadDir, { recursive: true });
}

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
    cb(null, 'server/uploads/questions/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'question-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
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
      try {
        // Process image and generate thumbnail
        const processedImagePath = await processQuestionImage(req.file.path, req.file.filename);
        const processedFilename = path.basename(processedImagePath);
        questionData.image_path = `/uploads/questions/${processedFilename}`;
        
        console.log(`✅ Question image processed: ${req.file.filename} -> ${processedFilename}`);
      } catch (imageError) {
        console.error('Error processing question image:', imageError);
        // Fallback to original image if processing fails
        questionData.image_path = `/uploads/questions/${req.file.filename}`;
      }
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
      try {
        // Get existing image path to potentially delete old image
        const existingQuestion = await knex('questions').where({ id: req.params.id }).first();
        
        // Process new image and generate thumbnail
        const processedImagePath = await processQuestionImage(req.file.path, req.file.filename);
        const processedFilename = path.basename(processedImagePath);
        updateData.image_path = `/uploads/questions/${processedFilename}`;
        
        // Delete old image if it exists
        if (existingQuestion && existingQuestion.image_path) {
          const oldImagePath = path.join(__dirname, '..', existingQuestion.image_path);
          try {
            await fs.promises.unlink(oldImagePath);
            console.log(`🗑️ Deleted old question image: ${existingQuestion.image_path}`);
          } catch (unlinkError) {
            console.warn('⚠️ Could not delete old image:', unlinkError.message);
          }
        }
        
        console.log(`✅ Question image updated: ${req.file.filename} -> ${processedFilename}`);
      } catch (imageError) {
        console.error('Error processing question image:', imageError);
        // Fallback to original image if processing fails
        updateData.image_path = `/uploads/questions/${req.file.filename}`;
      }
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

    // Get question data to delete associated image
    const question = await knex('questions').where({ id: req.params.id }).first();
    
    const deleted = await knex('questions')
      .where({ id: req.params.id })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Delete associated image file if it exists
    if (question && question.image_path) {
      const imagePath = path.join(__dirname, '..', question.image_path);
      try {
        await fs.promises.unlink(imagePath);
        console.log(`🗑️ Deleted question image: ${question.image_path}`);
      } catch (unlinkError) {
        console.warn('⚠️ Could not delete question image:', unlinkError.message);
      }
    }

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Copy questions from one event to another
router.post('/copy-from-event', authenticateToken, async (req, res) => {
  try {
    const { sourceEventId, targetEventId, questionIds } = req.body;

    if (!sourceEventId || !targetEventId) {
      return res.status(400).json({ error: 'Source and target event IDs are required' });
    }

    // Get source and target events
    const sourceEvent = await getEventByIdOrUuid(sourceEventId);
    const targetEvent = await getEventByIdOrUuid(targetEventId);

    if (!sourceEvent || !targetEvent) {
      return res.status(404).json({ error: 'Source or target event not found' });
    }

    let questionsToAssign;

    if (questionIds && questionIds.length > 0) {
      // Copy specific questions
      questionsToAssign = await knex('event_questions')
        .join('questions', 'event_questions.question_id', 'questions.id')
        .where(function() {
          if (sourceEvent.uuid) {
            this.where('event_questions.event_uuid', sourceEvent.uuid);
          } else {
            this.where('event_questions.event_id', sourceEvent.id);
          }
        })
        .whereIn('questions.id', questionIds)
        .select('questions.id', 'event_questions.order_index')
        .orderBy('event_questions.order_index');
    } else {
      // Copy all questions from source event
      questionsToAssign = await knex('event_questions')
        .join('questions', 'event_questions.question_id', 'questions.id')
        .where(function() {
          if (sourceEvent.uuid) {
            this.where('event_questions.event_uuid', sourceEvent.uuid);
          } else {
            this.where('event_questions.event_id', sourceEvent.id);
          }
        })
        .select('questions.id', 'event_questions.order_index')
        .orderBy('event_questions.order_index');
    }

    if (questionsToAssign.length === 0) {
      return res.status(400).json({ error: 'No questions found to copy' });
    }

    // Get the highest order_index in target event
    const maxOrderResult = await knex('event_questions')
      .where(function() {
        if (targetEvent.uuid) {
          this.where('event_uuid', targetEvent.uuid);
        } else {
          this.where('event_id', targetEvent.id);
        }
      })
      .max('order_index as maxOrder')
      .first();

    let nextOrderIndex = (maxOrderResult?.maxOrder || 0) + 1;

    // Insert questions into target event
    const insertPromises = questionsToAssign.map(async (question) => {
      // Check if question is already assigned to target event
      const existing = await knex('event_questions')
        .where('question_id', question.id)
        .where(function() {
          if (targetEvent.uuid) {
            this.where('event_uuid', targetEvent.uuid);
          } else {
            this.where('event_id', targetEvent.id);
          }
        })
        .first();

      if (!existing) {
        return knex('event_questions').insert({
          event_id: targetEvent.id,
          event_uuid: targetEvent.uuid,
          question_id: question.id,
          order_index: nextOrderIndex++
        });
      }
      return null;
    });

    const results = await Promise.all(insertPromises);
    const addedCount = results.filter(r => r !== null).length;

    res.json({
      message: `Successfully copied ${addedCount} questions to target event`,
      addedCount,
      skippedCount: questionsToAssign.length - addedCount
    });

  } catch (error) {
    console.error('Copy questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all questions available for assignment (not just assigned to current event)
router.get('/available/:eventId', authenticateToken, async (req, res) => {
  try {
    const event = await getEventByIdOrUuid(req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get all questions
    const allQuestions = await knex('questions')
      .select('*')
      .orderBy('created_at', 'desc');

    // Get questions already assigned to this event
    const assignedQuestions = await knex('event_questions')
      .where(function() {
        if (event.uuid) {
          this.where('event_uuid', event.uuid);
        } else {
          this.where('event_id', event.id);
        }
      })
      .select('question_id');

    const assignedIds = assignedQuestions.map(eq => eq.question_id);

    // Mark questions as assigned or available
    const questionsWithStatus = allQuestions.map(question => ({
      ...question,
      isAssigned: assignedIds.includes(question.id),
      // Remove sensitive data
      solution: undefined
    }));

    res.json(questionsWithStatus);

  } catch (error) {
    console.error('Get available questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign multiple questions to an event at once
router.post('/assign-multiple', authenticateToken, async (req, res) => {
  try {
    const { eventId, questionIds } = req.body;

    if (!eventId || !questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({ error: 'Event ID and question IDs array are required' });
    }

    const event = await getEventByIdOrUuid(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get the highest order_index for this event
    const maxOrderResult = await knex('event_questions')
      .where(function() {
        if (event.uuid) {
          this.where('event_uuid', event.uuid);
        } else {
          this.where('event_id', event.id);
        }
      })
      .max('order_index as maxOrder')
      .first();

    let nextOrderIndex = (maxOrderResult?.maxOrder || 0) + 1;

    // Insert each question
    const insertPromises = questionIds.map(async (questionId) => {
      // Check if already assigned
      const existing = await knex('event_questions')
        .where('question_id', questionId)
        .where(function() {
          if (event.uuid) {
            this.where('event_uuid', event.uuid);
          } else {
            this.where('event_id', event.id);
          }
        })
        .first();

      if (!existing) {
        return knex('event_questions').insert({
          event_id: event.id,
          event_uuid: event.uuid,
          question_id: questionId,
          order_index: nextOrderIndex++
        });
      }
      return null;
    });

    const results = await Promise.all(insertPromises);
    const addedCount = results.filter(r => r !== null).length;

    res.json({
      message: `Successfully assigned ${addedCount} questions to event`,
      addedCount,
      skippedCount: questionIds.length - addedCount
    });

  } catch (error) {
    console.error('Assign multiple questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 