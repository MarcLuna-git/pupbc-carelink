import { AlertCircle, Bot, User } from 'lucide-react';

/**
 * One chat bubble. Assistant replies are plain text, so newlines are preserved
 * with whitespace-pre-wrap instead of rendering any markup. When `name` is
 * given, a tiny sender label is shown above the bubble (chat-app style).
 */
export default function ChatMessage({ role, text, degraded = false, name, badge }) {
  const isUser = role === 'user';

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
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {name}
            </p>

            {badge && (
              <span className="rounded-full bg-maroon-100 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-maroon-700 dark:bg-maroon-950/50 dark:text-maroon-300">
                {badge}
              </span>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-tr-sm bg-maroon-800 text-white'
              : 'rounded-tl-sm bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{text}</p>

          {degraded && (
            <p className="mt-2 flex items-start gap-1.5 border-t border-gray-300/60 pt-2 text-[11px] text-amber-700 dark:border-gray-700 dark:text-amber-400">
              <AlertCircle className="mt-px h-3 w-3 shrink-0" />
              <span>Automated reply unavailable — this is a generic response.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
