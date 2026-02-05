/**
 * ADMIN CRM PAGE - AGENDEZAP
 * Visualização completa de conversas do WhatsApp
 * ✅ COM ENVIO DE MENSAGENS MANUAL
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, User, Clock, TrendingUp, Download, Send } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const API_URL = import.meta.env.VITE_API_URL;

// ✅ SUPABASE CLIENT
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Company {
  id: string;
  name: string;
  active: boolean;
}

interface Conversation {
  company_id: string;
  client_phone: string;
  client_name: string | null;
  message_count: number;
  last_message_at: string;
  last_incoming_message: string | null;
  last_outgoing_message: string | null;
}

interface Message {
  id: string;
  message_text: string;
  direction: 'incoming' | 'outgoing';
  message_type: string;
  created_at: string;
  extracted_data: any;
  conversation_type: string | null;
}

interface Stats {
  total: number;
  incoming: number;
  outgoing: number;
  today: number;
}

export default function AdminCRMPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, incoming: 0, outgoing: 0, today: 0 });
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // ============================================
  // FUNÇÕES DE CARREGAMENTO
  // ============================================

  const loadCompanies = async () => {
    try {
      console.log('📊 [CRM] Buscando empresas do Supabase...');
      
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, active')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('❌ Erro ao buscar empresas:', error);
        return;
      }

      console.log('✅ Empresas carregadas:', data?.length);
      setCompanies(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar empresas:', error);
    }
  };

  const loadConversations = async () => {
    setLoading(true);
    try {
      console.log('📊 [CRM] Buscando conversas...');
      
      const res = await axios.get(`${API_URL}/api/crm/conversations/${selectedCompanyId}`);
      
      console.log('✅ [CRM] Conversas:', res.data.data?.length || 0);
      setConversations(res.data.data || []);
    } catch (error: any) {
      console.error('❌ [CRM] Erro ao carregar conversas:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      console.log('📊 [CRM] Buscando mensagens...');
      
      const res = await axios.get(`${API_URL}/api/crm/messages/${selectedCompanyId}/${selectedPhone}`);
      
      console.log('✅ [CRM] Mensagens:', res.data.data?.length || 0);
      setMessages(res.data.data || []);
    } catch (error: any) {
      console.error('❌ [CRM] Erro ao carregar mensagens:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/crm/stats/${selectedCompanyId}`);
      setStats(res.data.data);
    } catch (error) {
      console.error('❌ [CRM] Erro ao carregar estatísticas:', error);
    }
  };

  const exportarConversa = () => {
    const texto = messages.map(m => {
      const data = new Date(m.created_at).toLocaleString('pt-BR');
      const tipo = m.direction === 'incoming' ? 'Cliente' : 'IA';
      return `[${data}] ${tipo}: ${m.message_text}`;
    }).join('\n\n');

    const blob = new Blob([texto], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa_${selectedPhone}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  // ✅ ENVIAR MENSAGEM MANUAL
  const enviarMensagem = async () => {
    if (!newMessage.trim()) {
      alert('Digite uma mensagem!');
      return;
    }

    if (!selectedCompanyId || !selectedPhone) {
      alert('Selecione uma conversa primeiro!');
      return;
    }

    setSending(true);
    try {
      console.log('📤 [CRM] Enviando mensagem...');
      
      const res = await axios.post(`${API_URL}/api/crm/send-message`, {
        companyId: selectedCompanyId,
        clientPhone: selectedPhone,
        message: newMessage
      });

      if (res.data.success) {
        console.log('✅ [CRM] Mensagem enviada!');
        
        // Adicionar mensagem localmente
        const novaMensagem: Message = {
          id: `temp-${Date.now()}`,
          message_text: newMessage,
          direction: 'outgoing',
          message_type: 'text',
          created_at: new Date().toISOString(),
          extracted_data: null,
          conversation_type: 'manual_crm'
        };
        
        setMessages([...messages, novaMensagem]);
        setNewMessage('');
        
        // Recarregar mensagens após 1 segundo
        setTimeout(() => {
          loadMessages();
          loadConversations(); // Atualizar última mensagem
        }, 1000);
      }
    } catch (error: any) {
      console.error('❌ [CRM] Erro ao enviar:', error);
      alert(error.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadConversations();
      loadStats();
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId && selectedPhone) {
      loadMessages();
    }
  }, [selectedCompanyId, selectedPhone]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Seletor de Empresa */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione a Empresa
        </label>
        <select
          value={selectedCompanyId}
          onChange={(e) => {
            setSelectedCompanyId(e.target.value);
            setSelectedPhone('');
            setMessages([]);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Selecione uma empresa --</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        
        {companies.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Nenhuma empresa encontrada
          </p>
        )}
      </div>

      {selectedCompanyId && (
        <>
          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Mensagens</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Recebidas</p>
                  <p className="text-3xl font-bold text-green-600">{stats.incoming}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Enviadas</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.outgoing}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Hoje</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.today}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Layout 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de Conversas */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Conversas ({conversations.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {loading && !selectedPhone ? (
                  <div className="p-8 text-center text-gray-500">Carregando...</div>
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Nenhuma conversa encontrada
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.client_phone}
                      onClick={() => setSelectedPhone(conv.client_phone)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                        selectedPhone === conv.client_phone ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conv.client_name || 'Cliente'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {conv.client_phone}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {conv.last_incoming_message}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs text-gray-500">
                            {new Date(conv.last_message_at).toLocaleDateString('pt-BR')}
                          </p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                            {conv.message_count}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Conversa Selecionada */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow flex flex-col" style={{ height: '700px' }}>
              {selectedPhone ? (
                <>
                  {/* Header da Conversa */}
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {conversations.find(c => c.client_phone === selectedPhone)?.client_name || 'Cliente'}
                      </h3>
                      <p className="text-sm text-gray-500">{selectedPhone}</p>
                    </div>
                    <button
                      onClick={exportarConversa}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      <span>Exportar</span>
                    </button>
                  </div>

                  {/* Mensagens */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                      <div className="text-center text-gray-500 py-8">Carregando...</div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        Nenhuma mensagem encontrada
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              msg.direction === 'outgoing'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                            <div className="flex items-center justify-between mt-1 space-x-2">
                              <p className="text-xs opacity-75">
                                {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {msg.conversation_type && (
                                <span className="text-xs px-2 py-0.5 rounded bg-white bg-opacity-20">
                                  {msg.conversation_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* ✅ CAMPO DE ENVIO DE MENSAGEM */}
                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-end space-x-2">
                      <div className="flex-1">
                        <textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              enviarMensagem();
                            }
                          }}
                          placeholder="Digite sua mensagem... (Enter para enviar)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={2}
                          disabled={sending}
                        />
                      </div>
                      <button
                        onClick={enviarMensagem}
                        disabled={sending || !newMessage.trim()}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors h-[60px] ${
                          sending || !newMessage.trim()
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <Send className="h-5 w-5" />
                        <span>{sending ? 'Enviando...' : 'Enviar'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Dica: Pressione Enter para enviar, Shift+Enter para nova linha
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p>Selecione uma conversa para visualizar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
