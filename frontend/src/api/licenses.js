import { api } from './client';
import * as XLSX from 'xlsx';

export function fetchLicenses({ search, page, perPage, sortBy, sortDir, status } = {}) {
  return api.get('/licenses', {
    search,
    page,
    per_page: perPage,
    sort_by: sortBy,
    sort_dir: sortDir,
    status
  });
}

export function fetchLicense(id) {
  return api.get(`/licenses/${id}`);
}

export function createLicense(payload) {
  return api.post('/licenses', payload);
}

export function updateLicense(id, payload) {
  return api.put(`/licenses/${id}`, payload);
}

export function deleteLicenses(ids) {
  return api.post('/licenses/bulk-delete', { ids });
}

export function fetchLicenseOptions() {
  return api.get('/licenses/options');
}

export async function exportLicensesCsv(params) {
  const response = await api.download('/licenses/export', {
    search: params.search,
    status: params.status,
    sort_by: params.sortBy,
    sort_dir: params.sortDir
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `licenses-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportLicensesXlsx(params) {
  const response = await fetchLicenses({
    search: params.search,
    page: 1,
    perPage: 100,
    sortBy: params.sortBy,
    sortDir: params.sortDir
  });
  const rows = (response.data || []).map((row) => ({
    ID: row.id ?? row._id,
    'License Name': row.name || '',
    'Product Name': row.productName || '',
    'Project Name': row.projectName || '',
    'Customer Name': row.customerName || '',
    Domain: row.domain || '',
    'License Key': row.maskedKey || '',
    'Expiry Date': row.expiry_date ? new Date(row.expiry_date).toISOString().slice(0, 10) : '',
    Status: row.status || ''
  }));
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Licenses');
  XLSX.writeFile(workbook, `licenses-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
