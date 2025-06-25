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

// Helper function to generate automatic logo description using OpenAI
const generateAutoLogoDescription = async (teamName, eventName) => {
  try {
    // Enhanced theme detection for popular franchises and concepts
    const name = teamName.toLowerCase();
    let systemPrompt = 'You are a logo design expert. Write precise, creative logo descriptions for team names. Maximum 500 characters. Focus on colors, shapes, style and atmosphere. No text elements, only visual symbols. Write in English for optimal AI image generation.';
    let userPrompt = `Write a detailed logo description for a team named "${teamName}". Maximum 500 characters. Describe colors, shapes, style and visual elements that match the team name. Write in English.`;
    
    // Detect specific themes and franchises for enhanced prompts
    if (name.includes('power rangers') || name.includes('power ranger')) {
      console.log('🎯 Theme detected: Power Rangers');
      userPrompt = `Create a logo description for team "${teamName}" inspired by Power Rangers. Include 5 colored elements (red, blue, yellow, pink, green), futuristic helmets or masks, energy symbols, metallic textures, and heroic sci-fi aesthetic. Maximum 500 characters.`;
    } else if (name.includes('avengers') || name.includes('avenger')) {
      console.log('🎯 Theme detected: Avengers');
      userPrompt = `Create a logo description for team "${teamName}" inspired by Avengers. Include heroic emblem design, shield-like elements, bold primary colors (red, blue, gold), dynamic action lines, and superhero aesthetic. Maximum 500 characters.`;
    } else if (name.includes('batman') || name.includes('dark knight')) {
      console.log('🎯 Theme detected: Batman');
      userPrompt = `Create a logo description for team "${teamName}" inspired by Batman. Include bat silhouette, dark colors (black, dark blue, yellow accents), gothic elements, angular shapes, and mysterious night-time aesthetic. Maximum 500 characters.`;
    } else if (name.includes('superman') || name.includes('man of steel')) {
      console.log('🎯 Theme detected: Superman');
      userPrompt = `Create a logo description for team "${teamName}" inspired by Superman. Include shield-like emblem, bold colors (red, blue, yellow), heroic diamond shapes, strong geometric forms, and classic superhero aesthetic. Maximum 500 characters.`;
    } else if (name.includes('spider') && (name.includes('man') || name.includes('spider'))) {
      console.log('🎯 Theme detected: Spider-Man');
      userPrompt = `Create a logo description for team "${teamName}" inspired by Spider-Man. Include web patterns, spider silhouette, red and blue colors, dynamic angular lines, and urban superhero aesthetic. Maximum 500 characters.`;
    } else if (name.includes('star wars') || name.includes('jedi') || name.includes('sith')) {
      console.log('🎯 Theme detected: Star Wars');
      userPrompt = `Create a logo description for team "${teamName}" inspired by Star Wars. Include lightsaber elements, galactic symbols, space colors (black, silver, blue/red glow), geometric sci-fi shapes, and epic space opera aesthetic. Maximum 500 characters.`;
    } else if (name.includes('marvel') || name.includes('dc')) {
      console.log('🎯 Theme detected: Comic Book Heroes');
      userPrompt = `Create a logo description for team "${teamName}" inspired by comic book superheroes. Include bold heroic emblem, primary colors, dynamic action elements, shield or badge design, and classic superhero aesthetic. Maximum 500 characters.`;
    } else if (name.includes('pokemon') || name.includes('pikachu')) {
      console.log('🎯 Theme detected: Pokemon');
      userPrompt = `Create a logo description for team "${teamName}" inspired by Pokemon. Include pokeball elements, bright vibrant colors (red, white, yellow), playful geometric shapes, lightning bolt accents, and animated adventure aesthetic. Maximum 500 characters.`;
    } else if (name.includes('ninja') || name.includes('shinobi')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by ninjas. Include shuriken or blade elements, dark colors (black, dark blue, silver), sharp angular shapes, stealth aesthetic, and Japanese-inspired design. Maximum 500 characters.`;
    } else if (name.includes('pirate') || name.includes('pirates')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by pirates. Include skull elements, crossed swords, nautical symbols, dark colors (black, red, gold), weathered textures, and adventurous maritime aesthetic. Maximum 500 characters.`;
    } else if (name.includes('viking') || name.includes('vikings')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Vikings. Include horned helmet, axe or hammer elements, Nordic symbols, rugged colors (brown, gold, red), fierce warrior aesthetic, and ancient Norse design. Maximum 500 characters.`;
    } else if (name.includes('knight') || name.includes('knights')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by medieval knights. Include shield and sword elements, heraldic design, noble colors (blue, gold, silver), castle or crown symbols, and chivalric medieval aesthetic. Maximum 500 characters.`;
    } else if (name.includes('wizard') || name.includes('magic') || name.includes('mage')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by wizards and magic. Include staff or wand elements, mystical symbols, magical colors (purple, blue, gold), sparkle effects, and enchanted fantasy aesthetic. Maximum 500 characters.`;
    } else if (name.includes('dragon') || name.includes('dragons')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by dragons. Include dragon silhouette or head, flame elements, powerful colors (red, gold, black), scales texture, wings, and mythical fierce aesthetic. Maximum 500 characters.`;
    } else if (name.includes('phoenix')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by phoenix. Include bird silhouette with spread wings, flame elements, rebirth colors (red, orange, gold), feather details, and majestic rising aesthetic. Maximum 500 characters.`;
    } else if (name.includes('wolf') || name.includes('wolves')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by wolves. Include wolf head silhouette, pack symbols, wild colors (grey, black, blue), sharp angular features, howling pose, and fierce pack hunter aesthetic. Maximum 500 characters.`;
    } else if (name.includes('lion') || name.includes('lions')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by lions. Include lion head with mane, crown elements, royal colors (gold, red, brown), majestic features, strength symbols, and king of jungle aesthetic. Maximum 500 characters.`;
    } else if (name.includes('eagle') || name.includes('eagles')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by eagles. Include eagle head or spread wings, sharp beak and talons, patriotic colors (blue, white, gold), soaring elements, and freedom/power aesthetic. Maximum 500 characters.`;
    } else if (name.includes('shark') || name.includes('sharks')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by sharks. Include shark silhouette, fin elements, ocean colors (blue, grey, white), sharp teeth, water waves, and predator of the sea aesthetic. Maximum 500 characters.`;
    } else if (name.includes('cyber') || name.includes('digital') || name.includes('tech')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by cyberpunk/technology. Include circuit patterns, digital grid, neon colors (blue, green, purple), geometric tech shapes, glowing effects, and futuristic aesthetic. Maximum 500 characters.`;
    } else if (name.includes('fire') || name.includes('flame') || name.includes('inferno')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by fire elements. Include flame shapes, ember effects, hot colors (red, orange, yellow), dynamic flowing forms, heat waves, and burning intensity aesthetic. Maximum 500 characters.`;
    } else if (name.includes('ice') || name.includes('frost') || name.includes('frozen')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by ice elements. Include crystalline shapes, snowflake patterns, cold colors (blue, white, silver), sharp icy forms, frozen textures, and arctic aesthetic. Maximum 500 characters.`;
    } else if (name.includes('thunder') || name.includes('lightning') || name.includes('storm')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by thunder and lightning. Include lightning bolt shapes, storm cloud elements, electric colors (yellow, blue, white), energy crackling, and powerful weather aesthetic. Maximum 500 characters.`;
    } else if (name.includes('fortnite') || name.includes('battle royale')) {
      console.log('🎯 Theme detected: Fortnite/Battle Royale');
      userPrompt = `Create a logo description for team "${teamName}" inspired by Fortnite/Battle Royale. Include shield elements, victory symbols, bright colors (blue, purple, orange), dynamic action shapes, and competitive gaming aesthetic. Maximum 500 characters.`;
    } else if (name.includes('apex') || name.includes('legends')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Apex Legends. Include futuristic weapon elements, champion symbols, sci-fi colors (orange, blue, silver), angular tech shapes, and competitive shooter aesthetic. Maximum 500 characters.`;
    } else if (name.includes('valorant') || name.includes('agents')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Valorant. Include tactical symbols, agent emblems, clean colors (red, blue, white), geometric precision shapes, and tactical shooter aesthetic. Maximum 500 characters.`;
    } else if (name.includes('league') || name.includes('legends') || name.includes('lol')) {
      console.log('🎯 Theme detected: League of Legends');
      userPrompt = `Create a logo description for team "${teamName}" inspired by League of Legends. Include magical runes, champion symbols, fantasy colors (blue, gold, purple), mystical geometric shapes, and MOBA gaming aesthetic. Maximum 500 characters.`;
    } else if (name.includes('dota') || name.includes('defense')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Dota. Include ancient symbols, hero emblems, mystical colors (red, blue, gold), runic geometric shapes, and strategic MOBA aesthetic. Maximum 500 characters.`;
    } else if (name.includes('overwatch') || name.includes('heroes')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Overwatch. Include hero symbols, futuristic elements, bright colors (orange, blue, white), dynamic geometric shapes, and team shooter aesthetic. Maximum 500 characters.`;
    } else if (name.includes('csgo') || name.includes('counter') || name.includes('strike')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Counter-Strike. Include tactical symbols, weapon elements, military colors (green, black, orange), precise geometric shapes, and competitive FPS aesthetic. Maximum 500 characters.`;
    } else if (name.includes('rocket league') || name.includes('rocket')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Rocket League. Include car/rocket elements, ball symbols, energetic colors (blue, orange, yellow), dynamic motion shapes, and high-speed sports aesthetic. Maximum 500 characters.`;
    } else if (name.includes('among us') || name.includes('crewmate') || name.includes('impostor')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Among Us. Include crewmate silhouette, space elements, vibrant colors (red, blue, green), simple geometric shapes, and space mystery aesthetic. Maximum 500 characters.`;
    } else if (name.includes('assassin') || name.includes('creed')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Assassin's Creed. Include hidden blade, eagle elements, historical colors (white, red, gold), hooded silhouette, and stealth assassin aesthetic. Maximum 500 characters.`;
    } else if (name.includes('call of duty') || name.includes('cod') || name.includes('warfare')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Call of Duty. Include military symbols, weapon elements, tactical colors (green, black, yellow), combat geometric shapes, and modern warfare aesthetic. Maximum 500 characters.`;
    } else if (name.includes('halo') || name.includes('master chief') || name.includes('spartan')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Halo. Include spartan helmet, energy shield, sci-fi colors (blue, green, silver), futuristic geometric shapes, and space marine aesthetic. Maximum 500 characters.`;
    } else if (name.includes('zelda') || name.includes('link') || name.includes('triforce')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Legend of Zelda. Include triforce symbol, sword and shield, adventure colors (green, gold, blue), mystical geometric shapes, and heroic fantasy aesthetic. Maximum 500 characters.`;
    } else if (name.includes('mario') || name.includes('nintendo')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Super Mario. Include power-up elements, coin symbols, playful colors (red, blue, yellow), fun geometric shapes, and classic gaming aesthetic. Maximum 500 characters.`;
    } else if (name.includes('sonic') || name.includes('hedgehog')) {
      userPrompt = `Create a logo description for team "${teamName}" inspired by Sonic. Include speed rings, spiky elements, energetic colors (blue, red, yellow), dynamic motion shapes, and high-speed gaming aesthetic. Maximum 500 characters.`;
    } else {
      console.log('🎯 No specific theme detected, using generic analysis');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.8
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const autoDescription = response.data.choices[0].message.content.trim();
    console.log('🤖 Auto-generated logo description:', autoDescription);
    return autoDescription;
  } catch (error) {
    console.error('Error generating auto logo description:', error);
    return null; // Fallback to original logic
  }
};

// Helper function to analyze team name and generate relevant prompts
const generateSmartPrompts = async (teamName, eventName, logoDescription) => {
  const name = teamName.toLowerCase();
  
  // Generate context-aware prompts
  const baseContext = `Design a professional team logo for "${teamName}". NO TEXT, NO LETTERS, NO NUMBERS - logo symbol only.`;
  
  // If custom description is provided, use it as primary guidance
  if (logoDescription && logoDescription.trim()) {
    const customDescription = logoDescription.trim();
    console.log('🎯 Using custom logo description:', customDescription);
    
    return [
      `${baseContext} ${customDescription} Create a modern, professional design that incorporates these specific style elements. Use bold colors and clean geometric shapes that work well at any size.`,
      
      `${baseContext} ${customDescription} Design a sleek, contemporary logo that balances these style requirements with team spirit. Focus on visual impact and memorable design elements.`,
      
      `${baseContext} ${customDescription} Create a minimalist yet powerful emblem that reflects these design preferences. The logo should be instantly recognizable and scalable across all media.`
    ];
  }
  
  // Try to generate automatic description using OpenAI
  const autoDescription = await generateAutoLogoDescription(teamName, eventName);
  if (autoDescription) {
    console.log('🤖 Using AI-generated logo description:', autoDescription);
    
    return [
      `${baseContext} ${autoDescription} Create a modern, professional design that incorporates these specific style elements. Use bold colors and clean geometric shapes that work well at any size.`,
      
      `${baseContext} ${autoDescription} Design a sleek, contemporary logo that balances these style requirements with team spirit. Focus on visual impact and memorable design elements.`,
      
      `${baseContext} ${autoDescription} Create a minimalist yet powerful emblem that reflects these design preferences. The logo should be instantly recognizable and scalable across all media.`
    ];
  }
  
  // Fallback to original theme-based logic if auto-description fails
  console.log('📝 Falling back to theme-based analysis');
  
  // Analyze team name for themes and concepts (original logic)
  const themes = {
    animals: ['wolf', 'wolves', 'lion', 'lions', 'tiger', 'tigers', 'eagle', 'eagles', 'bear', 'bears', 'shark', 'sharks', 'dragon', 'dragons', 'phoenix', 'falcon', 'hawk', 'panther', 'leopard', 'rhino', 'bull', 'ram', 'viper', 'cobra', 'fox', 'foxes'],
    colors: ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple', 'silver', 'gold', 'crimson', 'azure', 'emerald', 'violet'],
    elements: ['fire', 'water', 'earth', 'air', 'ice', 'storm', 'thunder', 'lightning', 'flame', 'frost', 'wind'],
    weapons: ['sword', 'blade', 'arrow', 'shield', 'hammer', 'axe', 'spear', 'dagger'],
    space: ['star', 'stars', 'moon', 'sun', 'comet', 'meteor', 'galaxy', 'cosmic', 'stellar', 'nova'],
    tech: ['cyber', 'digital', 'pixel', 'code', 'matrix', 'binary', 'quantum', 'neural', 'tech', 'bot', 'ai'],
    mythical: ['titan', 'titans', 'god', 'gods', 'legend', 'legends', 'myth', 'hero', 'heroes', 'knight', 'knights', 'guardian', 'guardians'],
    speed: ['lightning', 'flash', 'swift', 'rapid', 'quick', 'fast', 'velocity', 'turbo', 'sonic'],
    power: ['force', 'power', 'strength', 'might', 'fury', 'rage', 'storm', 'thunder', 'impact', 'blast']
  };
  
  // Find matching themes
  const matchedThemes = [];
  for (const [category, keywords] of Object.entries(themes)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        matchedThemes.push({ category, keyword, relevance: keyword.length / name.length });
      }
    }
  }
  
  // Sort by relevance (longer matches = more relevant)
  matchedThemes.sort((a, b) => b.relevance - a.relevance);
  
  let prompts = [];
  
  if (matchedThemes.length > 0) {
    const primaryTheme = matchedThemes[0];
    
    // Theme-specific prompts
    switch (primaryTheme.category) {
      case 'animals':
        prompts = [
          `${baseContext} Create a stylized, geometric ${primaryTheme.keyword} head or silhouette using bold, angular shapes. Use powerful colors like deep blue, crimson red, and gold. The design should be fierce, modern, and instantly recognizable - think professional sports team logo.`,
          
          `${baseContext} Design an abstract emblem inspired by a ${primaryTheme.keyword}'s characteristics (strength, speed, cunning). Use dynamic geometric patterns and sharp lines in a striking color palette. Focus on the essence and power of the ${primaryTheme.keyword}, not literal representation.`,
          
          `${baseContext} Create a minimalist, iconic symbol that captures the spirit of a ${primaryTheme.keyword}. Use clean geometric forms, negative space, and maximum 3 colors. The logo should work as a small app icon while conveying the ${primaryTheme.keyword}'s key traits.`
        ];
        break;
        
      case 'elements':
        prompts = [
          `${baseContext} Design a dynamic ${primaryTheme.keyword} symbol using flowing, energetic shapes. Use appropriate colors (${primaryTheme.keyword === 'fire' ? 'orange, red, yellow' : primaryTheme.keyword === 'water' ? 'blue, cyan, teal' : primaryTheme.keyword === 'earth' ? 'brown, green, gold' : 'silver, white, blue'}). The logo should feel powerful and elemental.`,
          
          `${baseContext} Create an abstract geometric interpretation of ${primaryTheme.keyword}. Use angular, crystalline shapes that suggest ${primaryTheme.keyword}'s energy and movement. Bold, contrasting colors that convey the raw power of this element.`,
          
          `${baseContext} Design a clean, modern emblem that symbolizes ${primaryTheme.keyword} through smart geometric abstraction. Minimal color palette, maximum visual impact. Think tech company meets elemental force.`
        ];
        break;
        
      case 'tech':
        prompts = [
          `${baseContext} Create a futuristic, high-tech logo with circuit-like patterns, geometric grids, or digital elements. Use electric blue, neon green, and silver. The design should feel cutting-edge and technological - think tech startup or gaming brand.`,
          
          `${baseContext} Design a sleek, digital-inspired emblem using hexagonal patterns, angular lines, or abstract data visualization elements. Modern color scheme with gradients. The logo should scream innovation and digital expertise.`,
          
          `${baseContext} Create a minimalist tech logo using clean geometric shapes that suggest connectivity, data flow, or digital networks. Monochromatic or limited color palette. Professional, scalable, and distinctly modern.`
        ];
        break;
        
      case 'space':
        prompts = [
          `${baseContext} Design a cosmic-inspired logo featuring stellar shapes, orbital patterns, or celestial geometry. Use deep space colors: navy blue, purple, silver, and bright accents. The design should feel vast, mysterious, and powerful.`,
          
          `${baseContext} Create an astronomical emblem using abstract representations of ${primaryTheme.keyword}s, orbits, or cosmic phenomena. Bold geometric forms with a space-age color palette. Think NASA meets gaming team.`,
          
          `${baseContext} Design a clean, modern space symbol using minimal geometric shapes that suggest the cosmos. Limited color palette with high contrast. The logo should work at any size and feel both scientific and powerful.`
        ];
        break;
        
      default:
        // Generic but team-name-aware prompts
        prompts = [
          `${baseContext} The name "${teamName}" suggests ${primaryTheme.keyword} - create a logo that captures this concept through bold, geometric shapes and powerful colors. Modern, professional, and immediately recognizable.`,
          
          `${baseContext} Design an abstract emblem inspired by the concept of "${primaryTheme.keyword}" from the team name. Use dynamic shapes and striking colors that convey strength and unity. Think professional sports or e-sports branding.`,
          
          `${baseContext} Create a minimalist symbol that represents the essence of "${teamName}". Clean geometric forms, smart use of negative space, and a refined color palette. The logo should be memorable and scalable.`
        ];
    }
  } else {
    // Fallback prompts for names without clear themes
    const words = teamName.split(/\s+/);
    const firstWord = words[0];
    const hasMultipleWords = words.length > 1;
    
    prompts = [
      `${baseContext} Create a dynamic logo inspired by the name "${teamName}". Use bold geometric shapes, strong typography-inspired elements (but NO actual letters), and a powerful color scheme. The design should feel energetic and competitive.`,
      
      `${baseContext} Design an abstract emblem that captures the spirit and personality suggested by "${teamName}". Use angular, modern shapes and vibrant colors. Think professional team branding with a unique twist.`,
      
      `${baseContext} Create a clean, iconic symbol that could represent a team called "${teamName}". Focus on geometric harmony, smart color choices, and instant recognizability. The logo should work across all media.`
    ];
    
    // Add specific elements based on name structure
    if (hasMultipleWords) {
      prompts[0] += ` Consider how "${firstWord}" and the other parts of the name could inspire complementary design elements.`;
    }
  }
  
  return prompts;
};

