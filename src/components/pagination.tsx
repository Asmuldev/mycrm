import Link from "next/link";
import { buttonClass } from "@/components/ui";

export const PAGE_SIZE = 25;

export function readPage(value: string | undefined) {
  const page = Number(value ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

/** Keeps existing filters in the URL while changing only the page number. */
function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  basePath,
  params,
  page,
  total,
  pageSize = PAGE_SIZE,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
  pageSize?: number;
}) {
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  if (pages <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link
          href={pageHref(basePath, params, page - 1)}
          className={buttonClass("secondary")}
        >
          Sebelumnya
        </Link>
      ) : (
        <span className={`${buttonClass("ghost")} pointer-events-none opacity-40`}>
          Sebelumnya
        </span>
      )}

      <span className="text-xs text-slate-500">
        {first}–{last} dari {total} · halaman {page}/{pages}
      </span>

      {page < pages ? (
        <Link
          href={pageHref(basePath, params, page + 1)}
          className={buttonClass("secondary")}
        >
          Berikutnya
        </Link>
      ) : (
        <span className={`${buttonClass("ghost")} pointer-events-none opacity-40`}>
          Berikutnya
        </span>
      )}
    </nav>
  );
}
