import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, Send, Trash2, X } from 'lucide-react';

import ChatMessage from './ChatMessage';
import chatbotService from '../../../services/chatbotService';
import { setStudentWidgetPref } from '../../../utils/studentWidgetPrefs';

// Where the student dragged the launcher, as an offset from its default
// bottom-right spot. Remembered per browser, separately for phone and wider
// screens, so a spot picked on a laptop doesn't land over a phone's content.
const dockOffsetKey = () => `studentChatWidgetOffset${window.innerWidth < 768 ? ':mobile' : ''}`;
const DRAG_THRESHOLD = 4;
const VIEWPORT_MARGIN = 8;

const readDockOffset = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(dockOffsetKey()) || 'null');
    return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : { x: 0, y: 0 };
  } catch {
    return { x: 0, y: 0 };
  }
};

// Keep the dock fully on screen: its default rect (without any translate)
// plus the offset must stay inside the viewport.
const clampDockOffset = (offset, node) => {
  if (!node) return offset;
  const rect = node.getBoundingClientRect();
  const [shiftX = 0, shiftY = 0] = (getComputedStyle(node).translate || '')
    .split(' ')
    .map((value) => parseFloat(value) || 0);
  const baseLeft = rect.left - shiftX;
  const baseTop = rect.top - shiftY;
  const minX = VIEWPORT_MARGIN - baseLeft;
  const maxX = window.innerWidth - VIEWPORT_MARGIN - rect.width - baseLeft;
  const minY = VIEWPORT_MARGIN - baseTop;
  const maxY = window.innerHeight - VIEWPORT_MARGIN - rect.height - baseTop;
  return {
    x: Math.min(Math.max(offset.x, minX), maxX),
    y: Math.min(Math.max(offset.y, minY), maxY),
  };
};

const GREETING = "Hi, I'm the CareLink Assistant. How can I help you?";

// Tiny sender label shown above each AI reply that appears in the chat
// (not on the very first greeting, and not in the header).
const ASSISTANT_NAME = 'CareLink Assistant';

// The three permanent opening chips. Always shown, always English: the first
// two cover common questions, the third invites the student to describe how
// they feel. These never change and are never randomized.
const STARTER_SUGGESTIONS = [
  'How do I book an appointment?',
  'What time is the clinic open?',
  "I'm not feeling well",
];

// Portal page / feature questions for the second follow-up slot, so it always
// points the student at another part of the dashboard (queue, QR code, health
// records, appointments) instead of repeating the reply's topic. English is the
// default; the assistant's own first follow-up already follows the student's
// language.
const PORTAL_FEATURE_QUESTIONS = [
  'How do I check my queue status?',
  'Where can I find my QR code?',
  'How do I view my health records?',
  'How do I see my appointments?',
  'How do I reschedule my appointment?',
  'How do I update my profile?',
  'Where can I see my appointment history?',
];

// Questions for the third follow-up slot: one about the clinic schedule or
// hours, or one about a symptom. One is picked at random each time.
const EXTRA_SCHEDULE_QUESTIONS = [
  'What are the clinic hours?',
  'When is the clinic open?',
  'Is the clinic open today?',
  'What time does the clinic close?',
  'What is the clinic schedule this week?',
];

const EXTRA_SYMPTOM_QUESTIONS = [
  'What should I do if I have a fever?',
  'Is my headache something to worry about?',
  'What can I do for a cough and cold?',
  'What should I do for a stomach ache?',
  'Should I see the nurse for a sore throat?',
  'How do I care for a toothache?',
  'What should I do for a minor wound?',
  'What if I feel dizzy?',
];

const EXTRA_FOLLOW_UPS = [...EXTRA_SCHEDULE_QUESTIONS, ...EXTRA_SYMPTOM_QUESTIONS];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickRandomOther(list, taken) {
  const pool = list.filter((question) => !taken.includes(question));

  return pickRandom(pool.length > 0 ? pool : list);
}

