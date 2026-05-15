import 'ranui/message';
import { createObjectURL } from 'ranuts/utils';
import { getDocmentObj } from '../store';
import { getOnlyOfficeLang, t } from './i18n';
import { c_oAscFileType2 } from './file-types';
import type { SaveEvent } from './document-types';
import { getMimeTypeFromExtension } from './document-utils';

// Import converter function to avoid circular dependency
let convertBinToDocumentAndDownloadFn:
  | ((bin: Uint8Array, fileName: string, targetExt?: string) => Promise<any>)
  | null = null;

export function setConverterCallback(
  callback: (bin: Uint8Array, fileName: string, targetExt?: string) => Promise<any>,
): void {
  convertBinToDocumentAndDownloadFn = callback;
}

// Global media mapping object
const media: Record<string, string> = {};

// Editor operation queue to prevent concurrent operations
let editorOperationQueue: Promise<void> = Promise.resolve();

/**
 * Queue editor operations to prevent concurrent editor creation/destruction
 */
async function queueEditorOperation<T>(operation: () => Promise<T>): Promise<T> {
  // Wait for previous operations to complete
  // Add a timeout to prevent infinite waiting
  try {
    await Promise.race([
      editorOperationQueue,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Editor operation queue timeout')), 30000)),
    ]);
  } catch (error) {
    // If timeout, log warning but continue (previous operation may have failed)
    if (error instanceof Error && error.message === 'Editor operation queue timeout') {
      console.warn('Editor operation queue timeout, proceeding anyway');
    } else {
      // Re-throw other errors
      throw error;
    }
  }

  // Create a new promise for this operation
  let resolveOperation: () => void;
  let rejectOperation: (error: any) => void;
  const operationPromise = new Promise<void>((resolve, reject) => {
    resolveOperation = resolve;
    rejectOperation = reject;
  });

  // Update the queue
  editorOperationQueue = operationPromise;

  try {
    const result = await operation();
    resolveOperation!();
    return result;
  } catch (error) {
    rejectOperation!(error);
    throw error;
  }
}

/**
 * Handle file write request (mainly for handling pasted images)
 * @param event - OnlyOffice editor file write event
 */
async function handleWriteFile(event: any) {
  try {
    console.log('Write file event:', event);

    const { data: eventData } = event;
    if (!eventData) {
      console.warn('No data provided in writeFile event');
      return;
    }

    const {
      data: imageData, // Uint8Array image data
      file: fileName, // File name, e.g., "display8image-174799443357-0.png"
      _target, // Target object containing frameOrigin and other info
    } = eventData;

    // Validate data
    if (!imageData || !(imageData instanceof Uint8Array)) {
      throw new Error('Invalid image data: expected Uint8Array');
    }

    if (!fileName || typeof fileName !== 'string') {
      throw new Error('Invalid file name');
    }

    // Extract extension from file name
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = getMimeTypeFromExtension(fileExtension);

    // Create Blob object
    const blob = new Blob([imageData as unknown as BlobPart], { type: mimeType });

    // Create object URL
    const objectUrl = await createObjectURL(blob);
    // Add image URL to media mapping using original file name as key
    media[`media/${fileName}`] = objectUrl;
    window.editor?.sendCommand({
      command: 'asc_setImageUrls',
      data: {
        urls: media,
      },
    });

    window.editor?.sendCommand({
      command: 'asc_writeFileCallback',
      data: {
        // Image base64
        path: objectUrl,
        imgName: fileName,
      },
    });
    console.log(`Successfully processed image: ${fileName}, URL: ${media}`);
  } catch (error: any) {
    console.error('Error handling writeFile:', error);

    // Notify editor that file processing failed
    if (window.editor && typeof window.editor.sendCommand === 'function') {
      window.editor.sendCommand({
        command: 'asc_writeFileCallback',
        data: {
          success: false,
          error: error.message,
        },
      });
    }

    if (event.callback && typeof event.callback === 'function') {
      event.callback({
        success: false,
        error: error.message,
      });
    }
  }
}

