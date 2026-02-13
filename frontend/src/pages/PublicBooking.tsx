import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { API_URL } from '../config/api';
import {
  AlertCircle, Share2, Copy, X, Clock,
  MapPin, Phone, Facebook, Instagram,
  ChevronLeft, ChevronRight, Search, Plus, ChevronDown, ArrowLeft, CheckCircle, User, LogOut, Calendar
} from 'lucide-react';

interface PublicBookingProps {
  slug: string;
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracao: number;
  categoria?: string;
  company_id?: string;
}

interface Profissional {
  id: string;
  nome: string;
}

interface Agendamento {
  id: string;
  cliente_id: string;
  profissional_id: string;
  servico_id: string;
  data_agendamento: string;
  hora_agendamento: string;
  status: string;
  company_id?: string;
}

interface ServicoSelecionado extends Servico {
  profissional_id?: string;
  data_agendamento?: string;
  hora_agendamento?: string;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  company_id: string;
}

type ModalStep = 'servicos' | 'resumo' | 'telefone' | 'nome' | 'confirmacao' | 'sucesso';

const PublicBooking: React.FC<PublicBookingProps> = ({ slug }) => {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [servicosSelecionados, setServicosSelecionados] = useState<ServicoSelecionado[]>([]);

  // ✅ FUNÇÃO PARA OBTER DIA DA SEMANA COM DATA CORRETA
  const obterDiaSemanaData = (dataStr: string): string => {
    const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    const [year, month, day] = dataStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const diaSemana = diasSemana[date.getDay()];
    const nomeMes = meses[date.getMonth()];

    return `${diaSemana}, ${String(day).padStart(2, '0')} de ${nomeMes}`;
  };

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandirHorarios, setExpandirHorarios] = useState(false);

  const [diaAtual, setDiaAtual] = useState<string>('');
  const [horaAtual, setHoraAtual] = useState<string>('');
  const [profissionalAtual, setProfissionalAtual] = useState<string>('sem-preferencia');
  const [servicoEmEdicao, setServicoEmEdicao] = useState<Servico | null>(null);
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<Record<string, boolean>>({ manha: false, tarde: false, noite: false });
  const [periodoAtual, setPeriodoAtual] = useState<'manha' | 'tarde' | 'noite' | ''>('');
  const horariosScrollRef = useRef<HTMLDivElement>(null);

  const [modalStep, setModalStep] = useState<ModalStep>('servicos');
  const [telefoneInput, setTelefoneInput] = useState('');
  const [nomeInput, setNomeInput] = useState('');
  const [clienteLogado, setClienteLogado] = useState<Cliente | null>(null);
  const [erroMsg, setErroMsg] = useState('');
  const [loadingVerificacao, setLoadingVerificacao] = useState(false);
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState<any>(null);
  const [showPerfilMenu, setShowPerfilMenu] = useState(false);

  // ✅ FUNÇÃO PARA FORMATAR DATA CORRETAMENTE (SEM TIMEZONE)
  const formatarDataString = (dataStr: string): string => {
    try {
      const [year, month, day] = dataStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dataStr;
    }
  };

  useEffect(() => {
    if (!companyId) return;
    const clienteSalvo = localStorage.getItem(`clienteLogado_${companyId}`);
    if (clienteSalvo) {
      setClienteLogado(JSON.parse(clienteSalvo));
    }
  }, [companyId]);

  useEffect(() => {
    const buscarEmpresa = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id')
          .eq('slug', slug)
          .single();

        if (error || !data) {
          setErro('Loja não encontrada');
          setLoading(false);
          return;
        }

        setCompanyId(data.id);
      } catch (error) {
        setErro('Erro ao carregar loja');
        setLoading(false);
      }
    };

    buscarEmpresa();
  }, [slug]);

  useEffect(() => {
    if (!companyId) return;

    const fetchData = async () => {
      try {
        const [configRes, servicosRes, profissionaisRes, agendamentosRes] = await Promise.all([
          supabase.from('configuracoes').select('*').eq('company_id', companyId).single(),
          supabase.from('servicos').select('*').eq('company_id', companyId),
          supabase.from('profissionais').select('*').eq('company_id', companyId),
          supabase.from('agendamentos').select('*').eq('company_id', companyId).neq('status', 'cancelado'),
        ]);

        if (configRes.data) setConfig(configRes.data);
        if (servicosRes.data) setServicos(servicosRes.data);
        if (profissionaisRes.data) setProfissionais(profissionaisRes.data);
        if (agendamentosRes.data) setAgendamentos(agendamentosRes.data);

        setLoading(false);
      } catch (error) {
        console.error('Erro:', error);
        setErro('Erro ao carregar dados');
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId]);

  const gerarProximosDias = () => {
    const dias = [];
    const hoje = new Date();
    for (let i = 0; i < 30; i++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + i);
      dias.push(data);
    }
    return dias;
  };

  // ✅ FUNÇÃO PARA CONVERTER DATE PARA STRING YYYY-MM-DD SEM TIMEZONE
  const dateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const obterHorarioDoDia = (data: Date) => {
    const diasMap: Record<number, string> = {
      0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta',
      4: 'quinta', 5: 'sexta', 6: 'sabado'
    };

    const dataAjustada = new Date(data.getTime() + data.getTimezoneOffset() * 60000);
    const diaName = diasMap[dataAjustada.getDay()];
    const diasAberturaJSON = typeof config?.dias_abertura === 'string'
      ? JSON.parse(config.dias_abertura)
      : config?.dias_abertura;

    const aberto = diasAberturaJSON?.[diaName];
    const horarioKey = `horario_${diaName}`;
    const horario = config?.[horarioKey];

    if (!aberto || !horario) return null;

    const partes = horario.split('-');
    if (partes.length !== 2) return null;

    const [inicio, fim] = partes;
    return { inicio: inicio.trim(), fim: fim.trim() };
  };

  const gerarTodosHorarios = () => {
    if (!diaAtual) return [];

    const horarioDia = obterHorarioDoDia(new Date(diaAtual));
    if (!horarioDia) return [];

    const [horaInicioStr] = horarioDia.inicio.split(':');
    const [horaFimStr] = horarioDia.fim.split(':');
    const hInicio = parseInt(horaInicioStr.trim());
    const hFim = parseInt(horaFimStr.trim());

    const agora = new Date();
    const hoje = dateToString(new Date());
    let horarioAtualMinutos = 0;

    if (diaAtual === hoje) {
      horarioAtualMinutos = agora.getHours() * 60 + agora.getMinutes();
      horarioAtualMinutos = Math.ceil(horarioAtualMinutos / 30) * 30;
    }

    const horarios = [];
    for (let h = hInicio; h < hFim; h++) {
      for (let m = 0; m < 60; m += 30) {
        const minutos = h * 60 + m;

        if (diaAtual === hoje && minutos < horarioAtualMinutos) {
          continue;
        }

        const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        if (!isHorarioOcupado(hora)) {
          horarios.push(hora);
        }
      }
    }

    return horarios;
  };

  const filtrarHorariosPorPeriodo = (horarios: string[], periodo: string) => {
    return horarios.filter(hora => {
      const [h] = hora.split(':').map(Number);

      if (periodo === 'manha') return h >= 8 && h < 12;
      if (periodo === 'tarde') return h >= 12 && h < 18;
      if (periodo === 'noite') return h >= 18;

      return false;
    });
  };

  useEffect(() => {
    if (!diaAtual) return;

    const todosHorarios = gerarTodosHorarios();

    setPeriodosDisponiveis({
      manha: filtrarHorariosPorPeriodo(todosHorarios, 'manha').length > 0,
      tarde: filtrarHorariosPorPeriodo(todosHorarios, 'tarde').length > 0,
      noite: filtrarHorariosPorPeriodo(todosHorarios, 'noite').length > 0,
    });

    if (filtrarHorariosPorPeriodo(todosHorarios, 'manha').length > 0) {
      setPeriodoAtual('manha');
    } else if (filtrarHorariosPorPeriodo(todosHorarios, 'tarde').length > 0) {
      setPeriodoAtual('tarde');
    } else if (filtrarHorariosPorPeriodo(todosHorarios, 'noite').length > 0) {
      setPeriodoAtual('noite');
    }
  }, [diaAtual, config]);

  const isHorarioOcupado = (hora: string): boolean => {
    if (!servicoEmEdicao || !diaAtual) return false;
    if (profissionalAtual === 'sem-preferencia') return false;

    const [hReq, mReq] = hora.split(':').map(Number);
    const minutoReq = hReq * 60 + mReq;
    const fimReq = minutoReq + servicoEmEdicao.duracao;

    return agendamentos.some(ag => {
      if (ag.profissional_id !== profissionalAtual || ag.data_agendamento !== diaAtual || ag.status === 'cancelado') {
        return false;
      }

      const [hAg, mAg] = ag.hora_agendamento.split(':').map(Number);
      const minutoAg = hAg * 60 + mAg;
      const servico = servicos.find(s => s.id === ag.servico_id);
      const fimAg = minutoAg + (servico?.duracao || 30);

      return !(fimReq <= minutoAg || minutoReq >= fimAg);
    });
  };

  const handleVerificarTelefone = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMsg('');
    setLoadingVerificacao(true);

    try {
      const telefoneLimpo = telefoneInput.replace(/\D/g, '');

      if (telefoneLimpo.length < 10) {
        setErroMsg('Telefone inválido (mínimo 10 dígitos)');
        setLoadingVerificacao(false);
        return;
      }

      const telefoneFull = '55' + telefoneLimpo;

      const { data: clientes } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefone', telefoneFull)
        .eq('company_id', companyId);

      if (clientes && clientes.length > 0) {
        // ✅ CLIENTE ENCONTRADO
        setClienteLogado(clientes[0]);
        localStorage.setItem(`clienteLogado_${companyId}`, JSON.stringify(clientes[0]));

        // ✅ SE TEM SERVIÇOS SELECIONADOS, VAI PRA CONFIRMAÇÃO
        // ✅ SE NÃO TEM, FECHA O MODAL (login feito com sucesso)
        if (servicosSelecionados.length > 0) {
          setModalStep('confirmacao');
        } else {
          setShowBookingModal(false);
          setTelefoneInput('');
          setNomeInput('');
        }
      } else {
        // ✅ CLIENTE NÃO EXISTE - PEDE NOME
        setModalStep('nome');
      }
    } catch (error: any) {
      console.error('❌ Erro:', error);
      setErroMsg('Erro ao verificar telefone');
    } finally {
      setLoadingVerificacao(false);
    }
  };

  const handleCriarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMsg('');
    setLoadingVerificacao(true);

    try {
      if (!nomeInput.trim()) {
        setErroMsg('Digite seu nome completo');
        setLoadingVerificacao(false);
        return;
      }

      const telefoneLimpo = telefoneInput.replace(/\D/g, '');
      const telefoneFull = '55' + telefoneLimpo;

      const { data: novoCliente, error } = await supabase
        .from('clientes')
        .insert([{
          nome: nomeInput.trim(),
          telefone: telefoneFull,
          company_id: companyId,
          ativo: true,
        }])
        .select()
        .single();

      if (error) {
        setErroMsg('Erro ao criar conta');
        throw error;
      }

      // ✅ CONTA CRIADA
      setClienteLogado(novoCliente);
      localStorage.setItem(`clienteLogado_${companyId}`, JSON.stringify(novoCliente));

      // ✅ SE TEM SERVIÇOS SELECIONADOS, VAI PRA CONFIRMAÇÃO
      // ✅ SE NÃO TEM, FECHA O MODAL (conta criada com sucesso)
      if (servicosSelecionados.length > 0) {
        setModalStep('confirmacao');
      } else {
        setShowBookingModal(false);
        setTelefoneInput('');
        setNomeInput('');
        alert('✅ Conta criada com sucesso!');
      }
    } catch (error: any) {
      console.error('❌ Erro:', error);
      setErroMsg('Erro ao criar conta');
    } finally {
      setLoadingVerificacao(false);
    }
  };

  const handleConfirmarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMsg('');
    setLoadingVerificacao(true);

    try {
      if (!clienteLogado) {
        setErroMsg('Erro ao confirmar: Cliente não identificado.');
        return;
      }

      // ✅ VERIFICAR SE O CLIENTE AINDA EXISTE NO BANCO (Evitar erro de FK)
      const { data: checkCliente, error: errorCheck } = await supabase
        .from('clientes')
        .select('id')
        .eq('id', clienteLogado.id)
        .eq('company_id', companyId)
        .single();

      if (errorCheck || !checkCliente) {
        console.warn('⚠️ Cliente não encontrado no banco. Limpando cache e pedindo login.');
        localStorage.removeItem(`clienteLogado_${companyId}`);
        setClienteLogado(null);
        setModalStep('telefone');
        setErroMsg('Sua sessão expirou ou o cliente não foi encontrado. Por favor, identifique-se novamente.');
        setLoadingVerificacao(false);
        return;
      }

      // ✅ BUSCAR AGENDAMENTOS ATUALIZADOS DO SUPABASE ANTES DE CONFIRMAR
      const { data: agendamentosAtualizados, error: erroFetch } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('company_id', companyId);

      if (erroFetch || !agendamentosAtualizados) {
        setErroMsg('Erro ao validar disponibilidade');
        setLoadingVerificacao(false);
        return;
      }

      // ✅ VALIDAR CADA SERVIÇO SELECIONADO CONTRA OS HORÁRIOS ATUALIZADOS
      for (const servico of servicosSelecionados) {
        const profissionalId = servico.profissional_id;

        if (!profissionalId) {
          continue;
        }

        const [hReq, mReq] = servico.hora_agendamento!.split(':').map(Number);
        const minutoReq = hReq * 60 + mReq;
        const fimReq = minutoReq + servico.duracao;

        const horarioOcupado = agendamentosAtualizados.some(ag => {
          if (ag.profissional_id !== profissionalId ||
            ag.data_agendamento !== servico.data_agendamento ||
            ag.status === 'cancelado') {
            return false;
          }

          const [hAg, mAg] = ag.hora_agendamento.split(':').map(Number);
          const minutoAg = hAg * 60 + mAg;
          const servicoAg = servicos.find(s => s.id === ag.servico_id);
          const fimAg = minutoAg + (servicoAg?.duracao || 30);

          return !(fimReq <= minutoAg || minutoReq >= fimAg);
        });

        if (horarioOcupado) {
          setErroMsg(`⚠️ O horário ${servico.hora_agendamento} do dia ${formatarDataString(servico.data_agendamento!)} com ${servico.profissional_id ? 'o profissional selecionado' : 'sem preferência'} já foi reservado. Escolha outro horário.`);
          setLoadingVerificacao(false);
          return;
        }
      }

      // ✅ SE PASSOU NA VALIDAÇÃO, SALVAR
      const agendamentosParaSalvar = servicosSelecionados.map(s => ({
        cliente_id: clienteLogado.id,
        servico_id: s.id,
        profissional_id: s.profissional_id || null,
        data_agendamento: s.data_agendamento,
        hora_agendamento: s.hora_agendamento,
        status: 'confirmado', // Alterado de 'pendente' para 'confirmado' para evitar conflito com agendamento_id se houver lógica de trigger/RPC
        origem: 'web',
        company_id: companyId,
      }));

      console.log('📝 [DEBUG] Tentando inserir agendamentos:', agendamentosParaSalvar);

      const { data: insertedData, error } = await supabase
        .from('agendamentos')
        .insert(agendamentosParaSalvar)
        .select('id');

      if (error) {
        console.error('❌ [ERRO SUPABASE]:', error);
        setErroMsg(`Erro ao confirmar: ${error.message || 'Verifique se o horário ainda está disponível'}`);
        throw error;
      }

      // 🔔 NOTIFICAR PROFISSIONAL (Link Público)
      if (insertedData && insertedData.length > 0) {
        insertedData.forEach(apt => {
          fetch(`${API_URL}/api/appointments/notify-new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: companyId, // Ajustado para companyId (minúsculo conforme esperado pela rota)
              appointmentId: apt.id
            })
          }).catch(err => console.error('⚠️ Erro ao disparar notificação:', err));
        });
      }

      // ✅ RECARREGAR AGENDAMENTOS APÓS SALVAR
      const { data: agendamentosNovos } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('company_id', companyId)
        .neq('status', 'cancelado');

      if (agendamentosNovos) {
        setAgendamentos(agendamentosNovos);
      }

      setAgendamentoConfirmado({
        cliente: clienteLogado,
        data: servicosSelecionados[0]?.data_agendamento,
        hora: servicosSelecionados[0]?.hora_agendamento,
      });

      setModalStep('sucesso');
    } catch (error: any) {
      console.error('❌ Erro:', error);
      setErroMsg('Erro ao confirmar agendamento');
    } finally {
      setLoadingVerificacao(false);
    }
  };

  const confirmarServico = () => {
    if (!servicoEmEdicao || !diaAtual || !horaAtual) {
      alert('Preencha todos os campos!');
      return;
    }

    // ✅ VALIDAR SE HORÁRIO TÁ OCUPADO
    if (profissionalAtual !== 'sem-preferencia') {
      if (isHorarioOcupado(horaAtual)) {
        setErroMsg('⚠️ Este horário já foi reservado! Escolha outro horário ou outro profissional.');
        return;
      }
    }

    const novoServico: ServicoSelecionado = {
      ...servicoEmEdicao,
      profissional_id: profissionalAtual === 'sem-preferencia' ? undefined : profissionalAtual,
      data_agendamento: diaAtual,
      hora_agendamento: horaAtual,
    };

    setServicosSelecionados([...servicosSelecionados, novoServico]);
    setModalStep('resumo');
    setServicoEmEdicao(null);
    setDiaAtual('');
    setHoraAtual('');
    setProfissionalAtual('sem-preferencia');
    setPeriodoAtual('manha');
    setErroMsg('');
  };

  const adicionarServico = (servico: Servico) => {
    setServicoEmEdicao(servico);

    // ✅ PRÉ-SELECIONAR DATA DE HOJE
    const hoje = dateToString(new Date());
    setDiaAtual(hoje);

    // ✅ PRÉ-SELECIONAR PROFISSIONAL SE TIVER SÓ 1
    if (profissionais.length === 1) {
      setProfissionalAtual(profissionais[0].id);
    } else {
      setProfissionalAtual('sem-preferencia');
    }

    setHoraAtual('');
    setPeriodoAtual('manha');
    setShowBookingModal(true);

    // ✅ SEMPRE ABRE EM 'servicos' (seleção)
    setModalStep('servicos');
    setErroMsg('');
  };

  const removerServico = (index: number) => {
    setServicosSelecionados(servicosSelecionados.filter((_, i) => i !== index));
  };

  const calcularTotal = () => servicosSelecionados.reduce((sum, s) => sum + s.preco, 0);
  const calcularDuracao = () => servicosSelecionados.reduce((sum, s) => sum + s.duracao, 0);

  const detectarPeriodoDoHorario = (hora: string): 'manha' | 'tarde' | 'noite' => {
    const [h] = hora.split(':').map(Number);
    if (h >= 12 && h < 18) return 'tarde';
    if (h >= 18) return 'noite';
    return 'manha';
  };

  const formatarHoraFim = (horaInicio: string, duracao: number) => {
    const [h, m] = horaInicio.split(':').map(Number);
    const minutos = h * 60 + m + duracao;
    const hFim = Math.floor(minutos / 60);
    const mFim = minutos % 60;
    return `${String(hFim).padStart(2, '0')}:${String(mFim).padStart(2, '0')}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('clienteLogado');
    localStorage.removeItem(`clienteLogado_${companyId}`);
    setClienteLogado(null);
    setShowPerfilMenu(false);
  };

  const linkCompartilhavel = `${window.location.origin}/${slug}`;
  const corTema = config?.cor_tema || '#0891b2';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-200 text-lg font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Erro</h1>
          <p className="text-white/60">{erro}</p>
        </div>
      </div>
    );
  }

  const fotos = config?.imagem_capa ? [config.imagem_capa] : [];
  const proximosDias = gerarProximosDias();
  const todosHorarios = gerarTodosHorarios();

  const servicosPorCategoria = servicos.reduce((acc, servico) => {
    const categoria = servico.categoria || 'Outros Serviços';
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(servico);
    return acc;
  }, {} as Record<string, Servico[]>);

  const getMesAnoIntervalo = () => {
    if (proximosDias.length === 0) return '';
    const primeiro = proximosDias[0];
    const ultimo = proximosDias[proximosDias.length - 1];

    if (primeiro.getMonth() === ultimo.getMonth()) {
      return primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else {
      return `${primeiro.toLocaleDateString('pt-BR', { month: 'short' })} - ${ultimo.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-black border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/logo.png" alt="Logo" className="h-12 w-auto object-contain" />
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar serviços..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setShowShareModal(true)} className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-white">
              <Share2 size={20} />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowPerfilMenu(!showPerfilMenu)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors text-white"
              >
                <User size={20} />
                <span className="text-sm font-semibold">
                  {clienteLogado ? 'Perfil' : 'Entrar/Inscrever-se'}
                </span>
              </button>

              {showPerfilMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border border-slate-200 z-50">
                  {clienteLogado ? (
                    <>
                      <div className="p-4 border-b border-slate-200">
                        <p className="font-bold text-slate-900">{clienteLogado.nome}</p>
                        <p className="text-sm text-slate-600">📱 {clienteLogado.telefone}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowPerfilMenu(false);
                          window.location.href = '/meu-agendamento';
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors font-semibold text-slate-900 flex items-center gap-2"
                      >
                        <Calendar size={18} />
                        Meus Agendamentos
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors font-semibold text-red-600 flex items-center gap-2 border-t border-slate-200"
                      >
                        <LogOut size={18} />
                        Sair
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setShowPerfilMenu(false);
                        setShowBookingModal(true);
                        setModalStep('telefone');
                        setTelefoneInput('');
                        setNomeInput('');
                        setErroMsg('');
                      }}
                      className="w-full px-4 py-3 text-center hover:bg-slate-50 transition-colors font-semibold text-slate-900"
                    >
                      Fazer Login
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="md:hidden px-4 pb-4">
          <div className="relative w-full">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            />
          </div>
        </div>
      </header>

      {fotos.length > 0 && (
        <div className="relative w-full h-96 bg-black overflow-hidden">
          <img src={fotos[currentPhotoIndex]} alt="Galeria" className="w-full h-full object-cover" />
          {fotos.length > 1 && (
            <>
              <button onClick={() => setCurrentPhotoIndex((p) => (p - 1 + fotos.length) % fotos.length)} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all">
                <ChevronLeft size={24} />
              </button>
              <button onClick={() => setCurrentPhotoIndex((p) => (p + 1) % fotos.length)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all">
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 py-8 border-b border-slate-200 max-w-7xl mx-auto">
        <div className="md:col-span-2">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">{config?.nome_estabelecimento || 'Loja'}</h1>
          {config?.descricao_loja && <p className="text-slate-600 mb-4">{config.descricao_loja}</p>}

          {(config?.endereco || config?.rua) && (
            <div className="flex items-start gap-3 mb-3 text-slate-600">
              <MapPin size={18} className="mt-1 flex-shrink-0" />
              <p className="text-sm">{config?.endereco || `${config?.rua}${config?.numero ? ', ' + config.numero : ''}${config?.cidade ? ' - ' + config.cidade : ''}`}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 mb-4">
            {config?.telefone_estabelecimento && (
              <div className="flex items-center gap-3 text-slate-600">
                <Phone size={18} />
                <p className="text-sm">{config.telefone_estabelecimento}</p>
              </div>
            )}
          </div>

          {(config?.facebook_url || config?.instagram_url) && (
            <div className="flex gap-3">
              {config?.facebook_url && (
                <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900">
                  <Facebook size={20} />
                </a>
              )}
              {config?.instagram_url && (
                <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900">
                  <Instagram size={20} />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl p-6">
          {(() => {
            const hoje = new Date();
            const diasMap: Record<number, string> = {
              0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta',
              4: 'quinta', 5: 'sexta', 6: 'sabado'
            };
            const diaHoje = diasMap[hoje.getDay()];
            const diasAberturaJSON = typeof config?.dias_abertura === 'string'
              ? JSON.parse(config.dias_abertura)
              : config?.dias_abertura;
            const abertoHoje = diasAberturaJSON?.[diaHoje];

            return (
              <button
                onClick={() => setExpandirHorarios(!expandirHorarios)}
                className="w-full flex items-center justify-between font-bold text-slate-900 mb-4 hover:text-cyan-600 transition-colors"
              >
                <span>{abertoHoje ? '✅ Aberto hoje' : '❌ Fechado hoje'} - Mostrar Semana</span>
                <ChevronDown size={20} className={`transition-transform ${expandirHorarios ? 'rotate-180' : ''}`} />
              </button>
            );
          })()}

          {expandirHorarios && config?.dias_abertura && (
            <div className="space-y-2 text-sm">
              {['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'].map((dia) => {
                const diasNomes: Record<string, string> = {
                  segunda: 'Segunda-Feira', terca: 'Terça-Feira', quarta: 'Quarta-Feira', quinta: 'Quinta-Feira',
                  sexta: 'Sexta-Feira', sabado: 'Sábado', domingo: 'Domingo'
                };

                const diasAberturaJSON = typeof config.dias_abertura === 'string'
                  ? JSON.parse(config.dias_abertura)
                  : config.dias_abertura;

                const aberto = diasAberturaJSON?.[dia];
                const horario = config[`horario_${dia}`];

                return (
                  <div key={dia} className="flex justify-between text-slate-600">
                    <span className="font-medium">{diasNomes[dia]}</span>
                    <span>{aberto && horario ? horario : 'Fechado'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-8 max-w-7xl mx-auto">
        {Object.entries(servicosPorCategoria as Record<string, Servico[]>).map(([categoria, items]) => (
          <div key={categoria} className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-3 border-b-2 border-cyan-500">{categoria}</h2>

            <div className="space-y-3">
              {items.filter(s => s.nome.toLowerCase().includes(searchTerm.toLowerCase())).map((servico) => (
                <div key={servico.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{servico.nome}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-slate-500 text-sm">
                        <Clock size={16} />
                        {servico.duracao || 30} min
                      </div>
                      <div className="text-cyan-600 font-bold">R$ {servico.preco.toFixed(2)}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => adicionarServico(servico)}
                    className="ml-4 px-6 py-2 rounded-lg font-semibold text-white transition-all hover:shadow-lg flex-shrink-0"
                    style={{ backgroundColor: corTema }}
                  >
                    Agendar
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50">
          <div className="w-full md:max-w-4xl rounded-t-3xl md:rounded-3xl bg-white shadow-2xl max-h-[98vh] md:max-h-[95vh] overflow-y-auto flex flex-col">

            {/* ===== STEP 1: SELEÇÃO (data, hora, profissional) ===== */}
            {modalStep === 'servicos' && servicoEmEdicao && (
              <>
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">{servicoEmEdicao?.nome || getMesAnoIntervalo()}</h3>
                  <button
                    onClick={() => {
                      setShowBookingModal(false);
                      setServicosSelecionados([]);
                      setServicoEmEdicao(null);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  {erroMsg && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-start gap-2">
                      <span className="text-lg">⚠️</span>
                      <p>{erroMsg}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-slate-900 mb-4 text-lg">Selecione a Data</h4>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 mb-6">
                      {proximosDias.map((dia) => {
                        const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
                        const diaStr = dateToString(dia);
                        const isSelected = diaAtual === diaStr;
                        const horarioDia = obterHorarioDoDia(dia);
                        const isClosed = !horarioDia;

                        return (
                          <button
                            key={diaStr}
                            onClick={() => !isClosed && setDiaAtual(diaStr)}
                            disabled={isClosed}
                            className={`flex flex-col items-center justify-center min-w-[90px] p-3 rounded-xl font-bold transition-all flex-shrink-0 ${isClosed
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-cyan-600 text-white shadow-lg'
                                  : 'bg-white border-2 border-slate-200 text-slate-900 hover:border-cyan-400'
                              }`}
                          >
                            <span className="text-xs mb-1">{diasNomes[dia.getDay()]}</span>
                            <span className="text-xl">{dia.getDate()}</span>
                            <div className={`mt-2 w-2 h-2 rounded-full ${isClosed ? 'bg-slate-400' :
                                isSelected ? 'bg-white' : 'bg-green-500'
                              }`}></div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-3">Período</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['manha', 'tarde', 'noite'].map(p => {
                        const periodo = p === 'manha' ? 'Manhã' : p === 'tarde' ? 'Tarde' : 'Noite';
                        const disponivel = diaAtual ? periodosDisponiveis[p as keyof typeof periodosDisponiveis] : false;

                        return (
                          <button
                            key={p}
                            onClick={() => {
                              if (disponivel) {
                                setPeriodoAtual(p as any);
                                const horariosDoperiodo = filtrarHorariosPorPeriodo(todosHorarios, p);
                                if (horariosDoperiodo.length > 0) {
                                  setHoraAtual(horariosDoperiodo[0]);
                                }
                              }
                            }}
                            disabled={!disponivel}
                            className={`py-2 rounded-lg font-bold text-sm transition-all ${disponivel
                                ? periodoAtual === p
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                                : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                              }`}
                          >
                            {periodo}
                          </button>
                        );
                      })}
                    </div>
                    {!diaAtual && <p className="text-xs text-slate-500 mt-2">Selecione uma data primeiro</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-3">Horário</label>
                    {!diaAtual ? (
                      <div className="w-full text-center py-6 text-slate-500 font-semibold bg-slate-50 rounded-lg">
                        Selecione uma data para ver horários disponíveis
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-slate-100 rounded-lg flex-shrink-0">
                          <ChevronLeft size={20} />
                        </button>

                        <div ref={horariosScrollRef} className="flex gap-2 overflow-x-auto pb-2 flex-1" style={{ scrollBehavior: 'smooth' }}>
                          {todosHorarios.length > 0 ? (
                            todosHorarios.map(hora => (
                              <button
                                key={hora}
                                onClick={() => {
                                  setHoraAtual(hora);
                                  const periodoDoHorario = detectarPeriodoDoHorario(hora);
                                  setPeriodoAtual(periodoDoHorario);
                                }}
                                className={`min-w-[70px] py-2 rounded-lg font-bold text-sm transition-all flex-shrink-0 ${horaAtual === hora
                                    ? 'bg-cyan-600 text-white shadow-lg'
                                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                                  }`}
                              >
                                {hora}
                              </button>
                            ))
                          ) : (
                            <div className="w-full text-center py-3 text-red-600 font-semibold text-sm">Sem horários disponíveis</div>
                          )}
                        </div>

                        <button className="p-2 hover:bg-slate-100 rounded-lg flex-shrink-0">
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-3">Profissional</label>
                    <select
                      value={profissionalAtual}
                      onChange={(e) => setProfissionalAtual(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-900 font-medium"
                    >
                      <option value="sem-preferencia">Sem preferência</option>
                      {profissionais.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>

                  {diaAtual && horaAtual && (
                    <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                      <h4 className="font-bold text-slate-900 mb-2">{servicoEmEdicao?.nome}</h4>
                      <p className="text-sm text-slate-600 mb-2">R$ {servicoEmEdicao?.preco.toFixed(2)} • {servicoEmEdicao?.duracao || 30} min</p>
                      <p className="text-xs text-slate-500">
                        {formatarDataString(diaAtual)} • {horaAtual} - {formatarHoraFim(horaAtual, servicoEmEdicao?.duracao || 30)}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={confirmarServico}
                    disabled={!diaAtual || !horaAtual}
                    className="w-full py-4 rounded-lg font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg text-lg"
                    style={{ backgroundColor: corTema }}
                  >
                    Confirmar
                  </button>
                </div>
              </>
            )}

            {/* ===== STEP 2: RESUMO (mostra serviços selecionados) ===== */}
            {modalStep === 'resumo' && (
              <>
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center gap-4">
                  <button
                    onClick={() => {
                      setModalStep('servicos');
                    }}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <h3 className="text-2xl font-bold text-slate-900 flex-1">Resumo do Agendamento</h3>
                </div>

                <div className="p-6 space-y-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    {servicosSelecionados.map((s, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200 mb-3">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-slate-900">{s.nome}</h4>
                            <p className="text-sm text-slate-600 mt-1">R$ {s.preco.toFixed(2)} • {s.duracao} min</p>
                          </div>
                          <button onClick={() => removerServico(idx)} className="text-red-500 hover:text-red-700">
                            <X size={20} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          {formatarDataString(s.data_agendamento!)} • {s.hora_agendamento} às {formatarHoraFim(s.hora_agendamento!, s.duracao)} ({s.duracao} min) • {s.profissional_id ? profissionais.find(p => p.id === s.profissional_id)?.nome : 'Sem preferência'}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-slate-600">Total:</span>
                      <span className="text-3xl font-bold text-cyan-600">R$ {calcularTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{calcularDuracao()} minutos</span>
                    </div>
                  </div>

                  {clienteLogado ? (
                    // ✅ CLIENTE LOGADO - VAI DIRETO PRA CONFIRMAÇÃO
                    <button
                      onClick={() => setModalStep('confirmacao')}
                      className="w-full py-4 rounded-lg font-bold text-white transition-all hover:shadow-lg text-lg"
                      style={{ backgroundColor: corTema }}
                    >
                      Confirmar Agendamento
                    </button>
                  ) : (
                    // ✅ CLIENTE NÃO LOGADO - VAI PRA TELEFONE
                    <button
                      onClick={() => {
                        setModalStep('telefone');
                        setTelefoneInput('');
                        setErroMsg('');
                      }}
                      className="w-full py-4 rounded-lg font-bold text-white transition-all hover:shadow-lg text-lg"
                      style={{ backgroundColor: corTema }}
                    >
                      Continuar
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ===== STEP 3: TELEFONE (pede telefone) ===== */}
            {modalStep === 'telefone' && (
              <>
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center gap-4">
                  <button
                    onClick={() => {
                      setModalStep('resumo');
                    }}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <h3 className="text-2xl font-bold text-slate-900 flex-1">Crie uma conta ou faça login</h3>
                </div>

                <div className="p-6 space-y-6 flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
                  {erroMsg && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {erroMsg}
                    </div>
                  )}

                  <form onSubmit={handleVerificarTelefone} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-900 mb-2">Número de Telefone</label>
                      <input
                        type="tel"
                        placeholder="11 9 9999-9999"
                        value={telefoneInput}
                        onChange={(e) => setTelefoneInput(e.target.value)}
                        disabled={loadingVerificacao}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-900"
                      />
                      <p className="text-xs text-slate-500 mt-2">Digite apenas números: DDD + número</p>
                    </div>

                    <button
                      type="submit"
                      disabled={loadingVerificacao || telefoneInput.length < 10}
                      className="w-full py-4 rounded-lg font-bold text-white transition-all disabled:opacity-50 text-lg"
                      style={{ backgroundColor: corTema }}
                    >
                      {loadingVerificacao ? 'Verificando...' : 'Continuar'}
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* ===== STEP 4: NOME (pede nome para criar conta) ===== */}
            {modalStep === 'nome' && (
              <>
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center gap-4">
                  <button
                    onClick={() => setModalStep('telefone')}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <h3 className="text-2xl font-bold text-slate-900 flex-1">Crie sua conta</h3>
                </div>

                <div className="p-6 space-y-6 flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
                  {erroMsg && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {erroMsg}
                    </div>
                  )}

                  <form onSubmit={handleCriarConta} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-900 mb-2">Nome completo</label>
                      <input
                        type="text"
                        placeholder="Seu nome"
                        value={nomeInput}
                        onChange={(e) => setNomeInput(e.target.value)}
                        disabled={loadingVerificacao}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-900 mb-2">Telefone</label>
                      <input
                        type="tel"
                        value={telefoneInput}
                        disabled
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg bg-slate-100 text-slate-600"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loadingVerificacao || !nomeInput.trim()}
                      className="w-full py-4 rounded-lg font-bold text-white transition-all disabled:opacity-50 text-lg"
                      style={{ backgroundColor: corTema }}
                    >
                      {loadingVerificacao ? 'Criando...' : 'Criar conta'}
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* ===== STEP 5: CONFIRMAÇÃO (bem-vindo) ===== */}
            {modalStep === 'confirmacao' && clienteLogado && (
              <>
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center gap-4">
                  <button
                    onClick={() => setModalStep('resumo')}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <h3 className="text-2xl font-bold text-slate-900 flex-1">Avaliação e Confirmação</h3>
                </div>

                <div className="p-6 space-y-6 flex-1 flex flex-col max-w-2xl mx-auto w-full">
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo, {clienteLogado.nome}! 👋</h4>
                    <p className="text-slate-600">Aqui está o resumo do seu agendamento:</p>
                  </div>

                  {servicosSelecionados.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-slate-900">{servicosSelecionados[0].nome}</h4>
                          <p className="text-sm text-slate-600 mt-1">R$ {servicosSelecionados[0].preco.toFixed(2)} • {servicosSelecionados[0].duracao} min</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">
                        <strong>{obterDiaSemanaData(servicosSelecionados[0].data_agendamento!)}</strong> • <strong>{servicosSelecionados[0].hora_agendamento}</strong> - {formatarHoraFim(servicosSelecionados[0].hora_agendamento!, servicosSelecionados[0].duracao)}
                      </p>
                      <p className="text-xs text-slate-500 mt-2">Funcionário: {servicosSelecionados[0].profissional_id ? profissionais.find(p => p.id === servicosSelecionados[0].profissional_id)?.nome : 'Sem preferência'}</p>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600">Total:</span>
                      <span className="text-3xl font-bold text-cyan-600">R$ {calcularTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  {erroMsg && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {erroMsg}
                    </div>
                  )}

                  <button
                    onClick={handleConfirmarReserva}
                    disabled={loadingVerificacao}
                    className="w-full py-4 rounded-lg font-bold text-white transition-all disabled:opacity-50 hover:shadow-lg text-lg"
                    style={{ backgroundColor: corTema }}
                  >
                    {loadingVerificacao ? 'Confirmando...' : 'Confirmar e reservar'}
                  </button>
                </div>
              </>
            )}

            {/* ===== STEP 6: SUCESSO (confirmação final) ===== */}
            {modalStep === 'sucesso' && agendamentoConfirmado && (
              <>
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900 flex-1">Agendamento Confirmado</h3>
                  <button
                    onClick={() => {
                      setShowBookingModal(false);
                      setServicosSelecionados([]);
                      setServicoEmEdicao(null);
                      setAgendamentoConfirmado(null);
                      setModalStep('servicos');
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6 flex-1 flex flex-col items-center justify-center">
                  <div className="mb-6">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle size={48} className="text-green-600" />
                    </div>
                  </div>

                  <h3 className="text-3xl font-bold text-slate-900 text-center mb-2">Agendamento Confirmado</h3>
                  <p className="text-xl font-semibold text-slate-700 text-center mb-2">
                    {formatarDataString(agendamentoConfirmado.data)}, {agendamentoConfirmado.hora}
                  </p>
                  <p className="text-slate-600 text-center mb-8">Concluído! Vamos enviar um lembrete antes do seu agendamento.</p>

                  <button
                    onClick={() => {
                      if (clienteLogado) {
                        localStorage.setItem('clienteLogado', JSON.stringify(clienteLogado));
                      }
                      window.location.href = '/meu-agendamento';
                    }}
                    className="w-full max-w-xs py-4 rounded-lg font-bold text-white transition-all hover:shadow-lg text-lg"
                    style={{ backgroundColor: corTema }}
                  >
                    Mostrar agendamento
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-900">Compartilhe</h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-600 mb-2">Seu link:</p>
                <div className="flex items-center gap-2">
                  <input type="text" value={linkCompartilhavel} readOnly className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm font-mono" />
                  <button onClick={() => { navigator.clipboard.writeText(linkCompartilhavel); alert('✅ Link copiado!'); }} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors">
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              <button onClick={() => { const msg = `Agende seu horário comigo: ${linkCompartilhavel}`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank'); }} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors">
                💬 Compartilhar no WhatsApp
              </button>

              <button onClick={() => setShowShareModal(false)} className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicBooking;
