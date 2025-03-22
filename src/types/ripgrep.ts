/**
 * Represents the raw JSON output from ripgrep for a single match
 */
export type RgMatchRawResult = {
  type: string;
  data: {
    path: { text: string };
    lines: { text: string };
    // eslint-disable-next-line @typescript-eslint/naming-convention
    line_number: number;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    absolute_offset: number;
    submatches: {
      end: number;
      match: {
        text: string;
      };
      start: number;
    }[];
  };
};

/**
 * Represents a processed ripgrep match result with extracted data
 * and the original raw ripgrep output
 */
export type RgMatchResult = {
  filePath: string;
  linePos: number;
  colPos: number;
  textResult: string;
  rawResult: RgMatchRawResult;
};
