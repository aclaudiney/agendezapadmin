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
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
          <span key={d} className="text-[10px] font-bold text-slate-400">{d}</span>
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
      const [agendamentosRes, clientesRes, profissionaisRes, servicosRes] = await Promise.all([
        supabase.from('agendamentos')
          .select('id, cliente_id, profissional_id, servico_id, data_agendamento, hora_agendamento, status, origem, forma_pagamento, valor_pago, data_pagamento, company_id, created_at')
          .eq('company_id', companyId)
          .order('data_agendamento', { ascending: true })
          .order('hora_agendamento', { ascending: true }),
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
    setErro('');
    setSaving(true);

    if (!formData.cliente_id || !formData.profissional_id || !formData.servico_id || !formData.data_agendamento || !formData.hora_agendamento) {
      setErro('Preencha todos os campos obrigatórios');
      setSaving(false);
      return;
    }

    // Validação de especialidade do profissional
    const profissionalSel = profissionais.find(p => p.id === formData.profissional_id);
    const servicoSel = servicos.find(s => s.id === formData.servico_id);
    if (profissionalSel && servicoSel && profissionalSel.especialidade) {
      const esp = String(profissionalSel.especialidade || '').toLowerCase();
      const nomeServico = String(servicoSel.nome || '').toLowerCase();
      if (!esp.includes(nomeServico)) {
        setErro(`${profissionalSel.nome} não realiza "${servicoSel.nome}"`);
        setSaving(false);
        return;
      }
    }

    try {
      const companyId = localStorage.getItem('companyId');
      if (!companyId) {
        setErro('Company ID não encontrado');
        setSaving(false);
        return;
      }

      const isEdit = !!formData.id;
      let agendamentoId = formData.id;

      const dataToSave: any = {
        company_id: companyId,
        cliente_id: formData.cliente_id,
        profissional_id: formData.profissional_id,
        servico_id: formData.servico_id,
        data_agendamento: formData.data_agendamento,
        hora_agendamento: formData.hora_agendamento,
        status: formData.status,
        forma_pagamento: formData.status === 'finalizado' ? (formData.forma_pagamento || 'pix') : null,
        valor_pago: formData.status === 'finalizado' ? parseFloat(String(formData.valor_pago)) : null,
        data_pagamento: formData.status === 'finalizado' ? new Date().toISOString() : null,
      };

      if (isEdit) {
        const { error } = await supabase
          .from('agendamentos')
          .update(dataToSave)
          .eq('id', formData.id)
          .eq('company_id', companyId);

        if (error) throw error;
      } else {
        dataToSave.origem = 'web';
        const { data, error } = await supabase.from('agendamentos').insert([dataToSave]).select();
        if (error) throw error;
        if (data && data.length > 0) {
          agendamentoId = data[0].id;
        }
      }

      // ✅ LÓGICA FINANCEIRA SE STATUS FOR FINALIZADO
      if (formData.status === 'finalizado') {
        const cliente = clientes.find(c => c.id === formData.cliente_id);
        const servico = servicos.find(s => s.id === formData.servico_id);
        
        // Verificar se já existe registro financeiro para este agendamento
        const { data: existingFin } = await supabase
          .from('financeiro')
          .select('id')
          .eq('agendamento_id', agendamentoId)
          .eq('company_id', companyId)
          .maybeSingle();

        const finData = {
          company_id: companyId,
          tipo: 'receita',
          descricao: `${cliente?.nome || 'Cliente'} - ${servico?.nome || 'Serviço'}`,
          valor: parseFloat(String(formData.valor_pago)),
          forma_pagamento: (formData.forma_pagamento || 'pix').toLowerCase(),
          agendamento_id: agendamentoId,
          cliente_id: formData.cliente_id,
          data_transacao: new Date().toISOString()
        };

        if (existingFin) {
          await supabase.from('financeiro').update(finData).eq('id', existingFin.id);
        } else {
          await supabase.from('financeiro').insert([finData]);
        }
      }

      setShowModal(false);
      setFormData({
        id: '',
        cliente_id: '',
        profissional_id: '',
        servico_id: '',
        data_agendamento: '',
        hora_agendamento: '',
        status: 'pendente',
        forma_pagamento: '',
        valor_pago: '',
      });
      await fetchData();
    } catch (error: any) {
      console.error('❌ Erro ao salvar agendamento:', error);
      setErro(error?.message || 'Erro ao salvar agendamento');
    } finally {
      setSaving(false);
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

      // SE FOR FINALIZADO, ABRIR MODAL DE EDIÇÃO COM CAMPOS DE PAGAMENTO
      if (novoStatusValue === 'finalizado') {
        const apt = agendamentos.find(a => a.id === aptId);
        if (apt) {
          const servico = servicos.find(s => s.id === apt.servico_id);
          setFormData({
            id: apt.id,
            cliente_id: apt.cliente_id,
            profissional_id: apt.profissional_id,
            servico_id: apt.servico_id,
            data_agendamento: apt.data_agendamento,
            hora_agendamento: apt.hora_agendamento,
            status: 'finalizado',
            forma_pagamento: apt.forma_pagamento || 'pix',
            valor_pago: apt.valor_pago || servico?.preco || '',
          });
          setShowModal(true);
          setEditandoId(null);
        }
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
                      <span className="text-sm text-slate-600">{profissional?.nome || 'Sem profissional'}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="text-sm text-slate-800 font-medium">{formatarDataString(apt.data_agendamento)}</div>
                      <div className="text-xs text-indigo-600 font-bold">{apt.hora_agendamento}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                      <span className="text-sm font-bold text-green-600">R$ {servico?.preco?.toFixed(2) || '0.00'}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded capitalize">
                        {apt.status === 'finalizado' ? (apt.forma_pagamento || '-') : '-'}
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
                              setNovoStatus(apt.status || '');
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
                            title="Editar status"
                          >
                            <MoreVertical size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              const servico = servicos.find(s => s.id === apt.servico_id);
                              setFormData({
                                id: apt.id,
                                cliente_id: apt.cliente_id,
                                profissional_id: apt.profissional_id,
                                servico_id: apt.servico_id,
                                data_agendamento: apt.data_agendamento,
                                hora_agendamento: apt.hora_agendamento,
                                status: apt.status,
                                forma_pagamento: apt.forma_pagamento || 'pix',
                                valor_pago: apt.valor_pago || servico?.preco || '',
                              });
                              setShowModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
                            title="Editar agendamento"
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
