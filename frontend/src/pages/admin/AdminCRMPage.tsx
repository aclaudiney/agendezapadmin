/**
 * ADMIN CRM PAGE - AGENDEZAP
 * Gestão completa de empresas e visualização de conversas
 */

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, User, Clock, TrendingUp, Download, Send, 
  Loader, AlertCircle, Building2, Eye, Trash2, Lock, Unlock, 
  Search, Filter, Plus, X, Check, DollarSign, CreditCard,
  Mail, Phone, Calendar as CalendarIcon, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

interface Company {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  email?: string;
  whatsapp_number?: string;
  setup_fee?: number;
  monthly_fee?: number;
  subscription_status?: string;
  created_at: string;
  stats?: {
    total_clientes: number;
    total_profissionais: number;
    total_servicos: number;
  };
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

export default function AdminCRMPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // ============================================
  // FUNÇÕES DE CARREGAMENTO
  // ============================================

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await adminService.listarEmpresas();
      const companiesData = res.companies || [];
      setCompanies(companiesData);
      setFilteredCompanies(companiesData);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (companyId: string) => {
    try {
      const data = await adminService.buscarConversasCRM(companyId);
      setConversations(data || []);
    } catch (error) {
      setConversations([]);
    }
  };

  const loadMessages = async (companyId: string, phone: string) => {
    try {
      const data = await adminService.buscarMensagensCRM(companyId, phone);
      setMessages(data || []);
    } catch (error) {
      setMessages([]);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    const filtered = companies.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCompanies(filtered);
  }, [searchTerm, companies]);

  // ============================================
  // AÇÕES
  // ============================================

