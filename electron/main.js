const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// Get bundled pandoc path
function getBundledPandocPath() {
  const platform = process.platform;
  const executableName = platform === 'win32' ? 'pandoc.exe' : 'pandoc';
  
  if (isDev) {
    // In development, use local resources folder
    const devPath = path.join(__dirname, '..', 'resources', 'pandoc', executableName);
    if (fs.existsSync(devPath)) {
      return devPath;
    }
  } else {
    // In production, use packaged resources
    const prodPath = path.join(process.resourcesPath, 'resources', 'pandoc', executableName);
    if (fs.existsSync(prodPath)) {
      return prodPath;
    }
  }
  
  // Fallback to system pandoc
  return null;
}

// Find pandoc executable
function findPandocExecutable() {
  // Try bundled pandoc first
  const bundledPandoc = getBundledPandocPath();
  if (bundledPandoc) {
    console.log('Using bundled pandoc:', bundledPandoc);
    return bundledPandoc;
  }
  
  // Fallback to system-installed pandoc
  console.log('Bundled pandoc not found, checking system installation...');
  
  const platform = process.platform;
  
  if (platform === 'win32') {
    // Check common Windows installation paths
    const possiblePaths = [
      process.env.USERNAME ? `C:\\Users\\${process.env.USERNAME}\\scoop\\apps\\pandoc\\current\\pandoc.exe` : null,
      'C:\\Program Files\\Pandoc\\pandoc.exe',
      'C:\\Program Files (x86)\\Pandoc\\pandoc.exe'
    ].filter(Boolean);
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log('Using system pandoc:', p);
        return p;
      }
    }
  }
  
  // Default to 'pandoc' command (assumes it's in PATH)
  console.log('Using pandoc from PATH');
  return 'pandoc';
}

const PANDOC_EXECUTABLE = findPandocExecutable();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'PaperKraft',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      webSecurity: true,
    },
    icon: path.join(__dirname, '../public/image.png'),
    contentProtection: true, // Disable screenshots and screen recording
  });

  // Set window flag to prevent screen capture (Windows-specific)
  if (process.platform === 'win32') {
    mainWindow.setContentProtection(true);
  }

  // In development, load from Next.js dev server
  // In production, load from Next.js exported static files
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Set Content Security Policy
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;",
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;",
          "img-src 'self' data: https:;",
          "font-src 'self' data: https://cdn.jsdelivr.net;",
          "connect-src 'self' http://localhost:* ws://localhost:*;"
        ].join(' ')
      }
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============= IPC Handlers for Document Processing =============

// Handler for converting DOCX files
ipcMain.handle('convert-docx', async (event, fileBuffer, fileName) => {
  console.log('Converting document:', fileName);
  
  try {
    // Convert ArrayBuffer to Node.js Buffer if needed
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    
    // Try pandoc first, fall back to mammoth
    try {
      const html = await convertWithPandoc(buffer, fileName);
      return { html, method: 'pandoc' };
    } catch (pandocError) {
      console.log('Pandoc failed, trying mammoth:', pandocError.message);
      const html = await convertWithMammoth(buffer);
      return { html, method: 'mammoth' };
    }
  } catch (error) {
    console.error('Conversion error:', error);
    throw error;
  }
});

// Handler for exporting to PDF/DOCX
ipcMain.handle('export-document', async (event, html, format, filename) => {
  console.log('Exporting document:', format);
  
  try {
    const fileBuffer = await exportWithPandoc(html, format, filename);
    return fileBuffer;
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
});

// Handler for showing native error dialogs
ipcMain.handle('show-error-dialog', async (event, options) => {
  const { title, message, detail } = options;
  
  return await dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: title || 'Error',
    message: message || 'An error occurred',
    detail: detail,
    buttons: ['OK']
  });
});

// Handler for showing native info dialogs
ipcMain.handle('show-info-dialog', async (event, options) => {
  const { title, message, detail } = options;
  
  return await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: title || 'Information',
    message: message || '',
    detail: detail,
    buttons: ['OK']
  });
});

// Handler for showing native warning dialogs
ipcMain.handle('show-warning-dialog', async (event, options) => {
  const { title, message, detail } = options;
  
  return await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: title || 'Warning',
    message: message || '',
    detail: detail,
    buttons: ['OK']
  });
});

// ============= Document Conversion Functions =============

