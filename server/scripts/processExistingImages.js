const path = require('path');
const fs = require('fs').promises;
const { processQuestionImage } = require('../utils/imageUtils');

// Database setup
const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

/**
 * Process all existing question images and convert them to thumbnails
 */
const processExistingImages = async () => {
  try {
    console.log('🔄 Starting to process existing question images...');
    
    // Get all questions with images
    const questionsWithImages = await knex('questions')
      .whereNotNull('image_path')
      .select('id', 'title', 'image_path');
    
    console.log(`📋 Found ${questionsWithImages.length} questions with images`);
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const question of questionsWithImages) {
      try {
        console.log(`\n🔄 Processing question ${question.id}: "${question.title}"`);
        console.log(`   Current image: ${question.image_path}`);
        
        // Check if image is already a thumbnail
        if (question.image_path.includes('_thumb.jpg')) {
          console.log('   ⏭️ Already a thumbnail, skipping...');
          skipped++;
          continue;
        }
        
        // Build full path to current image
        const currentImagePath = path.join(__dirname, '..', question.image_path);
        
        // Check if file exists
        try {
          await fs.access(currentImagePath);
        } catch (accessError) {
          console.log('   ❌ Image file not found, skipping...');
          skipped++;
          continue;
        }
        
        // Extract filename from path
        const filename = path.basename(currentImagePath);
        
        // Process the image (this will create thumbnail and delete original)
        const processedImagePath = await processQuestionImage(currentImagePath, filename);
        const processedFilename = path.basename(processedImagePath);
        const newImagePath = `/uploads/questions/${processedFilename}`;
        
        // Update database with new image path
        await knex('questions')
          .where({ id: question.id })
          .update({ image_path: newImagePath });
        
        console.log(`   ✅ Updated to: ${newImagePath}`);
        processed++;
        
      } catch (error) {
        console.error(`   ❌ Error processing question ${question.id}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 Processing Summary:');
    console.log(`   ✅ Processed: ${processed}`);
    console.log(`   ⏭️ Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📋 Total: ${questionsWithImages.length}`);
    
    if (processed > 0) {
      console.log('\n🎉 Image processing completed successfully!');
      console.log('💡 All processed images are now optimized thumbnails (max 800x600, JPEG format)');
    }
    
  } catch (error) {
    console.error('❌ Fatal error during image processing:', error);
  } finally {
    // Close database connection
    await knex.destroy();
  }
};

// Run the script if called directly
if (require.main === module) {
  processExistingImages()
    .then(() => {
      console.log('\n👋 Script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { processExistingImages }; 