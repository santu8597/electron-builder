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
    };
  }
}

// Document conversion using Electron IPC
export async function convertDocx(file: File): Promise<{ html: string; method: string }> {
  const buffer = await file.arrayBuffer();
  return await window.electron.convertDocx(buffer, file.name);
}

// Document export using Electron IPC
export async function exportDocument(html: string, format: 'pdf' | 'docx', filename: string): Promise<Blob> {
  const buffer = await window.electron.exportDocument(html, format, filename);
  return new Blob([buffer], {
    type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}
