// Type definitions for Electron API
declare global {
  interface Window {
    electron: {
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
      convertDocx: (fileBuffer: ArrayBuffer, fileName: string) => Promise<{ html: string; method: string }>;
      exportDocument: (html: string, format: string, filename: string) => Promise<ArrayBuffer>;
      showErrorDialog: (options: { title?: string; message: string; detail?: string }) => Promise<void>;
      showInfoDialog: (options: { title?: string; message: string; detail?: string }) => Promise<void>;
      showWarningDialog: (options: { title?: string; message: string; detail?: string }) => Promise<void>;
    };
  }
}

// Check if running in Electron environment
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electron !== undefined;
}

// Document conversion using Electron IPC (with browser fallback)
export async function convertDocx(file: File): Promise<{ html: string; method: string }> {
  if (!isElectron()) {
    // Fallback to browser-based conversion (will be handled by mammoth in parser.ts)
    throw new Error('Electron API not available, using browser fallback');
  }
  const buffer = await file.arrayBuffer();
  return await window.electron.convertDocx(buffer, file.name);
}

// Document export using Electron IPC (with browser fallback)
export async function exportDocument(html: string, format: 'pdf' | 'docx', filename: string): Promise<Blob> {
  if (!isElectron()) {
    // Browser fallback - throw error to trigger browser-based export methods
    throw new Error('Electron API not available. Please use browser-based export methods.');
  }
  const buffer = await window.electron.exportDocument(html, format, filename);
  return new Blob([buffer], {
    type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

// Native dialog functions
export async function showErrorDialog(message: string, detail?: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electron) {
    await window.electron.showErrorDialog({ message, detail });
  } else {
    // Fallback to browser alert
    alert(`Error: ${message}${detail ? '\n' + detail : ''}`);
  }
}

export async function showInfoDialog(message: string, detail?: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electron) {
    await window.electron.showInfoDialog({ message, detail });
  } else {
    alert(message);
  }
}

export async function showWarningDialog(message: string, detail?: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electron) {
    await window.electron.showWarningDialog({ message, detail });
  } else {
    alert(`Warning: ${message}${detail ? '\n' + detail : ''}`);
  }
}
