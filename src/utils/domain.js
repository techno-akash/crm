function normalizeHostname(value) {
  if (typeof value !== 'string') return null;
  let host = value.trim().toLowerCase();
  if (!host) return null;
  if (/^https?:\/\//.test(host)) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  } else {
    host = host.split('/')[0].split(':')[0];
  }
  if (host.startsWith('www.')) host = host.slice(4);
  return host || null;
}

function extractRequestHostname(req) {
  const origin = req.get('origin');
  if (origin && origin.toLowerCase() !== 'null') {
    const host = normalizeHostname(origin);
    if (host) return host;
  }
  const referer = req.get('referer');
  if (referer) {
    const host = normalizeHostname(referer);
    if (host) return host;
  }
  return null;
}

function isDomainAllowed(licenseDomain, requestHostname) {
  const allowed = normalizeHostname(licenseDomain);
  return Boolean(allowed && requestHostname && allowed === requestHostname);
}

module.exports = { extractRequestHostname, isDomainAllowed };
