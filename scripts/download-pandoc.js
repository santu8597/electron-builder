const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

const PANDOC_VERSION = '3.1.11';
const RESOURCES_DIR = path.join(__dirname, '..', 'resources');
const PANDOC_DIR = path.join(RESOURCES_DIR, 'pandoc');

// Platform-specific download URLs
const DOWNLOADS = {
  win32: {
    url: `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-windows-x86_64.zip`,
    executablePath: 'pandoc.exe'
  },
  darwin: {
    url: `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-macOS.zip`,
    executablePath: 'pandoc'
  },
  linux: {
    url: `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-linux-amd64.tar.gz`,
    executablePath: 'pandoc'
  }
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function downloadAndExtractPandoc() {
  const platform = process.platform;
  const download = DOWNLOADS[platform];
  
  if (!download) {
    console.log(`⚠️  Pandoc bundling not supported for platform: ${platform}`);
    return;
  }

  // Create directories
  if (!fs.existsSync(RESOURCES_DIR)) {
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });
  }

  const pandocExe = path.join(PANDOC_DIR, download.executablePath);
  
  // Check if already downloaded
  if (fs.existsSync(pandocExe)) {
    console.log('✓ Pandoc already bundled');
    return;
  }

  console.log(`📥 Downloading Pandoc ${PANDOC_VERSION} for ${platform}...`);
  
  const tempFile = path.join(RESOURCES_DIR, `pandoc.${platform === 'linux' ? 'tar.gz' : 'zip'}`);
  
  try {
    await downloadFile(download.url, tempFile);
    console.log('✓ Download complete');
    
    console.log('📦 Extracting Pandoc...');
    
    if (!fs.existsSync(PANDOC_DIR)) {
      fs.mkdirSync(PANDOC_DIR, { recursive: true });
    }
    
    if (platform === 'linux') {
      // Extract tar.gz for Linux
      execSync(`tar -xzf "${tempFile}" -C "${PANDOC_DIR}" --strip-components=1`);
    } else {
      // Extract zip for Windows/Mac
      const zip = new AdmZip(tempFile);
      zip.extractAllTo(RESOURCES_DIR, true);
      
      // Find the pandoc executable in extracted folder
      const extractedFolder = fs.readdirSync(RESOURCES_DIR)
        .find(f => f.startsWith('pandoc-') && fs.statSync(path.join(RESOURCES_DIR, f)).isDirectory());
      
      if (extractedFolder) {
        const extractedPath = path.join(RESOURCES_DIR, extractedFolder);
        
        // Copy pandoc executable to pandoc directory
        const srcExe = platform === 'darwin' 
          ? path.join(extractedPath, 'bin', download.executablePath)
          : path.join(extractedPath, download.executablePath);
        
        if (fs.existsSync(srcExe)) {
          fs.copyFileSync(srcExe, pandocExe);
          
          // Make executable on Unix-like systems
          if (platform !== 'win32') {
            fs.chmodSync(pandocExe, 0o755);
          }
        }
        
        // Clean up extracted folder
        fs.rmSync(extractedPath, { recursive: true, force: true });
      }
    }
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    if (fs.existsSync(pandocExe)) {
      console.log('✓ Pandoc bundled successfully at:', pandocExe);
    } else {
      console.error('❌ Failed to bundle Pandoc');
    }
    
  } catch (error) {
    console.error('❌ Error bundling Pandoc:', error.message);
    // Clean up on error
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

// Run if called directly
if (require.main === module) {
  downloadAndExtractPandoc().catch(console.error);
}

module.exports = { downloadAndExtractPandoc };
