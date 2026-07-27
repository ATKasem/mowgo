import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RefreshCw, Loader2, Wrench, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import useAutopilot from '../hooks/useAutopilot';

/**
 * AutopilotChat — AI assistant chat interface for MowGo.
 *
 * Features:
 *  - Message bubbles with markdown-like formatting
 *  - Tool call display (shows what the AI is doing)
 *  - Tool result display (collapsed, expandable)
 *  - Quick-start prompt suggestions
 *  - Loading/thinking/executing states
 *  - Dark mode support
 */

const QUICK_PROMPTS = [
  { label: "Show today's schedule", text: "Show me today's schedule" },
  { label: 'Run rain delay', text: "Move today's jobs to tomorrow and notify everyone — it's raining" },
  { label: 'Check revenue', text: 'How much did I make this month?' },
  { label: 'Unpaid invoices', text: 'Who has unpaid invoices?' }
];

export default function AutopilotChat({ compact = false }) {
  const { tr, t, i18n } = useLocalizedText('autopilotChat');
  const { messages, status, currentAction, sendMessage, reset, retry } = useAutopilot({ compact });
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom — but not if user has scrolled up to read history
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 60; // px from bottom before we auto-scroll
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    let animationFrame;
    if (isNearBottom) {
      animationFrame = requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || status !== 'idle') return;
    sendMessage(input.trim());
    setInput('');
  }

  function handleQuickPrompt(text) {
    sendMessage(text);
    setInput('');
  }

  const isBusy = status === 'thinking' || status === 'executing';

  return (
    <div className={`flex flex-col ${compact ? 'flex-1 min-h-0' : 'h-[calc(100vh-13rem)] max-h-[calc(100vh-13rem)]'}`}>
      {/* Header — hidden in compact mode */}
      {!compact && (
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{tr("AI Autopilot")}</h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {status === 'thinking' ? tr('Thinking...') :
               status === 'executing' ? currentAction || tr('Working...') :
               status === 'error' ? tr('Error — tap to retry') :
               tr('Ask me anything about your business')}
            </p>
          </div>
        </div>
        <button
          onClick={reset}
          className="btn-ghost text-xs gap-1"
          disabled={isBusy}
        >
          <RefreshCw className="w-3 h-3" />
          {tr("New chat")}
        </button>
      </div>
      )}

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-4 space-y-3 overscroll-contain">
        {messages.filter(m => !m.isToolResult).map((msg) => (
          <MessageBubble key={msg.id} msg={msg} messages={messages} index={messages.indexOf(msg)} />
        ))}

        {/* Typing indicator */}
        {isBusy && !currentAction && (
          <div className="flex gap-2.5 px-1">
            <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts (show when only welcome message) — more minimal in compact */}
      {messages.length === 1 && messages[0].isWelcome && (
        <div className={compact ? 'pb-2' : 'pb-3'}>
          {!compact && <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2 px-1">{tr("Try asking:")}</p>}
          <div className={`${compact ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-2 gap-2'}`}>
            {QUICK_PROMPTS.slice(0, compact ? 3 : 4).map((p, i) => (
              <button
                key={i}
                onClick={() => handleQuickPrompt(tr(p.text))}
                className={`text-left text-xs rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-gray-600 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-300 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-3 min-h-[44px]'}`}
              >
                {tr(p.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error state — retry button */}
      {status === 'error' && (
        <div className="pb-3">
          <button
            onClick={retry}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            {tr("Retry")}
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={
              status === 'executing' ? tr('Working on it...') :
              status === 'thinking' ? tr('AI is thinking...') :
              tr("Type a command (e.g. 'Show today's schedule')")
            }
            disabled={isBusy}
            className="flex-1 px-4 py-2.5 text-base bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50 transition-shadow"
          />
          <button
            type="submit"
            disabled={!input.trim() || isBusy}
            className="px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors disabled:cursor-not-allowed min-h-[44px]"
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className={`${compact ? 'text-[9px] mt-1.5' : 'text-[10px] mt-2'} text-gray-400 dark:text-gray-500 text-center`}>
          {tr(compact ? 'Type a command to manage your business' : 'AI Autopilot uses your business data to help manage scheduling, invoicing, and clients')}
        </p>
      </form>
    </div>
  );
}

/** Individual message bubble */
function MessageBubble({ msg, messages, index }) {
  const isUser = msg.role === 'user';
  const isToolCall = msg.isToolCall;
  const isWelcome = msg.isWelcome;

  if (isToolCall) {
    return <ToolCallMessage msg={msg} messages={messages} index={index} />;
  }

  return (
    <div className={`flex gap-2.5 px-1 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isWelcome
            ? 'bg-violet-100 dark:bg-violet-900/30'
            : 'bg-violet-100 dark:bg-violet-900/30'
        }`}>
          <Sparkles className={`w-3.5 h-3.5 ${
            msg.isError ? 'text-red-500' : 'text-violet-600 dark:text-violet-400'
          }`} />
        </div>
      )}

      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-emerald-600 text-white rounded-br-sm'
          : msg.isError
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-tl-sm'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
      }`}>
        <FormatContent content={msg.content} isUser={isUser} />
      </div>
    </div>
  );
}

/** Tool call + result display (collapsed by default, expandable) */
function ToolCallMessage({ msg, messages, index }) {
  const { tr } = useLocalizedText('autopilotChat');
  const [expanded, setExpanded] = useState(false);

  // Find the tool result that follows this tool call
  const toolResults = [];
  for (let i = index + 1; i < messages.length; i++) {
    const m = messages[i];
    if (m.isToolResult && msg.tool_calls?.some(tc => tc.id === m.tool_call_id)) {
      toolResults.push(m);
    } else if (!m.isToolResult) {
      break;
    }
  }

  const toolCallLabels = msg.tool_calls?.map(tc => {
    const args = safeParse(tc.function.arguments);
    return formatToolCallLabel(tc.function.name, args, tr);
  }) || [];

  return (
    <div className="px-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors text-left"
      >
        <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0">
          <Wrench className="w-3 h-3 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-violet-700 dark:text-violet-300 truncate">
            {toolCallLabels[0] || tr('Running...')}
          </p>
          {toolCallLabels.length > 1 && (
            <p className="text-[10px] text-violet-500 dark:text-violet-400">
              {tr('{{count}} more action', { count: toolCallLabels.length - 1 })}
            </p>
          )}
        </div>
        {toolResults.length > 0 && (
          <ResultBadge results={toolResults} />
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-violet-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-violet-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded tool details */}
      {expanded && (
        <div className="mt-1.5 ml-9 space-y-1.5">
          {msg.tool_calls?.map((tc, i) => {
            const result = toolResults.find(r => r.tool_call_id === tc.id);
            const args = safeParse(tc.function.arguments);
            const resultData = result ? safeParse(result.content) : null;

            return (
              <div key={i} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-medium text-violet-700 dark:text-violet-400">
                    {formatToolCallLabel(tc.function.name, args, tr)}
                  </span>
                  {resultData?.success ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : resultData && !resultData.success ? (
                    <X className="w-3 h-3 text-red-500" />
                  ) : null}
                </div>
                {resultData?.data?.message && (
                  <p className={`${resultData.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {resultData.data.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Success/failure badge for collapsed tool calls */
function ResultBadge({ results }) {
  const { tr } = useLocalizedText('autopilotChat');
  const allSuccess = results.every(r => {
    const d = safeParse(r.content);
    return d?.success !== false;
  });

  if (results.length === 0) return null;

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
      allSuccess
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    }`}>
      {tr(allSuccess ? 'Done' : 'Error')}
    </span>
  );
}

/** Human-readable label for a tool call */
function formatToolCallLabel(name, args, tr) {
  switch (name) {
    case 'getTodaySchedule': return tr('Checking schedule');
    case 'getSchedule': return tr('Schedule: {{startDate}} – {{endDate}}', { startDate: args.startDate || '', endDate: args.endDate || '' });
    case 'rescheduleJobs': return tr('Moving {{count}} jobs to {{date}}', { count: args.jobIds?.length || '?', date: args.newDate || '?' });
    case 'runRainDelay': return tr('Rain delay — moving today to tomorrow');
    case 'searchClients': return tr('Searching: "{{query}}"', { query: args.query || '' });
    case 'getClientInfo': return tr('Looking up: {{name}}', { name: args.clientName || '' });
    case 'getClientHistory': return tr('History for: {{name}}', { name: args.clientName || '' });
    case 'getUnpaidInvoices': return tr('Checking unpaid invoices');
    case 'createInvoice': return tr('Invoice: {{name}} — ${{amount}}', { name: args.clientName || '', amount: args.amount || 0 });
    case 'sendPaymentReminders': return tr('Sending payment reminders');
    case 'getRevenue': return tr('Revenue: {{period}}', { period: args.period || '' });
    case 'createJob': return tr('Schedule: {{service}} for {{name}}', { service: args.service || '', name: args.clientName || '' });
    case 'updateJobStatus': return tr('Marking job as {{status}}', { status: args.status || '' });
    case 'invoiceCompletedJobs': return tr('Invoicing for {{date}}', { date: args.date || tr('today') });
    default: return name;
  }
}

/** Simple markdown-like formatting for message content — safe against XSS (no dangerouslySetInnerHTML) */
function FormatContent({ content, isUser }) {
  if (!content) return null;

  const lines = content.split('\n');
  return lines.map((line, i) => {
    // Parse bold **...** and code `...` via regex, render as safe React elements
    const parts = [];
    let lastIndex = 0;
    let match;
    const tokenRegex = /\*\*(.*?)\*\*|`(.*?)`/g;
    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`t${lastIndex}`}>{line.slice(lastIndex, match.index)}</span>);
      }
      if (match[1] !== undefined) {
        parts.push(
          <strong key={`b${match.index}`} className={isUser ? 'text-white' : 'text-gray-900 dark:text-white font-semibold'}>
            {match[1]}
          </strong>
        );
      } else if (match[2] !== undefined) {
        parts.push(
          <code key={`c${match.index}`} className={`${isUser ? 'bg-emerald-700/50' : 'bg-gray-200 dark:bg-gray-700'} px-1 py-0.5 rounded text-xs font-mono`}>
            {match[2]}
          </code>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(<span key={`t${lastIndex}`}>{line.slice(lastIndex)}</span>);
    }
    if (parts.length === 0) parts.push(<span key="empty">{line}</span>);

    return (
      <span key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

/** Safe JSON parse */
function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}