async function handleSaveDocument(event: SaveEvent) {
  console.log('Save document event:', event);

  if (event.data && event.data.data) {
    const { data, option } = event.data;
    const { fileName } = getDocmentObj() || {};

    // Determine target format from editor's output format
    let targetFormat = c_oAscFileType2[option.outputformat];

    // Only force CSV format if the original file is CSV
    // This check ensures XLSX and other file types are not affected
    // CSV files are converted to XLSX internally, so editor may return XLSX format
    if (fileName && fileName.toLowerCase().endsWith('.csv')) {
      targetFormat = 'CSV';
      console.log('Original file is CSV, forcing save as CSV format');
    } else {
      // For non-CSV files (XLSX, DOCX, PPTX, etc.), use the format returned by editor
      // This ensures XLSX files are saved as XLSX, not CSV
      console.log(`Saving as ${targetFormat} format (original file: ${fileName})`);
    }

    // Create download
    if (convertBinToDocumentAndDownloadFn) {
      await convertBinToDocumentAndDownloadFn(data.data, fileName, targetFormat);
    } else {
      throw new Error('Converter callback not set');
    }
  }

  // Notify editor that save is complete
  window.editor?.sendCommand({
    command: 'asc_onSaveCallback',
    data: { err_code: 0 },
  });
}