// Generate AI logo options with live updates
router.post('/generate-logo', async (req, res) => {
  try {
    const { teamName, eventName, logoDescription, socketId } = req.body;

    if (!teamName) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    if (!OPENAI_ENABLED || !OPENAI_API_KEY) {
      return res.status(400).json({ error: 'AI logo generation is not enabled' });
    }

    // Get io instance from app
    const { io } = require('../index');

    // Generate dynamic style descriptions based on team name analysis
    const getStyleDescriptions = (teamName) => {
      const name = teamName.toLowerCase();
      
      // Check for themes to customize style descriptions
      if (name.includes('wolf') || name.includes('wolves') || name.includes('lion') || name.includes('tiger') || name.includes('bear') || name.includes('eagle') || name.includes('dragon')) {
        return ['Kraftvoll & Majestätisch', 'Dynamisch & Furchtlos', 'Elegant & Symbolisch'];
      } else if (name.includes('fire') || name.includes('flame') || name.includes('storm') || name.includes('thunder') || name.includes('lightning')) {
        return ['Energetisch & Elementar', 'Kraftvoll & Explosiv', 'Abstrakt & Fließend'];
      } else if (name.includes('cyber') || name.includes('digital') || name.includes('tech') || name.includes('matrix') || name.includes('quantum')) {
        return ['Futuristisch & Tech', 'Digital & Innovativ', 'Minimalistisch & Smart'];
      } else if (name.includes('star') || name.includes('cosmic') || name.includes('galaxy') || name.includes('nova') || name.includes('stellar')) {
        return ['Kosmisch & Mysteriös', 'Stellare & Kraftvoll', 'Elegant & Unendlich'];
      } else {
        return ['Professionell & Modern', 'Dynamisch & Kraftvoll', 'Minimalistisch & Clever'];
      }
    };
    
    const styleDescriptions = getStyleDescriptions(teamName);

    // Send initial status with appropriate message
    if (socketId && io) {
      const initialMessage = logoDescription && logoDescription.trim() 
        ? `Analysiere "${teamName}" und generiere passende Logos...`
        : `Analysiere "${teamName}", generiere Beschreibung und erstelle Logos...`;
        
      io.to(socketId).emit('logo-generation-status', {
        status: 'started',
        message: initialMessage,
        progress: 0,
        total: 3
      });
    }

    // Generate smart, context-aware prompts based on team name and optional description
    const prompts = await generateSmartPrompts(teamName, eventName, logoDescription);

    if (logoDescription && logoDescription.trim()) {
      console.log('🎨 Generating 3 AI logo options for team:', teamName);
      console.log('🎯 Using custom logo description:', logoDescription.trim());
    } else {
      console.log('🎨 Generating 3 AI logo options for team:', teamName);
      console.log('🤖 Using AI-generated description or theme-based analysis');
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
            currentStyle: styleDescriptions[i]
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

        const timestamp = Date.now();
        const fileName = `logo_${eventName ? eventName.replace(/[^a-zA-Z0-9]/g, '_') : 'event'}_${teamName.replace(/[^a-zA-Z0-9]/g, '_')}_v${i + 1}_${timestamp}.png`;
        const filePath = path.join(logosDir, fileName);

        await fs.writeFile(filePath, imageResponse.data);

        const logoUrl = `/uploads/logos/${fileName}`;
        
        const logoOption = {
          id: i + 1,
          url: logoUrl,
          style: styleDescriptions[i]
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

    // Find team by UUID or numeric ID
    const team = await getTeamByIdOrUuid(teamId);
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
      uuid: require('crypto').randomUUID(),
      name,
      event_id,
      event_uuid: event.uuid,
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