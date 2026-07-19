import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { formatCAD } from '../prepare/amounts';

// Rows are the compact index rows emitted by src/prepare/indexes.ts:
//   solicitations: { d, t, u, s, r, c, v, y, dl, a, nb, nd }
//   suppliers:     { g, n, na, nb, a }
//   noncompetitive:{ w, wl, n, r, v, y, a }  (wl = URL-safe workspace slug; links use it)
//   council:       { f, t, y, nb }
type Row = Record<string, any>;

export type BrowseEntity = 'solicitations' | 'suppliers' | 'noncompetitive' | 'council';

export interface BrowseTableProps {
  entity: BrowseEntity;
  indexUrl: string;
  /** import.meta.env.BASE_URL, passed by the page; used to build record links. */
  base: string;
}

interface SelectFilter {
  id: string; // compact column key in the index row
  param: string; // query-string parameter name
  label: string;
}

// All six spec facets for solicitations: status, rfx type, category, division,
// and year are selects; has-documents is a checkbox (CHECKS below).
const SELECTS: Record<BrowseEntity, SelectFilter[]> = {
  solicitations: [
    { id: 's', param: 'status', label: 'Status' },
    { id: 'r', param: 'type', label: 'Type' },
    { id: 'c', param: 'category', label: 'Category' },
    { id: 'v', param: 'division', label: 'Division' },
    { id: 'y', param: 'year', label: 'Year' },
  ],
  suppliers: [],
  noncompetitive: [{ id: 'y', param: 'year', label: 'Year' }],
  council: [{ id: 'y', param: 'year', label: 'Year' }],
};

interface CheckFilter {
  id: string; // column whose filterFn implements the boolean facet
  param: string; // query-string parameter name (serialized as `<param>=yes`)
  label: string;
}

const CHECKS: Record<BrowseEntity, CheckFilter[]> = {
  solicitations: [
    { id: 'nd', param: 'docs', label: 'Has documents' },
    { id: 'nb', param: 'sole', label: 'Single bidder' },
  ],
  suppliers: [],
  noncompetitive: [],
  council: [{ id: 'nb', param: 'sole', label: 'Single bidder' }],
};

const exactText: FilterFn<Row> = (row, columnId, filterValue) =>
  String(row.getValue(columnId)) === String(filterValue);

// Checkbox facet: keep only rows with a positive count (nd > 0 = has documents).
const positiveCount: FilterFn<Row> = (row, columnId) => Number(row.getValue(columnId)) > 0;

// Checkbox facet: keep only single-bidder competitions (exactly one bid on record).
const isOne: FilterFn<Row> = (row, columnId) => Number(row.getValue(columnId)) === 1;

function money(v: unknown): string {
  return typeof v === 'number' ? formatCAD(v) : '—';
}

function buildColumns(entity: BrowseEntity, link: (path: string) => string): ColumnDef<Row, any>[] {
  switch (entity) {
    case 'solicitations':
      return [
        { accessorKey: 'd', header: 'Document #' },
        {
          accessorKey: 't',
          header: 'Title',
          cell: (c) => (
            <a
              href={link(`solicitations/${c.row.original.d}/`)}
              className={`line-clamp-3 ${c.row.original.u ? 'italic' : ''}`}
            >
              {c.getValue<string>()}
            </a>
          ),
        },
        { accessorKey: 's', header: 'Status', filterFn: exactText },
        { accessorKey: 'r', header: 'Type', filterFn: exactText },
        { accessorKey: 'c', header: 'Category', filterFn: exactText },
        { accessorKey: 'v', header: 'Division', filterFn: exactText },
        { accessorKey: 'y', header: 'Year', filterFn: exactText },
        { accessorKey: 'dl', header: 'Deadline' },
        { accessorKey: 'a', header: 'Awarded (parsed)', cell: (c) => money(c.getValue()) },
        { accessorKey: 'nb', header: 'Bids', filterFn: isOne },
        { accessorKey: 'nd', header: 'Docs', filterFn: positiveCount },
      ];
    case 'suppliers':
      return [
        {
          accessorKey: 'n',
          header: 'Supplier',
          cell: (c) => (
            <a href={link(`suppliers/${c.row.original.g}/`)} className="line-clamp-3">
              {c.getValue<string>()}
            </a>
          ),
        },
        { accessorKey: 'na', header: 'Award lines' },
        { accessorKey: 'nb', header: 'Bids' },
        { accessorKey: 'a', header: 'City awards (parsed)', cell: (c) => money(c.getValue()) },
      ];
    case 'noncompetitive':
      return [
        {
          accessorKey: 'w',
          header: 'Workspace #',
          // Link from the URL-safe slug (wl); display the raw workspace_number.
          cell: (c) => (
            <a href={link(`noncompetitive/${c.row.original.wl}/`)}>{c.getValue<string>()}</a>
          ),
        },
        {
          accessorKey: 'n',
          header: 'Supplier',
          cell: (c) => <span className="line-clamp-3">{c.getValue<string>()}</span>,
        },
        { accessorKey: 'r', header: 'Reason' },
        { accessorKey: 'v', header: 'Division' },
        { accessorKey: 'y', header: 'Year', filterFn: exactText },
        { accessorKey: 'a', header: 'Amount (parsed)', cell: (c) => money(c.getValue()) },
      ];
    case 'council':
      return [
        {
          accessorKey: 'f',
          header: 'Reference',
          cell: (c) => <a href={link(`council/${c.getValue<string>()}/`)}>{c.getValue<string>()}</a>,
        },
        {
          accessorKey: 't',
          header: 'Title',
          cell: (c) => <span className="line-clamp-3">{c.getValue<string>()}</span>,
        },
        { accessorKey: 'y', header: 'Year', filterFn: exactText },
        { accessorKey: 'nb', header: 'Bids', filterFn: isOne },
      ];
    default:
      return [];
  }
}

