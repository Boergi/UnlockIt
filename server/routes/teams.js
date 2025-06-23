const express = require('express');
const { authenticateToken } = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const router = express.Router();
const { getTeamByIdOrUuid, getEventByIdOrUuid, getTeamsByEventIdOrUuid, getTeamProgressByIdOrUuid, isUUID } = require('../utils/idUtils');
const { v4: uuidv4 } = require('uuid');

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENABLED = process.env.OPENAI_ENABLED === 'true';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
const logosDir = path.join(uploadsDir, 'logos');

const ensureDirectories = async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(logosDir, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
};

ensureDirectories();

// Middleware to validate UUID for public routes
const requireUUID = (req, res, next) => {
  const id = req.params.teamId || req.params.id;
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Only UUID access is allowed for security reasons' });
  }
  next();
};

// Helper function to delete logo files for a team
const deleteTeamLogoFiles = async (team, event) => {
  if (!team.ai_logo_generated && !team.logo_url) {
    return; // No logos to delete
  }

  const eventName = event?.name ? event.name.replace(/[^a-zA-Z0-9]/g, '_') : 'event';
  const teamName = team.name.replace(/[^a-zA-Z0-9]/g, '_');
  
  // Try to delete all 3 possible logo versions
  for (let i = 1; i <= 3; i++) {
    const fileName = `logo_${eventName}_${teamName}_v${i}.png`;
    const filePath = path.join(logosDir, fileName);
    
    try {
      await fs.access(filePath); // Check if file exists
      await fs.unlink(filePath); // Delete file
      console.log(`🗑️ Deleted logo file: ${fileName}`);
    } catch (error) {
      // File doesn't exist or couldn't be deleted - that's ok
      console.log(`ℹ️ Logo file not found or already deleted: ${fileName}`);
    }
  }

  // Also try to delete the currently used logo if it has a different name
  if (team.logo_url && team.logo_url.startsWith('/uploads/logos/')) {
    const currentLogoFileName = team.logo_url.replace('/uploads/logos/', '');
    const currentLogoPath = path.join(logosDir, currentLogoFileName);
    
    try {
      await fs.access(currentLogoPath);
      await fs.unlink(currentLogoPath);
      console.log(`🗑️ Deleted current logo file: ${currentLogoFileName}`);
    } catch (error) {
      console.log(`ℹ️ Current logo file not found or already deleted: ${currentLogoFileName}`);
    }
  }
};

