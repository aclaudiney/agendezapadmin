
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, CheckCheck } from 'lucide-react';
import { processChatbotMessage } from '../services/geminiService';

const WhatsAppSim: React.FC = () => {
  const [messages, setMessages] = useState<{ text: string, sender: 'user' | 'bot', time: string }[]>([
    { text: "Olá! Como posso te ajudar hoje?", sender: 'bot', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { text: input, sender: 'user' as const, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await processChatbotMessage("+5511999999999", input);
      setMessages(prev => [...prev, { 
        text: response.reply, 
        sender: 'bot' as const, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        text: "Houve um erro no robô.", 
        sender: 'bot' as const, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-md mx-auto bg-[#E5DDD5] rounded-xl shadow-xl overflow-hidden border border-slate-300">
      <div className="bg-[#075E54] p-4 flex items-center gap-3 text-white shadow-md">
        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 overflow-hidden">
          <Bot size={24} />
        </div>
        <div>
          <h4 className="font-bold text-sm">Robô AgendeZap</h4>
          <p className="text-[10px] opacity-80">Online agora</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-2 rounded-lg text-sm shadow-sm relative ${
              m.sender === 'user' ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'
            }`}>
              <p className="pr-12 text-slate-800">{m.text}</p>
              <div className="absolute bottom-1 right-1 flex items-center gap-1">
                <span className="text-[9px] text-slate-400">{m.time}</span>
                {m.sender === 'user' && <CheckCheck size={12} className="text-blue-500" />}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-2 rounded-lg text-xs shadow-sm flex gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce [animation-delay:0.2s]">.</span>
              <span className="animate-bounce [animation-delay:0.4s]">.</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#F0F0F0] p-3 flex gap-2 border-t border-slate-200">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-white p-2 px-4 rounded-full text-sm outline-none border border-transparent focus:border-[#075E54] transition-all"
        />
        <button 
          onClick={handleSend}
          className="w-10 h-10 bg-[#075E54] text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default WhatsAppSim;