  const handleVerDetalhes = async (company: Company) => {
    try {
      const res = await adminService.getEmpresa(company.id);
      setSelectedCompany(res.empresa);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Erro ao carregar detalhes da empresa');
    }
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setEditFormData({
      name: company.name,
      setup_fee: company.setup_fee || 0,
      monthly_fee: company.monthly_fee || 0,
      subscription_status: company.subscription_status || 'active',
      active: company.active
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCompany) return;
    setSaving(true);
    try {
      await adminService.atualizarEmpresa(selectedCompany.id, editFormData);
      await loadCompanies();
      setShowEditModal(false);
      toast.success('Empresa atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!window.confirm(`ATENÇÃO: Você está prestes a DESATIVAR a empresa "${company.name}".\n\nIsso irá bloquear o acesso da empresa ao sistema.\n\nDeseja continuar?`)) return;

    try {
      await adminService.desativarEmpresa(company.id);
      await loadCompanies();
      toast.success('Empresa excluída com sucesso');
    } catch (error: any) {
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const handleToggleActive = async (company: Company) => {
    const action = company.active ? 'bloquear' : 'ativar';
    if (!window.confirm(`Deseja realmente ${action} a empresa "${company.name}"?`)) return;

    try {
      await adminService.atualizarEmpresa(company.id, { active: !company.active });
      await loadCompanies();
      toast.success(`Empresa ${company.active ? 'bloqueada' : 'ativada'} com sucesso!`);
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleOpenCRM = (company: Company) => {
    setSelectedCompany(company);
    loadConversations(company.id);
    setSelectedPhone('');
    setMessages([]);
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string | undefined) => {
    const s = status?.toLowerCase() || 'active';
    switch (s) {
      case 'active':
      case 'pago':
        return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border border-emerald-200">PAGO/ATIVO</span>;
      case 'trial':
      case 'teste':
        return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border border-blue-200">TESTE</span>;
      case 'overdue':
      case 'inadimplente':
        return <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border border-rose-200">PENDENTE</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border border-slate-200">{s.toUpperCase()}</span>;
    }
  };

  // ================================= RENDER =================================

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-10 animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão de Empresas</h1>
          <p className="text-slate-500 mt-1">Controle total sobre as empresas parceiras e suporte via CRM.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* LISTA DE EMPRESAS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Assinatura</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Faturamento</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Acesso</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredCompanies.map((company) => (
              <tr key={company.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
                      {company.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{company.name}</p>
                      <p className="text-xs text-slate-400 font-medium">ID: {company.id.substring(0, 8)}...</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  {getStatusBadge(company.subscription_status)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{formatarMoeda(company.monthly_fee || 0)}/mês</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Setup: {formatarMoeda(company.setup_fee || 0)}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${company.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${company.active ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    {company.active ? 'LIBERADO' : 'BLOQUEADO'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleVerDetalhes(company)}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                      title="Ver Detalhes"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => handleEditCompany(company)}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-amber-600 transition-all"
                      title="Editar Assinatura"
                    >
                      <Info size={18} />
                    </button>
                    <button 
                      onClick={() => handleOpenCRM(company)}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                      title="Abrir CRM"
                    >
                      <MessageSquare size={18} />
                    </button>
                    <button 
                      onClick={() => handleToggleActive(company)}
                      className={`p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all ${company.active ? 'text-slate-400 hover:text-amber-600' : 'text-slate-400 hover:text-emerald-600'}`}
                      title={company.active ? 'Bloquear Acesso' : 'Desbloquear Acesso'}
                    >
                      {company.active ? <Lock size={18} /> : <Unlock size={18} />}
                    </button>
                    <button 
                      onClick={() => handleDeleteCompany(company)}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                      title="Excluir Empresa"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCompanies.length === 0 && (
          <div className="py-20 text-center">
            <Building2 size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">Nenhuma empresa encontrada.</p>
          </div>
        )}
      </div>

      {/* MODAL: CRM WHATSAPP (Aparece abaixo se selecionado) */}
      {selectedCompany && !showDetailModal && !showEditModal && conversations.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-500">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-900 text-white">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-white/10 rounded-xl">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold">CRM: {selectedCompany.name}</h3>
                <p className="text-white/60 text-xs font-medium">Monitoramento em tempo real de conversas</p>
              </div>
            </div>
            <button onClick={() => setSelectedCompany(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 h-[600px]">
            {/* Lista de Conversas */}
            <div className="lg:col-span-1 border-right border-slate-100 overflow-y-auto bg-slate-50/50">
              <div className="p-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Conversas Ativas</h4>
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <button
                      key={conv.client_phone}
                      onClick={() => {
                        setSelectedPhone(conv.client_phone);
                        loadMessages(selectedCompany.id, conv.client_phone);
                      }}
                      className={`w-full p-4 rounded-2xl text-left transition-all border ${selectedPhone === conv.client_phone ? 'bg-white border-indigo-100 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/50'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-slate-800 text-sm truncate pr-2">{conv.client_name || 'Cliente'}</p>
                        <span className="text-[10px] font-bold text-slate-400">{formatarData(conv.last_message_at)}</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mb-2">{conv.client_phone}</p>
                      <p className="text-xs text-slate-400 truncate italic">"{conv.last_incoming_message || conv.last_outgoing_message}"</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat */}
            <div className="lg:col-span-2 flex flex-col bg-white">
              {selectedPhone ? (
                <>
                  <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-white z-10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{conversations.find(c => c.client_phone === selectedPhone)?.client_name || 'Cliente'}</p>
                        <p className="text-xs text-slate-400 font-medium">{selectedPhone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-sm ${msg.direction === 'outgoing' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.message_text}</p>
                          <div className={`flex items-center gap-2 mt-1.5 ${msg.direction === 'outgoing' ? 'text-white/50' : 'text-slate-400'}`}>
                            <span className="text-[10px] font-bold">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            {msg.conversation_type === 'manual_crm' && <span className="text-[9px] font-black uppercase tracking-tighter bg-white/10 px-1 rounded">MANUAL</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                  <MessageSquare size={64} className="mb-4 opacity-20" />
                  <p className="font-bold text-lg">Selecione uma conversa</p>
                  <p className="text-sm">Clique em um cliente para ver o histórico</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES (OLHINHO) */}
      {showDetailModal && selectedCompany && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="relative h-32 bg-slate-900">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                <X size={24} />
              </button>
              <div className="absolute -bottom-12 left-10">
                <div className="h-24 w-24 rounded-3xl bg-white p-1.5 shadow-xl">
                  <div className="h-full w-full rounded-2xl bg-slate-900 flex items-center justify-center text-white text-3xl font-black">
                    {selectedCompany.name.substring(0, 2).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-16 pb-10 px-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedCompany.name}</h2>
                  <p className="text-slate-500 font-bold text-sm mt-1 uppercase tracking-widest">Empresa Parceira</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(selectedCompany.subscription_status)}
                  <p className="text-xs text-slate-400 font-bold mt-2 uppercase">Status Global</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-indigo-50 transition-colors">
                      <Mail size={18} className="text-slate-600 group-hover:text-indigo-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">E-mail</span>
                  </div>
                  <p className="font-bold text-slate-800 break-all">{selectedCompany.email || `${selectedCompany.slug}@agendezap.com`}</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-emerald-50 transition-colors">
                      <Phone size={18} className="text-slate-600 group-hover:text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">WhatsApp</span>
                  </div>
                  <p className="font-bold text-slate-800">{selectedCompany.whatsapp_number || 'Não cadastrado'}</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-blue-50 transition-colors">
                      <CalendarIcon size={18} className="text-slate-600 group-hover:text-blue-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cadastro</span>
                  </div>
                  <p className="font-bold text-slate-800">{formatarData(selectedCompany.created_at)}</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-amber-50 transition-colors">
                      <DollarSign size={18} className="text-slate-600 group-hover:text-amber-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Faturamento</span>
                  </div>
                  <p className="font-bold text-slate-800">{formatarMoeda(selectedCompany.monthly_fee || 0)}/mês</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
                >
                  Fechar
                </button>
                <button 
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEditCompany(selectedCompany);
                  }}
                  className="flex-1 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-lg shadow-slate-900/20 transition-all hover:scale-[1.02]"
                >
                  Editar Assinatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR ASSINATURA */}
      {showEditModal && selectedCompany && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Assinatura & Plano</h2>
                  <p className="text-slate-500 font-bold text-sm mt-1 uppercase tracking-widest">{selectedCompany.name}</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status da Assinatura</label>
                  <select 
                    value={editFormData.subscription_status}
                    onChange={(e) => setEditFormData({...editFormData, subscription_status: e.target.value})}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  >
                    <option value="active">Pago / Ativo</option>
                    <option value="trial">Período de Teste</option>
                    <option value="overdue">Inadimplente / Pendente</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Taxa de Setup</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                      <input 
                        type="number"
                        value={editFormData.setup_fee}
                        onChange={(e) => setEditFormData({...editFormData, setup_fee: parseFloat(e.target.value)})}
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mensalidade</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                      <input 
                        type="number"
                        value={editFormData.monthly_fee}
                        onChange={(e) => setEditFormData({...editFormData, monthly_fee: parseFloat(e.target.value)})}
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-2xl flex gap-3">
                  <Info className="text-indigo-600 flex-shrink-0" size={20} />
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    Alterar esses valores afetará apenas a cobrança e o controle administrativo. O acesso da empresa ao sistema é controlado pelo campo "Bloqueio de Acesso".
                  </p>
                </div>

                <button 
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-lg shadow-slate-900/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader className="animate-spin" size={20} /> : <Check size={20} />}
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
