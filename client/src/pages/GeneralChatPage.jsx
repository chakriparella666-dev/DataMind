import React, { useState, useRef } from 'react';
import { Send, Bot, User, Sparkles, MessageSquare, Mic, MicOff, Edit2, RotateCcw, Plus, Image, X, Trash2 } from 'lucide-react';
import FormattedMarkdown from '../components/FormattedMarkdown';
import { sendChatMessage } from '../services/api';

export default function GeneralChatPage({ onAddSession, messages: propMessages, setMessages: propSetMessages }) {
  const [localMessages, setLocalMessages] = useState([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Hello! How can I help you with your database or software engineering questions today? Whether you need help writing a complex SQL query, designing a normalized database schema, optimizing performance, or anything else, just let me know!'
    }
  ]);

  const messages = propMessages || localMessages;
  const setMessages = propSetMessages || setLocalMessages;
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Attached File / Image State
  const [attachedImage, setAttachedImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'agent',
        text: 'Hello! How can I help you with your database or software engineering questions today? Whether you need help writing a complex SQL query, designing a normalized database schema, optimizing performance, or anything else, just let me know!'
      }
    ]);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setAttachedImage(selectedFile);
    }
  };

  // Voice Input Speech Recognition
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice speech recognition is supported in Google Chrome, Microsoft Edge, and Safari.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('Voice input error:', err);
      setIsListening(false);
    }
  };

  // Undo / Delete Question and Answer
  const handleUndoMessage = (msgId) => {
    setMessages(prev => {
      const index = prev.findIndex(m => m.id === msgId);
      if (index === -1) return prev;
      const newMsgs = [...prev];
      if (newMsgs[index + 1] && newMsgs[index + 1].sender === 'agent') {
        newMsgs.splice(index, 2);
      } else {
        newMsgs.splice(index, 1);
      }
      return newMsgs;
    });
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if ((!input.trim() && !attachedImage) || loading) return;

    let userText = input.trim();
    if (attachedImage) {
      userText = `[Attached File: ${attachedImage.name}] ` + userText;
    }

    setInput('');
    setAttachedImage(null);
    const userMsg = { id: 'u_' + Date.now(), sender: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);
    onAddSession?.(userText);
    setLoading(true);

    try {
      const res = await sendChatMessage({
        message: userText,
        history: messages,
        mode: 'general'
      });

      const botReplyText = res.text || res.reply || res.message || 'How can I assist you with your database or software engineering questions today?';
      const botMsg = {
        id: 'b_' + Date.now(),
        sender: 'agent',
        text: botReplyText
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = {
        id: 'err_' + Date.now(),
        sender: 'agent',
        text: `Error connecting to DataMind AI service: ${err.response?.data?.error || err.message}`
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#18181b] text-slate-100 overflow-hidden font-sans select-none antialiased min-w-0 max-w-full">
      {/* Top Header */}
      <header className="px-4 md:px-6 py-3.5 md:py-4 border-b border-[#2e2e36] bg-[#222226] flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="p-2 md:p-2.5 rounded-xl bg-[#18181b] text-white border border-[#383842] shadow-sm shrink-0">
            <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-2xl font-extrabold text-white tracking-tight truncate">General AI Chatbot</h2>
            <p className="text-xs md:text-base text-indigo-400 font-semibold truncate">Ask SQL questions, syntax help, and database advice</p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="px-3 md:px-4 py-2 bg-[#18181b] hover:bg-rose-950/60 border border-[#383842] hover:border-rose-800/80 text-zinc-300 hover:text-rose-300 text-xs md:text-sm font-bold rounded-xl transition cursor-pointer flex items-center space-x-2 shadow-sm active:scale-[0.98] shrink-0"
        >
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span className="hidden sm:inline">Clear chat</span>
        </button>
      </header>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 md:p-8 space-y-4 md:space-y-6 min-w-0 max-w-full overflow-x-hidden">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex items-start space-x-2.5 md:space-x-4 max-w-5xl mx-auto min-w-0 w-full ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse group' : ''}`}
          >
            <div
              className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 shadow-md ${msg.sender === 'user'
                  ? 'bg-white text-black font-black'
                  : 'bg-[#222226] border border-[#383842] text-white'
                }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4 md:w-5 md:h-5 text-black" /> : <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />}
            </div>

            {msg.sender === 'user' ? (
              <div className="flex flex-col items-end space-y-2 max-w-[85%] md:max-w-xl min-w-0">
                <div className="px-3.5 md:px-5 py-2.5 md:py-4 bg-[#262630] border border-[#3d3d4d] text-slate-100 font-medium rounded-2xl rounded-tr-none text-xs md:text-base leading-relaxed shadow-lg break-words overflow-hidden max-w-full">
                  {msg.text}
                </div>
                <div className="flex items-center space-x-2 text-xs text-zinc-400 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setInput(msg.text.replace(/^\[Attached File: [^\]]+\]\s*/, ''))}
                    className="hover:text-white flex items-center space-x-1.5 bg-[#222226] hover:bg-[#2a2a30] px-2.5 py-1 rounded-lg border border-[#383842] text-zinc-300 font-semibold transition cursor-pointer text-xs"
                    title="Rewrite / Edit Question"
                  >
                    <Edit2 className="w-3 h-3 text-zinc-400" />
                    <span>Rewrite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUndoMessage(msg.id)}
                    className="hover:text-rose-400 flex items-center space-x-1.5 bg-[#222226] hover:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-[#383842] hover:border-rose-900/60 text-zinc-300 font-semibold transition cursor-pointer text-xs"
                    title="Undo Question and Answer"
                  >
                    <RotateCcw className="w-3 h-3 text-zinc-400" />
                    <span>Undo</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-3.5 md:px-6 py-3.5 md:py-5 bg-[#222226] border border-[#2e2e36] text-slate-100 font-medium rounded-2xl rounded-tl-none max-w-[90%] md:max-w-3xl leading-relaxed shadow-lg space-y-3 text-xs md:text-base min-w-0 overflow-hidden break-words">
                <FormattedMarkdown content={msg.text} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-3 max-w-5xl mx-auto pl-1">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#222226] border border-[#383842] flex items-center justify-center text-white shrink-0 shadow-md">
              <Bot className="w-4 h-4 md:w-5 md:h-5 text-white animate-pulse" />
            </div>
            <div className="px-4 py-2.5 md:px-5 md:py-3.5 bg-[#222226] border border-[#2e2e36] rounded-2xl text-xs md:text-sm font-semibold text-indigo-400 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
              <span>DataMind AI is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <footer className="p-3 md:p-6 pb-4 md:pb-6 border-t border-[#2e2e36] bg-[#222226] shrink-0 z-20">
        <form onSubmit={handleSend} className="max-w-5xl mx-auto flex flex-col space-y-2.5">

          {attachedImage && (
            <div className="flex items-center space-x-2 bg-[#18181b] px-3 py-1.5 rounded-xl border border-[#383842] w-max">
              <Image className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-zinc-200">{attachedImage.name}</span>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center space-x-2 md:space-x-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 md:p-3 bg-[#18181b] hover:bg-[#28282e] text-zinc-300 hover:text-white rounded-xl border border-[#383842] transition cursor-pointer shrink-0"
              title="Attach File or Image"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            <div className="flex-1 relative min-w-0">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask a SQL question..."
                className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none text-white text-xs md:text-base font-medium rounded-xl px-3.5 md:px-5 py-2.5 md:py-3.5 pr-10 md:pr-12 transition shadow-inner"
              />
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg transition cursor-pointer ${isListening
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'text-zinc-400 hover:text-white'
                  }`}
                title="Voice Input"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={(!input.trim() && !attachedImage) || loading}
              className="p-2.5 md:p-3.5 bg-white hover:bg-zinc-200 text-black font-black rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
