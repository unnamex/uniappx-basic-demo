import { createObjectURL } from 'ranuts/utils';
import { getDocmentObj, setDocmentObj } from '../store';
import { handleDocumentOperation, initX2T, loadEditorApi, loadScript } from './converter';
import { showLoading } from './loading';

// Import UI functions with type-only to avoid circular dependency
// These will be passed as callbacks or called after document operations
let hideControlPanelFn: (() => void) | null = null;
let showControlPanelFn: (() => void) | null = null;
let showMenuGuideFn: (() => void) | null = null;

export function setUICallbacks(callbacks: {
  hideControlPanel: () => void;
  showControlPanel: () => void;
  showMenuGuide: () => void;
}): void {
  hideControlPanelFn = callbacks.hideControlPanel;
  showControlPanelFn = callbacks.showControlPanel;
  showMenuGuideFn = callbacks.showMenuGuide;
}

// Create a single file input element
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.docx,.xlsx,.pptx,.doc,.xls,.ppt,.csv';
fileInput.style.setProperty('visibility', 'hidden');
document.body.appendChild(fileInput);

export const onCreateNew = async (ext: string): Promise<void> => {
  // Note: Loading is now shown in the menu button click handler
  // This function should not show loading again to avoid double loading indicators
  try {
    // Always hide control panel and ensure FAB is visible when creating new document
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }
    setDocmentObj({
      fileName: 'New_Document' + ext,
      file: undefined,
    });
    await loadScript();
    await loadEditorApi();
    await initX2T();
    const { fileName, file: fileBlob } = getDocmentObj();
    await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
    // Show menu guide after document is loaded
    if (showMenuGuideFn) {
      setTimeout(() => {
        showMenuGuideFn!();
      }, 1000);
    }
  } catch (error) {
    console.error('Error creating new document:', error);
    // Ensure control panel is shown on error
    if (showControlPanelFn) {
      showControlPanelFn();
    }
    throw error; // Re-throw to let the menu button handler catch it
  }
};

export const onOpenDocument = (): void => {
  // Clear previous event handler and value
  fileInput.onchange = null;
  fileInput.value = '';

  // Define the change handler
  const handleChange = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];

    // Clear the handler to prevent multiple triggers
    fileInput.onchange = null;

    // Only process if a file was actually selected
    // If user cancelled, onchange won't fire, nothing happens
    if (file) {
      const { removeLoading } = showLoading();
      try {
        if (hideControlPanelFn) {
          hideControlPanelFn();
        }
        setDocmentObj({
          fileName: file.name,
          file: file,
          url: await createObjectURL(file),
        });
        await initX2T();
        const { fileName, file: fileBlob } = getDocmentObj();
        await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
        // Clear file selection so the same file can be selected again
        fileInput.value = '';
        // Show menu guide after document is loaded
        if (showMenuGuideFn) {
          setTimeout(() => {
            showMenuGuideFn!();
          }, 1000);
        }
      } catch (error) {
        console.error('Error opening document:', error);
        // Ensure control panel is shown on error
        if (showControlPanelFn) {
          showControlPanelFn();
        }
      } finally {
        // Always remove loading, even if there's an error
        removeLoading();
      }
    }
    // If no file selected, nothing happens (user cancelled)
  };

  // Set the change handler
  fileInput.onchange = handleChange;

  // Trigger file picker click event
  fileInput.click();
};

export const openDocumentFromUrl = async (url: string, fileName?: string): Promise<void> => {
  const { removeLoading } = showLoading();
  try {
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }

    // Fetch the file from URL
    console.log('Fetching document from URL:', url);
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
    }

    // Get file name from URL or Content-Disposition header, or use provided name
    let finalFileName = fileName;
    if (!finalFileName) {
      // Try to get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          finalFileName = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // If still no filename, extract from URL
      if (!finalFileName) {
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          finalFileName = pathname.split('/').pop() || 'document';
          // Remove query parameters if any
          finalFileName = finalFileName.split('?')[0];
        } catch {
          finalFileName = 'document';
        }
      }
    }

    // Get file blob
    const blob = await response.blob();
    const file = new File([blob], finalFileName, { type: blob.type });

    // Set document object
    setDocmentObj({
      fileName: finalFileName,
      file: file,
      url: await createObjectURL(file),
    });

    // Initialize and open document
    await initX2T();
    const { fileName: docFileName, file: fileBlob } = getDocmentObj();
    await handleDocumentOperation({ file: fileBlob, fileName: docFileName, isNew: !fileBlob });

    // Show menu guide after document is loaded
    if (showMenuGuideFn) {
      setTimeout(() => {
        showMenuGuideFn!();
      }, 1000);
    }
  } catch (error) {
    console.error('Error opening document from URL:', error);
    
    // Display error directly in the iframe container
    const iframeContainer = document.getElementById('iframe');
    if (iframeContainer) {
      iframeContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-center;height:100%;padding:40px;text-align:center;color:#ef4444;font-family:sans-serif;">
          <svg style="width:48px;height:48px;margin-bottom:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <h2 style="font-size:20px;margin-bottom:8px;font-weight:bold;">文档加载失败</h2>
          <p style="font-size:14px;color:#666;">可能原因：网络问题、跨域拦截或格式不支持。</p>
          <pre style="margin-top:16px;background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;color:#374151;max-width:100%;overflow-x:auto;">${error instanceof Error ? error.message : String(error)}</pre>
        </div>
      `;
    }
  } finally {
    removeLoading();
  }
};

export const openDocumentFromBase64 = async (base64Str: string, fileName: string): Promise<void> => {
  const { removeLoading } = showLoading();
  try {
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }

    // Convert base64 to Blob
    const byteCharacters = atob(base64Str);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray]);
    const file = new File([blob], fileName, { type: blob.type });

    setDocmentObj({
      fileName: fileName,
      file: file,
      url: await createObjectURL(file),
    });

    await initX2T();
    const { fileName: docFileName, file: fileBlob } = getDocmentObj();
    await handleDocumentOperation({ file: fileBlob, fileName: docFileName, isNew: !fileBlob });

    if (showMenuGuideFn) {
      setTimeout(() => {
        showMenuGuideFn!();
      }, 1000);
    }
  } catch (error) {
    console.error('Error opening document from base64:', error);
    
    // Display error directly in the iframe container
    const iframeContainer = document.getElementById('iframe');
    if (iframeContainer) {
      iframeContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-center;height:100%;padding:40px;text-align:center;color:#ef4444;font-family:sans-serif;">
          <svg style="width:48px;height:48px;margin-bottom:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <h2 style="font-size:20px;margin-bottom:8px;font-weight:bold;">文档渲染失败</h2>
          <p style="font-size:14px;color:#666;">可能原因：文件格式不支持、WASM 加载失败或跨域拦截。</p>
          <pre style="margin-top:16px;background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;color:#374151;max-width:100%;overflow-x:auto;">${error instanceof Error ? error.message : String(error)}</pre>
        </div>
      `;
    }
    
    // DO NOT show control panel
    // if (showControlPanelFn) {
    //   showControlPanelFn();
    // }
  } finally {
    removeLoading();
  }
};