// Generate AI logo options with live updates
router.post('/generate-logo', async (req, res) => {
  try {
    const { teamName, eventName, socketId } = req.body;

    if (!teamName) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    if (!OPENAI_ENABLED || !OPENAI_API_KEY) {
      return res.status(400).json({ error: 'AI logo generation is not enabled' });
    }

    // Get io instance from app
    const { io } = require('../index');

    // Create 3 different prompt variations for variety
    const prompts = [
      `Design a modern, professional logo for the team "${teamName}", participating in "${eventName || 'a gaming event'}". This is a logo design only — no text, no letters, no numbers, no scenes. Use clean, balanced geometric shapes and vibrant, contrasting colors that look great on both light and dark backgrounds. The logo should be simple, scalable, and immediately recognizable at small sizes. Think tech company branding or app icon — focus on symmetry, clarity, and visual impact.`,
    
      `Create a powerful team logo for "${teamName}" in "${eventName || 'a gaming event'}". Design an angular, bold emblem or badge-style logo using sharp geometric forms and a dynamic color scheme (e.g., red, black, gold, electric blue). Avoid text, numbers, or letters — logo only. The design should convey energy, strength, and competitive spirit. Think professional e-sports or sports franchise identity — simple, striking, and printable on merch.`,
    
      `Design a minimalist, symbolic logo for team "${teamName}", competing in "${eventName || 'a gaming event'}". Use abstract geometric forms, subtle negative space, and a limited, refined color palette (max 3 colors). No text, letters, or decorative details — just a clean, elegant icon that scales well and works as a favicon, app logo, or tech brand mark. Focus on simplicity, clever shape composition, and brand-level clarity.`
    ];

    console.log('🎨 Generating 3 AI logo options for team:', teamName);

    // Send initial status
    if (socketId && io) {
      io.to(socketId).emit('logo-generation-status', {
        status: 'started',
        message: 'Logo-Generierung gestartet...',
        progress: 0,
        total: 3
      });
    }

    // Generate all 3 logos in parallel for much faster processing
    const logoGenerationPromises = prompts.map(async (prompt, i) => {
      try {
        // Send progress update
        if (socketId && io) {
          io.to(socketId).emit('logo-generation-status', {
            status: 'generating',
            message: `Generiere alle 3 Logos parallel...`,
            progress: 0,
            total: 3,
            currentStyle: ['Modern & Professional', 'Dynamic & Bold', 'Minimalist & Clean'][i]
          });
        }

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

        const fileName = `logo_${eventName ? eventName.replace(/[^a-zA-Z0-9]/g, '_') : 'event'}_${teamName.replace(/[^a-zA-Z0-9]/g, '_')}_v${i + 1}.png`;
        const filePath = path.join(logosDir, fileName);

        await fs.writeFile(filePath, imageResponse.data);

        const logoUrl = `/uploads/logos/${fileName}`;
        
        const logoOption = {
          id: i + 1,
          url: logoUrl,
          style: ['Modern & Professional', 'Dynamic & Bold', 'Minimalist & Clean'][i]
        };

        console.log(`✅ AI logo option ${i + 1} generated and saved:`, logoUrl);

        // Send live update with new logo as soon as it's ready
        if (socketId && io) {
          io.to(socketId).emit('logo-generation-update', {
            logoOption: logoOption,
            progress: i + 1,
            total: 3
          });
        }

        return logoOption;
      } catch (error) {
        console.error(`Error generating logo option ${i + 1}:`, error);
        
        // Send error update
        if (socketId && io) {
          io.to(socketId).emit('logo-generation-error', {
            error: `Fehler bei Logo ${i + 1}`,
            progress: i + 1,
            total: 3
          });
        }
        
        // Return null for failed generations
        return null;
      }
    });

    // Wait for all logo generations to complete (or fail)
    const logoResults = await Promise.allSettled(logoGenerationPromises);
    
    // Extract successful logo options
    const logoOptions = logoResults
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    if (logoOptions.length === 0) {
      if (socketId && io) {
        io.to(socketId).emit('logo-generation-status', {
          status: 'error',
          message: 'Keine Logos konnten generiert werden'
        });
      }
      throw new Error('Failed to generate any logo options');
    }

    // Send completion status
    if (socketId && io) {
      io.to(socketId).emit('logo-generation-status', {
        status: 'completed',
        message: `${logoOptions.length} Logo-Optionen erfolgreich generiert!`,
        progress: 3,
        total: 3
      });
    }

    res.json({
      success: true,
      logoOptions: logoOptions,
      message: `${logoOptions.length} Logo-Optionen erfolgreich generiert!`
    });

  } catch (error) {
    console.error('Error generating AI logo options:', error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid OpenAI API key' });
    } else if (error.response?.status === 429) {
      return res.status(429).json({ error: 'OpenAI API rate limit exceeded. Please try again later.' });
    } else if (error.response?.data?.error) {
      return res.status(400).json({ error: `OpenAI Error: ${error.response.data.error.message}` });
    }
    
    res.status(500).json({ error: 'Failed to generate logo options' });
  }
});

