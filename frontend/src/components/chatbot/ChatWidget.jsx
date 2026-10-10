import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, Send, Trash2, X } from 'lucide-react';

import ChatMessage from './ChatMessage';
import chatbotService from '../../services/chatbotService';

const GREETING = "Hi! I'm the CareLink Assistant. How may I help you?";

// Tiny sender label shown above each AI reply that appears in the chat
// (not on the very first greeting, and not in the header).
const ASSISTANT_NAME = 'CareLink Assistant';

const SUGGESTIONS = [
  'What time is the clinic open?',
  'What is my queue status?',
  'How do I book an appointment?',
];

// Render Free sleeps after 15 minutes, so the first request can take a while.
const SLOW_REPLY_MS = 6000;

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState(SUGGESTIONS);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const slowTimer = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    const node = scrollRef.current;

    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, sending, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Close on Escape, matching the other dialogs in the portal.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => () => clearTimeout(slowTimer.current), []);

  const send = useCallback(
    async (rawText) => {
      const text = rawText.trim();

      if (!text || sending) {
        return;
      }

      // History is the conversation so far, before this new message.
      const history = messages.map((message) => ({
        role: message.role,
        text: message.text,
      }));

      setMessages((current) => [...current, { role: 'user', text }]);
      setInput('');
      setError('');
      setSending(true);
      setSlow(false);

      slowTimer.current = setTimeout(() => setSlow(true), SLOW_REPLY_MS);

      try {
        const { reply, degraded, suggestions: next } = await chatbotService.sendMessage(
          text,
          history
        );

        setMessages((current) => [
          ...current,
          { role: 'assistant', text: reply, degraded },
        ]);

        // Keep guiding the student: use the assistant's follow-ups, or fall
        // back to the starter set if the backend sent none.
        setSuggestions(next.length > 0 ? next : SUGGESTIONS);
      } catch (requestError) {
        const status = requestError?.response?.status;
        const timedOut =
          requestError?.code === 'ECONNABORTED' ||
          /timeout/i.test(requestError?.message ?? '');

        setError(
          timedOut
            ? 'The clinic assistant is taking longer than usual. Please wait a moment and try again.'
            : status === 429
              ? 'You are sending messages too quickly. Please wait a moment and try again.'
              : status === 503
                ? 'The clinic assistant is temporarily unavailable. Please try again later.'
                : 'Could not reach the clinic assistant. Please check your connection and try again.'
        );
      } finally {
        clearTimeout(slowTimer.current);
        setSlow(false);
        setSending(false);
      }
    },
    [messages, sending]
  );

  const onSubmit = (event) => {
    event.preventDefault();
    send(input);
  };

  const clearConversation = () => {
    setMessages([]);
    setError('');
    setSuggestions(SUGGESTIONS);
    inputRef.current?.focus();
  };

  const showSuggestions = !sending && suggestions.length > 0;

// Only the newest AI reply keeps the NEW badge; earlier replies lose it.
const lastAssistantIndex = messages.reduce(
  (last, message, index) => (message.role === 'assistant' ? index : last),
  -1
);

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Close clinic assistant' : 'Open clinic assistant'}
        aria-expanded={open}
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-maroon-800 text-white shadow-xl shadow-maroon-950/30 transition-transform hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <Bot className="h-7 w-7" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-modal="false"
            aria-label="CareLink clinic assistant"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed bottom-40 right-4 z-50 flex h-[min(70vh,520px)] w-[min(calc(100vw-2rem),380px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 lg:bottom-24 lg:right-6"
          >
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-gray-200 bg-gradient-to-r from-[#65111f] to-[#4f0d18] px-4 py-3 dark:border-gray-800">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                <Bot className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">
                  CareLink Assistant
                </p>

                <p className="truncate text-[11px] text-white/70">
                  Clinic help, 24/7
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close clinic assistant"
                className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Transcript */}
            <div
              ref={scrollRef}
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4"
            >
              {/* Fresh state: the greeting sits directly above the starter
                  chips at the bottom-right. Once a conversation starts, the
                  greeting stays at the top of the transcript. */}
              <div className={messages.length === 0 ? 'mt-auto' : ''}>
                <ChatMessage role="assistant" text={GREETING} />
              </div>

              {messages.map((message, index) => (
                <ChatMessage
                  key={`${message.role}-${index}`}
                  role={message.role}
                  text={message.text}
                  degraded={message.degraded}
                  name={
                    message.role === 'assistant' ? ASSISTANT_NAME : undefined
                  }
                  badge={
                    message.role === 'assistant' &&
                    index === lastAssistantIndex
                      ? 'new'
                      : undefined
                  }
                />
              ))}

              {/* Thinking indicator: the assistant's profile with an animated
                  three-dot typing bubble, shown right below the student's
                  question while the assistant replies. */}
              {sending && (
                <div className="flex items-end gap-2">
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-maroon-100 text-maroon-800 dark:bg-maroon-950/60 dark:text-maroon-300"
                    aria-hidden="true"
                  >
                    <Bot className="h-4 w-4" />
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 dark:bg-gray-800">
                      <span className="think-dot" />
                      <span className="think-dot think-dot-2" />
                      <span className="think-dot think-dot-3" />
                    </div>

                    {slow && (
                      <p className="mt-1.5 px-1 text-[11px] text-gray-500 dark:text-gray-400">
                        Still waking up the clinic server…
                      </p>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"
                >
                  {error}
                </p>
              )}

              {/* Follow-up chips and "Delete conversation." share one group anchored to
                  the bottom of the chat once a conversation exists, so the
                  delete link always holds a fixed spot. */}
              <div
                className={
                  messages.length > 0
                    ? 'mt-auto flex flex-col gap-2'
                    : 'flex flex-col gap-2'
                }
              >
                {showSuggestions && (
                  <div className="flex flex-col items-end gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="rounded-full border border-maroon-200 bg-maroon-50 px-3 py-1.5 text-[11px] font-medium text-maroon-800 transition-colors hover:bg-maroon-100 dark:border-maroon-900 dark:bg-maroon-950/40 dark:text-maroon-300 dark:hover:bg-maroon-950/70"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {/* Delete conversation: only after the assistant actually
                    replied — never while the first reply is still thinking. */}
                {messages.some((message) => message.role === 'assistant') && (
                  <div className="flex justify-center pt-0.5">
                    <button
                      type="button"
                      onClick={clearConversation}
                      aria-label="Delete conversation"
                      title="Delete conversation"
                      className="flex items-center gap-1 text-[11px] text-maroon-700 underline underline-offset-4 transition-colors hover:text-maroon-800 dark:text-maroon-400 dark:hover:text-maroon-300"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete conversation.</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Composer */}
            <form
              onSubmit={onSubmit}
              className="border-t border-gray-200 px-3 py-2.5 dark:border-gray-800"
            >
              <div className="flex items-end gap-2">
                <label htmlFor="carelink-chat-input" className="sr-only">
                  Message the clinic assistant
                </label>

                <textarea
                  id="carelink-chat-input"
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      send(input);
                    }
                  }}
                  maxLength={1000}
                  placeholder="Ask about the clinic…"
                  className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-maroon-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-maroon-600"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  aria-label="Send message"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon-800 text-white transition-colors hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="mt-1.5 px-1 text-center text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
                Automated replies only. For other concerns, please contact us
                at{' '}
                <a
                  href="mailto:pupbinancarelink@gmail.com"
                  className="font-medium underline underline-offset-2 transition-colors hover:text-maroon-700 dark:hover:text-maroon-300"
                >
                  pupbinancarelink@gmail.com
                </a>
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
