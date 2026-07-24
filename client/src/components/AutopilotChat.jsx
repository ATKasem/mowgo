import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RefreshCw, Loader2, Wrench, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import useAutopilot from '../hooks/useAutopilot';

/**
 * AutopilotChat — AI assistant chat interface for MowFlow.
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
  const { messages, status, currentAction, sendMessage, reset, retry } = useAutopilot();
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
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">AI Autopilot</h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {status === 'thinking' ? 'Thinking...' :
               status === 'executing' ? currentAction || 'Working...' :
               status === 'error' ? 'Error — tap to retry' :
               'Ask me anything about your business'}
            </p>
          </div>
        </div>
        <button
          onClick={reset}
          className="btn-ghost text-xs gap-1"
          disabled={isBusy}
        >
          <RefreshCw className="w-3 h-3" />
          New chat
        </button>
      </div>
      )}

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-4 space-y-3 overscroll-contain">
        {messages.filter(m => !m.isToolResult).map((msg, i) => (
          <MessageBubble key={msg.id} msg={msg} messages={messages} index={i} />
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

      {/* Quick prompts (show when only welcome message) */}
      {messages.length === 1 && messages[0].isWelcome && (
        <div className="pb-3">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2 px-1">Try asking:</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => handleQuickPrompt(p.text)}
                className="text-left text-xs px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors text-gray-600 dark:text-gray-400 hover:text-violet-700 dark:hover:text-violet-300 min-h-[44px]"
              >
                {p.label}
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
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
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
              status === 'executing' ? 'Working on it...' :
              status === 'thinking' ? 'AI is thinking...' :
              "Type a command (e.g. 'Show today's schedule')"
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
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
          AI Autopilot uses your business data to help manage scheduling, invoicing, and clients
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
    return formatToolCallLabel(tc.function.name, args);
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
            {toolCallLabels[0] || 'Running...'}
          </p>
          {toolCallLabels.length > 1 && (
            <p className="text-[10px] text-violet-500 dark:text-violet-400">
              +{toolCallLabels.length - 1} more action{toolCallLabels.length > 2 ? 's' : ''}
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
                    {tc.function.name}
                  </span>
                  {resultData?.success ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : resultData && !resultData.success ? (
                    <X className="w-3 h-3 text-red-500" />
                  ) : null}
                </div>
                {Object.keys(args).length > 0 && (
                  <div className="text-gray-500 dark:text-gray-400 mb-1">
                    {Object.entries(args).map(([k, v]) => (
                      <span key={k} className="inline-block mr-2">
                        <span className="font-medium text-gray-600 dark:text-gray-300">{k}:</span>{' '}
                        {Array.isArray(v) ? `[${v.length} items]` : String(v).slice(0, 50)}
                      </span>
                    ))}
                  </div>
                )}
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
      {allSuccess ? 'Done' : 'Error'}
    </span>
  );
}

/** Human-readable label for a tool call */
function formatToolCallLabel(name, args) {
  switch (name) {
    case 'getTodaySchedule': return 'Checking schedule';
    case 'getSchedule': return `Schedule: ${args.startDate || ''} – ${args.endDate || ''}`;
    case 'rescheduleJobs': return `Moving ${args.jobIds?.length || '?'} jobs to ${args.newDate || '?'}`;
    case 'runRainDelay': return `Rain delay — moving today to tomorrow`;
    case 'searchClients': return `Searching: "${args.query || ''}"`;
    case 'getClientInfo': return `Looking up: ${args.clientName || ''}`;
    case 'getClientHistory': return `History for: ${args.clientName || ''}`;
    case 'getUnpaidInvoices': return 'Checking unpaid invoices';
    case 'createInvoice': return `Invoice: ${args.clientName || ''} — $${args.amount || 0}`;
    case 'sendPaymentReminders': return 'Sending payment reminders';
    case 'getRevenue': return `Revenue: ${args.period || ''}`;
    case 'createJob': return `Schedule: ${args.service || ''} for ${args.clientName || ''}`;
    case 'updateJobStatus': return `Marking job as ${args.status || ''}`;
    case 'invoiceCompletedJobs': return `Invoicing for ${args.date || 'today'}`;
    default: return name;
  }
}

/** Simple markdown-like formatting for message content — safe against XSS */
function FormatContent({ content, isUser }) {
  if (!content) return null;

  // Escape HTML entities first, then apply our own formatting
  const lines = content.split('\n');
  return lines.map((line, i) => {
    // 1. Escape any HTML to prevent XSS from LLM responses
    const escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    // 2. Bold
    const bolded = escaped.replace(/\*\*(.*?)\*\*/g, (_, text) =>
      `<strong class="${isUser ? 'text-white' : 'text-gray-900 dark:text-white'} font-semibold">${text}</strong>`
    );
    // 3. Inline code
    const coded = bolded.replace(/`(.*?)`/g, (_, text) =>
      `<code class="${isUser ? 'bg-emerald-700/50' : 'bg-gray-200 dark:bg-gray-700'} px-1 py-0.5 rounded text-xs font-mono">${text}</code>`
    );
    return (
      <span key={i}>
        <span dangerouslySetInnerHTML={{ __html: coded }} />
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

/** Safe JSON parse */
function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}
