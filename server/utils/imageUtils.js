const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Generate thumbnail from uploaded image
 * @param {string} inputPath - Path to the original image
 * @param {string} outputPath - Path where thumbnail should be saved
 * @param {number} maxWidth - Maximum width for thumbnail (default: 800)
 * @param {number} maxHeight - Maximum height for thumbnail (default: 600)
 * @param {number} quality - JPEG quality (default: 85)
 * @returns {Promise<{width: number, height: number, size: number}>}
 */
const generateThumbnail = async (inputPath, outputPath, maxWidth = 800, maxHeight = 600, quality = 85) => {
  try {
    console.log(`🖼️ Generating thumbnail: ${inputPath} -> ${outputPath}`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Process image with sharp
    const result = await sharp(inputPath)
      .resize(maxWidth, maxHeight, {
        fit: 'inside', // Maintain aspect ratio, fit within bounds
        withoutEnlargement: true // Don't enlarge smaller images
      })
      .jpeg({ 
        quality: quality,
        progressive: true,
        mozjpeg: true // Use mozjpeg encoder for better compression
      })
      .toFile(outputPath);
    
    console.log(`✅ Thumbnail generated: ${result.width}x${result.height}, ${Math.round(result.size / 1024)}KB`);
    
    return {
      width: result.width,
      height: result.height,
      size: result.size
    };
  } catch (error) {
    console.error('❌ Error generating thumbnail:', error);
    throw error;
  }
};

/**
 * Process uploaded question image - replace original with optimized thumbnail
 * @param {string} originalPath - Path to the uploaded image
 * @param {string} filename - Original filename
 * @returns {Promise<string>} - Path to the processed image
 */
const processQuestionImage = async (originalPath, filename) => {
  try {
    console.log(`🔄 Processing question image: ${originalPath}`);
    
    // Create thumbnail filename (same name, but optimized)
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);
    const thumbnailFilename = `${nameWithoutExt}_thumb.jpg`; // Always save as JPG for consistency
    const thumbnailPath = path.join(path.dirname(originalPath), thumbnailFilename);
    
    // Generate thumbnail (max 800x600 for question images)
    await generateThumbnail(originalPath, thumbnailPath, 800, 600, 85);
    
    // Delete original file to save space
    try {
      await fs.unlink(originalPath);
      console.log(`🗑️ Deleted original file: ${originalPath}`);
    } catch (unlinkError) {
      console.warn('⚠️ Could not delete original file:', unlinkError.message);
    }
    
    // Return the thumbnail path
    return thumbnailPath;
  } catch (error) {
    console.error('❌ Error processing question image:', error);
    throw error;
  }
};

/**
 * Get image dimensions without loading the full image
 * @param {string} imagePath - Path to the image
 * @returns {Promise<{width: number, height: number}>}
 */
const getImageDimensions = async (imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    throw error;
  }
};

module.exports = {
  generateThumbnail,
  processQuestionImage,
  getImageDimensions
}; 