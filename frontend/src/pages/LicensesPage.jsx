import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import {
  fetchLicenses, fetchLicense, deleteLicenses, exportLicensesCsv, exportLicensesXlsx
} from '../api/licenses.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Pagination from '../components/Pagination.jsx';
import { toast } from '../components/Toast.jsx';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function isExpired(value) {
  if (!value) return false;
  const expiry = formatDate(value);
  const today = new Date().toISOString().slice(0, 10);
  return expiry < today;
}

function SortableHeader({ label, field, sort, onSort }) {
  const active = sort.by === field;
  return (
    <button type="button" className="th-sort" onClick={() => onSort(field)}>
      <span>{label}</span>
      <ArrowUp size={13} className={`sort-icon${sort.dir === 'desc' && active ? ' desc' : ''}${active ? ' active' : ''}`} />
    </button>
  );
}

export default function LicensesPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ by: 'name', dir: 'asc' });
  const [selected, setSelected] = useState(new Set());

  const searchTimer = useRef(null);
  const requestId = useRef(0);
  const hasRows = useRef(false);

  const load = useCallback(async (params) => {
    const currentRequest = ++requestId.current;
    const startedAt = Date.now();
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLicenses(params);
      const remaining = Math.max(0, 650 - (Date.now() - startedAt));
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
      if (currentRequest !== requestId.current) return;
      const nextRows = response.data || [];
      hasRows.current = nextRows.length > 0;
      setRows(nextRows);
      setMeta(response.meta || { page: 1, per_page: 25, total: 0, total_pages: 1 });
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      if (hasRows.current) {
        toast(err.message || 'Failed to refresh licenses', 'error');
      } else {
        setError(err.message || 'Failed to load licenses');
        setRows([]);
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ search, page, per_page: perPage, sort_by: sort.by, sort_dir: sort.dir });
  }, [load, search, page, perPage, sort]);

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearch(value);
    setPage(1);
  };

  const toggleSort = (by) => {
    setSort((prev) => (prev.by === by ? { by, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' }));
    setPage(1);
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyLicenseKey = async (id, maskedKey) => {
    if (!maskedKey || maskedKey === '—') return;
    try {
      const response = await fetchLicense(id);
      const actualKey = response.data?.licenkey;
      if (!actualKey) throw new Error('License key is unavailable');
      await navigator.clipboard.writeText(actualKey);
      toast('License Key copied!');
    } catch {
      toast('Unable to copy license key', 'error');
    }
  };

  const allChecked = rows.length > 0 && rows.every((row) => selected.has(String(row._id)));

  const toggleAll = () => {
    setSelected((prev) => {
      if (allChecked) {
        const next = new Set(prev);
        rows.forEach((row) => next.delete(String(row._id)));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((row) => next.add(String(row._id)));
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportLicensesCsv({ search, sortBy: sort.by, sortDir: sort.dir });
      toast('Licenses exported successfully');
    } catch (err) {
      toast(err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportOption = async (format) => {
    setExportOpen(false);
    if (format === 'pdf' || format === 'print') {
      window.setTimeout(() => window.print(), 0);
      return;
    }
    if (format === 'excel') {
      setExporting(true);
      try {
        await exportLicensesXlsx({ search, sortBy: sort.by, sortDir: sort.dir });
        toast('Licenses exported successfully');
      } catch (err) {
        toast(err.message || 'Excel export failed', 'error');
      } finally {
        setExporting(false);
      }
      return;
    }
    await handleExport();
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const response = await deleteLicenses(Array.from(selected));
      toast(`${response.data?.deleted ?? 0} license(s) deleted`);
      setSelected(new Set());
      setConfirmOpen(false);
      load({ search, page, per_page: perPage, sort_by: sort.by, sort_dir: sort.dir });
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const showingFrom = meta.total === 0 ? 0 : (meta.page - 1) * meta.per_page + 1;
  const showingTo = Math.min(meta.page * meta.per_page, meta.total);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Licenses</h1>
        <Link to="/admin/licenses/new" className="btn btn-primary">+ New License</Link>
      </div>

      {selected.size > 0 && (
        <button type="button" className="btn btn-danger btn-sm bulk-delete-btn" onClick={() => setConfirmOpen(true)}>
          <Trash2 size={14} /> Delete selected ({selected.size})
        </button>
      )}

      <div className="card print-area">
        <div className="table-toolbar">
          <div className="toolbar-left">
            <select
              className="select per-page-select"
              value={perPage}
              onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }}
              aria-label="Entries per page"
            >
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="toolbar-button-group">
            <div className="export-control">
              <button
                type="button"
                className="btn btn-outline btn-sm export-button"
                onClick={() => setExportOpen((open) => !open)}
                disabled={exporting}
                aria-expanded={exportOpen}
                aria-haspopup="menu"
              >
                {exporting && <Loader2 size={14} className="spin" />} Export
              </button>
              {exportOpen && (
                <div className="export-menu" role="menu">
                  {['Excel', 'CSV', 'PDF', 'Print'].map((format) => (
                    <button
                      key={format}
                      type="button"
                      role="menuitem"
                      onClick={() => handleExportOption(format.toLowerCase())}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="icon-btn boxed"
              aria-label="Refresh"
              onClick={() => load({ search, page, per_page: perPage, sort_by: sort.by, sort_dir: sort.dir })}
            >
              <RefreshCw size={14} />
            </button>
            </div>
          </div>
          <div className="toolbar-right">
            <div className="table-search">
              <Search size={14} className="table-search-icon" />
              <input
                type="search"
                placeholder="Search..."
                aria-label="Search licenses"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" disabled />
                </th>
                <th className="col-id">ID</th>
                <th>{<SortableHeader label="License Name" field="name" sort={sort} onSort={toggleSort} />}</th>
                <th>{<SortableHeader label="Product Name" field="product" sort={sort} onSort={toggleSort} />}</th>
                <th>{<SortableHeader label="Project Name" field="project" sort={sort} onSort={toggleSort} />}</th>
                <th>{<SortableHeader label="Customer Name" field="customer" sort={sort} onSort={toggleSort} />}</th>
                <th>{<SortableHeader label="Domain" field="domain" sort={sort} onSort={toggleSort} />}</th>
                <th>License Key</th>
                <th className="col-expiry">{<SortableHeader label="Expiry Date" field="expiry_date" sort={sort} onSort={toggleSort} />}</th>
                <th className="col-status">{<SortableHeader label="Status" field="status" sort={sort} onSort={toggleSort} />}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="table-empty">
                    <div className="table-loading-bars" role="status" aria-label="Loading licenses">
                      <span />
                      <span />
                      <span />
                    </div>
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={10} className="table-empty text-danger">{error}</td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="table-empty">No licenses found</td>
                </tr>
              )}
              {!error && rows.length > 0 && rows.map((row, index) => {
                const id = String(row._id);
                const rowNumber = (meta.page - 1) * meta.per_page + index + 1;
                return (
                  <tr key={id} className={selected.has(id) ? 'row-selected' : ''}>
                    <td className="col-check">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggleRow(id)}
                        disabled
                        aria-label={`Select license ${row.name}`}
                      />
                    </td>
                    <td className="col-id">{rowNumber}</td>
                    <td className="col-name">
                      <span className="row-link">{row.name}</span>
                      <Link to={`/admin/licenses/${id}/edit`} className="row-edit-link">Edit</Link>
                    </td>
                    <td>{row.productName || '—'}</td>
                    <td>{row.projectName || '—'}</td>
                    <td>{row.customerName || '—'}</td>
                    <td className="col-domain">{row.domain || '—'}</td>
                    <td className="col-key">
                      <button
                        type="button"
                        className="license-key-copy"
                        onClick={() => copyLicenseKey(id, row.maskedKey)}
                        title="Copy license key"
                      >
                        {row.maskedKey || '—'}
                      </button>
                    </td>
                    <td className={`col-expiry${isExpired(row.expiry_date) ? ' expired' : ''}`}>
                      {formatDate(row.expiry_date)}
                    </td>
                    <td className="col-status"><StatusBadge status={row.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(loading || exporting) && rows.length > 0 && (
            <div className="table-loading-indicator" role="status" aria-label="Loading licenses">
              <div className="table-loading-bars">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>

        <div className="table-footer">
          <span className="table-info">
            {meta.total === 0 ? 'No entries' : `Showing ${showingFrom} to ${showingTo} of ${meta.total} entries`}
          </span>
          <Pagination page={meta.page} totalPages={meta.total_pages} onChange={setPage} />
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Delete licenses"
        message={`Are you sure you want to delete ${selected.size} selected license(s)? This action cannot be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
