import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, Filter, Download, MoreVertical, Plus, X, AlertCircle, Edit2, Check, CreditCard, Trash2 } from 'lucide-react';

const ComboSelect = ({ 
  options, 
  value, 
  onChange, 
  getOptionValue, 
  getOptionLabel, 
  placeholder 
}: { 
  options: any[]; 
  value: string; 
  onChange: (val: string) => void; 
  getOptionValue: (o: any) => string; 
  getOptionLabel: (o: any) => string; 
  placeholder: string; 
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(o => {
    const label = getOptionLabel(o).toLowerCase();
    const digits = String(getOptionLabel(o).replace(/\D/g, ''));
    const q = query.toLowerCase();
    const qDigits = query.replace(/\D/g, '');
    return q ? (label.includes(q) || (qDigits ? digits.includes(qDigits) : false)) : true;
  });

  const selectedLabel = (() => {
    const sel = options.find(o => getOptionValue(o) === value);
    return sel ? getOptionLabel(sel) : '';
  })();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[highlight];
      if (item) {
        onChange(getOptionValue(item));
        setOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      >
        <span className="text-sm text-slate-700">{selectedLabel || placeholder}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="relative p-2 border-b border-slate-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por nome ou telefone..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
            />
          </div>
          <ul className="max-h-60 overflow-auto">
            {filtered.map((o, idx) => (
              <li
                key={getOptionValue(o)}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => { onChange(getOptionValue(o)); setOpen(false); setQuery(''); }}
                className={`px-3 py-2 cursor-pointer text-sm ${idx === highlight ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                {getOptionLabel(o)}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">Nenhum resultado</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const MiniCalendar = ({ 
  agendamentos, 
  onSelectDate, 
  selectedDate 
}: { 
  agendamentos: any[]; 
  onSelectDate: (date: string) => void; 
  selectedDate: string; 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Agendamentos por dia
  const counts: Record<string, number> = {};
  agendamentos.forEach(a => {
    if (a.data_agendamento) {
      counts[a.data_agendamento] = (counts[a.data_agendamento] || 0) + 1;
    }
  });

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const count = counts[dateStr] || 0;
    const isSelected = selectedDate === dateStr;
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    
    days.push(
      <button
        key={d}
        onClick={() => onSelectDate(dateStr)}
        className={`
          h-8 w-8 rounded-full flex items-center justify-center text-xs relative transition-colors
          ${isSelected ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}
          ${isToday && !isSelected ? 'border border-indigo-600 text-indigo-600 font-bold' : ''}
        `}
      >
        {d}
        {count > 0 && !isSelected && (
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full" />
        )}
      </button>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto min-w-[300px]">
      <div className="flex items-center justify-between mb-4">
        <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded text-slate-600">
          <span className="text-lg">◀</span>
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {monthNames[month]} {year}
        </span>
        <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded text-slate-600">
          <span className="text-lg">▶</span>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, index) => (
          <span key={`weekday-${index}`} className="text-[10px] font-bold text-slate-400">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 place-items-center">
        {days}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
         <button 
           onClick={() => onSelectDate('')}
           className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
         >
           Limpar seleção de data
         </button>
      </div>
    </div>
  );
};

const Appointments: React.FC = () => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [profissionalFiltro, setProfissionalFiltro] = useState('');
  const [dataFiltro, setDataFiltro] = useState('');
  const [viewMode, setViewMode] = useState<'upcoming' | 'all'>('upcoming'); // ✅ NOVO ESTADO
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [agendamentoServicos, setAgendamentoServicos] = useState<any[]>([]);
  const [buscaServico, setBuscaServico] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [erro, setErro] = useState('');

  // ✅ FUNÇÃO PARA FORMATAR DATA CORRETAMENTE (SEM TIMEZONE)
  const formatarDataString = (dataStr: string): string => {
    try {
      const [year, month, day] = dataStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dataStr;
    }
  };

  // Estado para edição de status
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoStatus, setNovoStatus] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    id: '', // Adicionado id para edição
    cliente_id: '',
    profissional_id: '',
    servico_id: '',
    servicos_ids: [] as string[],
    data_agendamento: '',
    hora_agendamento: '',
    status: 'pendente',
    forma_pagamento: '',
    valor_pago: '',
  });

  const [saving, setSaving] = useState(false); // Adicionado estado de loading no salvamento

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ BUSCAR DADOS COM FILTRO POR COMPANY_ID
  const fetchData = async () => {
    try {
      setLoading(true);
      const CACHE_TTL_MS = 120000;

      // ✅ PEGAR COMPANY_ID DO LOCALSTORAGE
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      console.log('🔍 Buscando dados para company_id:', companyId);

      try {
        const cacheA = localStorage.getItem(`cache_agendamentos_${companyId}`);
        const cacheC = localStorage.getItem(`cache_clientes_${companyId}`);
        const cacheP = localStorage.getItem(`cache_profissionais_${companyId}`);
        const cacheS = localStorage.getItem(`cache_servicos_${companyId}`);
        const now = Date.now();
        const parsedA = cacheA ? JSON.parse(cacheA) : null;
        const parsedC = cacheC ? JSON.parse(cacheC) : null;
        const parsedP = cacheP ? JSON.parse(cacheP) : null;
        const parsedS = cacheS ? JSON.parse(cacheS) : null;
        if (parsedA && now - (parsedA.ts || 0) < CACHE_TTL_MS) setAgendamentos(parsedA.data || []);
        if (parsedC && now - (parsedC.ts || 0) < CACHE_TTL_MS) setClientes(parsedC.data || []);
        if (parsedP && now - (parsedP.ts || 0) < CACHE_TTL_MS) setProfissionais(parsedP.data || []);
        if (parsedS && now - (parsedS.ts || 0) < CACHE_TTL_MS) setServicos(parsedS.data || []);
      } catch {}

      // ✅ BUSCAR DADOS FILTRANDO POR COMPANY_ID
      const [agendamentosRes, agendamentoServicosRes, clientesRes, profissionaisRes, servicosRes] = await Promise.all([
        supabase.from('agendamentos')
          .select(`
            *,
            agendamento_servicos(
              servico_id,
              valor
            )
          `)
          .eq('company_id', companyId)
          .order('data_agendamento', { ascending: true })
          .order('hora_agendamento', { ascending: true }),
        supabase.from('agendamento_servicos')
          .select('agendamento_id, servico_id, valor'),
        supabase.from('clientes')
          .select('id, nome, telefone')
          .eq('company_id', companyId),
        supabase.from('profissionais')
          .select('id, nome, ativo, telefone, especialidade')
          .eq('company_id', companyId),
        supabase.from('servicos')
          .select('id, nome, preco, duracao, ativo')
          .eq('company_id', companyId),
      ]);

      setAgendamentos(agendamentosRes.data || []);
      setAgendamentoServicos(agendamentoServicosRes.data || []);
      setClientes(clientesRes.data || []);
      setProfissionais(profissionaisRes.data || []);
      setServicos(servicosRes.data || []);
      try {
        localStorage.setItem(`cache_agendamentos_${companyId}`, JSON.stringify({ ts: Date.now(), data: agendamentosRes.data || [] }));
        localStorage.setItem(`cache_clientes_${companyId}`, JSON.stringify({ ts: Date.now(), data: clientesRes.data || [] }));
        localStorage.setItem(`cache_profissionais_${companyId}`, JSON.stringify({ ts: Date.now(), data: profissionaisRes.data || [] }));
        localStorage.setItem(`cache_servicos_${companyId}`, JSON.stringify({ ts: Date.now(), data: servicosRes.data || [] }));
      } catch {}

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
    setSaving(true);
    setErro('');

    // ✅ Calcular total real somando os preços dos serviços selecionados
    const valorTotal = formData.servicos_ids.reduce((sum, id) => {
      const s = servicos.find(item => item.id === id);
      return sum + parseFloat(s?.preco?.toString() || '0');
    }, 0);

    const servicosSelecionados = formData.servicos_ids.map(id => {
      const s = servicos.find(item => item.id === id);
      return { ...s, servico_id: id };
    });

    console.log('=== SALVANDO ===');
    console.log('Serviços:', servicosSelecionados);
    console.log('Valor total:', valorTotal);

    try {
      const companyId = localStorage.getItem('companyId');
      if (!companyId) throw new Error('Company ID não encontrado');

      // 1. Dados básicos do agendamento
      const payload = {
        cliente_id: formData.cliente_id,
        profissional_id: formData.profissional_id,
        servico_id: formData.servicos_ids.length > 0 ? formData.servicos_ids[0] : formData.servico_id,
        data_agendamento: formData.data_agendamento,
        hora_agendamento: formData.hora_agendamento,
        status: formData.status,
        forma_pagamento: formData.forma_pagamento || null,
        valor_pago: valorTotal,
        company_id: companyId
      };

      let agendamentoId = formData.id;

      if (agendamentoId) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('agendamentos')
          .update(payload)
          .eq('id', agendamentoId);
        if (updateError) throw updateError;
      } else {
        // INSERT
        const { data: insertData, error: insertError } = await supabase
          .from('agendamentos')
          .insert([payload])
          .select()
          .single();
        if (insertError) throw insertError;
        agendamentoId = insertData.id;
      }

      // 2. Deletar serviços antigos
      await supabase
        .from('agendamento_servicos')
        .delete()
        .eq('agendamento_id', agendamentoId);

      // 3. Inserir novos serviços
      if (formData.servicos_ids.length > 0) {
        const servicosParaInserir = formData.servicos_ids.map(sid => {
          const s = servicos.find(item => item.id === sid);
          return {
            agendamento_id: agendamentoId,
            servico_id: sid,
            valor: parseFloat(s?.preco?.toString() || '0')
          };
        });
        
        const { error: sError } = await supabase
          .from('agendamento_servicos')
          .insert(servicosParaInserir);
        if (sError) throw sError;
      }

      // 4. ATUALIZAR FINANCEIRO COM NOVO VALOR (CRÍTICO!)
      const cliente = clientes.find(c => c.id === formData.cliente_id);
      
      const { error: erroFinanceiro } = await supabase
        .from('financeiro')
        .upsert({
          company_id: companyId,
          agendamento_id: agendamentoId,
          tipo: 'receita',
          categoria: 'agendamento',
          descricao: `Agendamento - ${cliente?.nome || 'Cliente'}`,
          valor: valorTotal,
          metodo_pagamento: formData.forma_pagamento || 'pendente',
          data_transacao: formData.data_agendamento,
          status: formData.status === 'finalizado' ? 'pago' : 'pendente',
          data_pagamento: formData.status === 'finalizado' ? new Date().toISOString().split('T')[0] : null,
        }, { 
          onConflict: 'agendamento_id' 
        });
      
      if (erroFinanceiro) {
        console.error('Erro ao atualizar financeiro:', erroFinanceiro);
        throw erroFinanceiro;
      }

      console.log('✅ Financeiro atualizado com valor:', valorTotal);

      // 5. Sucesso!
      alert('Agendamento atualizado com sucesso!');
      setShowModal(false);
      fetchData(); // Recarregar tudo
      setFormData({
        id: '',
        cliente_id: '',
        profissional_id: '',
        servico_id: '',
        servicos_ids: [],
        data_agendamento: new Date().toISOString().split('T')[0],
        hora_agendamento: '',
        status: 'pendente',
        forma_pagamento: '',
        valor_pago: '',
      });
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert(`Erro: ${error.message}`);
      setErro(error.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // ✅ ATUALIZAR STATUS E ABRIR MODAL DE PAGAMENTO
  const handleAtualizarStatus = async (aptId: string, novoStatusValue: string, novaFormaPagamento?: string) => {
    try {
      // ✅ PEGAR COMPANY_ID
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      // SE FOR FINALIZADO (e não vier de uma atualização rápida de pagamento), ABRIR MODAL
      if (novoStatusValue === 'finalizado' && !novaFormaPagamento) {
        const apt = agendamentos.find(a => a.id === aptId);
        if (apt) {
          const aptServicos = agendamentoServicos
            .filter(as => as.agendamento_id === apt.id)
            .map(as => as.servico_id);
            
          const ids = aptServicos.length > 0 ? aptServicos : (apt.servico_id ? [apt.servico_id] : []);
          
          const valorTotal = ids.reduce((total, id) => {
            const s = servicos.find(serv => serv.id === id);
            return total + (s?.preco || 0);
          }, 0);

          setFormData({
            id: apt.id,
            cliente_id: apt.cliente_id,
            profissional_id: apt.profissional_id,
            servico_id: apt.servico_id || ids[0] || '',
            servicos_ids: ids,
            data_agendamento: apt.data_agendamento,
            hora_agendamento: apt.hora_agendamento,
            status: 'finalizado',
            forma_pagamento: apt.forma_pagamento || 'pix',
            valor_pago: apt.valor_pago || valorTotal || '',
          });
          setShowModal(true);
          setEditandoId(null);
        }
        return;
      }

      // PARA OUTROS STATUS OU ATUALIZAÇÃO RÁPIDA DE PAGAMENTO
      const updateData: any = {
        status: novoStatusValue
      };

      if (novaFormaPagamento) {
        updateData.forma_pagamento = novaFormaPagamento;
      }

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
          status: novoStatusValue,
          forma_pagamento: novaFormaPagamento || apt.forma_pagamento
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

  const filteredAgendamentos = agendamentos
    .filter(a => {
      // ✅ 1. Filtro de Data (Prioridade: Data Específica > ViewMode)
      if (dataFiltro) return a.data_agendamento === dataFiltro;
      
      if (viewMode === 'upcoming') {
          const hoje = new Date().toISOString().split('T')[0];
          return a.data_agendamento >= hoje;
      }
      return true;
    })
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => profissionalFiltro === '' || a.profissional_id === profissionalFiltro)
    // .filter(a => dataFiltro === '' || a.data_agendamento === dataFiltro) // REMOVIDO pois já tratamos acima
    .filter(a => {
      const cliente = clientes.find(c => c.id === a.cliente_id);
      return cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
             cliente?.telefone.includes(searchTerm);
    });

  const onlyDigits = (v: string | undefined | null) => String(v || '').replace(/\D/g, '');
  const formatPhone = (v: string | undefined | null) => {
    let d = onlyDigits(v);
    if (d.startsWith('55') && d.length > 11) d = d.slice(2);
    if (d.length === 11) {
      return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    }
    if (d.length === 10) {
      return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    }
    return v || '';
  };

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

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ESQUERDA: Calendário e Modos */}
        <div className="w-full lg:w-auto space-y-4">
           <MiniCalendar 
             agendamentos={agendamentos} 
             selectedDate={dataFiltro} 
             onSelectDate={(d) => { setDataFiltro(d); if(d) setViewMode('all'); }} 
           />
           
           <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 min-w-[300px]">
             <label className="text-xs font-bold text-slate-500 uppercase px-2">Visualização</label>
             <button 
                onClick={() => { setViewMode('upcoming'); setDataFiltro(''); }}
                className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'upcoming' && !dataFiltro ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
             >
                📅 Hoje + Próximos
             </button>
             <button 
                onClick={() => { setViewMode('all'); setDataFiltro(''); }}
                className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'all' && !dataFiltro ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
             >
                🗂️ Todos
             </button>
           </div>
        </div>

        {/* DIREITA: Lista */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
          {/* FILTROS */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            </div>

            {(searchTerm || filter !== 'all' || profissionalFiltro || dataFiltro) && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilter('all');
                    setProfissionalFiltro('');
                    setDataFiltro('');
                    setViewMode('upcoming'); // Reset to default
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
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase hidden sm:table-cell">Serviço(s)</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase hidden md:table-cell">Profissional</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Data/Hora</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase hidden lg:table-cell">Valor</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase hidden lg:table-cell">Origem</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase hidden lg:table-cell">Pagamento</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="sticky right-0 bg-white shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.1)] px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAgendamentos.map((apt) => {
                const cliente = clientes.find(c => c.id === apt.cliente_id);
                const aptServicos = agendamentoServicos.filter(as => as.agendamento_id === apt.id);
                
                const valorTotal = aptServicos.length > 0
                  ? aptServicos.reduce((total, as) => total + (servicos.find(s => s.id === as.servico_id)?.preco || 0), 0)
                  : (servicos.find(s => s.id === apt.servico_id)?.preco || 0);

                const profissional = profissionais.find(p => p.id === apt.profissional_id);

                return (
                  <tr key={apt.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-800 text-sm">{cliente?.nome}</div>
                      <div className="text-xs text-slate-400">{formatPhone(cliente?.telefone)}</div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {aptServicos.length > 0 ? aptServicos.map(as => {
                          const s = servicos.find(item => item.id === as.servico_id);
                          return (
                            <span key={as.servico_id} className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-medium border border-indigo-100">
                              {s?.nome}
                            </span>
                          );
                        }) : (
                          <span className="bg-slate-50 text-slate-600 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-100">
                            {servicos.find(s => s.id === apt.servico_id)?.nome || 'Sem serviço'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-sm text-slate-600">
                      {profissional?.nome || 'Sem profissional'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-slate-800 font-medium">{formatarDataString(apt.data_agendamento)}</div>
                      <div className="text-xs text-indigo-600 font-bold">{apt.hora_agendamento}</div>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-sm font-bold text-green-600">
                        R$ {(() => {
                          // Soma os valores dos serviços vinculados na agendamento_servicos
                          const servicosDoApt = agendamentoServicos.filter(as => as.agendamento_id === apt.id);
                          if (servicosDoApt.length > 0) {
                            return servicosDoApt.reduce((sum, as) => sum + (parseFloat(as.valor?.toString()) || 0), 0).toFixed(2);
                          }
                          // Fallback para o valor_pago se não houver registros na agendamento_servicos
                          return (parseFloat(apt.valor_pago?.toString()) || 0).toFixed(2);
                        })()}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                       {apt.origem === 'whatsapp' ? (
                         <span className="flex items-center gap-1 text-[10px] font-bold text-green-600">💬 WhatsApp</span>
                       ) : (
                         <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600">🔗 Link</span>
                       )}
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <select 
                        value={apt.forma_pagamento || 'pendente'} 
                        onChange={(e) => handleAtualizarStatus(apt.id, apt.status, e.target.value)}
                        className="text-xs border border-slate-200 rounded p-1 bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                      >
                        <option value="pendente">Pendente</option>
                        <option value="pix">PIX</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusColor(apt.status)}`}>
                        {getStatusLabel(apt.status)}
                      </span>
                    </td>
                    <td className="sticky right-0 bg-white shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.1)] px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => {
                            const aptServicosIds = agendamentoServicos
                              .filter(as => as.agendamento_id === apt.id)
                              .map(as => as.servico_id);
                              
                            const ids = aptServicosIds.length > 0 ? aptServicosIds : (apt.servico_id ? [apt.servico_id] : []);
                            
                            const valorTotal = ids.reduce((total, id) => {
                              const s = servicos.find(serv => serv.id === id);
                              return total + (s?.preco || 0);
                            }, 0);

                            setFormData({
                              id: apt.id,
                              cliente_id: apt.cliente_id,
                              profissional_id: apt.profissional_id,
                              servico_id: apt.servico_id || ids[0] || '',
                              servicos_ids: ids,
                              data_agendamento: apt.data_agendamento,
                              hora_agendamento: apt.hora_agendamento,
                              status: apt.status,
                              forma_pagamento: apt.forma_pagamento || 'pix',
                              valor_pago: apt.valor_pago || valorTotal || '',
                            });
                            setShowModal(true);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteAgendamento(apt.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
      </div>

      {/* MODAL DE NOVO AGENDAMENTO */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10">
              <h3 className="text-2xl font-bold text-slate-800">
                {formData.id ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h3>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setFormData({
                    id: null,
                    cliente_id: '',
                    profissional_id: '',
                    servico_id: '',
                    servicos_ids: [],
                    data_agendamento: new Date().toISOString().split('T')[0],
                    hora_agendamento: '',
                    status: 'pendente',
                    forma_pagamento: '',
                    valor_pago: '',
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cliente *</label>
              <ComboSelect
                options={clientes}
                value={formData.cliente_id}
                onChange={(val) => setFormData({ ...formData, cliente_id: val })}
                getOptionValue={(c: any) => c.id}
                getOptionLabel={(c: any) => `${c.nome} — ${formatPhone(c.telefone)}`}
                placeholder="Selecione um cliente"
              />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Profissional *</label>
              <ComboSelect
                options={profissionais}
                value={formData.profissional_id}
                onChange={(val) => setFormData({ ...formData, profissional_id: val })}
                getOptionValue={(p: any) => p.id}
                getOptionLabel={(p: any) => `${p.nome}${p.telefone ? ` — ${formatPhone(p.telefone)}` : ''}`}
                placeholder="Selecione um profissional"
              />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Serviços Selecionados</label>
                <div className="space-y-2 mb-4">
                  {formData.servicos_ids.length === 0 ? (
                    <p className="text-slate-400 text-xs italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                      Nenhum serviço selecionado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {formData.servicos_ids.map((sid, index) => {
                        const s = servicos.find(item => item.id === sid);
                        return (
                          <div key={`${sid}-${index}`} className="flex items-center gap-2 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 group">
                            <span className="flex-1 text-sm text-slate-700 font-medium">{s?.nome}</span>
                            <span className="text-xs font-bold text-indigo-600">R$ {s?.preco?.toFixed(2)}</span>
                            <button 
                              type="button"
                              onClick={() => {
                            const newIds = formData.servicos_ids.filter((_, i) => i !== index);
                            
                            // ✅ CALCULAR TOTAL COM DEBUG
                            const novoValor = newIds.reduce((total, id) => {
                              const serv = servicos.find(item => item.id === id);
                              const valor = parseFloat(serv?.preco?.toString() || '0');
                              console.log('Removendo - Serviço:', serv?.nome, 'Valor:', valor);
                              return total + valor;
                            }, 0);
                            
                            console.log('Total calculado após remoção:', novoValor);

                            setFormData({
                              ...formData,
                              servicos_ids: newIds,
                              servico_id: newIds[0] || '',
                              valor_pago: novoValor || ''
                            });
                              }}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Adicionar Serviço</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      placeholder="Buscar serviço para adicionar..."
                      value={buscaServico}
                      onChange={(e) => setBuscaServico(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  
                  {buscaServico && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {servicos
                        .filter(s => s.nome.toLowerCase().includes(buscaServico.toLowerCase()))
                        .map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              if (formData.servicos_ids.includes(s.id)) {
                                toast.error('Serviço já adicionado');
                                return;
                              }
                              const newIds = [...formData.servicos_ids, s.id];
                              
                              // ✅ CALCULAR TOTAL COM DEBUG
                              const novoValor = newIds.reduce((total, id) => {
                                const serv = servicos.find(item => item.id === id);
                                const valor = parseFloat(serv?.preco?.toString() || '0');
                                console.log('Adicionando - Serviço:', serv?.nome, 'Valor:', valor);
                                return total + valor;
                              }, 0);
                              
                              console.log('Total calculado após adição:', novoValor);

                              setFormData({
                                ...formData,
                                servicos_ids: newIds,
                                servico_id: newIds[0] || '',
                                valor_pago: novoValor || ''
                              });
                              setBuscaServico('');
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-indigo-50 flex justify-between items-center transition-colors border-b border-slate-50 last:border-0"
                          >
                            <span className="text-sm text-slate-700">{s.nome}</span>
                            <span className="text-xs font-bold text-indigo-600">R$ {s.preco?.toFixed(2)}</span>
                          </button>
                        ))}
                      {servicos.filter(s => s.nome.toLowerCase().includes(buscaServico.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-xs text-slate-400 italic text-center">Nenhum serviço encontrado</div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">Total:</span>
                  <span className="text-lg font-bold text-green-600">
                    R$ {parseFloat(formData.valor_pago?.toString() || '0').toFixed(2)}
                  </span>
                </div>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Status do Agendamento</label>
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

              {/* Informações de Pagamento */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <CreditCard size={16} className="text-indigo-600" />
                  Informações de Pagamento
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Status do Pagamento</label>
                    <select 
                      value={formData.status === 'finalizado' ? 'pago' : 'pendente'}
                      onChange={(e) => {
                        const newStatus = e.target.value === 'pago' ? 'finalizado' : 'pendente';
                        setFormData({
                          ...formData, 
                          status: newStatus,
                          forma_pagamento: newStatus === 'finalizado' ? (formData.forma_pagamento || 'pix') : ''
                        });
                      }}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Forma de Pagamento</label>
                    <select 
                      value={formData.forma_pagamento}
                      onChange={(e) => setFormData({...formData, forma_pagamento: e.target.value})}
                      disabled={formData.status !== 'finalizado'}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">Selecione</option>
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Valor Pago (R$)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={formData.valor_pago}
                      onChange={(e) => setFormData({...formData, valor_pago: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-green-600"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    formData.id ? 'Salvar Alterações' : 'Criar Agendamento'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE DELEÇÃO JÁ É NATIVO (window.confirm) */}
    </div>
  );
};

export default Appointments;