export default function BrowseTable({ entity, indexUrl, base }: BrowseTableProps) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [ready, setReady] = useState(false); // true once the URL query string has been read

  const selects = SELECTS[entity];
  const checks = CHECKS[entity];
  const link = useMemo(() => {
    const b = base.endsWith('/') ? base : `${base}/`;
    return (path: string) => b + path;
  }, [base]);
  const columns = useMemo(() => buildColumns(entity, link), [entity, link]);

  // 1. Fetch the prebuilt compact index.
  useEffect(() => {
    let cancelled = false;
    fetch(indexUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${indexUrl}`);
        return r.json();
      })
      .then((rows: Row[]) => {
        if (!cancelled) {
          setData(rows);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [indexUrl]);

  // 2. Read initial state from the query string (client only, once).
  //    Kept out of useState initializers so build-time SSR (client:load still
  //    prerenders) never touches `window` and hydration cannot mismatch.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setGlobalFilter(q);
    const cf: ColumnFiltersState = [];
    for (const s of selects) {
      const v = params.get(s.param);
      if (v) cf.push({ id: s.id, value: v });
    }
    for (const cb of checks) {
      if (params.get(cb.param) === 'yes') cf.push({ id: cb.id, value: true });
    }
    if (cf.length > 0) setColumnFilters(cf);
    const sort = params.get('sort');
    if (sort) {
      const [id, dir] = sort.split('.');
      if (id) setSorting([{ id, desc: dir === 'desc' }]);
    }
    const page = Number(params.get('page') ?? '1');
    if (Number.isInteger(page) && page > 1) {
      setPagination((prev) => ({ ...prev, pageIndex: page - 1 }));
    }
    setReady(true);
    // Runs once on mount; `selects`/`checks` are module-level constants per entity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Serialize state back to the query string so filtered views are citable URLs.
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    if (globalFilter) params.set('q', globalFilter);
    for (const s of selects) {
      const f = columnFilters.find((c) => c.id === s.id);
      if (f && f.value != null && f.value !== '') params.set(s.param, String(f.value));
    }
    for (const cb of checks) {
      if (columnFilters.some((f) => f.id === cb.id)) params.set(cb.param, 'yes');
    }
    if (sorting.length > 0) {
      params.set('sort', `${sorting[0].id}.${sorting[0].desc ? 'desc' : 'asc'}`);
    }
    if (pagination.pageIndex > 0) params.set('page', String(pagination.pageIndex + 1));
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [ready, globalFilter, columnFilters, sorting, pagination, selects, checks]);

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, columnFilters, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  // Distinct values for the select filters, derived from the loaded data.
  const options = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const s of selects) {
      const values = new Set<string>();
      for (const row of data) {
        const v = row[s.id];
        if (v !== null && v !== undefined && v !== '') values.add(String(v));
      }
      out[s.id] = Array.from(values).sort((a, b) =>
        s.id === 'y' ? Number(b) - Number(a) : a.localeCompare(b),
      );
    }
    return out;
  }, [data, selects]);

  const setSelect = (id: string, value: string) => {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== id);
      return value === '' ? rest : [...rest, { id, value }];
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const setCheck = (id: string, on: boolean) => {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== id);
      return on ? [...rest, { id, value: true }] : rest;
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  if (error) {
    return <p role="alert">Failed to load the browse index ({error}). Reload to retry.</p>;
  }

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div>
      <div className="my-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Filter
          <input
            type="search"
            value={globalFilter}
            placeholder="Any text or identifier"
            className="rounded border px-2 py-1"
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          />
        </label>
        {selects.map((s) => {
          const current = columnFilters.find((f) => f.id === s.id);
          return (
            <label key={s.id} className="flex flex-col text-sm">
              {s.label}
              <select
                value={current ? String(current.value) : ''}
                className="rounded border px-2 py-1"
                onChange={(e) => setSelect(s.id, e.target.value)}
              >
                <option value="">All</option>
                {(options[s.id] ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        {checks.map((cb) => (
          <label key={cb.id} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={columnFilters.some((f) => f.id === cb.id)}
              onChange={(e) => setCheck(cb.id, e.target.checked)}
            />
            {cb.label}
          </label>
        ))}
      </div>
      {loading ? (
        <p>Loading table…</p>
      ) : (
        <>
          <p className="text-sm">
            {filteredCount.toLocaleString('en-CA')} of {data.length.toLocaleString('en-CA')} rows
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="cursor-pointer select-none border-b px-2 py-1 text-left"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {({ asc: ' ▲', desc: ' ▼' } as Record<string, string>)[
                          h.column.getIsSorted() as string
                        ] ?? ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b align-top">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2 py-1">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="my-4 flex items-center gap-2">
            <button
              type="button"
              className="rounded border px-2 py-1 disabled:opacity-50"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </button>
            <span className="text-sm">
              Page {pagination.pageIndex + 1} of {pageCount}
            </span>
            <button
              type="button"
              className="rounded border px-2 py-1 disabled:opacity-50"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
