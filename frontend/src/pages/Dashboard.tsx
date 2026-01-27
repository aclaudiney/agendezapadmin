import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { TrendingUp, Users, Calendar, Scissors, CheckCircle2, Clock, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // FILTROS
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [profissionalFiltro, setProfissionalFiltro] = useState('');

  // Edição de status
  const [editandoStatus, setEditandoStatus] = useState<string | null>(null);
  const [novoStatus, setNovoStatus] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar agendamentos
      const { data: agendamentosData, error: agendamentosError } = await supabase
        .from('agendamentos')
        .select('*');

      // Buscar profissionais
      const { data: profissionaisData, error: profissionaisError } = await supabase
        .from('profissionais')
        .select('*');

      // Buscar serviços
      const { data: servicosData, error: servicosError } = await supabase
        .from('servicos')
        .select('*');

      // Buscar clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*');

      if (!agendamentosError) setAgendamentos(agendamentosData || []);
      if (!profissionaisError) setProfissionais(profissionaisData || []);
      if (!servicosError) setServicos(servicosData || []);
      if (!clientesError) setClientes(clientesData || []);

      console.log('Dados carregados:', { agendamentosData, profissionaisData, servicosData, clientesData });
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // APLICAR FILTROS - MOSTRAR APENAS CONFIRMADOS
  const agendamentosFiltrados = useMemo(() => {
    return agendamentos
      .filter(apt => apt.status === 'finalizado' || apt.status === 'confirmed') // APENAS CONFIRMADOS
      .filter(apt => {
        // Filtro por profissional
        if (profissionalFiltro && apt.profissional_id !== profissionalFiltro) {
          return false;
        }

        // Filtro por período
        if (dataInicio && apt.data_agendamento < dataInicio) {
          return false;
        }
        if (dataFim && apt.data_agendamento > dataFim) {
          return false;
        }

        return true;
      });
  }, [agendamentos, profissionalFiltro, dataInicio, dataFim]);

  // CALCULAR FATURAMENTO POR PROFISSIONAL
  const faturamentoPorProfissional = useMemo(() => {
    const faturamento: { [key: string]: { nome: string; total: number; quantidade: number } } = {};

    agendamentosFiltrados.forEach(apt => {
      const profId = apt.profissional_id;
      const servico = servicos.find(s => s.id === apt.servico_id);
      const valor = servico?.preco || 0;

      if (!faturamento[profId]) {
        const prof = profissionais.find(p => p.id === profId);
        faturamento[profId] = {
          nome: prof?.nome || 'Desconhecido',
          total: 0,
          quantidade: 0
        };
      }

      faturamento[profId].total += valor;
      faturamento[profId].quantidade += 1;
    });

    return faturamento;
  }, [agendamentosFiltrados, servicos, profissionais]);

  const stats = useMemo(() => {
    const totalFaturamento = agendamentosFiltrados.reduce((sum, apt) => {
      const servico = servicos.find(s => s.id === apt.servico_id);
      return sum + (servico?.preco || 0);
    }, 0);

    const confirmed = agendamentosFiltrados.filter(a => a.status === 'finalizado' || a.status === 'confirmed').length;

    return [
      { label: 'Faturamento', value: `R$ ${totalFaturamento.toFixed(2)}`, icon: <TrendingUp className="text-green-500" />, detail: 'Total de receita' },
      { label: 'Agendamentos', value: agendamentosFiltrados.length, icon: <Calendar className="text-blue-500" />, detail: 'finalizado' },
      { label: 'Profissionais', value: profissionais.length, icon: <Users className="text-purple-500" />, detail: 'Equipe ativa' },
      { label: 'Serviços', value: servicos.length, icon: <Scissors className="text-orange-500" />, detail: 'Catálogo' },
    ];
  }, [agendamentosFiltrados, servicos, profissionais]);

  const chartData = useMemo(() => {
    // Se tem filtro de período, mostrar dias do período
    if (dataInicio && dataFim) {
      const days = [];
      let currentDate = new Date(dataInicio);
      const endDate = new Date(dataFim);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        days.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return days.map(date => ({
        name: date.split('-').slice(1).join('/'),
        total: agendamentosFiltrados.filter(a => a.data_agendamento === date).length
      }));
    }

    // Caso contrário, mostrar últimos 7 dias
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => ({
      name: date.split('-').slice(1).join('/'),
      total: agendamentosFiltrados.filter(a => a.data_agendamento === date).length
    }));
  }, [agendamentosFiltrados, dataInicio, dataFim]);

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setProfissionalFiltro('');
  };

  const handleAtualizarStatus = async (appointmentId: string, novoStatusValue: string) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: novoStatusValue })
        .eq('id', appointmentId);

      if (error) throw error;

      // Atualizar no estado local
      setAgendamentos(agendamentos.map(apt =>
        apt.id === appointmentId ? { ...apt, status: novoStatusValue } : apt
      ));

      setEditandoStatus(null);
      setNovoStatus('');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status');
    }
  };

  const temFiltros = dataInicio || dataFim || profissionalFiltro;

  const getNomeProfissional = (id: string) => {
    return profissionais.find(p => p.id === id)?.nome || 'Profissional desconhecido';
  };

  const getNomeServico = (id: string) => {
    return servicos.find(s => s.id === id)?.nome || 'Serviço desconhecido';
  };

  const getNomeCliente = (id: string) => {
    return clientes.find(c => c.id === id)?.nome || 'Cliente desconhecido';
  };

  const getStatusColor = (status: string) => {
    if (status === 'finalizado' || status === 'confirmed') return 'bg-green-100 text-green-700';
    if (status === 'pendente' || status === 'pending') return 'bg-blue-100 text-blue-700';
    if (status === 'cancelado' || status === 'cancelled') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard de Agendamentos</h2>
        <p className="text-slate-500">Visualize e gerencie todos os agendamentos da sua agenda.</p>
      </header>

      {/* FILTROS */}
      <div className="p-4 md:p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base md:text-lg font-semibold text-slate-800">Filtros</h3>
          {temFiltros && (
            <button
              onClick={limparFiltros}
              className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1 text-xs md:text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <X size={14} />
              Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* Data Início */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1 md:mb-2">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1 md:mb-2">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Profissional */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1 md:mb-2">Profissional</label>
            <select
              value={profissionalFiltro}
              onChange={(e) => setProfissionalFiltro(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">Todos</option>
              {profissionais.map(prof => (
                <option key={prof.id} value={prof.id}>
                  {prof.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {temFiltros && (
          <div className="mt-3 p-2 md:p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs md:text-sm text-indigo-700">
            📊 Mostrando {agendamentosFiltrados.length} agendamento(s)
          </div>
        )}
      </div>

      {/* CARDS DE ESTATÍSTICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="p-3 md:p-6 bg-white rounded-lg md:rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-start md:gap-4">
            <div className="p-2 md:p-3 bg-slate-50 rounded-lg h-fit">{stat.icon}</div>
            <div className="mt-2 md:mt-0">
              <p className="text-xs md:text-sm font-medium text-slate-500">{stat.label}</p>
              <h4 className="text-xl md:text-2xl font-bold text-slate-800">{stat.value}</h4>
              <p className="text-[10px] md:text-xs text-slate-400 mt-0.5 md:mt-1 hidden md:block">{stat.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* GRÁFICO */}
      <div className="p-4 md:p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
          <TrendingUp size={18} className="text-indigo-600" />
          Fluxo
        </h3>
        <div className="h-48 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={35} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
              />
              <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FATURAMENTO POR PROFISSIONAL */}
      <div className="p-4 md:p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-4">Faturamento por Profissional</h3>
        
        {Object.keys(faturamentoPorProfissional).length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum agendamento confirmado neste período.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(faturamentoPorProfissional)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([profId, dados]) => (
                <div key={profId} className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-semibold text-slate-800">{dados.nome}</p>
                      <p className="text-xs text-slate-500">{dados.quantidade} agendamento(s)</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">R$ {dados.total.toFixed(2)}</p>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${Object.values(faturamentoPorProfissional).reduce((sum, d) => sum + d.total, 0) > 0 
                          ? (dados.total / Object.values(faturamentoPorProfissional).reduce((sum, d) => sum + d.total, 0)) * 100 
                          : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      <div className="p-4 md:p-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-4">Agendamentos</h3>
        
        {agendamentosFiltrados.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500">Nenhum agendamento encontrado.</p>
          </div>
        ) : (
          <>
            {/* TABELA (Desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-800">Data</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-800">Hora</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-800">Cliente</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-800">Serviço</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-800">Profissional</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-800">Valor</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-800">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {agendamentosFiltrados.map(apt => {
                    const servico = servicos.find(s => s.id === apt.servico_id);
                    const valor = servico?.preco || 0;
                    return (
                      <tr key={apt.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 text-slate-700 text-xs md:text-sm">{apt.data_agendamento}</td>
                        <td className="px-3 py-2 text-slate-700 text-xs md:text-sm">{apt.hora_agendamento}</td>
                        <td className="px-3 py-2 text-slate-700 text-xs md:text-sm">{getNomeCliente(apt.cliente_id)}</td>
                        <td className="px-3 py-2 text-slate-700 text-xs md:text-sm">{getNomeServico(apt.servico_id)}</td>
                        <td className="px-3 py-2 text-slate-700 text-xs md:text-sm">{getNomeProfissional(apt.profissional_id)}</td>
                        <td className="px-3 py-2 text-green-600 font-semibold text-xs md:text-sm">R$ {valor.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          {editandoStatus === apt.id ? (
                            <div className="flex gap-2">
                              <select
                                value={novoStatus}
                                onChange={(e) => setNovoStatus(e.target.value)}
                                className="text-xs px-2 py-1 border border-slate-200 rounded"
                              >
                                <option value="">Selecionar</option>
                                <option value="confirmado">Confirmado</option>
                                <option value="pendente">Pendente</option>
                                <option value="cancelado">Cancelado</option>
                                <option value="realizado">Realizado</option>
                              </select>
                              <button
                                onClick={() => handleAtualizarStatus(apt.id, novoStatus)}
                                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusColor(apt.status)}`}>
                                {apt.status}
                              </span>
                              <button
                                onClick={() => {
                                  setEditandoStatus(apt.id);
                                  setNovoStatus(apt.status);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* CARDS (Mobile) */}
            <div className="md:hidden space-y-3">
              {agendamentosFiltrados.map(apt => {
                const servico = servicos.find(s => s.id === apt.servico_id);
                const valor = servico?.preco || 0;
                return (
                  <div key={apt.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{getNomeCliente(apt.cliente_id)}</p>
                        <p className="text-xs text-slate-500">{apt.data_agendamento} • {apt.hora_agendamento}</p>
                      </div>
                      <p className="text-sm font-bold text-green-600">R$ {valor.toFixed(2)}</p>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1 mb-3">
                      <p><strong>Serviço:</strong> {getNomeServico(apt.servico_id)}</p>
                      <p><strong>Profissional:</strong> {getNomeProfissional(apt.profissional_id)}</p>
                    </div>
                    {editandoStatus === apt.id ? (
                      <div className="flex gap-2">
                        <select
                          value={novoStatus}
                          onChange={(e) => setNovoStatus(e.target.value)}
                          className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded"
                        >
                          <option value="">Selecionar</option>
                          <option value="confirmado">Confirmado</option>
                          <option value="pendente">Pendente</option>
                          <option value="cancelado">Cancelado</option>
                          <option value="realizado">Realizado</option>
                        </select>
                        <button
                          onClick={() => handleAtualizarStatus(apt.id, novoStatus)}
                          className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusColor(apt.status)}`}>
                          {apt.status}
                        </span>
                        <button
                          onClick={() => {
                            setEditandoStatus(apt.id);
                            setNovoStatus(apt.status);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          ✏️ Editar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;