import { DelayRow } from "../types";
import { normalizeBusRoute } from "../utils";

function parseTimestampDate(ts: string): string | null {
  // Timestamp format: "M/D/YYYY H:MM:SS"
  const match = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export async function fetchDelayRows(sheetUrl: string, today: string): Promise<DelayRow[]> {
  const res = await fetch(sheetUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet: ${res.status}`);
  }

  const html = await res.text();

  const allRows: string[][] = [];
  let pendingCells: string[] = [];

  const parser = new HTMLRewriter()
    .on("tr", {
      element() {
        if (pendingCells.length > 0) {
          allRows.push([...pendingCells]);
        }
        pendingCells = [];
      },
    })
    .on("td", {
      element() {
        pendingCells.push("");
      },
    })
    // Capture text inside any descendant of td (e.g. <td><span>value</span></td>)
    .on("td *", {
      text(text) {
        if (pendingCells.length > 0) {
          pendingCells[pendingCells.length - 1] += text.text;
        }
      },
    })
    // Also capture direct text nodes of td
    .on("td", {
      text(text) {
        if (pendingCells.length > 0) {
          pendingCells[pendingCells.length - 1] += text.text;
        }
      },
    });

  const transformed = parser.transform(new Response(html));
  await transformed.text();

  // Flush the last row
  if (pendingCells.length > 0) {
    allRows.push([...pendingCells]);
  }

  const rows: DelayRow[] = [];

  // Skip header row (first row), process data rows
  for (let i = 1; i < allRows.length; i++) {
    const cells = allRows[i];
    if (cells.length < 5) continue;

    // Only process rows from today — the sheet accumulates entries over time
    const rowDate = parseTimestampDate(cells[0]?.trim() || "");
    if (rowDate !== today) continue;

    const rawRoute = cells[1]?.trim();
    const school = (cells[3]?.trim() || cells[2]?.trim()) || "";
    const rawMinutes = cells[4]?.trim();

    if (!rawRoute || !rawMinutes) continue;

    const busRoute = normalizeBusRoute(rawRoute);
    const minutesLate = parseInt(rawMinutes, 10);
    if (isNaN(minutesLate) || minutesLate <= 0) continue;

    rows.push({ busRoute, school, minutesLate });
  }

  return rows;
}
