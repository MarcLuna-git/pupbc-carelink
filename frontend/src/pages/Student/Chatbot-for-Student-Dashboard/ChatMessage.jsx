import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bot, User } from 'lucide-react';

/**
 * The triage badge colours, mirroring chatbot.triage.levels on the backend.
 * Only the text is tinted — no fill and no border, so the badge reads as plain
 * coloured text inside the bubble.
 */
const TRIAGE_STYLES = {
  red: 'text-red-700 dark:text-red-300',
  yellow: 'text-yellow-700 dark:text-yellow-300',
  green: 'text-green-700 dark:text-green-300',
};

/**
 * The call to action shown inside a categorized reply, keyed by the
 * recommendation the backend sent with the triage level. Every level shares the
 * same maroon button, so no urgency colour bleeds onto the call to action.
 */
const RECOMMENDATIONS = {
  go_now: { label: 'Go to the clinic now', to: '/student/help' },
  book_same_day: { label: 'Book a Consultation', to: '/student/appointments' },
  book_consultation: { label: 'Book a Consultation', to: '/student/appointments' },
};

/**
 * The leading emoji of the header, representing the urgency signal the reply
 * was tagged with: an alert for emergency, a warning for semi-urgent, and a
 * check for the minor case.
 */
const TRIAGE_EMOJI = {
  HIGH: '🚨',
  MEDIUM: '⚠️',
  LOW: '✅',
};

/**
 * A categorized symptom always gets a sad reaction, never a happy one: worried
 * for an emergency, troubled for a semi-urgent case, sad for a minor one.
 */
const TRIAGE_REACTIONS = {
  HIGH: '😟',
  MEDIUM: '😕',
  LOW: '😔',
};

/**
 * Facial-expression pools used when there is nothing to triage, so the
 * assistant's face follows the mood of the conversation: laughing at good
 * news, awkward at a stumble, downcast at bad news, and a plain smile
 * otherwise. The face is picked deterministically from the reply text, so it
 * varies between messages but never flickers on re-render.
 */
const REACTION_POOLS = {
  happy: ['😄', '😆', '😊', '😁'],
  awkward: ['😅', '😬', '😳', '🫣', '🙃'],
  sad: ['😔', '😞', '😢', '🥺', '☹️'],
  friendly: ['🙂', '😊', '😌'],
};

/**
 * Signals in the reply that hint at the mood of the conversation, checked in
 * order. The wording is bilingual, since the assistant replies in English or
 * Tagalog depending on how the student writes.
 */
const MOOD_SIGNALS = [
  [
    'happy',
    /\b(welcome|congrat|great|awesome|nice|sure|happy|enjoy|approved|success|fresh|good|salamat|maganda|mabuti)\b/i,
  ],
  [
    'awkward',
    /\b(sorry|apolog|can'?t help|cannot help|not sure|don'?t know|hmm|unavailable|blocked|no access|empty|failed|paumanhin|patawad|wala akong|hindi kita)\b/i,
  ],
  [
    'sad',
    /\b(unfortunately|sad|regret|missing|no upcoming|declin|reject|cancel|walang|nakakalungkot|dehad)\b/i,
  ],
];

/** A stable pseudo-random index, so the face varies but never flickers. */
function seedIndex(seed, length) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return hash % length;
}

function pickFrom(pool, seed) {
  return pool[seedIndex(seed, pool.length)];
}

/** The mood of a reply, read from its wording. */
function moodFor(text) {
  const match = MOOD_SIGNALS.find(([, signal]) => signal.test(text));

  return match ? match[0] : 'friendly';
}

/**
 * The facial expression woven into a reply. A categorized symptom stays sad
 * (never happy). An explicit `mood` (e.g. the greeting's happy face) wins over
 * detection. Otherwise the face follows the mood of the conversation, and a
 * degraded reply stays sober.
 */
function reactionFor({ triage, text, degraded, mood }) {
  if (triage) return TRIAGE_REACTIONS[triage.level] ?? TRIAGE_REACTIONS.LOW;
  if (degraded) return pickFrom(REACTION_POOLS.sad, text);
  if (mood) return pickFrom(REACTION_POOLS[mood], text);

  return pickFrom(REACTION_POOLS[moodFor(text)], text);
}

/**
 * Splice the reaction emoji into the reply just before the first sentence dot,
 * so it reads like ordinary chat (e.g. "...that sounds uncomfortable 😕. Please
 * book today."). A dot inside a number (e.g. "37.5") is skipped. When the reply
 * has no sentence dot at all, the emoji goes at the very end.
 */
function withReaction(text, emoji) {
  if (!emoji) return text;

  const dot = text.search(/\.(?!\d)/);
  if (dot === -1) {
    return `${text} ${emoji}`;
  }

  const lead = text.slice(0, dot).replace(/\s+$/, '');
  return `${lead} ${emoji}${text.slice(dot)}`;
}

