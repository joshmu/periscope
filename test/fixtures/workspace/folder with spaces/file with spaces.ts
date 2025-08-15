// Test file with spaces in the path
export function testSpacesInPath(): string {
  return 'This file has spaces in its path';
}

export class SpacePathTest {
  private message = 'Testing path with spaces';
  
  getMessage(): string {
    return this.message;
  }
}

// TODO: Verify this file can be searched
const SEARCH_TEST = 'ripgrep should find this content';