// The follow-up row is exactly three and always in this order:
//   1. the assistant's own first follow-up (the next step on its reply);
//   2. a question about another portal page or feature (queue, QR code, health
//      records, appointments);
//   3. a random extra about the clinic hours or a symptom.
// The second and third are chosen here so they never drift back to the reply's
// topic, and no chip repeats an earlier one.
function buildFollowUps(base) {
  const replyQuestion = base[0];
  const featureQuestion = pickRandomOther(PORTAL_FEATURE_QUESTIONS, [replyQuestion]);
  const extraQuestion = pickRandomOther(EXTRA_FOLLOW_UPS, [
    replyQuestion,
    featureQuestion,
  ]);

  return [replyQuestion, featureQuestion, extraQuestion];
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState(STARTER_SUGGESTIONS);
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Draggable launcher: pointer drag moves the dock; a drag past the
  // threshold swallows the click so it doesn't also toggle the panel.
  const dockRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [dockOffset, setDockOffset] = useState(readDockOffset);
  const [dragging, setDragging] = useState(false);

  // Re-clamp on mount and whenever the viewport changes size.
  useEffect(() => {
    // Crossing the phone/desktop width switches to that size's saved spot.
    let key = dockOffsetKey();
    const reclamp = () => {
      const next = dockOffsetKey();
      if (next !== key) { key = next; setDockOffset(readDockOffset()); return; }
      setDockOffset((current) => clampDockOffset(current, dockRef.current));
    };
    reclamp();
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, []);

  const onDockPointerDown = (event) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: dockOffset,
      moved: false,
    };
  };

  const onDockPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setDockOffset(clampDockOffset({ x: drag.origin.x + dx, y: drag.origin.y + dy }, dockRef.current));
  };

  const onDockPointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.moved) {
      // Swallow only the click that immediately follows this drag (if the
      // pointer ended off the button no click comes, so release it anyway).
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      setDragging(false);
      setDockOffset((current) => {
        try {
          localStorage.setItem(dockOffsetKey(), JSON.stringify(current));
        } catch {
          /* Remembering the spot is best-effort. */
        }
        return current;
      });
    }
  };

  const onLauncherClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen((current) => !current);
  };

  // The small X hides the assistant; Settings → General turns it back on.
  const hideAssistant = () => {
    setOpen(false);
    setStudentWidgetPref('chatWidget', false);
  };

  // Keep the newest message in view. While the AI is typing, lock the
  // transcript to the bottom so the newest words stay visible (the
  // "camera" follows the reply). When typing stops, free scroll returns.
  useEffect(() => {
    const node = scrollRef.current;

    if (node && isTyping) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, sending, open, isTyping]);

  // Also follow during the word-by-word reveal.
  useEffect(() => {
    const node = scrollRef.current;

    if (node && isTyping) {
      const observer = new MutationObserver(() => {
        node.scrollTop = node.scrollHeight;
      });

      observer.observe(node, { childList: true, subtree: true, characterData: true });

      return () => observer.disconnect();
    }
    return undefined;
  }, [isTyping]);

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

  const send = useCallback(
    async (rawText) => {
      const text = rawText.trim();

      if (!text || sending) {
        return;
      }

      // History is the conversation so far, before this new message. Assistant
      // turns also carry the follow-up chips that were shown, so the backend can
      // tell the model not to repeat them.
      const history = messages.map((message) => {
        const turn = { role: message.role, text: message.text };

        if (message.role === 'assistant' && message.suggestions?.length) {
          turn.suggestions = message.suggestions;
        }

        return turn;
      });

      setMessages((current) => [...current, { role: 'user', text }]);
      setInput('');
      setError('');
      setSending(true);

      try {
        const {
          reply,
          degraded,
          suggestions: next,
          symptom,
          triage,
          recommendation,
        } = await chatbotService.sendMessage(text, history);

        // Keep guiding the student: use the assistant's own follow-ups plus the
        // extra clinic-hours and symptom questions, or fall back to the starter
        // chips if the backend sent none. The chips are stored on the message so
        // they travel with the history next time.
        const shown = next.length > 0 ? buildFollowUps(next) : STARTER_SUGGESTIONS;

        // Symptom categorization + triage travel with the message so the badge
        // and its call to action survive re-renders and older turns.
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            text: reply,
            degraded,
            suggestions: shown,
            symptom,
            triage,
            recommendation,
          },
        ]);

        setSuggestions(shown);
        setIsTyping(true);
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
    setSuggestions(STARTER_SUGGESTIONS);
    inputRef.current?.focus();
  };

  const showSuggestions = !sending && !isTyping && suggestions.length > 0;

