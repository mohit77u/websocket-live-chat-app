'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { formatTime } from '@/lib/format';

export const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export default function MessageItem({ message: m, mine, myId, showHeader, onReact, onEdit, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false); // touch devices pe tap se
  const [editing, setEditing] = useState(false);
  const deleted = !!m.deletedAt;

  return (
    <div className={`group relative flex gap-2.5 ${mine ? 'flex-row-reverse' : ''} ${showHeader ? 'mt-3' : 'mt-0.5'}`}>
      {/* avatar sirf group ke pehle message pe; baaki jagah khali jagah rakhte hain */}
      <div className="w-8 shrink-0">{showHeader && !mine && <Avatar name={m.sender.username} size="sm" />}</div>

      <div className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%] ${mine ? 'items-end' : 'items-start'}`}>
        {showHeader && (
          <div className={`mb-0.5 flex items-baseline gap-2 px-1 text-xs ${mine ? 'flex-row-reverse' : ''}`}>
            <span className="font-semibold">{mine ? 'You' : m.sender.username}</span>
            <time dateTime={m.createdAt} className="text-muted">
              {formatTime(m.createdAt)}
            </time>
          </div>
        )}

        <div className="relative">
          {editing ? (
            <EditBox
              initial={m.text}
              onCancel={() => setEditing(false)}
              onSave={(text) => {
                setEditing(false);
                if (text !== m.text) onEdit(m, text);
              }}
            />
          ) : (
            <div
              title={new Date(m.createdAt).toLocaleString()}
              className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                deleted
                  ? 'border border-dashed border-border italic text-muted'
                  : mine
                    ? 'rounded-br-md bg-primary text-primary-foreground'
                    : 'rounded-bl-md bg-surface-2'
              }`}
            >
              {deleted ? 'This message was deleted' : m.text}
              {m.editedAt && !deleted && (
                <span className={`ml-1.5 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted'}`}>(edited)</span>
              )}
            </div>
          )}

          {!deleted && !editing && (
            <>
              {/* touch ke liye: hamesha dikhne wala chhota button (md+ pe hover se bar aata hai) */}
              <button
                type="button"
                onClick={() => setActionsOpen((o) => !o)}
                aria-label="Message actions"
                aria-expanded={actionsOpen}
                className={`absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-surface-2 md:hidden ${
                  mine ? '-left-8' : '-right-8'
                }`}
              >
                <MoreHorizontal className="size-4" />
              </button>
              <div
                // desktop: bubble ke side mein (text nahi dhakta); mobile: bubble ke upar
                className={`absolute z-10 gap-0.5 rounded-full border border-border bg-surface p-0.5 shadow-md group-focus-within:flex group-hover:md:flex max-md:-top-9 md:top-1/2 md:-translate-y-1/2 ${
                  actionsOpen ? 'flex' : 'hidden'
                } ${mine ? 'max-md:right-0 md:right-full md:mr-2' : 'max-md:left-0 md:left-full md:ml-2'}`}
                role="toolbar"
                aria-label="Message actions"
              >
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(m, emoji);
                      setActionsOpen(false);
                    }}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-full text-sm hover:bg-surface-2"
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                {mine && (
                  <>
                    <span className="mx-0.5 my-1 w-px bg-border" aria-hidden />
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(true);
                        setActionsOpen(false);
                      }}
                      className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
                      aria-label="Edit message"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(m);
                        setActionsOpen(false);
                      }}
                      className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-danger/10 hover:text-danger"
                      aria-label="Delete message"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {m.reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''}`}>
            {m.reactions.map((r) => {
              const reacted = r.users.includes(myId);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReact(m, r.emoji)}
                  aria-pressed={reacted}
                  aria-label={`${r.emoji} ${r.users.length}${reacted ? ', you reacted' : ''}`}
                  className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    reacted ? 'border-primary/50 bg-primary/12 text-foreground' : 'border-border bg-surface hover:bg-surface-2'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="font-medium">{r.users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EditBox({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(initial.length, initial.length);
  }, [initial]);

  const save = () => value.trim() && onSave(value.trim());

  return (
    <div className="w-[min(28rem,70vw)] rounded-2xl border border-primary bg-surface p-2">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={1000}
        rows={Math.min(6, value.split('\n').length + 1)}
        aria-label="Edit message"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') onCancel();
        }}
        className="w-full resize-none bg-transparent px-1.5 py-1 text-sm outline-none"
      />
      <div className="flex items-center justify-between px-1.5 pt-1 text-xs text-muted">
        <span>Esc to cancel · Enter to save</span>
        <span className="flex gap-1.5">
          <button type="button" onClick={onCancel} className="cursor-pointer rounded px-2 py-0.5 hover:bg-surface-2">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!value.trim()}
            className="cursor-pointer rounded bg-primary px-2 py-0.5 text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </span>
      </div>
    </div>
  );
}
