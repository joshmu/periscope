#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Safely clean up compiled .js and .js.map files that have corresponding .ts files
 */

function findCompiledFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
      findCompiledFiles(fullPath, files);
    } else if (item.endsWith('.js') || item.endsWith('.js.map')) {
      files.push(fullPath);
    }
  }

  return files;
}

function hasTypeScriptSource(jsFile) {
  // Remove .js or .js.map extension to get base name
  let baseName = jsFile;
  if (jsFile.endsWith('.js.map')) {
    baseName = jsFile.slice(0, -7); // Remove .js.map
  } else if (jsFile.endsWith('.js')) {
    baseName = jsFile.slice(0, -3); // Remove .js
  }

  // Check for .ts or .tsx file
  return fs.existsSync(baseName + '.ts') || fs.existsSync(baseName + '.tsx');
}

// Find all .js and .js.map files in src and test directories
const srcFiles = findCompiledFiles(path.join(__dirname, '..', 'src'));
const testFiles = findCompiledFiles(path.join(__dirname, '..', 'test'));
const allFiles = [...srcFiles, ...testFiles];

console.log(`Found ${allFiles.length} compiled files to check\n`);

const filesToRemove = [];
const filesToKeep = [];

for (const file of allFiles) {
  if (hasTypeScriptSource(file)) {
    filesToRemove.push(file);
  } else {
    filesToKeep.push(file);
  }
}

if (filesToKeep.length > 0) {
  console.log('Files to KEEP (no TypeScript source found):');
  filesToKeep.forEach((f) => console.log(`  - ${f.replace(path.join(__dirname, '..') + '/', '')}`));
  console.log();
}

if (filesToRemove.length > 0) {
  console.log(`Files to REMOVE (${filesToRemove.length} files with TypeScript sources):`);
  filesToRemove.forEach((f) =>
    console.log(`  - ${f.replace(path.join(__dirname, '..') + '/', '')}`),
  );
  console.log();

  // Ask for confirmation
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Do you want to remove these files? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      filesToRemove.forEach((file) => {
        fs.unlinkSync(file);
      });
      console.log(`\n✓ Removed ${filesToRemove.length} compiled files`);
    } else {
      console.log('\nCancelled - no files removed');
    }
    rl.close();
  });
} else {
  console.log('No compiled files with TypeScript sources found to remove');
}
