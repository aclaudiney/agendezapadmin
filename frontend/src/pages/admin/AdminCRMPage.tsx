/**
 * ADMIN CRM PAGE - AGENDEZAP
 * Layout de 3 colunas: Empresas -> Conversas -> Mensagens
 */

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, User, Send, Loader, Search, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';
import { supabase } from '../../services/supabaseClient';

interface Company {
  id: string;
  name: string;
  whatsapp_connected?: boolean;
}

interface Conversation {
  client_jid: string;
  client_name: string | null;
  last_message: string;
  last_message_at: string;
}

interface Message {
  id: string;
  body: string;
  direction: 'incoming' | 'outgoing';
  timestamp: string;
}

export default function AdminCRMPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedJid, setSelectedJid] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);

  // 1. CARREGAR EMPRESAS
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoading(true);
        const { data: empresas, error } = await supabase
          .from('companies')
          .select('id, name, active')
          .order('name', { ascending: true });
        
        if (error) throw error;
        
        const empresasComStatus = await Promise.all(
          (empresas || []).map(async (emp) => {
            const { data: session } = await supabase
              .from('whatsapp_sessions')
              .select('status')
              .eq('company_id', emp.id)
              .maybeSingle();
            
            return { 
              ...emp, 
              whatsapp_connected: session?.status === 'open' || session?.status === 'connected' 
            };
          })
        );
        
        setCompanies(empresasComStatus);
      } catch (error) {
        console.error('Erro ao carregar empresas:', error);
        toast.error('Erro ao carregar empresas');
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    };
    loadCompanies();
  }, []);

  // 2. CARREGAR CONVERSAS (Sem duplicatas)
  useEffect(() => {
    if (!selectedCompanyId) return;

    const loadConversations = async () => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('client_jid, client_name, body, timestamp')
          .eq('company_id', selectedCompanyId)
          .order('timestamp', { ascending: false });

        if (error) throw error;

        const convMap = (data || []).reduce((acc: any, m: any) => {
          if (!acc[m.client_jid] || new Date(m.timestamp) > new Date(acc[m.client_jid].last_message_at)) {
            acc[m.client_jid] = {
              client_jid: m.client_jid,
              client_name: m.client_name,
              last_message: m.body,
              last_message_at: m.timestamp
            };
          }
          return acc;
        }, {});

        setConversations(Object.values(convMap));
      } catch (error) {
        console.error('Erro ao carregar conversas:', error);
      }
    };

    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [selectedCompanyId]);

  // 3. CARREGAR MENSAGENS
  useEffect(() => {
    if (!selectedCompanyId || !selectedJid) return;

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('id, body, direction, timestamp')
          .eq('company_id', selectedCompanyId)
          .eq('client_jid', selectedJid)
          .order('timestamp', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [selectedCompanyId, selectedJid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim() || !selectedCompanyId || !selectedJid || sending) return;

    setSending(true);
    try {
      // Aqui chamaria a API para enviar via WhatsApp
      // Por enquanto, apenas simulamos ou salvamos no banco
      const { error } = await supabase.from('whatsapp_messages').insert({
        company_id: selectedCompanyId,
        client_jid: selectedJid,
        body: msgInput,
        direction: 'outgoing',
        timestamp: new Date().toISOString()
      });

      if (error) throw error;
      setMsgInput('');
      toast.success('Mensagem enviada');
    } catch (error) {
      console.error('Erro ao enviar:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">CRM Global</h1>
        <p className="text-slate-500 text-sm">Monitoramento de todas as empresas</p>
      </div>

      <div className="flex-1 flex border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm">
        
        {/* COLUNA 1: EMPRESAS */}
        <div className="w-64 border-r border-slate-100 flex flex-col bg-slate-50/50">
          <div className="p-4 border-b border-slate-100 bg-white">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Empresas</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCompanyId(c.id);
                  setSelectedJid('');
                  setMessages([]);
                }}
                className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between group ${selectedCompanyId === c.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-white'}`}
              >
                <div className="truncate">
                  <p className="font-bold text-sm truncate">{c.name}</p>
                  <p className={`text-[10px] ${selectedCompanyId === c.id ? 'text-white/60' : 'text-slate-400'}`}>ID: {c.id.substring(0,8)}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${c.whatsapp_connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* COLUNA 2: CONVERSAS */}
        <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/30">
          <div className="p-4 border-b border-slate-100 bg-white">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Conversas</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {!selectedCompanyId ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 p-4 text-center">
                <Search size={32} className="mb-2 opacity-20" />
                <p className="text-xs font-bold">Selecione uma empresa</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 p-4 text-center">
                <MessageSquare size={32} className="mb-2 opacity-20" />
                <p className="text-xs font-bold">Nenhuma conversa</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.client_jid}
                  onClick={() => setSelectedJid(conv.client_jid)}
                  className={`w-full p-4 rounded-2xl text-left transition-all border ${selectedJid === conv.client_jid ? 'bg-white border-indigo-100 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/50'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-slate-800 text-sm truncate flex-1">{conv.client_name || 'Cliente'}</p>
                    <span className="text-[10px] font-bold text-slate-400 ml-2">
                      {new Date(conv.last_message_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mb-1 truncate">{conv.client_jid}</p>
                  <p className="text-xs text-slate-500 truncate italic">"{conv.last_message}"</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* COLUNA 3: MENSAGENS */}
        <div className="flex-1 flex flex-col bg-white">
          {!selectedJid ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <MessageSquare size={64} className="mb-4 opacity-10" />
              <p className="font-bold text-lg">Chat</p>
              <p className="text-sm">Selecione uma conversa para visualizar</p>
            </div>
          ) : (
            <>
              {/* Header Chat */}
              <div className="p-4 border-b border-slate-50 flex items-center gap-3 bg-white">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <User size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {conversations.find(c => c.client_jid === selectedJid)?.client_name || 'Cliente'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">{selectedJid}</p>
                </div>
              </div>

              {/* Lista de Mensagens */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm shadow-sm ${msg.direction === 'outgoing' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                      <div className={`flex items-center gap-2 mt-1.5 ${msg.direction === 'outgoing' ? 'text-white/50' : 'text-slate-400'}`}>
                        <span className="text-[10px] font-bold">
                          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!msgInput.trim() || sending}
                    className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:scale-95 active:scale-95"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
