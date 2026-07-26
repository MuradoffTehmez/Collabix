// Markdown render — marked (parse) + DOMPurify (sanitizasiya), npm bundle-dan.
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { el } from './util.js';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'code', 'pre',
  'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

export function markdownNode(text){
  const div = el('div', { class: 'md-body' });
  try{
    const html = marked.parse(text || '', { breaks: true, gfm: true, async: false });
    div.innerHTML = DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ['href', 'title'],
    });
    div.querySelectorAll('a').forEach(a => {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
    return div;
  }catch(e){ console.error('markdown', e); }
  div.textContent = text || '';
  div.style.whiteSpace = 'pre-wrap';
  return div;
}
