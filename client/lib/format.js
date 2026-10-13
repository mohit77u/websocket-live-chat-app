export function initials(name = '?') {
  return name.slice(0, 2).toUpperCase();
}

// username se hamesha ek hi color (deterministic)
export function hueFor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();

export function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// sidebar ke liye chhota label: aaj -> time, 7 din ke andar -> weekday, warna date
export function formatListTime(date) {
  const d = new Date(date);
  const now = new Date();
  if (sameDay(d, now)) return formatTime(d);
  const days = (now - d) / 86400000;
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// messages ke beech date separator
export function formatDayLabel(date) {
  const d = new Date(date);
  const now = new Date();
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export function dayKey(date) {
  return new Date(date).toDateString();
}

// sidebar preview line
export function previewOf(conv, myId) {
  const m = conv.lastMessage;
  if (!m) return 'No messages yet';
  if (m.deletedAt) return 'Message deleted';
  const mine = m.sender.id === myId;
  if (conv.type === 'dm') return `${mine ? 'You: ' : ''}${m.text}`;
  return `${mine ? 'You' : m.sender.username}: ${m.text}`;
}