async function convertWithPandoc(fileBuffer, fileName) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-convert-'));
  const inputPath = path.join(tempDir, 'input.docx');
  const outputPath = path.join(tempDir, 'output.html');
  const mediaDir = path.join(tempDir, 'media');

  try {
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(inputPath, fileBuffer);
    
    if (!fs.existsSync(inputPath)) {
      throw new Error('Failed to write input file');
    }

    // Use the globally determined pandoc executable
    const pandocExecutable = PANDOC_EXECUTABLE;
    
    const pandocArgs = [
      '--from=docx',
      '--to=html',
      '--wrap=none',
      '--mathjax',
      `--extract-media=${mediaDir}`,
      '--standalone',
      '--preserve-tabs',
      '--section-divs',
      '--html-q-tags',
      '-o',
      outputPath,
      inputPath
    ];

    const pandocCommand = `"${pandocExecutable}" ${pandocArgs.map(arg => {
      if (arg.includes(' ') && !arg.startsWith('--')) {
        return `"${arg}"`;
      }
      return arg;
    }).join(' ')}`;
    
    console.log('Running pandoc:', pandocCommand);

    await execAsync(pandocCommand, { 
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10,
      windowsHide: true
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Pandoc did not generate output file');
    }

    const htmlContent = fs.readFileSync(outputPath, 'utf-8');
    const processedHtml = processImagesInHtml(htmlContent, mediaDir);

    return processedHtml;
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup:', cleanupError);
    }
  }
}

function processImagesInHtml(html, mediaDir) {
  if (!fs.existsSync(mediaDir)) {
    return html;
  }

  let processedHtml = html;
  const imgRegex = /<img[^>]+src="([^"]*)"[^>]*>/g;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const imgSrc = match[1];
    const fullImagePath = path.resolve(mediaDir, imgSrc);

    if (fs.existsSync(fullImagePath)) {
      try {
        const imageBuffer = fs.readFileSync(fullImagePath);
        const ext = path.extname(fullImagePath).toLowerCase();
        const mimeTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.bmp': 'image/bmp',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp'
        };
        const mimeType = mimeTypes[ext] || 'image/png';
        const base64 = imageBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;

        processedHtml = processedHtml.replace(imgSrc, dataUrl);
      } catch (error) {
        console.warn(`Failed to process image ${imgSrc}:`, error);
      }
    }
  }

  return processedHtml;
}

async function convertWithMammoth(fileBuffer) {
  try {
    const mammoth = require('mammoth');
    
    const result = await mammoth.convertToHtml({ 
      buffer: fileBuffer
    }, {
      convertImage: mammoth.images.imgElement(function(image) {
        return image.read("base64").then(function(imageBuffer) {
          const attributes = {
            src: "data:" + image.contentType + ";base64," + imageBuffer
          };
          
          // Preserve original dimensions from DOCX
          // Mammoth provides width/height in EMUs (English Metric Units)
          // 1 inch = 914400 EMUs, 1 inch = 96 pixels (standard screen DPI)
          // So: pixels = EMUs / 9525
          if (image.width) {
            attributes.width = Math.round(image.width / 9525);
          }
          if (image.height) {
            attributes.height = Math.round(image.height / 9525);
          }
          
          return attributes;
        }).catch(() => {
          return { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" };
        });
      }),
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "b => strong",
        "i => em"
      ]
    });
    
    return result.value;
  } catch (error) {
    console.error('Mammoth error:', error);
    const mammoth = require('mammoth');
    const textResult = await mammoth.extractRawText({ buffer: fileBuffer });
    return `<div>${textResult.value.replace(/\n/g, '<br>')}</div>`;
  }
}

async function exportWithPandoc(html, format, filename) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-'));
  const inputFile = path.join(tempDir, 'input.html');
  const outputFile = path.join(tempDir, `output.${format}`);
// Log a sample of the HTML to see image tags
    const imgMatches = html.match(/<img[^>]*>/g);
    if (imgMatches) {
      console.log('=== IMAGE TAGS IN EXPORT HTML ===');
      imgMatches.forEach((img, idx) => {
        console.log(`Image ${idx + 1}:`, img.substring(0, 200));
      });
      console.log('================================');
    }
    
    
  try {
    fs.writeFileSync(inputFile, html, 'utf-8');

    if (format === 'pdf') {
      const pdfEngines = ['wkhtmltopdf', 'weasyprint', 'prince', 'context', 'pdfroff'];
      
      let pdfCreated = false;
      
      for (const engine of pdfEngines) {
        try {
          await execAsync(`pandoc "${inputFile}" -o "${outputFile}" --pdf-engine=${engine}`);
          pdfCreated = true;
          break;
        } catch (err) {
          continue;
        }
      }
      
      if (!pdfCreated) {
        throw new Error(
          'No PDF engine found. Please install wkhtmltopdf from https://wkhtmltopdf.org/downloads.html'
        );
      }
    } else if (format === 'docx') {
      // Use --dpi=96 to ensure Pandoc uses standard screen DPI for image conversion
      await execAsync(`pandoc "${inputFile}" -f html+tex_math_dollars -t docx -o "${outputFile}" --mathml --dpi=96`);
    } else {
      throw new Error('Unsupported format. Use "pdf" or "docx"');
    }

    const fileBuffer = fs.readFileSync(outputFile);
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return fileBuffer;
  } catch (error) {
    // Clean up on error
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    throw error;
  }
}