// Only the newest AI reply keeps the NEW badge; earlier replies lose it.
const lastAssistantIndex = messages.reduce(
  (last, message, index) => (message.role === 'assistant' ? index : last),
  -1
);

  return (
    <>
      {/* Launcher dock: draggable anywhere on screen; the small X (shown on
          hover / keyboard focus, always on touch screens) hides the assistant. */}
      <div
        ref={dockRef}
        className={`carelink-assistant-dock fixed z-50 h-14 w-14${dragging ? ' is-dragging' : ''}`}
        style={{ '--chat-dx': `${dockOffset.x}px`, '--chat-dy': `${dockOffset.y}px` }}
      >
        <button
          type="button"
          onClick={onLauncherClick}
          onPointerDown={onDockPointerDown}
          onPointerMove={onDockPointerMove}
          onPointerUp={onDockPointerUp}
          onPointerCancel={onDockPointerUp}
          aria-label={open ? 'Close clinic assistant' : 'Open clinic assistant'}
          aria-expanded={open}
          title="Drag to move"
          className="carelink-assistant-launcher flex h-full w-full items-center justify-center rounded-full bg-maroon-800 text-white shadow-xl shadow-maroon-950/30 transition-transform hover:scale-105 active:scale-95"
        >
          {open ? (
            <X className="h-6 w-6" />
          ) : (
            <Bot className="h-7 w-7" />
          )}
        </button>

        <button
          type="button"
          onClick={hideAssistant}
          aria-label="Hide clinic assistant"
          title="Hide assistant (turn it back on in Settings)"
          className="carelink-assistant-hide"
        >
          <X />
        </button>
      </div>

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
            className="carelink-assistant-panel fixed z-50 flex flex-col overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
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
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close clinic assistant"
                className="rounded-[10px] p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Transcript */}
            <div
              ref={scrollRef}
              className={`flex flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4 chatbot-transcript ${
                isTyping ? 'chat-locked' : ''
              }`}
            >
              {/* Fresh state: the greeting sits directly above the starter
                  chips at the bottom-right. Once a conversation starts, the
                  greeting stays at the top of the transcript. */}
              <div className={messages.length === 0 ? 'mt-auto' : ''}>
                <ChatMessage role="assistant" text={GREETING} mood="happy" />
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
                  triage={
                    message.role === 'assistant' ? message.triage : undefined
                  }
                  recommendation={
                    message.role === 'assistant'
                      ? message.recommendation
                      : undefined
                  }
                  animate={
                    message.role === 'assistant' &&
                    index === lastAssistantIndex &&
                    !message.degraded
                  }
                  onTypingDone={() => setIsTyping(false)}
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

                  <div className="flex items-center gap-1 rounded-[10px] rounded-tl-[10px] bg-gray-100 px-4 py-3 dark:bg-gray-800">
                    <span className="think-dot" />
                    <span className="think-dot think-dot-2" />
                    <span className="think-dot think-dot-3" />
                  </div>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-[10px] bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"
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
                    {suggestions.map((suggestion, chipIndex) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="chip-stagger rounded-full border border-maroon-200 bg-maroon-50 px-3 py-1.5 text-xs font-medium text-maroon-800 transition-colors hover:bg-maroon-100 dark:border-maroon-900 dark:bg-maroon-950/40 dark:text-maroon-300 dark:hover:bg-maroon-950/70"
                        style={{ animationDelay: `${chipIndex * 0.15}s` }}
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
                      className="flex items-center gap-1 text-xs text-maroon-700 underline underline-offset-4 transition-colors hover:text-maroon-800 dark:text-maroon-400 dark:hover:text-maroon-300"
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
                  className="max-h-24 min-h-[40px] flex-1 resize-none rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-maroon-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-maroon-600"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  aria-label="Send message"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-800 text-white transition-colors hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="mt-1.5 px-1 text-center text-xs leading-relaxed text-gray-400 dark:text-gray-500">
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
