#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Post-compile script to flatten the out/src directory structure.
 * Moves all contents from out/src/* to out/* and removes the empty out/src directory.
 * Also updates import paths in test files to reflect the new structure.
 */

const outDir = path.join(__dirname, '..', 'out');
const srcOutDir = path.join(outDir, 'src');
const testOutDir = path.join(outDir, 'test');

function moveDirectory(source, destination) {
  // Ensure destination exists
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  // Read all items in source directory
  const items = fs.readdirSync(source);

  items.forEach((item) => {
    const srcPath = path.join(source, item);
    const destPath = path.join(destination, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      // Recursively move directories
      moveDirectory(srcPath, destPath);
    } else {
      // Move files
      fs.renameSync(srcPath, destPath);
    }
  });

  // Remove empty source directory
  fs.rmdirSync(source);
}

// Check if out/src exists
if (fs.existsSync(srcOutDir)) {
  console.log('Moving files from out/src to out...');

  try {
    // Get all items in out/src
    const items = fs.readdirSync(srcOutDir);

    items.forEach((item) => {
      const srcPath = path.join(srcOutDir, item);
      const destPath = path.join(outDir, item);

      // If destination exists and is a directory, we need to merge
      if (fs.existsSync(destPath) && fs.statSync(destPath).isDirectory()) {
        moveDirectory(srcPath, destPath);
      } else {
        // Simple move for files or non-existing destinations
        fs.renameSync(srcPath, destPath);
      }
    });

    // Remove the now-empty src directory
    fs.rmdirSync(srcOutDir);
    console.log('Successfully flattened out/src directory structure');

    // Update import paths in test files
    console.log('Updating import paths in test files...');
    updateTestImports(testOutDir);
    console.log('Successfully updated test import paths');
  } catch (error) {
    console.error('Error during post-compile processing:', error);
    process.exit(1);
  }
} else {
  console.log('No out/src directory found, skipping post-compile step');
}

/**
 * Recursively update import paths in test files
 */
function updateTestImports(dir) {
  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      updateTestImports(fullPath);
    } else if (item.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');

      // Replace require paths that reference ../../src/xxx with ../../xxx
      content = content.replace(/require\("\.\.\/\.\.\/src\//g, 'require("../../');

      // Also update source map references
      content = content.replace(/\/\/# sourceMappingURL=/g, '//# sourceMappingURL=');

      fs.writeFileSync(fullPath, content, 'utf8');
    }
  });
}
