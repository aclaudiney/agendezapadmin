import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { TrendingUp, Plus, Trash2, Edit2, X, AlertCircle } from 'lucide-react';

interface Agendamento {
  id: string;
  cliente_id: string;
  data_agendamento: string;
  hora_agendamento: string;
  status: string;
  forma_pagamento: string;
  clientes: { nome: string };
  servicos: { nome: string; preco: number };
}

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  tipo: string;
  forma_pagamento?: string;
}

export default function Financeiro() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState<string>('todos');
  const [loading, setLoading] = useState(true);
  const [showModalDespesa, setShowModalDespesa] = useState(false);
  const [editingDespesaId, setEditingDespesaId] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const [formDespesa, setFormDespesa] = useState({
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    categoria: '',
    forma_pagamento: 'Dinheiro',
  });

  // Função para normalizar forma de pagamento
  const normalizarFormaPagamento = (forma: string | null | undefined): string => {
    if (!forma) return '';
    const normalized = forma.toLowerCase().trim();
    if (normalized === 'dinheiro') return 'Dinheiro';
    if (normalized === 'pix') return 'Pix';
    if (normalized === 'débito' || normalized === 'debito') return 'Débito';
    if (normalized === 'crédito' || normalized === 'credito') return 'Crédito';
    return forma;
  };

  // Inicializar data início como primeiro dia do mês
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    setDataInicio(primeiroDia.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dataInicio) {
      carregarAgendamentos();
      carregarDespesas();
    }
  }, [dataInicio, dataFim, filtroFormaPagamento]);

  const carregarAgendamentos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('agendamentos')
        .select('*, clientes(nome), servicos(nome, preco)')
        .eq('status', 'finalizado');

      if (dataInicio) {
        query = query.gte('data_agendamento', dataInicio);
      }

      if (dataFim) {
        query = query.lte('data_agendamento', dataFim);
      }

      const { data, error } = await query.order('data_agendamento', { ascending: false });

      if (error) throw error;
      
      let dataNormalizado = data?.map(d => ({
        ...d,
        forma_pagamento: normalizarFormaPagamento(d.forma_pagamento)
      })) || [];
      
      if (filtroFormaPagamento !== 'todos') {
        dataNormalizado = dataNormalizado.filter(a => a.forma_pagamento === filtroFormaPagamento);
      }
      
      setAgendamentos(dataNormalizado);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarDespesas = async () => {
    try {
      let query = supabase
        .from('despesas')
        .select('*');

      if (dataInicio) {
        query = query.gte('data', dataInicio);
      }

      if (dataFim) {
        query = query.lte('data', dataFim);
      }

      const { data, error } = await query.order('data', { ascending: false });

      if (error) throw error;
      
      setDespesas(data || []);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
    }
  };

  const handleSubmitDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formDespesa.descricao || !formDespesa.valor || !formDespesa.data || !formDespesa.forma_pagamento) {
      setErro('Preencha descrição, valor, data e forma de pagamento');
      return;
    }

    try {
      if (editingDespesaId) {
        // Atualizar
        const { error } = await supabase
          .from('despesas')
          .update({
            descricao: formDespesa.descricao,
            valor: parseFloat(formDespesa.valor),
            data: formDespesa.data,
            categoria: formDespesa.categoria,
            forma_pagamento: formDespesa.forma_pagamento,
          })
          .eq('id', editingDespesaId);

        if (error) {
          setErro('Erro ao atualizar despesa');
          return;
        }
      } else {
        // Criar novo - garantir que a data seja salva corretamente
        const dataParts = formDespesa.data.split('-');
        const dataFormatada = `${dataParts[0]}-${dataParts[1]}-${dataParts[2]}`;
        
        const { error } = await supabase.from('despesas').insert([{
          descricao: formDespesa.descricao,
          valor: parseFloat(formDespesa.valor),
          data: dataFormatada,
          categoria: formDespesa.categoria,
          forma_pagamento: formDespesa.forma_pagamento,
          tipo: 'despesa',
        }]);

        if (error) {
          setErro('Erro ao criar despesa');
          return;
        }
      }

      setFormDespesa({
        descricao: '',
        valor: '',
        data: new Date().toISOString().split('T')[0],
        categoria: '',
        forma_pagamento: 'Dinheiro',
      });
      setEditingDespesaId(null);
      setShowModalDespesa(false);
      carregarDespesas();
    } catch (error) {
      setErro('Erro ao salvar despesa');
      console.error(error);
    }
  };

  const handleDeleteDespesa = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta despesa?')) return;

    try {
      const { error } = await supabase.from('despesas').delete().eq('id', id);

      if (error) {
        setErro('Erro ao deletar despesa');
        return;
      }

      carregarDespesas();
    } catch (error) {
      setErro('Erro ao deletar');
      console.error(error);
    }
  };

  const handleEditDespesa = (despesa: Despesa) => {
    setFormDespesa({
      descricao: despesa.descricao,
      valor: despesa.valor.toString(),
      data: despesa.data,
      categoria: despesa.categoria || '',
      forma_pagamento: despesa.forma_pagamento || 'Dinheiro',
    });
    setEditingDespesaId(despesa.id);
    setShowModalDespesa(true);
  };

  // Cálculos
  const totalGeral = agendamentos.reduce((sum, a) => sum + (a.servicos?.preco || 0), 0);
  const totalDespesas = despesas.reduce((sum, d) => sum + (d.valor || 0), 0);
  const saldoLiquido = totalGeral - totalDespesas;

  // Calcular totais por forma de pagamento (descontando despesas da forma escolhida)
  const totaisReceitasPorForma = {
    Dinheiro: agendamentos
      .filter(a => a.forma_pagamento === 'Dinheiro')
      .reduce((sum, a) => sum + (a.servicos?.preco || 0), 0),
    Pix: agendamentos
      .filter(a => a.forma_pagamento === 'Pix')
      .reduce((sum, a) => sum + (a.servicos?.preco || 0), 0),
    Débito: agendamentos
      .filter(a => a.forma_pagamento === 'Débito')
      .reduce((sum, a) => sum + (a.servicos?.preco || 0), 0),
    Crédito: agendamentos
      .filter(a => a.forma_pagamento === 'Crédito')
      .reduce((sum, a) => sum + (a.servicos?.preco || 0), 0),
  };

  // Descontar despesas de cada forma de pagamento
  const despesasPorForma = {
    Dinheiro: despesas
      .filter(d => d.forma_pagamento === 'Dinheiro')
      .reduce((sum, d) => sum + (d.valor || 0), 0),
    Pix: despesas
      .filter(d => d.forma_pagamento === 'Pix')
      .reduce((sum, d) => sum + (d.valor || 0), 0),
    Débito: despesas
      .filter(d => d.forma_pagamento === 'Débito')
      .reduce((sum, d) => sum + (d.valor || 0), 0),
    Crédito: despesas
      .filter(d => d.forma_pagamento === 'Crédito')
      .reduce((sum, d) => sum + (d.valor || 0), 0),
  };

  const totaisPorForma = {
    Dinheiro: Math.max(0, totaisReceitasPorForma.Dinheiro - despesasPorForma.Dinheiro),
    Pix: Math.max(0, totaisReceitasPorForma.Pix - despesasPorForma.Pix),
    Débito: Math.max(0, totaisReceitasPorForma.Débito - despesasPorForma.Débito),
    Crédito: Math.max(0, totaisReceitasPorForma.Crédito - despesasPorForma.Crédito),
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp size={32} className="text-indigo-600" />
          <h1 className="text-3xl font-bold text-slate-800">Financeiro</h1>
        </div>
        <p className="text-slate-500">Controle de pagamentos recebidos e despesas</p>
      </div>

      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {/* Total Geral */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-slate-600 mb-2">Total Receita</p>
          <p className="text-3xl font-bold text-green-600">R$ {totalGeral.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-2">{agendamentos.length} pagamentos</p>
        </div>

        {/* Total Despesas */}
        <div className="bg-white rounded-lg p-6 border border-red-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-red-700 font-medium mb-2">💸 Despesas</p>
          <p className="text-3xl font-bold text-red-600">R$ {totalDespesas.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-2">{despesas.length} despesas</p>
        </div>

        {/* Saldo Líquido */}
        <div className={`bg-white rounded-lg p-6 border shadow-sm hover:shadow-md transition ${saldoLiquido >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <p className="text-sm text-slate-600 mb-2">Saldo Líquido</p>
          <p className={`text-3xl font-bold ${saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R$ {saldoLiquido.toFixed(2)}
          </p>
        </div>

        {/* Dinheiro */}
        <div className="bg-white rounded-lg p-6 border border-green-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-green-700 font-medium mb-2">💵 Dinheiro</p>
          <p className="text-3xl font-bold text-green-700">R$ {totaisPorForma.Dinheiro.toFixed(2)}</p>
        </div>

        {/* Pix */}
        <div className="bg-white rounded-lg p-6 border border-blue-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-blue-700 font-medium mb-2">📱 Pix</p>
          <p className="text-3xl font-bold text-blue-700">R$ {totaisPorForma.Pix.toFixed(2)}</p>
        </div>

        {/* Débito */}
        <div className="bg-white rounded-lg p-6 border border-amber-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-amber-700 font-medium mb-2">💳 Débito</p>
          <p className="text-3xl font-bold text-amber-700">R$ {totaisPorForma.Débito.toFixed(2)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Forma de Pagamento</label>
            <select
              value={filtroFormaPagamento}
              onChange={(e) => setFiltroFormaPagamento(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="todos">Todas</option>
              <option value="Dinheiro">💵 Dinheiro</option>
              <option value="Pix">📱 Pix</option>
              <option value="Débito">💳 Débito</option>
              <option value="Crédito">💰 Crédito</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">&nbsp;</label>
            <button
              onClick={() => setShowModalDespesa(true)}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Nova Despesa
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Pagamentos */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Receitas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Cliente</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Serviço</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Data</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Hora</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Forma de Pagamento</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : agendamentos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhum pagamento encontrado
                  </td>
                </tr>
              ) : (
                agendamentos.map((agendamento) => (
                  <tr key={agendamento.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm text-slate-800">{agendamento.clientes?.nome || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-800">{agendamento.servicos?.nome || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{agendamento.hora_agendamento}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        agendamento.forma_pagamento === 'Dinheiro' ? 'bg-green-100 text-green-700' :
                        agendamento.forma_pagamento === 'Pix' ? 'bg-blue-100 text-blue-700' :
                        agendamento.forma_pagamento === 'Débito' ? 'bg-amber-100 text-amber-700' :
                        agendamento.forma_pagamento === 'Crédito' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {agendamento.forma_pagamento}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-slate-800">
                      R$ {(agendamento.servicos?.preco || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela de Despesas */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Despesas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Descrição</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Categoria</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Descontado de</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Data</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">Valor</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {despesas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma despesa encontrada
                  </td>
                </tr>
              ) : (
                despesas.map((despesa) => (
                  <tr key={despesa.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm text-slate-800">{despesa.descricao}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{despesa.categoria || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        despesa.forma_pagamento === 'Dinheiro' ? 'bg-green-100 text-green-700' :
                        despesa.forma_pagamento === 'Pix' ? 'bg-blue-100 text-blue-700' :
                        despesa.forma_pagamento === 'Débito' ? 'bg-amber-100 text-amber-700' :
                        despesa.forma_pagamento === 'Crédito' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {despesa.forma_pagamento || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {despesa.data.split('-').reverse().join('/')}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-red-600">
                      -R$ {despesa.valor.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditDespesa(despesa)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteDespesa(despesa.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Despesa */}
      {showModalDespesa && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800">
                {editingDespesaId ? 'Editar Despesa' : 'Nova Despesa'}
              </h3>
              <button 
                onClick={() => {
                  setShowModalDespesa(false);
                  setEditingDespesaId(null);
                  setFormDespesa({ descricao: '', valor: '', data: new Date().toISOString().split('T')[0], categoria: '' });
                }}
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

            <form onSubmit={handleSubmitDespesa} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descrição</label>
                <input 
                  type="text"
                  value={formDespesa.descricao}
                  onChange={(e) => setFormDespesa({...formDespesa, descricao: e.target.value})}
                  placeholder="Ex: Aluguel, Material..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Valor (R$)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={formDespesa.valor}
                  onChange={(e) => setFormDespesa({...formDespesa, valor: e.target.value})}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
                <input 
                  type="date"
                  value={formDespesa.data}
                  onChange={(e) => setFormDespesa({...formDespesa, data: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Categoria</label>
                <input 
                  type="text"
                  value={formDespesa.categoria}
                  onChange={(e) => setFormDespesa({...formDespesa, categoria: e.target.value})}
                  placeholder="Ex: Aluguel, Suprimentos..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descontar de (Forma de Pagamento)</label>
                <select
                  value={formDespesa.forma_pagamento}
                  onChange={(e) => setFormDespesa({...formDespesa, forma_pagamento: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Dinheiro">💵 Dinheiro</option>
                  <option value="Pix">📱 Pix</option>
                  <option value="Débito">💳 Débito</option>
                  <option value="Crédito">💰 Crédito</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModalDespesa(false);
                    setEditingDespesaId(null);
                    setFormDespesa({ descricao: '', valor: '', data: new Date().toISOString().split('T')[0], categoria: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  {editingDespesaId ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}