// Select and confirm logo choice
router.post('/select-logo', authenticateToken, async (req, res) => {
  try {
    const { teamId, logoUrl } = req.body;

    if (!teamId || !logoUrl) {
      return res.status(400).json({ error: 'Team ID and logo URL are required' });
    }

    // Update team with selected logo
    await knex('teams')
      .where({ id: teamId })
      .update({
        logo_url: logoUrl,
        ai_logo_generated: true,
        updated_at: knex.fn.now()
      });

    const updatedTeam = await knex('teams').where({ id: teamId }).first();
    
    console.log('✅ Logo selected and team updated:', logoUrl);

    res.json({
      success: true,
      team: updatedTeam,
      message: 'Logo erfolgreich ausgewählt!'
    });

  } catch (error) {
    console.error('Error selecting logo:', error);
    res.status(500).json({ error: 'Failed to select logo' });
  }
});

// Get AI configuration
router.get('/ai-config', (req, res) => {
  res.json({
    aiEnabled: OPENAI_ENABLED && !!OPENAI_API_KEY
  });
});

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

// Create team (admin only)
router.post('/admin/create', authenticateToken, async (req, res) => {
  try {
    const { name, event_id, logo_url, generate_ai_logo } = req.body;

    if (!name || !event_id) {
      return res.status(400).json({ error: 'Team name and event ID are required' });
    }

    // Check if event exists
    const event = await knex('events').where({ id: event_id }).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if team name already exists for this event
    const existingTeam = await knex('teams')
      .where({ name, event_id })
      .first();
    
    if (existingTeam) {
      return res.status(409).json({ error: 'Team name already exists for this event' });
    }

    let finalLogoUrl = logo_url || null;
    let aiLogoGenerated = false;

    // AI logo generation will be handled separately via the generate-logo endpoint
    if (generate_ai_logo && OPENAI_ENABLED && OPENAI_API_KEY) {
      // Just mark that AI logo will be generated, but don't generate it here
      // The frontend will call the generate-logo endpoint separately
      aiLogoGenerated = false; // Will be set to true when logo is selected
      console.log('🎨 AI logo generation requested for team:', name);
    }

    const [teamId] = await knex('teams').insert({
      name,
      event_id,
      logo_url: finalLogoUrl,
      ai_logo_generated: aiLogoGenerated
    });

    const team = await knex('teams').where({ id: teamId }).first();
    res.status(201).json(team);
  } catch (error) {
    console.error('Admin team creation error:', error);
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
    const event = await getEventByIdOrUuid(event_id);
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
      .where({ 
        name, 
        [event.uuid ? 'event_uuid' : 'event_id']: event.uuid || event.id 
      })
      .first();
    
    if (existingTeam) {
      return res.status(409).json({ error: 'Team name already exists for this event' });
    }

    const teamUuid = require('crypto').randomUUID();
    
    await knex('teams').insert({
      uuid: teamUuid,
      name,
      event_id: event.id,
      event_uuid: event.uuid
    });

    const team = await knex('teams').where({ uuid: teamUuid }).first();
    res.status(201).json(team);
  } catch (error) {
    console.error('Team registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team details
router.get('/:id', requireUUID, async (req, res) => {
  try {
    const team = await getTeamByIdOrUuid(req.params.id);
    
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
    const { name, logo_url, generate_ai_logo } = req.body;
    
    const team = await knex('teams').where({ id: req.params.id }).first();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    let finalLogoUrl = logo_url;
    let aiLogoGenerated = team.ai_logo_generated;

    // Generate AI logo if requested and not already generated
    if (generate_ai_logo && !team.ai_logo_generated && OPENAI_ENABLED && OPENAI_API_KEY) {
      try {
        const teamEvent = await knex('events').where({ id: team.event_id }).first();
        const prompt = `Design a professional LOGO for the team "${name || team.name}" participating in "${teamEvent?.name || 'a gaming event'}". This must be a LOGO design - not a scene or illustration. Create a clean, modern logo with geometric shapes, bold typography-style elements, and vibrant colors. The logo should work on both light and dark backgrounds. Make it simple enough to be recognizable at small sizes. LOGO DESIGN ONLY. No text, no words, no letters - just pure symbolic logo design. Think corporate logo style.`;

        console.log('🎨 Generating AI logo for team:', name || team.name);

        const response = await axios.post(
          'https://api.openai.com/v1/images/generations',
          {
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
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

        const fileName = `logo_${teamEvent?.name ? teamEvent.name.replace(/[^a-zA-Z0-9]/g, '_') : 'event'}_${(name || team.name).replace(/[^a-zA-Z0-9]/g, '_')}_v1.png`;
        const filePath = path.join(logosDir, fileName);

        await fs.writeFile(filePath, imageResponse.data);

        finalLogoUrl = `/uploads/logos/${fileName}`;
        aiLogoGenerated = true;

        console.log('✅ AI logo generated and saved:', finalLogoUrl);
      } catch (error) {
        console.error('Error generating AI logo:', error);
        // Continue with team update without logo change if AI generation fails
        finalLogoUrl = team.logo_url;
        
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
        } else if (error.response?.status === 400) {
          console.error('❌ OpenAI API bad request:', error.response.data);
          return res.status(400).json({ 
            error: 'AI-Logo-Generierung fehlgeschlagen: Ungültige Anfrage. Bitte versuchen Sie es erneut.' 
          });
        } else {
          console.error('❌ Unexpected error during AI logo generation:', error.message);
          // For updates, we continue without changing the logo
          finalLogoUrl = team.logo_url;
        }
      }
    }
    
    await knex('teams')
      .where({ id: req.params.id })
      .update({
        name: name || team.name,
        logo_url: finalLogoUrl,
        ai_logo_generated: aiLogoGenerated,
        updated_at: knex.fn.now()
      });

    const updatedTeam = await knex('teams').where({ id: req.params.id }).first();
    res.json(updatedTeam);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete team (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Get team info before deletion to find logo files
    const team = await knex('teams').where({ id: req.params.id }).first();
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get event info for logo file naming
    const event = await knex('events').where({ id: team.event_id }).first();

    // Delete team from database
    const deleted = await knex('teams')
      .where({ id: req.params.id })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Delete associated logo files (all 3 versions if they exist)
    await deleteTeamLogoFiles(team, event);

    console.log(`✅ Team "${team.name}" and associated logos deleted successfully`);
    res.json({ message: 'Team and associated logos deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set team logo (for logo selection after generation)
router.put('/:id/logo', requireUUID, async (req, res) => {
  try {
    const { logoUrl } = req.body;
    
    if (!logoUrl) {
      return res.status(400).json({ error: 'Logo URL is required' });
    }

    const team = await getTeamByIdOrUuid(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Update team with selected logo - use numeric ID for database operations
    await knex('teams')
      .where({ id: team.id })
      .update({
        logo_url: logoUrl,
        ai_logo_generated: true,
        updated_at: knex.fn.now()
      });

    const updatedTeam = await knex('teams').where({ id: team.id }).first();
    
    console.log(`✅ Logo selected for team "${team.name}": ${logoUrl}`);
    res.json(updatedTeam);
  } catch (error) {
    console.error('Set team logo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team progress
router.get('/:id/progress', requireUUID, async (req, res) => {
  try {
    const progress = await getTeamProgressByIdOrUuid(req.params.id);
    
    if (progress.length === 0) {
      // Check if team exists
      const team = await getTeamByIdOrUuid(req.params.id);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
    }

    // Transform the data to match the expected format
    const formattedProgress = progress.map(row => ({
      id: row.id,
      team_id: req.params.id,
      question_id: row.id,
      question_title: row.title,
      difficulty: row.difficulty,
      order_index: row.order_index,
      attempt_1: row.attempt_1,
      attempt_2: row.attempt_2,
      attempt_3: row.attempt_3,
      used_tip: row.used_tip || 0,
      correct: row.correct || false,
      completed: row.completed || false,
      time_started: row.time_started,
      time_answered: row.time_answered,
      points_awarded: row.points_awarded || 0
    }));

    res.json(formattedProgress);
  } catch (error) {
    console.error('Get team progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, deleteTeamLogoFiles }; 