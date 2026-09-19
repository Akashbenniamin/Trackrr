import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const srcDir = path.resolve('trackrr-extension');
const outZip = path.resolve('public/trackrr-extension.zip');

const zip = new JSZip();

function addDirToZip(dir, zipFolder) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      addDirToZip(fullPath, zipFolder.folder(entry.name));
    } else if (entry.isFile()) {
      const content = fs.readFileSync(fullPath);
      zipFolder.file(entry.name, content);
    }
  }
}

addDirToZip(srcDir, zip);

zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
  platform: 'DOS'
}).then(content => {
  fs.mkdirSync(path.dirname(outZip), { recursive: true });
  fs.writeFileSync(outZip, content);
  console.log(`Successfully packed trackrr-extension.zip (${content.length} bytes)`);
}).catch(err => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
