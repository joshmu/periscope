// Another file that should be excluded by rgGlobExcludes
// Used for testing multiple exclusion patterns

function compiledCode() {
  return 'This is compiled code that should be excluded';
}

function buildArtifact() {
  // This function is in the build directory
  console.log('Build output should not appear in searches');
}

// FIXME: This FIXME in build folder should not be found
const buildVersion = '1.0.0-compiled';

class CompiledClass {
  constructor() {
    this.name = 'Should be excluded from search';
  }
}

module.exports = {
  compiledCode,
  buildArtifact,
  CompiledClass,
};