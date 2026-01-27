import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, Filter, Download, MoreVertical, Plus, X, AlertCircle, Edit2, Check } from 'lucide-react';

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

  // Estado para edição de status
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoStatus, setNovoStatus] = useState('');
  const [mostrarFormaPagamento, setMostrarFormaPagamento] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    cliente_id: '',
    profissional_id: '',
    servico_id: '',
    data_agendamento: '',
    hora_agendamento: '',
    status: 'pendente',
    forma_pagamento: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [agendamentosRes, clientesRes, profissionaisRes, servicosRes] = await Promise.all([
        supabase.from('agendamentos').select('*'),
        supabase.from('clientes').select('*'),
        supabase.from('profissionais').select('*'),
        supabase.from('servicos').select('*'),
      ]);

      setAgendamentos(agendamentosRes.data || []);
      setClientes(clientesRes.data || []);
      setProfissionais(profissionaisRes.data || []);
      setServicos(servicosRes.data || []);
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
      // Preparar dados
      const dataToInsert = {
        cliente_id: formData.cliente_id,
        profissional_id: formData.profissional_id,
        servico_id: formData.servico_id,
        data_agendamento: formData.data_agendamento,
        hora_agendamento: formData.hora_agendamento,
        status: formData.status,
        forma_pagamento: formData.status === 'finalizado' ? formData.forma_pagamento : null,
      };

      console.log('Inserindo dados:', dataToInsert);

      const { error } = await supabase.from('agendamentos').insert([dataToInsert]);

      if (error) {
        console.error('Erro ao criar:', error);
        setErro(`Erro ao criar agendamento: ${error.message || 'Erro desconhecido'}`);
        return;
      }

      console.log('Agendamento criado com sucesso!');

      setFormData({
        cliente_id: '',
        profissional_id: '',
        servico_id: '',
        data_agendamento: '',
        hora_agendamento: '',
        status: 'pendente',
        forma_pagamento: '',
      });
      setShowModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao salvar agendamento:', error);
      setErro(error?.message || 'Erro ao salvar agendamento');
    }
  };

  // Função para atualizar status e forma de pagamento
  const handleAtualizarStatus = async (aptId: string, novoStatusValue: string, formaPagamentoValue?: string) => {
    try {
      // Se o status for finalizado, precisa ter forma de pagamento
      if (novoStatusValue === 'finalizado') {
        if (!formaPagamentoValue) {
          setErro('Selecione uma forma de pagamento para finalizar o agendamento');
          return;
        }
      }

      // Preparar os dados para atualizar
      const updateData: any = {
        status: novoStatusValue
      };

      // Só adiciona forma_pagamento se for finalizado
      if (novoStatusValue === 'finalizado') {
        updateData.forma_pagamento = formaPagamentoValue;
      } else {
        updateData.forma_pagamento = null;
      }

      console.log('Atualizando com dados:', updateData);

      // Atualizar status
      const { error } = await supabase
        .from('agendamentos')
        .update(updateData)
        .eq('id', aptId);

      if (error) {
        console.error('Erro detalhado do Supabase:', error);
        setErro(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
        return;
      }

      console.log('Atualização bem-sucedida!');

      // Atualizar no estado local
      setAgendamentos(agendamentos.map(apt =>
        apt.id === aptId ? { 
          ...apt, 
          status: novoStatusValue, 
          forma_pagamento: updateData.forma_pagamento || apt.forma_pagamento 
        } : apt
      ));

      setEditandoId(null);
      setNovoStatus('');
      setFormaPagamento('');
      setMostrarFormaPagamento(false);
      setErro('');
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      setErro(error?.message || 'Erro ao atualizar status');
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
    return <div className="flex items-center justify-center h-96"><p className="text-slate-500">Carregando...</p></div>;
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
                      <span className="text-sm text-slate-600">
                        {apt.status === 'finalizado' && apt.forma_pagamento ? apt.forma_pagamento : '-'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      {editandoId === apt.id ? (
                        <div className="flex flex-col gap-3 min-w-max">
                          <select
                            value={novoStatus}
                            onChange={(e) => {
                              setNovoStatus(e.target.value);
                              setMostrarFormaPagamento(e.target.value === 'finalizado');
                              if (e.target.value !== 'finalizado') {
                                setFormaPagamento('');
                              }
                            }}
                            className="text-xs px-2 py-1 border border-slate-200 rounded bg-white"
                          >
                            <option value="">Selecionar</option>
                            <option value="pendente">Pendente</option>
                            <option value="confirmado">Confirmado</option>
                            <option value="finalizado">Finalizado</option>
                            <option value="cancelado">Cancelado</option>
                          </select>

                          {mostrarFormaPagamento && (
                            <select
                              value={formaPagamento}
                              onChange={(e) => setFormaPagamento(e.target.value)}
                              className="text-xs px-2 py-1 border border-green-200 rounded bg-green-50"
                            >
                              <option value="">Forma de pagamento</option>
                              <option value="Dinheiro">💵 Dinheiro</option>
                              <option value="Pix">📱 Pix</option>
                              <option value="Débito">💳 Débito</option>
                              <option value="Crédito">💰 Crédito</option>
                            </select>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                handleAtualizarStatus(apt.id, novoStatus, formaPagamento);
                              }}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditandoId(null);
                                setNovoStatus('');
                                setFormaPagamento('');
                                setMostrarFormaPagamento(false);
                              }}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusColor(apt.status)}`}>
                              {getStatusLabel(apt.status)}
                            </span>
                            {apt.status === 'finalizado' && apt.forma_pagamento && (
                              <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 font-semibold text-center">
                                {apt.forma_pagamento}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setEditandoId(apt.id);
                              setNovoStatus(apt.status);
                              setFormaPagamento(apt.forma_pagamento || '');
                              setMostrarFormaPagamento(apt.status === 'finalizado');
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredAgendamentos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                    Nenhum agendamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Cliente</label>
                <select 
                  value={formData.cliente_id}
                  onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Profissional</label>
                <select 
                  value={formData.profissional_id}
                  onChange={(e) => setFormData({...formData, profissional_id: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione um profissional</option>
                  {profissionais.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Serviço</label>
                <select 
                  value={formData.servico_id}
                  onChange={(e) => setFormData({...formData, servico_id: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione um serviço</option>
                  {servicos.map(s => (
                    <option key={s.id} value={s.id}>{s.nome} - R$ {s.preco?.toFixed(2) || '0.00'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
                <input 
                  type="date"
                  value={formData.data_agendamento}
                  onChange={(e) => setFormData({...formData, data_agendamento: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hora</label>
                <input 
                  type="time"
                  value={formData.hora_agendamento}
                  onChange={(e) => setFormData({...formData, hora_agendamento: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => {
                    setFormData({...formData, status: e.target.value});
                  }}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="pendente">Pendente</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              {formData.status === 'finalizado' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Forma de Pagamento</label>
                  <select 
                    value={formData.forma_pagamento}
                    onChange={(e) => setFormData({...formData, forma_pagamento: e.target.value})}
                    className="w-full px-4 py-2 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                  >
                    <option value="">Selecione a forma de pagamento</option>
                    <option value="Dinheiro">💵 Dinheiro</option>
                    <option value="Pix">📱 Pix</option>
                    <option value="Débito">💳 Débito</option>
                    <option value="Crédito">💰 Crédito</option>
                  </select>
                </div>
              )}

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
    </div>
  );
};

export default Appointments;