const fs = require('fs');
const path = require('path');

const modelsDir = path.join('f:\\workProject\\avpbc-pop\\electron-shell\\vendor\\models');
const manifestsDir = path.join(modelsDir, 'manifests', 'registry.ollama.ai', 'library', 'qwen2.5');
const blobsDir = path.join(modelsDir, 'blobs');

const targetModel = '3b-instruct-q4_K_M';
const targetManifestPath = path.join(manifestsDir, targetModel);

if (!fs.existsSync(targetManifestPath)) {
    console.log(`Manifest ${targetModel} not found.`);
    process.exit(0);
}

// 1. Gather all active digests
const activeDigests = new Set();
const files = fs.readdirSync(manifestsDir);

for (const file of files) {
    if (file !== targetModel) {
        const filePath = path.join(manifestsDir, file);
        if (fs.statSync(filePath).isFile()) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (data.config && data.config.digest) {
                    activeDigests.add(data.config.digest.replace('sha256:', 'sha256-'));
                }
                if (data.layers) {
                    for (const layer of data.layers) {
                        activeDigests.add(layer.digest.replace('sha256:', 'sha256-'));
                    }
                }
            } catch (e) {
                console.error(`Error reading ${file}:`, e);
            }
        }
    }
}

// Also get embedding model digests just in case
const embedManifestsDir = path.join(modelsDir, 'manifests', 'registry.ollama.ai', 'library', 'nomic-embed-text');
if (fs.existsSync(embedManifestsDir)) {
    const embedFiles = fs.readdirSync(embedManifestsDir);
    for (const file of embedFiles) {
        const filePath = path.join(embedManifestsDir, file);
        if (fs.statSync(filePath).isFile()) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (data.config && data.config.digest) {
                    activeDigests.add(data.config.digest.replace('sha256:', 'sha256-'));
                }
                if (data.layers) {
                    for (const layer of data.layers) {
                        activeDigests.add(layer.digest.replace('sha256:', 'sha256-'));
                    }
                }
            } catch (e) {}
        }
    }
}

// 2. Find blobs to delete
let deletedBlobsCount = 0;
let deletedBytes = 0;

try {
    const targetData = JSON.parse(fs.readFileSync(targetManifestPath, 'utf-8'));
    const targetDigests = new Set();
    
    if (targetData.config && targetData.config.digest) {
        targetDigests.add(targetData.config.digest.replace('sha256:', 'sha256-'));
    }
    if (targetData.layers) {
        for (const layer of targetData.layers) {
            targetDigests.add(layer.digest.replace('sha256:', 'sha256-'));
        }
    }
    
    for (const digest of targetDigests) {
        if (!activeDigests.has(digest)) {
            const blobPath = path.join(blobsDir, digest);
            if (fs.existsSync(blobPath)) {
                const size = fs.statSync(blobPath).size;
                fs.unlinkSync(blobPath);
                deletedBlobsCount++;
                deletedBytes += size;
                console.log(`Deleted blob: ${digest} (${(size / 1024 / 1024).toFixed(2)} MB)`);
            }
        }
    }
    
    // 3. Delete the manifest
    fs.unlinkSync(targetManifestPath);
    console.log(`Deleted manifest: ${targetModel}`);
    
    console.log(`Cleanup complete. Deleted ${deletedBlobsCount} blobs. Freed ${(deletedBytes / 1024 / 1024 / 1024).toFixed(2)} GB.`);
} catch (e) {
    console.error(`Error processing ${targetModel}:`, e);
}
