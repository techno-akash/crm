import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createLicense, fetchLicense, fetchLicenseOptions, updateLicense } from '../api/licenses.js';
import { LICENSE_ENVIRONMENTS, LICENSE_STATUSES } from '../constants/app.js';
import { toast } from '../components/Toast.jsx';

const EMPTY_FORM = {
  name: '',
  product_id: '',
  domain: '',
  customer_id: '',
  project_id: '',
  expiry_date: '',
  environment: 'Staging',
  status: 'Active'
};

function toDateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function SearchableSelect({ id, value, options, placeholder, getValue, getLabel, onChange, invalid }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const selected = options.find((option) => String(getValue(option)) === String(value));
  const filtered = options.filter((option) => getLabel(option).toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const close = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="searchable-select" ref={containerRef}>
      <button
        type="button"
        id={id}
        className={`searchable-select-trigger${invalid ? ' invalid' : ''}`}
        onClick={() => { setOpen((current) => !current); setQuery(''); }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selected ? '' : 'placeholder'}>{selected ? getLabel(selected) : placeholder}</span>
        <span className="searchable-select-chevron">⌄</span>
      </button>
      {open && (
        <div className="searchable-select-menu" role="listbox">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            aria-label={`Search ${id}`}
            autoFocus
          />
          <div className="searchable-select-options">
            {filtered.length > 0 ? filtered.map((option) => {
              const optionValue = getValue(option);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={String(optionValue) === String(value)}
                  key={String(optionValue)}
                  onClick={() => { onChange(optionValue); setOpen(false); setQuery(''); }}
                >
                  {getLabel(option)}
                </button>
              );
            }) : <span className="searchable-select-empty">No matches found</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LicenseFormPage({ mode }) {
  const isEdit = mode === 'edit';
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [options, setOptions] = useState({ products: [], projects: [], clients: [] });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let active = true;
    fetchLicenseOptions()
      .then((response) => {
        if (active) setOptions(response.data || { products: [], projects: [], clients: [] });
      })
      .catch((err) => {
        if (active) toast(err.message || 'Failed to load form options', 'error');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    setLoading(true);
    fetchLicense(id)
      .then((response) => {
        if (!active) return;
        const license = response.data;
        setForm({
          name: license.name || '',
          product_id: license.product_id || '',
          domain: license.domain || '',
          customer_id: license.customer_id || '',
          project_id: license.project_id || '',
          expiry_date: toDateInput(license.expiry_date),
          environment: license.environment || 'Staging',
          status: license.status ? license.status.charAt(0).toUpperCase() + license.status.slice(1).toLowerCase() : 'Active'
        });
      })
      .catch((err) => {
        if (active) setFormError(err.message || 'Failed to load license');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isEdit, id]);

  const setField = (field) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'License name is required';
    if (!form.product_id) next.product_id = 'Product name is required';
    if (!form.domain.trim()) next.domain = 'Domain is required';
    if (!form.customer_id) next.customer_id = 'Customer name is required';
    if (!form.project_id) next.project_id = 'Project name is required';
    if (!form.expiry_date) next.expiry_date = 'Expiry date is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      product_id: form.product_id,
      domain: form.domain.trim(),
      customer_id: form.customer_id,
      project_id: form.project_id,
      expiry_date: form.expiry_date,
      environment: form.environment,
      status: form.status
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateLicense(id, payload);
        toast('License updated successfully');
      } else {
        await createLicense(payload);
        toast('License created successfully');
      }
      navigate('/admin/licenses');
    } catch (err) {
      setFormError(err.errors?.length ? err.errors.join(', ') : err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page form-page">
        <h1 className="page-title">{isEdit ? 'Edit License' : 'Add New License'}</h1>
        <div className="card page-loading"><Loader2 size={24} className="spin" /></div>
      </div>
    );
  }

  return (
    <div className="page form-page">
      <h1 className="page-title">{isEdit ? 'Edit License' : 'Add New License'}</h1>

      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        {formError && <div className="form-alert" role="alert">{formError}</div>}

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="license-name">
              <span className="req">*</span> License Name
            </label>
            <input
              id="license-name"
              type="text"
              value={form.name}
              onChange={setField('name')}
              className={errors.name ? 'invalid' : ''}
              placeholder=""
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="product-name">
              <span className="req">*</span> Product Name
            </label>
            <SearchableSelect
              id="product-name"
              value={form.product_id}
              options={options.products}
              placeholder="Nothing selected"
              getValue={(product) => product.id || product._id}
              getLabel={(product) => product.name}
              onChange={(value) => setForm((prev) => ({ ...prev, product_id: value }))}
              invalid={errors.product_id}
            />
            {errors.product_id && <span className="field-error">{errors.product_id}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="domain">
              <span className="req">*</span> Domain
            </label>
            <input
              id="domain"
              type="text"
              value={form.domain}
              onChange={setField('domain')}
              className={errors.domain ? 'invalid' : ''}
              placeholder="https://example.com"
            />
            {errors.domain && <span className="field-error">{errors.domain}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="customer-name">
              <span className="req">*</span> Customer Name
            </label>
            <select
              id="customer-name"
              value={form.customer_id}
              onChange={setField('customer_id')}
              className={errors.customer_id ? 'invalid' : ''}
            >
              <option value="">Nothing selected</option>
              {options.clients.map((client) => (
                <option key={client.userid || client._id} value={client.userid || client._id}>{client.company}</option>
              ))}
            </select>
            {errors.customer_id && <span className="field-error">{errors.customer_id}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="project-name">
              <span className="req">*</span> Project Name
            </label>
            <SearchableSelect
              id="project-name"
              value={form.project_id}
              options={options.projects}
              placeholder="Nothing selected"
              getValue={(project) => project.id || project._id}
              getLabel={(project) => project.name}
              onChange={(value) => setForm((prev) => ({ ...prev, project_id: value }))}
              invalid={errors.project_id}
            />
            {errors.project_id && <span className="field-error">{errors.project_id}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="expiry-date">
              <span className="req">*</span> Expiry Date
            </label>
            <input
              id="expiry-date"
              type="date"
              value={form.expiry_date}
              onChange={setField('expiry_date')}
              min={today}
              className={errors.expiry_date ? 'invalid' : ''}
            />
            {errors.expiry_date && <span className="field-error">{errors.expiry_date}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="environment">
              <span className="req">*</span> License Environment
            </label>
            <select id="environment" value={form.environment} onChange={setField('environment')}>
              {LICENSE_ENVIRONMENTS.map((env) => <option key={env} value={env}>{env}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="status">
              <span className="req">*</span> Status
            </label>
            <select id="status" value={form.status} onChange={setField('status')}>
              {LICENSE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <hr className="form-divider" />

        <div className="form-actions">
          <Link to="/admin/licenses" className="btn btn-primary">
            <ArrowLeft size={15} /> Back
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 size={15} className="spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}
