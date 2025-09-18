const Handlebars = require('handlebars');
const {
  allowInsecurePrototypeAccess,
} = require('@handlebars/allow-prototype-access');

function section(name, options) {
  if (!this._sections) this._sections = {};
  this._sections[name] = options.fn(this);
  return null;
}

function pagination(pagination) {
  if (!pagination || pagination.totalPages <= 1) return '';
  const { page, totalPages, baseUrl } = pagination;
  const qs = require('qs');
  const parts = baseUrl.split('?');
  const params = parts[1] ? qs.parse(parts[1]) : {};
  const makeUrl = (p) => {
    const s = qs.stringify({ ...params, page: p });
    return parts[0] + (s ? '?' + s : '');
  };
  let items = '';
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const push = (p) => {
    items += `<li class="page-item ${p === page ? 'active' : ''}"><a class="page-link" href="${makeUrl(p)}">${p}</a></li>`;
  };
  if (page > 1) items += `<li class="page-item"><a class="page-link" href="${makeUrl(page - 1)}">&laquo;</a></li>`;
  for (let p = start; p <= end; p++) push(p);
  if (page < totalPages) items += `<li class="page-item"><a class="page-link" href="${makeUrl(page + 1)}">&raquo;</a></li>`;
  return new Handlebars.SafeString(`<ul class="pagination">${items}</ul>`);
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString();
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

module.exports = {
  handlebars: allowInsecurePrototypeAccess(Handlebars),
  helpers: {
    section,
    pagination,
    eq: (a, b) => a == b,
    formatDate,
    formatDateTime,
    capitalize,
  },
  defaultLayout: 'main',
  layoutsDir: 'views/layout',
  extname: '.hbs',
};
