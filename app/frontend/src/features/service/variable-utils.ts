export type VariableDraft = { key: string; value: string; isSecret: boolean };

export const VARIABLE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// parseDotenv handles KEY=VAL lines, '#' comments, 'export ' prefixes and
// single/double-quoted values — enough for standard .env pastes.
export function parseDotenv(text: string): VariableDraft[] {
  const rows: VariableDraft[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const stripped = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = stripped.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = stripped.slice(0, eq).trim();
    let value = stripped.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    rows.push({ key, value, isSecret: false });
  }
  return rows;
}

export function validateVariableRows(rows: VariableDraft[]): Record<number, string> {
  const errors: Record<number, string> = {};
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const key = row.key.trim();
    if (!key) {
      errors[i] = 'Key is required';
    } else if (!VARIABLE_KEY_RE.test(key)) {
      errors[i] = 'Letters, digits, underscore; must not start with a digit';
    } else if (seen.has(key)) {
      errors[i] = 'Duplicate key';
    } else {
      seen.add(key);
    }
  });
  return errors;
}
