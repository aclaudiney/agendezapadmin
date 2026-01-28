import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { TrendingUp, Plus, Trash2, Edit2, X, AlertCircle } from 'lucide-react';

interface Receita {
  id: string;
  descricao: string;
  valor: number;
  data_transacao: string;
  forma_pagamento: string;
  agendamento_id?: string;
}

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data_transacao: string;
  categoria: string;
  forma_pagamento: string;
}

export default function Financeiro() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
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
    data_transacao: new Date().toISOString().split('T')[0],
    categoria: '',
    forma_pagamento: 'dinheiro',
  });

  // ✅ NORMALIZAR FORMA DE PAGAMENTO
  const normalizarFormaPagamento = (forma: string | null | undefined): string => {
    if (!forma) return '';
    const normalized = forma.toLowerCase().trim();
    // ✅ VALIDAR CONTRA AS PALAVRAS-CHAVE CORRETAS
    if (normalized === 'dinheiro') return 'dinheiro';
    if (normalized === 'pix') return 'pix';
    if (normalized === 'débito' || normalized === 'debito') return 'débito';
    if (normalized === 'crédito' || normalized === 'credito') return 'crédito';
    return forma.toLowerCase();
  };

  // ✅ INICIALIZAR DATA INÍCIO COMO PRIMEIRO DIA DO MÊS
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    setDataInicio(primeiroDia.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dataInicio) {
      carregarReceitas();
      carregarDespesas();
    }
  }, [dataInicio, dataFim, filtroFormaPagamento]);

  // ✅ CARREGAR RECEITAS COM FILTRO POR COMPANY_ID E DATAS CORRETAS
  const carregarReceitas = async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        setLoading(false);
        return;
      }

      console.log('🔍 Buscando receitas para company_id:', companyId);
      console.log('📅 Período:', dataInicio, 'até', dataFim);

      let query = supabase
        .from('financeiro')
        .select('*')
        .eq('company_id', companyId)
        .eq('tipo', 'receita');

      // ✅ CORRIGIR FILTRO DE DATAS COM TIMESTAMP
      if (dataInicio) {
        query = query.gte('data_transacao', dataInicio + 'T00:00:00');
      }

      if (dataFim) {
        query = query.lte('data_transacao', dataFim + 'T23:59:59');
      }

      const { data, error } = await query.order('data_transacao', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar receitas:', error);
        setErro('Erro ao carregar receitas');
        setLoading(false);
        return;
      }

      let dataNormalizado = data?.map(d => ({
        ...d,
        forma_pagamento: normalizarFormaPagamento(d.forma_pagamento)
      })) || [];

      // ✅ FILTRAR POR FORMA DE PAGAMENTO (SÓ SE NÃO FOR 'TODOS')
      if (filtroFormaPagamento !== 'todos') {
        dataNormalizado = dataNormalizado.filter(r => r.forma_pagamento === filtroFormaPagamento);
      }

      console.log('✅ Receitas carregadas:', dataNormalizado.length);
      setReceitas(dataNormalizado);
    } catch (error) {
      console.error('❌ Erro crítico ao carregar receitas:', error);
      setErro('Erro ao carregar receitas');
    } finally {
      setLoading(false);
    }
  };

  // ✅ CARREGAR DESPESAS COM FILTRO POR COMPANY_ID E DATAS CORRETAS
  const carregarDespesas = async () => {
    try {
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        return;
      }

      console.log('🔍 Buscando despesas para company_id:', companyId);

      let query = supabase
        .from('financeiro')
        .select('*')
        .eq('company_id', companyId)
        .eq('tipo', 'despesa');

      // ✅ CORRIGIR FILTRO DE DATAS COM TIMESTAMP
      if (dataInicio) {
        query = query.gte('data_transacao', dataInicio + 'T00:00:00');
      }

      if (dataFim) {
        query = query.lte('data_transacao', dataFim + 'T23:59:59');
      }

      const { data, error } = await query.order('data_transacao', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar despesas:', error);
        return;
      }

      console.log('✅ Despesas carregadas:', data?.length || 0);
      setDespesas(data || []);
    } catch (error) {
      console.error('❌ Erro crítico ao carregar despesas:', error);
    }
  };

  // ✅ SALVAR DESPESA
  const handleSubmitDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formDespesa.descricao || !formDespesa.valor || !formDespesa.data_transacao || !formDespesa.forma_pagamento) {
      setErro('Preencha descrição, valor, data e forma de pagamento');
      return;
    }

    try {
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      console.log('💾 Salvando despesa...');

      if (editingDespesaId) {
        // ✅ ATUALIZAR
        const { error } = await supabase
          .from('financeiro')
          .update({
            descricao: formDespesa.descricao,
            valor: parseFloat(formDespesa.valor),
            data_transacao: formDespesa.data_transacao,
            categoria: formDespesa.categoria || null,
            forma_pagamento: formDespesa.forma_pagamento,
          })
          .eq('id', editingDespesaId)
          .eq('company_id', companyId);

        if (error) {
          console.error('❌ Erro ao atualizar:', error);
          setErro('Erro ao atualizar despesa');
          return;
        }

        console.log('✅ Despesa atualizada!');
      } else {
        // ✅ CRIAR NOVO
        const { error } = await supabase.from('financeiro').insert([{
          company_id: companyId,
          tipo: 'despesa',
          descricao: formDespesa.descricao,
          valor: parseFloat(formDespesa.valor),
          data_transacao: formDespesa.data_transacao,
          categoria: formDespesa.categoria || null,
          forma_pagamento: formDespesa.forma_pagamento,
        }]);

        if (error) {
          console.error('❌ Erro ao criar:', error);
          setErro('Erro ao criar despesa');
          return;
        }

        console.log('✅ Despesa criada!');
      }

      setFormDespesa({
        descricao: '',
        valor: '',
        data_transacao: new Date().toISOString().split('T')[0],
        categoria: '',
        forma_pagamento: 'dinheiro',
      });
      setEditingDespesaId(null);
      setShowModalDespesa(false);
      setErro('');
      await carregarDespesas();
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao salvar despesa');
    }
  };

  // ✅ DELETAR DESPESA
  const handleDeleteDespesa = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta despesa?')) return;

    try {
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      console.log('🗑️ Deletando despesa:', id);

      const { error } = await supabase
        .from('financeiro')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) {
        console.error('❌ Erro ao deletar:', error);
        setErro('Erro ao deletar despesa');
        return;
      }

      console.log('✅ Despesa deletada!');
      setErro('');
      setDespesas(despesas.filter(d => d.id !== id));
      await carregarDespesas();
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao deletar');
    }
  };

  const handleEditDespesa = (despesa: Despesa) => {
    setFormDespesa({
      descricao: despesa.descricao,
      valor: despesa.valor.toString(),
      data_transacao: despesa.data_transacao,
      categoria: despesa.categoria || '',
      forma_pagamento: despesa.forma_pagamento || 'dinheiro',
    });
    setEditingDespesaId(despesa.id);
    setShowModalDespesa(true);
  };

  // ✅ CÁLCULOS
  const totalReceita = receitas.reduce((sum, r) => sum + (r.valor || 0), 0);
  const totalDespesas = despesas.reduce((sum, d) => sum + (d.valor || 0), 0);
  const saldoLiquido = totalReceita - totalDespesas;

  // ✅ RECEITAS POR FORMA DE PAGAMENTO
  const totaisReceitasPorForma = {
    dinheiro: receitas
      .filter(r => r.forma_pagamento === 'dinheiro')
      .reduce((sum, r) => sum + (r.valor || 0), 0),
    pix: receitas
      .filter(r => r.forma_pagamento === 'pix')
      .reduce((sum, r) => sum + (r.valor || 0), 0),
    débito: receitas
      .filter(r => r.forma_pagamento === 'débito')
      .reduce((sum, r) => sum + (r.valor || 0), 0),
    crédito: receitas
      .filter(r => r.forma_pagamento === 'crédito')
      .reduce((sum, r) => sum + (r.valor || 0), 0),
  };

  // ✅ DESPESAS POR FORMA DE PAGAMENTO
  const despesasPorForma = {
    dinheiro: despesas
      .filter(d => d.forma_pagamento === 'dinheiro')
      .reduce((sum, d) => sum + (d.valor || 0), 0),
    pix: despesas
      .filter(d => d.forma_pagamento === 'pix')
      .reduce((sum, d) => sum + (d.valor || 0), 0),
    débito: despesas
      .filter(d => d.forma_pagamento === 'débito')
      .reduce((sum, d) => sum + (d.valor || 0), 0),
    crédito: despesas
      .filter(d => d.forma_pagamento === 'crédito')
      .reduce((sum, d) => sum + (d.valor || 0), 0),
  };

  // ✅ TOTAIS POR FORMA (RECEITA - DESPESA)
  const totaisPorForma = {
    dinheiro: Math.max(0, totaisReceitasPorForma.dinheiro - despesasPorForma.dinheiro),
    pix: Math.max(0, totaisReceitasPorForma.pix - despesasPorForma.pix),
    débito: Math.max(0, totaisReceitasPorForma.débito - despesasPorForma.débito),
    crédito: Math.max(0, totaisReceitasPorForma.crédito - despesasPorForma.crédito),
  };

  const getFormaPagamentoColor = (forma: string) => {
    switch (forma) {
      case 'dinheiro':
        return 'bg-green-100 text-green-700';
      case 'pix':
        return 'bg-blue-100 text-blue-700';
      case 'débito':
        return 'bg-amber-100 text-amber-700';
      case 'crédito':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getFormaPagamentoEmoji = (forma: string) => {
    switch (forma) {
      case 'dinheiro':
        return '💵';
      case 'pix':
        return '📱';
      case 'débito':
        return '💳';
      case 'crédito':
        return '💰';
      default:
        return '💸';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp size={32} className="text-indigo-600" />
          <h1 className="text-3xl font-bold text-slate-800">Financeiro</h1>
        </div>
        <p className="text-slate-500">Controle de receitas e despesas</p>
      </div>

      {erro && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
        {/* Total Receita */}
        <div className="bg-white rounded-lg p-6 border border-green-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-slate-600 mb-2">💰 Total Receita</p>
          <p className="text-2xl font-bold text-green-600">R$ {totalReceita.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-2">{receitas.length} recebimentos</p>
        </div>

        {/* Total Despesas */}
        <div className="bg-white rounded-lg p-6 border border-red-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-red-700 font-medium mb-2">💸 Despesas</p>
          <p className="text-2xl font-bold text-red-600">R$ {totalDespesas.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-2">{despesas.length} despesas</p>
        </div>

        {/* Saldo Líquido */}
        <div className={`bg-white rounded-lg p-6 border shadow-sm hover:shadow-md transition ${saldoLiquido >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <p className="text-sm text-slate-600 mb-2">📊 Saldo Líquido</p>
          <p className={`text-2xl font-bold ${saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R$ {saldoLiquido.toFixed(2)}
          </p>
        </div>

        {/* Dinheiro */}
        <div className="bg-white rounded-lg p-6 border border-green-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-green-700 font-medium mb-2">💵 Dinheiro</p>
          <p className="text-2xl font-bold text-green-700">R$ {totaisPorForma.dinheiro.toFixed(2)}</p>
        </div>

        {/* Pix */}
        <div className="bg-white rounded-lg p-6 border border-blue-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-blue-700 font-medium mb-2">📱 Pix</p>
          <p className="text-2xl font-bold text-blue-700">R$ {totaisPorForma.pix.toFixed(2)}</p>
        </div>

        {/* Débito */}
        <div className="bg-white rounded-lg p-6 border border-amber-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-amber-700 font-medium mb-2">💳 Débito</p>
          <p className="text-2xl font-bold text-amber-700">R$ {totaisPorForma.débito.toFixed(2)}</p>
        </div>

        {/* Crédito */}
        <div className="bg-white rounded-lg p-6 border border-red-200 shadow-sm hover:shadow-md transition">
          <p className="text-sm text-red-700 font-medium mb-2">💰 Crédito</p>
          <p className="text-2xl font-bold text-red-700">R$ {totaisPorForma.crédito.toFixed(2)}</p>
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Forma de Pagamento</label>
            <select
              value={filtroFormaPagamento}
              onChange={(e) => setFiltroFormaPagamento(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todos">Todas</option>
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="pix">📱 Pix</option>
              <option value="débito">💳 Débito</option>
              <option value="crédito">💰 Crédito</option>
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

      {/* Tabela de Receitas */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Receitas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Descrição</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Data</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Forma de Pagamento</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : receitas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma receita encontrada
                  </td>
                </tr>
              ) : (
                receitas.map((receita) => (
                  <tr key={receita.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm text-slate-800">{receita.descricao}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(receita.data_transacao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getFormaPagamentoColor(receita.forma_pagamento)}`}>
                        {getFormaPagamentoEmoji(receita.forma_pagamento)} {receita.forma_pagamento}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                      R$ {receita.valor.toFixed(2)}
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
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Data</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Forma de Pagamento</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">Valor</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {despesas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma despesa encontrada
                  </td>
                </tr>
              ) : (
                despesas.map((despesa) => (
                  <tr key={despesa.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm text-slate-800">{despesa.descricao}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{despesa.categoria || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(despesa.data_transacao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getFormaPagamentoColor(despesa.forma_pagamento)}`}>
                        {getFormaPagamentoEmoji(despesa.forma_pagamento)} {despesa.forma_pagamento}
                      </span>
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
                  setFormDespesa({
                    descricao: '',
                    valor: '',
                    data_transacao: new Date().toISOString().split('T')[0],
                    categoria: '',
                    forma_pagamento: 'dinheiro'
                  });
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
                  required
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
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
                <input 
                  type="date"
                  value={formDespesa.data_transacao}
                  onChange={(e) => setFormDespesa({...formDespesa, data_transacao: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Forma de Pagamento</label>
                <select
                  value={formDespesa.forma_pagamento}
                  onChange={(e) => setFormDespesa({...formDespesa, forma_pagamento: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="dinheiro">💵 Dinheiro</option>
                  <option value="pix">📱 Pix</option>
                  <option value="débito">💳 Débito</option>
                  <option value="crédito">💰 Crédito</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModalDespesa(false);
                    setEditingDespesaId(null);
                    setFormDespesa({
                      descricao: '',
                      valor: '',
                      data_transacao: new Date().toISOString().split('T')[0],
                      categoria: '',
                      forma_pagamento: 'dinheiro'
                    });
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