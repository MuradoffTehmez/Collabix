// @mention dəstəyi: mətndə @username-i klik olunan linkə çevirir və
// input-larda sadə autocomplete dropdown göstərir.
import { state } from './store.js';
import { el } from './util.js';
import { emit } from './util.js';

// Mətni parçalara ayırır: @username hissələri profilə keçid düyməsi olur.
export function mentionify(text){
  const frag = document.createDocumentFragment();
  const parts = String(text || '').split(/(@[a-z0-9._]{3,20})/g);
  const known = new Set([...state.users.values()].map(u => u.username));
  parts.forEach(part => {
    const m = /^@([a-z0-9._]{3,20})$/.exec(part);
    if(m && known.has(m[1])){
      frag.append(el('button', {
        class: 'mention-link',
        onclick: e => { e.stopPropagation(); emit('nav', { page: 'u/' + m[1] }); },
      }, part));
    } else {
      frag.append(document.createTextNode(part));
    }
  });
  return frag;
}

// Input/textarea-ya autocomplete bağlayır: "@pre" yazanda uyğun istifadəçilər çıxır.
export function attachMentionAutocomplete(input){
  const dd = el('div', { class: 'mention-dd' });
  document.body.append(dd);
  let items = [];
  let active = -1;

  const hide = () => { dd.classList.remove('show'); items = []; active = -1; };

  const currentToken = () => {
    const pos = input.selectionStart;
    const before = input.value.slice(0, pos);
    const m = /@([a-z0-9._]{1,20})$/i.exec(before);
    return m ? { prefix: m[1].toLowerCase(), start: pos - m[1].length - 1, end: pos } : null;
  };

  const pick = (username) => {
    const tok = currentToken();
    if(!tok) return;
    input.value = input.value.slice(0, tok.start) + '@' + username + ' ' + input.value.slice(tok.end);
    input.dispatchEvent(new Event('input'));
    input.focus();
    hide();
  };

  const update = () => {
    const tok = currentToken();
    if(!tok){ hide(); return; }
    items = [...state.users.values()]
      .filter(u => u.uid !== state.authUser.uid && u.username && u.username.startsWith(tok.prefix))
      .slice(0, 5);
    if(!items.length){ hide(); return; }
    dd.replaceChildren(...items.map((u, i) => el('button', {
      class: 'mention-dd-item' + (i === active ? ' active' : ''),
      onmousedown: e => { e.preventDefault(); pick(u.username); },
    }, '@' + u.username, el('span', {}, u.name))));
    const r = input.getBoundingClientRect();
    dd.style.left = r.left + 'px';
    dd.style.top = (r.bottom + 4 + window.scrollY) + 'px';
    dd.style.minWidth = Math.min(r.width, 260) + 'px';
    dd.classList.add('show');
  };

  input.addEventListener('input', update);
  input.addEventListener('blur', () => setTimeout(hide, 150));
  input.addEventListener('keydown', e => {
    if(!dd.classList.contains('show')) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); active = Math.min(active + 1, items.length - 1); update(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); active = Math.max(active - 1, 0); update(); }
    else if(e.key === 'Tab' || (e.key === 'Enter' && active >= 0)){
      e.preventDefault();
      pick(items[Math.max(active, 0)].username);
    }
    else if(e.key === 'Escape') hide();
  });
}
