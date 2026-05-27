const fs = require('fs');
const path = require('path');

const tier = process.argv[2] || 'pro';
let qwenModelTag = '';

switch (tier) {
  case 'lite':
    qwenModelTag = '1.5b';
    break;
  case 'standard':
    qwenModelTag = '3b';
    break;
  case 'pro':
  default:
    qwenModelTag = '7b';
    break;
}

const baseDir = path.join(__dirname, '..');
const srcVendorModels = path.join(baseDir, 'vendor', 'models');
const destVendorModels = path.join(baseDir, 'vendor', 'models-selected');

if (fs.existsSync(destVendorModels)) {
  fs.rmSync(destVendorModels, { recursive: true, force: true });
}

fs.mkdirSync(path.join(destVendorModels, 'blobs'), { recursive: true });

function copyManifestAndBlobs(modelName, tag) {
  const manifestRelPath = `manifests/registry.ollama.ai/library/${modelName}/${tag}`;
  const manifestSrc = path.join(srcVendorModels, manifestRelPath);
  const manifestDest = path.join(destVendorModels, manifestRelPath);

  if (!fs.existsSync(manifestSrc)) {
    console.error(`Manifest not found: ${manifestSrc}`);
    return;
  }

  // Ensure dest manifest dir exists
  fs.mkdirSync(path.dirname(manifestDest), { recursive: true });
  fs.copyFileSync(manifestSrc, manifestDest);

  // Parse manifest
  const manifestContent = fs.readFileSync(manifestSrc, 'utf-8');
  const manifest = JSON.parse(manifestContent);

  const digests = [];
  if (manifest.config && manifest.config.digest) {
    digests.push(manifest.config.digest);
  }
  if (manifest.layers && Array.isArray(manifest.layers)) {
    for (const layer of manifest.layers) {
      if (layer.digest) {
        digests.push(layer.digest);
      }
    }
  }

  // Copy blobs
  for (const digest of digests) {
    const blobName = digest.replace(':', '-');
    const blobSrc = path.join(srcVendorModels, 'blobs', blobName);
    const blobDest = path.join(destVendorModels, 'blobs', blobName);
    if (fs.existsSync(blobSrc)) {
      if (!fs.existsSync(blobDest)) {
        console.log(`Copying blob: ${blobName}`);
        fs.copyFileSync(blobSrc, blobDest);
      }
    } else {
      console.warn(`Blob not found: ${blobSrc}`);
    }
  }
}

// Copy the models
console.log(`Preparing tier: ${tier}, model: qwen2.5:${qwenModelTag}`);
copyManifestAndBlobs('qwen2.5', qwenModelTag);
copyManifestAndBlobs('nomic-embed-text', 'latest');

// Write config
const configPath = path.join(destVendorModels, 'model-config.json');
const configData = {
  modelName: `qwen2.5:${qwenModelTag}`,
  tier: tier
};
fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf-8');

console.log('Model preparation complete.');
