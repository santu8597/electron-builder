// Type definitions for Electron API
declare global {
  interface Window {
    electron?: {
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
      convertDocx: (fileBuffer: ArrayBuffer, fileName: string) => Promise<{ html: string; method: string }>;
      exportDocument: (html: string, format: string, filename: string) => Promise<ArrayBuffer>;
    };
  }
}

// Check if running in Electron
export const isElectron = typeof window !== 'undefined' && window.electron !== undefined;

// Wrapper for document conversion
export async function convertDocx(file: File): Promise<{ html: string; method: string }> {
  if (isElectron && window.electron) {
    // Use Electron IPC
    const buffer = await file.arrayBuffer();
    return await window.electron.convertDocx(buffer, file.name);
  } else {
    // Fallback to API route for web version
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/convert-docx', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Failed to convert document');
    }
    
    return await response.json();
  }
}

// Wrapper for document export
export async function exportDocument(html: string, format: 'pdf' | 'docx', filename: string): Promise<Blob> {
  if (isElectron && window.electron) {
    // Use Electron IPC
    const buffer = await window.electron.exportDocument(html, format, filename);
    return new Blob([buffer], {
      type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  } else {
    // Fallback to API route for web version
    const response = await fetch('/api/export-pandoc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ html, format, filename }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to export document');
    }
    
    return await response.blob();
  }
}
