import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Sparkles, Minimize2, Maximize2, Trash2, Copy, Check } from 'lucide-react';
import api from '../utils/api';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

const AIWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: 'Hello! 👋 I am your AByte AI Assistant. How can I help you today? I can assist you with:\n\n• Sales inquiries\n• Stock management\n• Profit analysis\n• Product information\n• Customer data\n\nFeel free to ask in English or Urdu!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/ai/chat', {
        message: userMsg.text,
        history: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        })).slice(-10) // Send last 10 messages for better context
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.data.reply,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sorry, I'm having trouble connecting to the server. Please try again later. 😔",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear all messages?')) {
      setMessages([
        {
          id: '1',
          role: 'model',
          text: 'Hello! 👋 I am your AByte AI Assistant. How can I help you today? I can assist you with:\n\n• Sales inquiries\n• Stock management\n• Profit analysis\n• Product information\n• Customer data\n\nFeel free to ask in English or Urdu!',
          timestamp: new Date()
        }
      ]);
    }
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatMessageText = (text: string) => {
    // Convert markdown-style formatting to HTML
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Bullet points
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return (
          <div key={idx} className="flex gap-2 ml-2">
            <span className="text-blue-500 font-bold">•</span>
            <span>{line.replace(/^[•\-]\s*/, '')}</span>
          </div>
        );
      }
      // Bold text (wrapped in **)
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <div key={idx}>
            {parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
            )}
          </div>
        );
      }
      // Regular text
      return line ? <div key={idx}>{line}</div> : <div key={idx} className="h-2"></div>;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className={`mb-4 bg-white rounded-2xl shadow-2xl border-2 border-blue-200 flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? 'w-80 h-16' : 'w-[450px] h-[650px]'
          } animate-in fade-in slide-in-from-bottom-10 duration-300`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 p-4 text-white flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center animate-pulse">
                  <Bot size={24} className="text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-blue-700 animate-pulse"></div>
              </div>
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  AByte AI Assistant
                  <Sparkles size={16} className="text-yellow-300 animate-pulse" />
                </h3>
                <span className="text-xs text-blue-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Always Online • Ready to Help
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
              </button>
              {!isMinimized && (
                <button
                  onClick={handleClearChat}
                  className="hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                  title="Clear Chat"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages - Only show when not minimized */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-gray-50 to-white space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group`}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md ${msg.role === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                        : 'bg-gradient-to-br from-green-400 to-emerald-500 text-white'
                      }`}>
                      {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                    </div>

                    {/* Message Content */}
                    <div className="flex flex-col max-w-[75%]">
                      <div className={`p-4 rounded-2xl text-sm shadow-md transition-all duration-200 ${msg.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none'
                          : 'bg-white text-gray-800 border-2 border-gray-100 rounded-tl-none hover:shadow-lg'
                        }`}>
                        <div className="space-y-1 leading-relaxed">
                          {msg.role === 'model' ? formatMessageText(msg.text) : msg.text}
                        </div>
                      </div>

                      {/* Message Footer */}
                      <div className={`flex items-center gap-2 mt-1 px-2 text-xs text-gray-400 ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}>
                        <span>{formatTime(msg.timestamp)}</span>
                        {msg.role === 'model' && (
                          <button
                            onClick={() => handleCopyMessage(msg.text, msg.id)}
                            className="opacity-0 group-hover:opacity-100 hover:text-blue-600 transition-all duration-200 p-1 hover:bg-blue-50 rounded"
                            title="Copy message"
                          >
                            {copiedId === msg.id ? (
                              <Check size={12} className="text-green-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading Indicator */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Bot size={18} />
                    </div>
                    <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-md border-2 border-gray-100">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"></span>
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t-2 border-gray-100">
                <div className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Ask anything about your business..."
                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all placeholder-gray-400"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg disabled:shadow-none transform hover:scale-105 disabled:scale-100"
                    title="Send message"
                  >
                    <Send size={20} />
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-400 text-center">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd> to send
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setIsMinimized(false);
        }}
        className={`relative p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${isOpen
            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white rotate-90'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white animate-bounce'
          }`}
        title={isOpen ? "Close Chat" : "Open AI Assistant"}
      >
        {isOpen ? (
          <X size={28} />
        ) : (
          <>
            <MessageCircle size={28} />
            {/* Notification Badge */}
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            {/* Pulse Effect */}
            <span className="absolute inset-0 rounded-full bg-blue-400 opacity-20 animate-ping"></span>
          </>
        )}
      </button>

      {/* Floating Hint - Only show when closed */}
      {!isOpen && (
        <div className="absolute bottom-20 right-0 bg-white text-gray-800 px-4 py-2 rounded-lg shadow-xl border-2 border-blue-200 text-sm font-medium animate-in slide-in-from-right-5 duration-300 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600" />
            Need help? Ask me anything!
          </div>
          <div className="absolute top-1/2 -right-2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-8 border-l-blue-200 -translate-y-1/2"></div>
        </div>
      )}
    </div>
  );
};

export default AIWidget;