// Public editor creation method
export function createEditorInstance(config: {
  fileName: string;
  fileType: string;
  binData: ArrayBuffer | string;
  media?: any;
}): Promise<void> {
  return queueEditorOperation(async () => {
    const { fileName, fileType, binData, media: mediaUrls } = config;

    // Check if there's an existing editor that needs cleanup
    const hasExistingEditor = !!window.editor;

    // Clean up old editor instance properly
    if (window.editor) {
      try {
        console.log('Destroying previous editor instance...');
        window.editor.destroyEditor();

        // When switching between document types, especially from/to PPT,
        // we need more time for cleanup. PPT editors are particularly resource-intensive.
        // Use longer delay when switching editors or when dealing with presentations
        const isPresentation = fileType === 'pptx' || fileType === 'ppt';
        const destroyDelay = hasExistingEditor && isPresentation ? 400 : hasExistingEditor ? 250 : 150;

        // Wait a bit for destroy to complete
        await new Promise((resolve) => setTimeout(resolve, destroyDelay));
      } catch (error) {
        console.warn('Error destroying previous editor:', error);
      }
      window.editor = undefined;
    }

    // Clean up iframe container to ensure clean state
    const iframeContainer = document.getElementById('iframe');
    if (iframeContainer) {
      // Remove all child elements
      while (iframeContainer.firstChild) {
        iframeContainer.removeChild(iframeContainer.firstChild);
      }
    }

    // Additional delay to ensure cleanup completes before creating new editor
    // This is especially important when switching between different document types
    // When switching editors, especially involving PPT, we need more time
    const isPresentation = fileType === 'pptx' || fileType === 'ppt';
    const cleanupDelay = hasExistingEditor && isPresentation ? 400 : hasExistingEditor ? 250 : 150;
    await new Promise((resolve) => setTimeout(resolve, cleanupDelay));

    const editorLang = getOnlyOfficeLang();
    console.log('Creating new editor instance for:', fileName, 'type:', fileType);

    try {
      // 使用占位短 URL，而非将完整文档 base64 编码到 data: URI 中。
      // 原因：OnlyOffice 的 api.js 会将整个 document 对象（含 url）序列化后
      // 拼接到 iframe 的 URL 查询参数 _document 中。如果 url 是包含完整文档
      // 数据的 data: URI（约 2.7MB+），会导致 URL 超长，浏览器请求失败。
      // 实际的文档内容通过 onAppReady 回调中的 asc_openDocument({ buf: binData })
      // 直接以二进制方式注入编辑器内核，document.url 仅用于通过 api.js 校验。
      const dummyUrl = 'about:blank';

      window.editor = new window.DocsAPI.DocEditor('iframe', {
        document: {
          title: fileName,
          url: dummyUrl, // 占位 URL，仅用于通过 api.js 的格式校验
          fileType: fileType,
          permissions: {
            edit: false,     // 禁用编辑
            chat: false,     // 禁用聊天
            protect: false,  // 禁用保护功能
            print: false,    // 禁用打印
            download: false, // 禁用下载
            review: false,   // 禁用审阅
          },
        },
        editorConfig: {
          mode: 'view',
          lang: editorLang,
          user: {
            id: 'local-user',
            name: 'Guest',
          },
          customization: {
            help: false,
            about: false,
            feedback: false, // 隐藏反馈按钮
            hideRightMenu: true,
            compactHeader: true, // 紧凑型顶部栏
            toolbarNoTabs: true, // 隐藏顶部的标签栏（如文件、视图、插入等）
            features: {
              spellcheck: {
                change: false,
              },
            },
            anonymous: {
              request: false,
              label: 'Guest',
            },
          },
        },
        events: {
          onAppReady: () => {
            // Set media resources
            if (mediaUrls) {
              window.editor?.sendCommand({
                command: 'asc_setImageUrls',
                data: { urls: mediaUrls },
              });
            }

            // Load document content
            window.editor?.sendCommand({
              command: 'asc_openDocument',
              // @ts-expect-error binData type is handled by the editor
              data: { buf: binData },
            });
          },
          onDocumentReady: () => {
            console.log(`${t('documentLoaded')}${fileName}`);
            // Note: For CSV files, the save dialog may show XLSX format,
            // but the actual save will be forced to CSV format in handleSaveDocument

            // 注入脚本以隐藏特定的高级设置菜单项（如“反馈”、“下载文档”）
            try {
              const iframe = document.getElementById('iframe') as HTMLIFrameElement;
              const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
              if (doc) {
                const script = doc.createElement('script');
                script.innerHTML = `
                  (function() {
                    var hideItems = function() {
                      var items = document.querySelectorAll('.x-menu-item-text, .box-item-caption, span');
                      for (var i = 0; i < items.length; i++) {
                        var text = items[i].innerText || items[i].textContent;
                        if (text === '反馈' || text === '下载文档' || text === 'Feedback' || text === 'Download Document' || text === 'Download as...') {
                          var parent = items[i].closest('.x-menu-item') || items[i].closest('.box-item') || items[i].parentElement;
                          if (parent) {
                            parent.style.display = 'none';
                            parent.style.setProperty('display', 'none', 'important');
                          }
                        }
                      }
                    };
                    // 初始隐藏
                    setTimeout(hideItems, 500);
                    // 监听DOM变化，防止下拉菜单动态渲染时出现
                    var observer = new MutationObserver(hideItems);
                    observer.observe(document.body, { childList: true, subtree: true });
                  })();
                `;
                doc.head.appendChild(script);
              }
            } catch (e) {
              console.warn('Failed to inject hide UI script', e);
            }
          },
          onSave: handleSaveDocument,
          // writeFile
          // TODO: writeFile - handle when pasting images from external sources
          writeFile: handleWriteFile,
        },
      });
    } catch (error) {
      console.error('Error creating editor instance:', error);
      throw error;
    }
  });
}

export function loadEditorApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.DocsAPI) {
      resolve();
      return;
    }

    // Load editor API
    const script = document.createElement('script');
    script.src = './web-apps/apps/api/documents/api.js';
    script.onload = () => resolve();
    script.onerror = (error) => {
      console.error('Failed to load OnlyOffice API:', error);
      alert(t('failedToLoadEditor'));
      reject(error);
    };
    document.head.appendChild(script);
  });
}