/**
 * One chat bubble. Assistant replies are plain text, so newlines are preserved
 * with whitespace-pre-wrap instead of rendering any markup. When `name` is
 * given, a tiny sender label is shown above the bubble (chat-app style).
 *
 * When `triage` is given (a symptom category was detected), a header is shown
 * at the top of the bubble: a static "Category" label inside the tag badge,
 * "SYMPTOM CATEGORY TAG AS <level label> <urgency emoji>", tinted by the
 * triage level. Its call to action sits at the end of the reply, inside the
 * bubble.
 * When `animate` is true (the latest assistant reply), the text is revealed
 * word-by-word with a blinking cursor, and `onTypingDone` fires when complete.
 */
export default function ChatMessage({
  role,
  text,
  degraded = false,
  name,
  badge,
  mood,
  triage,
  recommendation,
  animate = false,
  onTypingDone,
}) {
  const isUser = role === 'user';

  // The assistant weaves a reaction emoji into every reply right before the
  // first sentence dot, so it reads like ordinary chat instead of always
  // leading or trailing the message. It types out with the text because it is
  // part of the displayed words.
  const reaction = isUser
    ? ''
    : reactionFor({ triage, text, degraded, mood });
  const displayText = withReaction(text, reaction);

  const [visibleWords, setVisibleWords] = useState(animate ? 0 : null);
  const words = displayText.split(' ');
  const typingDone = animate && visibleWords !== null && visibleWords >= words.length;

  useEffect(() => {
    if (!animate) return;

    if (visibleWords === null) {
      setVisibleWords(0);
      return;
    }

    if (visibleWords >= words.length) {
      onTypingDone?.();
      return;
    }

    const timer = setTimeout(() => {
      setVisibleWords((current) => current + 1);
    }, 40);

    return () => clearTimeout(timer);
  }, [animate, visibleWords, words.length, onTypingDone]);

  useEffect(() => {
    if (typingDone) {
      onTypingDone?.();
    }
  }, [typingDone, onTypingDone]);

  const displayWords = animate && visibleWords !== null
    ? words.slice(0, visibleWords)
    : words;

  // The triage header is shown the moment the reply arrives, so the badge
  // reads first and the answer types out beneath it. Its call to action waits
  // until the reply has finished typing, so the student reads before acting.
  const hasTriage = !isUser && Boolean(triage);
  const showDetails = !animate || typingDone;
  const triageStyle = triage
    ? TRIAGE_STYLES[triage.color] ?? TRIAGE_STYLES.green
    : '';
  const triageEmoji = TRIAGE_EMOJI[triage?.level] ?? TRIAGE_EMOJI.LOW;
  const action = triage && recommendation ? RECOMMENDATIONS[recommendation] : null;
  const showTriage = hasTriage;
  const showActions = hasTriage && showDetails;

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            : 'bg-maroon-100 text-maroon-800 dark:bg-maroon-950/60 dark:text-maroon-300'
        }`}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 max-w-[85%]">
        {name && (
          <div
            className={`mb-1 flex items-center gap-1.5 ${
              isUser ? 'justify-end' : ''
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {name}
            </p>

            {badge && (
              <span className="rounded-full bg-maroon-100 px-1.5 py-px text-xs font-bold uppercase tracking-wider text-maroon-700 dark:bg-maroon-950/50 dark:text-maroon-300">
                {badge}
              </span>
            )}
          </div>
        )}

        <div
          className={`rounded-[10px] px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-tr-[10px] bg-maroon-800 text-white'
              : 'rounded-tl-[10px] bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
          }`}
        >
          {showTriage && (
            <div
              className={`mb-2 flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${triageStyle}`}
            >
              <span>Symptom</span>
              <span>Category</span>
              <span>Tag as</span>
              <span>{triage.label}</span>
              <span className="text-xs leading-none" aria-hidden="true">
                {triageEmoji}
              </span>
            </div>
          )}

          <p className="whitespace-pre-wrap break-words">
            {displayWords.map((word, i) => (
              <span key={i} className="word-appear">
                {word}
                {i < displayWords.length - 1 ? ' ' : ''}
              </span>
            ))}
          </p>

          {degraded && (
            <p className="mt-2 flex items-start gap-1.5 border-t border-gray-300/60 pt-2 text-xs text-amber-700 dark:border-gray-700 dark:text-amber-400">
              <AlertCircle className="mt-px h-3 w-3 shrink-0" />
              <span>Automated reply unavailable — this is a generic response.</span>
            </p>
          )}

          {showActions && action && (
            <div className="mt-3 flex flex-col gap-1.5">
              <Link
                to={action.to}
                className="inline-flex w-fit items-center rounded-[10px] bg-maroon-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-maroon-900"
              >
                {action.label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
