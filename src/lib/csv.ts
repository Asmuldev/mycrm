/** Quotes a value for CSV, escaping embedded quotes and forcing text on formulas. */
export function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Prevent spreadsheet formula injection from user-entered text.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // BOM so Excel opens UTF-8 correctly.
  return `﻿${lines.join("\r\n")}`;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const clean = text.replace(/^﻿/, "");

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index]!;

    if (inQuotes) {
      if (char === '"') {
        if (clean[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === "," || char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
}
