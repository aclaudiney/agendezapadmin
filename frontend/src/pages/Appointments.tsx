import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, Filter, Download, MoreVertical, Plus, X, AlertCircle, Edit2, Check, CreditCard, Trash2 } from 'lucide-react';

const Appointments: React.FC = () => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [profissionalFiltro, setProfissionalFiltro] = useState('');
  const [dataFiltro, setDataFiltro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [erro, setErro] = useState('');

  // Estado para modal de pagamento
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<any>(null);
  const [formaPagamento, setFormaPagamento] = useState('');

  // Estado para edição de status
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoStatus, setNovoStatus] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    cliente_id: '',
    profissional_id: '',
    servico_id: '',
    data_agendamento: '',
    hora_agendamento: '',
    status: 'pendente',
  });

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ BUSCAR DADOS COM FILTRO POR COMPANY_ID
  const fetchData = async () => {
    try {
      setLoading(true);

      // ✅ PEGAR COMPANY_ID DO LOCALSTORAGE
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      console.log('🔍 Buscando dados para company_id:', companyId);

      // ✅ BUSCAR DADOS FILTRANDO POR COMPANY_ID
      const [agendamentosRes, clientesRes, profissionaisRes, servicosRes] = await Promise.all([
        supabase.from('agendamentos').select('*').eq('company_id', companyId),
        supabase.from('clientes').select('*').eq('company_id', companyId),
        supabase.from('profissionais').select('*').eq('company_id', companyId),
        supabase.from('servicos').select('*').eq('company_id', companyId),
      ]);

      setAgendamentos(agendamentosRes.data || []);
      setClientes(clientesRes.data || []);
      setProfissionais(profissionaisRes.data || []);
      setServicos(servicosRes.data || []);

      console.log('✅ Dados carregados');
    } catch (error) {
      setErro('Erro ao carregar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formData.cliente_id || !formData.profissional_id || !formData.servico_id || !formData.data_agendamento || !formData.hora_agendamento) {
      setErro('Preencha todos os campos');
      return;
    }

    try {
      // ✅ PEGAR COMPANY_ID
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      // ✅ PREPARAR DADOS
      const dataToInsert = {
        company_id: companyId,
        cliente_id: formData.cliente_id,
        profissional_id: formData.profissional_id,
        servico_id: formData.servico_id,
        data_agendamento: formData.data_agendamento,
        hora_agendamento: formData.hora_agendamento,
        status: formData.status,
        forma_pagamento: null,
        valor_pago: null,
        data_pagamento: null,
        origem: 'web',
      };

      console.log('📝 Inserindo dados:', dataToInsert);

      const { error } = await supabase.from('agendamentos').insert([dataToInsert]);

      if (error) {
        console.error('❌ Erro ao criar:', error);
        setErro(`Erro ao criar agendamento: ${error.message || 'Erro desconhecido'}`);
        return;
      }

      console.log('✅ Agendamento criado com sucesso!');

      setFormData({
        cliente_id: '',
        profissional_id: '',
        servico_id: '',
        data_agendamento: '',
        hora_agendamento: '',
        status: 'pendente',
      });
      setShowModal(false);
      await fetchData();
    } catch (error: any) {
      console.error('❌ Erro ao salvar agendamento:', error);
      setErro(error?.message || 'Erro ao salvar agendamento');
    }
  };

  // ✅ ATUALIZAR STATUS E ABRIR MODAL DE PAGAMENTO
  const handleAtualizarStatus = async (aptId: string, novoStatusValue: string) => {
    try {
      // ✅ PEGAR COMPANY_ID
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      // SE FOR CONFIRMADO, PEDIR FORMA DE PAGAMENTO
      if (novoStatusValue === 'confirmado') {
        const agendamento = agendamentos.find(a => a.id === aptId);
        setAgendamentoSelecionado(agendamento);
        setFormaPagamento('');
        setShowPagamentoModal(true);
        setEditandoId(null);
        return;
      }

      // PARA OUTROS STATUS, APENAS ATUALIZAR
      const updateData = {
        status: novoStatusValue
      };

      console.log('🔄 Atualizando com dados:', updateData);

      const { error } = await supabase
        .from('agendamentos')
        .update(updateData)
        .eq('id', aptId)
        .eq('company_id', companyId);

      if (error) {
        console.error('❌ Erro detalhado do Supabase:', error);
        setErro(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
        return;
      }

      console.log('✅ Atualização bem-sucedida!');

      setAgendamentos(agendamentos.map(apt =>
        apt.id === aptId ? { 
          ...apt, 
          status: novoStatusValue
        } : apt
      ));

      setEditandoId(null);
      setNovoStatus('');
      setErro('');
    } catch (error: any) {
      console.error('❌ Erro ao atualizar status:', error);
      setErro(error?.message || 'Erro ao atualizar status');
    }
  };

  // ✅ DELETAR AGENDAMENTO (DELETA FINANCEIRO PRIMEIRO, DEPOIS AGENDAMENTO)
  const handleDeleteAgendamento = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este agendamento?\n\nEsta ação não pode ser desfeita!')) return;

    try {
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      console.log('🗑️ Deletando agendamento:', id);

      // ✅ PASSO 1: DELETAR RECEITAS VINCULADAS EM FINANCEIRO
      console.log('1️⃣ Deletando receitas em financeiro...');
      const { error: errorFinanceiro } = await supabase
        .from('financeiro')
        .delete()
        .eq('agendamento_id', id)
        .eq('company_id', companyId);

      if (errorFinanceiro) {
        console.error('❌ Erro ao deletar receita:', errorFinanceiro);
        setErro('Erro ao deletar receita vinculada');
        return;
      }

      console.log('✅ Receitas deletadas!');

      // ✅ PASSO 2: AGORA DELETAR O AGENDAMENTO
      console.log('2️⃣ Deletando agendamento...');
      const { error: errorAgendamento } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (errorAgendamento) {
        console.error('❌ Erro ao deletar agendamento:', errorAgendamento);
        setErro('Erro ao deletar agendamento');
        return;
      }

      console.log('✅ Agendamento deletado!');
      setErro('');
      setAgendamentos(agendamentos.filter(a => a.id !== id));
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao deletar');
    }
  };

  // ✅ SALVAR PAGAMENTO
  const handleSalvarPagamento = async () => {
    try {
      if (!formaPagamento) {
        setErro('Selecione uma forma de pagamento');
        return;
      }

      const companyId = localStorage.getItem('companyId');
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      // ✅ BUSCAR VALOR DO SERVIÇO
      const servico = servicos.find(s => s.id === agendamentoSelecionado.servico_id);
      const valor = servico?.preco || 0;

      // ✅ ATUALIZAR AGENDAMENTO
      const { error: errorAgendamento } = await supabase
        .from('agendamentos')
        .update({
          status: 'confirmado',
          forma_pagamento: formaPagamento,
          valor_pago: valor,
          data_pagamento: new Date().toISOString()
        })
        .eq('id', agendamentoSelecionado.id)
        .eq('company_id', companyId);

      if (errorAgendamento) {
        console.error('❌ Erro ao atualizar agendamento:', errorAgendamento);
        setErro('Erro ao confirmar pagamento');
        return;
      }

      // ✅ INSERIR EM FINANCEIRO (RECEITA)
      const { error: errorFinanceiro } = await supabase
        .from('financeiro')
        .insert([{
          company_id: companyId,
          tipo: 'receita',
          descricao: `Pagamento - ${servico?.nome || 'Serviço'}`,
          valor: valor,
          forma_pagamento: formaPagamento.toLowerCase(),
          agendamento_id: agendamentoSelecionado.id,
          data_transacao: new Date().toISOString()
        }]);

      if (errorFinanceiro) {
        console.error('❌ Erro ao criar financeiro:', errorFinanceiro);
        setErro('Erro ao registrar na financeiro');
        return;
      }

      console.log('✅ Pagamento salvo com sucesso!');

      // ✅ ATUALIZAR ESTADO LOCAL
      setAgendamentos(agendamentos.map(apt =>
        apt.id === agendamentoSelecionado.id ? {
          ...apt,
          status: 'confirmado',
          forma_pagamento: formaPagamento,
          valor_pago: valor,
          data_pagamento: new Date().toISOString()
        } : apt
      ));

      setShowPagamentoModal(false);
      setAgendamentoSelecionado(null);
      setFormaPagamento('');
      setErro('');
    } catch (error: any) {
      console.error('❌ Erro ao salvar pagamento:', error);
      setErro(error?.message || 'Erro ao salvar pagamento');
    }
  };

  const filteredAgendamentos = agendamentos
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => profissionalFiltro === '' || a.profissional_id === profissionalFiltro)
    .filter(a => dataFiltro === '' || a.data_agendamento === dataFiltro)
    .filter(a => {
      const cliente = clientes.find(c => c.id === a.cliente_id);
      return cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
             cliente?.telefone.includes(searchTerm);
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-blue-100 text-blue-700';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-700';
      case 'finalizado':
        return 'bg-green-100 text-green-700';
      case 'cancelado':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'Confirmado';
      case 'pendente':
        return 'Pendente';
      case 'finalizado':
        return 'Finalizado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return status;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-slate-500">Carregando agendamentos...</p></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestão de Agendamentos</h2>
          <p className="text-slate-500">Visualize e gerencie todos os horários marcados.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm w-full md:w-auto justify-center md:justify-start"
        >
          <Plus size={18} />
          Novo Agendamento
        </button>
      </header>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* FILTROS */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Busca */}
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Cliente ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
              />
            </div>

            {/* Status */}
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-600"
            >
              <option value="all">Todos Status</option>
              <option value="pendente">Pendente</option>
              <option value="confirmado">Confirmado</option>
              <option value="finalizado">Finalizado</option>
              <option value="cancelado">Cancelado</option>
            </select>

            {/* Profissional */}
            <select 
              value={profissionalFiltro}
              onChange={(e) => setProfissionalFiltro(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-600"
            >
              <option value="">Todos Profissionais</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>

            {/* Data */}
            <input 
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-600"
            />
          </div>

          {(searchTerm || filter !== 'all' || profissionalFiltro || dataFiltro) && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                  setProfissionalFiltro('');
                  setDataFiltro('');
                }}
                className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Limpar filtros
              </button>
              <span className="text-xs text-slate-500">
                {filteredAgendamentos.length} resultado(s)
              </span>
            </div>
          )}
        </div>

        {/* TABELA */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Serviço</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Profissional</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data/Hora</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Valor</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Pagamento</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAgendamentos.map((apt) => {
                const cliente = clientes.find(c => c.id === apt.cliente_id);
                const servico = servicos.find(s => s.id === apt.servico_id);
                const profissional = profissionais.find(p => p.id === apt.profissional_id);

                return (
                  <tr key={apt.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 md:px-6 py-4">
                      <div className="font-semibold text-slate-800 text-sm">{cliente?.nome}</div>
                      <div className="text-xs text-slate-400">{cliente?.telefone}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm text-slate-600">{servico?.nome}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                      <span className="text-sm text-slate-600">{profissional?.nome}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="text-sm text-slate-800 font-medium">{apt.data_agendamento}</div>
                      <div className="text-xs text-indigo-600 font-bold">{apt.hora_agendamento}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                      <span className="text-sm font-bold text-green-600">R$ {servico?.preco?.toFixed(2) || '0.00'}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded capitalize">
                        {apt.forma_pagamento || '-'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      {editandoId === apt.id ? (
                        <div className="flex flex-col gap-3 min-w-max">
                          <select
                            value={novoStatus}
                            onChange={(e) => setNovoStatus(e.target.value)}
                            className="text-xs px-2 py-1 border border-slate-200 rounded bg-white"
                          >
                            <option value="">Selecionar</option>
                            <option value="pendente">Pendente</option>
                            <option value="confirmado">Confirmado</option>
                            <option value="finalizado">Finalizado</option>
                            <option value="cancelado">Cancelado</option>
                          </select>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAtualizarStatus(apt.id, novoStatus)}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                              disabled={!novoStatus}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditandoId(null);
                                setNovoStatus('');
                              }}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusColor(apt.status)}`}>
                            {getStatusLabel(apt.status)}
                          </span>
                          <button
                            onClick={() => {
                              setEditandoId(apt.id);
                              setNovoStatus(apt.status);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <button
                        onClick={() => handleDeleteAgendamento(apt.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition opacity-0 group-hover:opacity-100"
                        title="Deletar agendamento"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredAgendamentos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-slate-400">
                    Nenhum agendamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE NOVO AGENDAMENTO */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white">
              <h3 className="text-2xl font-bold text-slate-800">Novo Agendamento</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            {erro && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{erro}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cliente *</label>
                <select 
                  value={formData.cliente_id}
                  onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Profissional *</label>
                <select 
                  value={formData.profissional_id}
                  onChange={(e) => setFormData({...formData, profissional_id: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Selecione um profissional</option>
                  {profissionais.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Serviço *</label>
                <select 
                  value={formData.servico_id}
                  onChange={(e) => setFormData({...formData, servico_id: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Selecione um serviço</option>
                  {servicos.map(s => (
                    <option key={s.id} value={s.id}>{s.nome} - R$ {s.preco?.toFixed(2) || '0.00'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Data *</label>
                <input 
                  type="date"
                  value={formData.data_agendamento}
                  onChange={(e) => setFormData({...formData, data_agendamento: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hora *</label>
                <input 
                  type="time"
                  value={formData.hora_agendamento}
                  onChange={(e) => setFormData({...formData, hora_agendamento: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="pendente">Pendente</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Criar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PAGAMENTO */}
      {showPagamentoModal && agendamentoSelecionado && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CreditCard className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Confirmar Pagamento</h3>
                <p className="text-sm text-slate-500">Selecione a forma de pagamento</p>
              </div>
            </div>

            {erro && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{erro}</p>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-slate-600 mb-2">Valor a receber:</p>
              <p className="text-3xl font-bold text-green-600">
                R$ {servicos.find(s => s.id === agendamentoSelecionado.servico_id)?.preco?.toFixed(2) || '0.00'}
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <label className="block text-sm font-medium text-slate-700">Forma de Pagamento *</label>
              <div className="grid grid-cols-2 gap-3">
                {['Dinheiro', 'PIX', 'Débito', 'Crédito'].map((opcao) => (
                  <button
                    key={opcao}
                    onClick={() => setFormaPagamento(opcao.toLowerCase())}
                    className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                      formaPagamento === opcao.toLowerCase()
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    {opcao}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPagamentoModal(false);
                  setAgendamentoSelecionado(null);
                  setFormaPagamento('');
                }}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarPagamento}
                disabled={!formaPagamento}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
