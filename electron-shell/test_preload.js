
        const { contextBridge, ipcRenderer } = require('electron');
        contextBridge.exposeInMainWorld('electronAPI', {
            testSync: () => {
                const b = Buffer.from([42, 43, 44]);
                // return ArrayBuffer
                return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
            },
            report: (info) => ipcRenderer.send('report', info)
        });
    