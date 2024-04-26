import { rgPath } from '@vscode/ripgrep';

// grab the bundled ripgrep binary from vscode
export function ripgrepPath(optionsPath?: string) {
  if(optionsPath?.trim()) {
    return optionsPath.trim();
  }

  return rgPath;
}