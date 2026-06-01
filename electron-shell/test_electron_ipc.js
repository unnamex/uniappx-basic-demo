const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
    fs.writeFileSync('test_preload.js', `
        const { contextBridge, ipcRenderer } = require('electron');
        contextBridge.exposeInMainWorld('electronAPI', {
            testSync: () => {
                const b = Buffer.from([42, 43, 44]);
                // return ArrayBuffer
                return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
            },
            report: (info) => ipcRenderer.send('report', info)
        });
    `);
    fs.writeFileSync('test.html', `
        <script>
            try {
                const res = window.electronAPI.testSync();
                window.electronAPI.report({
                    isBuffer: res instanceof ArrayBuffer,
                    byteLength: res ? res.byteLength : -1,
                    type: typeof res,
                    val: res instanceof ArrayBuffer ? new Uint8Array(res)[0] : -1
                });
            } catch(e) {
                window.electronAPI.report({ error: e.message });
            }
        </script>
    `);

    const win = new BrowserWindow({
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'test_preload.js')
        }
    });

    ipcMain.on('report', (event, info) => {
        console.log("Renderer got:", info);
        app.quit();
    });

    win.loadFile('test.html');
});
