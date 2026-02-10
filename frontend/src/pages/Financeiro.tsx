import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { TrendingUp, Plus, Trash2, Edit2, X, AlertCircle, Filter } from 'lucide-react';

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

      const inicio = dataInicio || new Date().toISOString().split('T')[0];
      const fim = dataFim || new Date().toISOString().split('T')[0];

      const [{ data: apts, error: aptErr }, { data: servs, error: servErr }, { data: clis, error: cliErr }] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('id, status, servico_id, cliente_id, data_pagamento, forma_pagamento')
          .eq('company_id', companyId)
          .gte('data_agendamento', inicio)
          .lte('data_agendamento', fim),
        supabase
          .from('servicos')
          .select('id, nome, preco')
          .eq('company_id', companyId),
        supabase
          .from('clientes')
          .select('id, nome')
          .eq('company_id', companyId)
      ]);

      if (aptErr || servErr || cliErr) {
        console.error('❌ Erro ao buscar dados:', aptErr || servErr || cliErr);
        setErro('Erro ao carregar receitas');
        setLoading(false);
        return;
      }

      const servMap = new Map((servs || []).map(s => [s.id, s]));
      const cliMap = new Map((clis || []).map(c => [c.id, c]));
      const finalizados = (apts || []).filter(a => (a.status || '').toLowerCase() === 'finalizado');

      // ✅ Construir uma lista única por agendamento finalizado, usando o valor do serviço
      let receitasDerivadas: Receita[] = finalizados.map(a => {
        const srv = servMap.get(a.servico_id);
        const cli = cliMap.get(a.cliente_id);
        return {
          id: a.id,
          descricao: `${cli?.nome || 'Cliente'} - ${srv?.nome || 'Serviço'}`,
          valor: srv?.preco || 0,
          data_transacao: a.data_pagamento || new Date().toISOString(),
          forma_pagamento: normalizarFormaPagamento(a.forma_pagamento),
          agendamento_id: a.id
        } as Receita;
      });

      // ✅ Filtrar por forma de pagamento
      if (filtroFormaPagamento !== 'todos') {
        receitasDerivadas = receitasDerivadas.filter(r => r.forma_pagamento === filtroFormaPagamento);
      }

      setReceitas(receitasDerivadas);
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
    dinheiro: totaisReceitasPorForma.dinheiro - despesasPorForma.dinheiro,
    pix: totaisReceitasPorForma.pix - despesasPorForma.pix,
    débito: totaisReceitasPorForma.débito - despesasPorForma.débito,
    crédito: totaisReceitasPorForma.crédito - despesasPorForma.crédito,
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
    <div className="max-w-[1600px] mx-auto space-y-8 pb-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Financeiro</h1>
          <p className="text-slate-500 mt-1">Controle total de receitas e despesas.</p>
        </div>
        
        <button
          onClick={() => setShowModalDespesa(true)}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-sm hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          Nova Despesa
        </button>
      </div>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{erro}</p>
        </div>
      )}

      {/* Cards de Totais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 md:gap-6">
        {/* Total Receita */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-green-50 transition-colors">
              <TrendingUp size={20} className="text-slate-900 group-hover:text-green-600 transition-colors" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Total Receita</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">R$ {totalReceita.toFixed(2)}</h3>
          <p className="text-xs text-slate-400 mt-1">{receitas.length} recebimentos</p>
        </div>

        {/* Total Despesas */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-red-50 transition-colors">
              <TrendingUp size={20} className="text-slate-900 group-hover:text-red-600 transition-colors rotate-180" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Despesas</p>
          <h3 className="text-2xl font-bold text-red-600 mt-1">R$ {totalDespesas.toFixed(2)}</h3>
          <p className="text-xs text-slate-400 mt-1">{despesas.length} despesas</p>
        </div>

        {/* Saldo Líquido */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2.5 rounded-xl transition-colors ${saldoLiquido >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <TrendingUp size={20} className={`${saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Saldo Líquido</p>
          <h3 className={`text-2xl font-bold mt-1 ${saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R$ {saldoLiquido.toFixed(2)}
          </h3>
          <p className="text-xs text-slate-400 mt-1">lucro/prejuízo</p>
        </div>

        {/* Dinheiro */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <p className="text-sm font-medium text-slate-500 mb-2">💵 Dinheiro</p>
          <h3 className={`text-xl font-bold ${totaisPorForma.dinheiro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R$ {totaisPorForma.dinheiro.toFixed(2)}
          </h3>
        </div>

        {/* Pix */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <p className="text-sm font-medium text-slate-500 mb-2">📱 Pix</p>
          <h3 className={`text-xl font-bold ${totaisPorForma.pix >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R$ {totaisPorForma.pix.toFixed(2)}
          </h3>
        </div>

        {/* Débito */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <p className="text-sm font-medium text-slate-500 mb-2">💳 Débito</p>
          <h3 className={`text-xl font-bold ${totaisPorForma.débito >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R$ {totaisPorForma.débito.toFixed(2)}
          </h3>
        </div>

        {/* Crédito */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <p className="text-sm font-medium text-slate-500 mb-2">💰 Crédito</p>
          <h3 className={`text-xl font-bold ${totaisPorForma.crédito >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R$ {totaisPorForma.crédito.toFixed(2)}
          </h3>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Filter size={18} className="text-slate-400" />
          <h2 className="text-xl font-bold text-slate-900">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-semibold text-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-semibold text-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Forma de Pagamento</label>
            <select
              value={filtroFormaPagamento}
              onChange={(e) => setFiltroFormaPagamento(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-slate-700"
            >
              <option value="todos">Todas</option>
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="pix">📱 Pix</option>
              <option value="débito">💳 Débito</option>
              <option value="crédito">💰 Crédito</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tabela de Receitas */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Receitas (Entradas)</h3>
            <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg uppercase tracking-wider">
              {receitas.length} itens
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="px-8 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-8 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-400">
                        <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <span className="text-sm font-medium">Carregando...</span>
                      </div>
                    </td>
                  </tr>
                ) : receitas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-8 py-12 text-center text-slate-400 text-sm font-medium">
                      Nenhuma receita encontrada
                    </td>
                  </tr>
                ) : (
                  receitas.map((receita) => (
                    <tr key={receita.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-4">
                        <p className="text-sm font-bold text-slate-900">{receita.descricao}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {getFormaPagamentoEmoji(receita.forma_pagamento)} {receita.forma_pagamento}
                        </p>
                      </td>
                      <td className="px-8 py-4 text-sm font-medium text-slate-900">
                        {new Date(receita.data_transacao).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-8 py-4 text-right">
                        <span className="text-sm font-bold text-green-600">
                          R$ {receita.valor.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Despesas */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Despesas (Saídas)</h3>
            <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg uppercase tracking-wider">
              {despesas.length} itens
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="px-8 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                  <th className="px-8 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {despesas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-slate-400 text-sm font-medium">
                      Nenhuma despesa encontrada
                    </td>
                  </tr>
                ) : (
                  despesas.map((despesa) => (
                    <tr key={despesa.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-4">
                        <p className="text-sm font-bold text-slate-900">{despesa.descricao}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {despesa.categoria || 'Geral'} • {getFormaPagamentoEmoji(despesa.forma_pagamento)} {despesa.forma_pagamento}
                        </p>
                      </td>
                      <td className="px-8 py-4 text-sm font-medium text-slate-900">
                        {new Date(despesa.data_transacao).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-8 py-4 text-right">
                        <span className="text-sm font-bold text-red-600">
                          -R$ {despesa.valor.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditDespesa(despesa)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteDespesa(despesa.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
      </div>

      {/* Modal Despesa */}
      {showModalDespesa && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
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
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {erro && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{erro}</p>
              </div>
            )}

            <form onSubmit={handleSubmitDespesa} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Descrição</label>
                <input 
                  type="text"
                  value={formDespesa.descricao}
                  onChange={(e) => setFormDespesa({...formDespesa, descricao: e.target.value})}
                  placeholder="Ex: Aluguel, Material..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-semibold text-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Valor (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={formDespesa.valor}
                    onChange={(e) => setFormDespesa({...formDespesa, valor: e.target.value})}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-semibold text-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Data</label>
                  <input 
                    type="date"
                    value={formDespesa.data_transacao}
                    onChange={(e) => setFormDespesa({...formDespesa, data_transacao: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-semibold text-slate-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Categoria</label>
                <input 
                  type="text"
                  value={formDespesa.categoria}
                  onChange={(e) => setFormDespesa({...formDespesa, categoria: e.target.value})}
                  placeholder="Ex: Aluguel, Suprimentos..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-semibold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Forma de Pagamento</label>
                <select
                  value={formDespesa.forma_pagamento}
                  onChange={(e) => setFormDespesa({...formDespesa, forma_pagamento: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-slate-700"
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
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
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
