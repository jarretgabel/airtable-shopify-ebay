import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { aiAppApi } from '@/services/app-api';
import { IntakeDraftCard } from '@/components/assistant/IntakeDraftCard';
import { StageDraftCard } from '@/components/assistant/StageDraftCard';
import { getAssistantSuggestions } from '@/components/assistant/assistantSuggestions';
import type { UserRole } from '@/stores/auth/authTypes';
import { useAssistantStore, type AssistantMessage as Message } from '@/stores/assistantStore';


const INLINE_PATTERN = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

// Small markdown subset: links to in-app paths only, bold, inline code and bullet lists.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(<Fragment key={`${keyPrefix}t${last}`}>{text.slice(last, start)}</Fragment>);
    const key = `${keyPrefix}m${start}`;
    if (match[2]) {
      nodes.push(<Link key={key} to={match[2]} className="font-semibold text-sky-300 underline hover:text-sky-200">{match[1]}</Link>);
    } else if (match[3]) {
      nodes.push(<strong key={key}>{match[3]}</strong>);
    } else {
      nodes.push(<code key={key} className="rounded bg-slate-950 px-1">{match[4]}</code>);
    }
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(<Fragment key={`${keyPrefix}t${last}`}>{text.slice(last)}</Fragment>);
  return nodes;
}

function renderMarkdown(text: string): ReactNode {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = (key: number) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul${key}`} className="m-0 list-disc space-y-1 pl-5">
        {bullets.map((item, i) => <li key={i}>{renderInline(item, `b${key}-${i}`)}</li>)}
      </ul>,
    );
    bullets = [];
  };
  text.split('\n').forEach((line, index) => {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets(index);
    if (line.trim()) blocks.push(<p key={`p${index}`} className="m-0">{renderInline(line, `p${index}-`)}</p>);
  });
  flushBullets(text.length);
  return <div className="space-y-2">{blocks}</div>;
}

export function AssistantChat({ userId, role }: { userId: string; role?: UserRole }) {
  const location = useLocation();
  const claim = useAssistantStore((state) => state.claim);
  const open = useAssistantStore((state) => state.open);
  const setOpen = useAssistantStore((state) => state.setOpen);
  const messages = useAssistantStore((state) => state.messages);
  const setMessages = useAssistantStore((state) => state.setMessages);
  const draft = useAssistantStore((state) => state.draft);
  const [dragActive, setDragActive] = useState(false);
  const addPendingFiles = useAssistantStore((state) => state.addPendingFiles);
  const stageDraft = draft && draft.kind && draft.kind !== 'intake' && draft.recordId ? { ...draft, recordId: draft.recordId } : null;
  const setDraft = useAssistantStore((state) => state.setDraft);
  const owned = useAssistantStore((state) => state.ownerId === userId);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    claim(userId);
  }, [claim, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, busy, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError(null);
    setBusy(true);
    try {
      const result = await aiAppApi.sendAssistantMessage(next, location.pathname, draft);
      if (result.draft) setDraft(result.draft);
      setMessages([...next, { role: 'assistant', content: result.reply, tools: result.tools ?? [] }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The assistant is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  if (!owned) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open assistant"
        title="Ask assistant"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-500"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  return (
    <section
      aria-label="Assistant"
      onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragActive(true); } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false); }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        const images = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
        if (images.length === 0) return;
        if (stageDraft) addPendingFiles(images);
        else setError('To attach images, first ask me to start a testing or photography update for an item.');
      }}
      className={`fixed inset-x-2 bottom-2 z-40 flex h-[min(32rem,calc(100dvh-1rem))] flex-col sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[32rem] sm:max-h-[80vh] ${stageDraft ? 'sm:w-[30rem]' : 'sm:w-[22rem]'} sm:max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl`}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-sky-900/80 text-sm font-semibold text-white">
          {stageDraft ? 'Drop images to attach them' : 'Start a testing or photography update first'}
        </div>
      )}
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <h2 className="m-0 text-sm font-semibold">Assistant</h2>
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={() => { setMessages([]); setDraft(null); setError(null); }} className="text-slate-300 hover:text-white">New chat</button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="text-slate-300 hover:text-white">Close</button>
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="m-0 text-slate-300">Ask about items, intake status, specs, or the workflow.</p>
            {getAssistantSuggestions(role).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="block w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-left ${message.role === 'user' ? 'bg-sky-700' : 'bg-slate-800'}`}>
              {message.role === 'assistant' ? renderMarkdown(message.content) : message.content}
            </div>
          </div>
        ))}
        {stageDraft && (
          <StageDraftCard
            key={`${stageDraft.kind}-${stageDraft.recordId}`}
            stage={stageDraft.kind === 'photos' ? 'photos' : 'testing'}
            draft={stageDraft}
            onDiscard={() => setDraft(null)}
            onDone={(content) => {
              setDraft(null);
              setMessages([...messages, { role: 'assistant', content }]);
            }}
          />
        )}
        {draft && !stageDraft && (
          <IntakeDraftCard
            draft={draft}
            onDiscard={() => setDraft(null)}
            onCreated={(recordId) => {
              setDraft(null);
              setMessages([...messages, { role: 'assistant', content: `Created the intake item. [Open it](/workflow-hub/${encodeURIComponent(recordId)})` }]);
            }}
          />
        )}
        {busy && <p className="m-0 text-slate-400">Thinking…</p>}
        {error && <p role="alert" className="m-0 text-red-300">{error}</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-700 p-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question…"
          aria-label="Message"
          maxLength={4000}
          className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-base sm:text-sm"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">Send</button>
      </form>
    </section>
  );
}
