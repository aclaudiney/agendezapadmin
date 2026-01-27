import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Calendar, CheckCircle2, AlertCircle, Clock, ChevronLeft, X, Plus, Trash2, LogOut, Eye, MapPin, Phone, ChevronDown, Facebook, Instagram, Linkedin, Youtube, Home, Search, User, Menu } from 'lucide-react';

// 📱 Função para normalizar telefone - sempre adiciona 55 (Brasil)
const normalizarTelefone = (telefone: string): string => {
  // Remove espaços, parênteses, hífens e outros caracteres
  let apenasNumeros = telefone.replace(/\D/g, '');
  
  // Se já começa com 55, retorna como está
  if (apenasNumeros.startsWith('55')) {
    return apenasNumeros;
  }
  
  // Se tem 11 dígitos (DDD + número), adiciona 55
  if (apenasNumeros.length === 11) {
    return '55' + apenasNumeros;
  }
  
  // Se tem 10 dígitos, adiciona 55 + 9 no meio (para celular)
  if (apenasNumeros.length === 10) {
    return '55' + apenasNumeros.substring(0, 2) + '9' + apenasNumeros.substring(2);
  }
  
  // Fallback: retorna com 55 se não tiver
  if (!apenasNumeros.startsWith('55')) {
    return '55' + apenasNumeros;
  }
  
  return apenasNumeros;
};

interface ServicoSelecionado {
  id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
}

const PublicBooking: React.FC = () => {
  const [servicos, setServicos] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ horario_inicio: '08:00', horario_fim: '18:00', cor_tema: '#6366f1' });
  const [loading, setLoading] = useState(true);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [servicosSelecionados, setServicosSelecionados] = useState<ServicoSelecionado[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [showServicosList, setShowServicosList] = useState(false);
  const [clienteLogado, setClienteLogado] = useState<any>(null);
  const [estapa, setEstapa] = useState<'dados' | 'profissional' | 'confirmado'>('dados');
  const [expandirHorarios, setExpandirHorarios] = useState(false);
  const [statusHoje, setStatusHoje] = useState<any>(null);
  const [abaAtiva, setAbaAtiva] = useState<'inicio' | 'buscar' | 'perfil'>('inicio');
  const [buscaServico, setBuscaServico] = useState('');

  const [formData, setFormData] = useState({
    nome_cliente: '',
    telefone_cliente: '',
    data_nascimento_cliente: '',
    profissional_id: '',
    data_agendamento: '',
    hora_agendamento: '',
  });

  const calcularStatusHoje = () => {
    const agora = new Date();
    const diaSemana = agora.getDay();
    const horaAgora = agora.getHours();
    const minutoAgora = agora.getMinutes();

    const diasMap: { [key: number]: string } = {
      1: 'segunda',
      2: 'terca',
      3: 'quarta',
      4: 'quinta',
      5: 'sexta',
      6: 'sabado',
      0: 'domingo',
    };

    const diasNomes: { [key: number]: string } = {
      1: 'Segunda-feira',
      2: 'Terça-feira',
      3: 'Quarta-feira',
      4: 'Quinta-feira',
      5: 'Sexta-feira',
      6: 'Sábado',
      0: 'Domingo',
    };

    const diaHoje = diasMap[diaSemana];
    const diaHojeNome = diasNomes[diaSemana];
    const diaAberto = config?.dias_abertura?.[diaHoje] || false;

    if (!diaAberto) {
      return {
        dia: diaHojeNome,
        aberto: false,
        horario: 'Fechado',
        mensagem: 'Loja fechada hoje',
      };
    }

    const horarioHoje = config?.[`horario_${diaHoje}`] || '08:00-18:00';
    const [horaAberturaStr, horaFechamentoStr] = horarioHoje.split('-');
    const [hAbertura, mAbertura] = horaAberturaStr.split(':').map(Number);
    const [hFechamento, mFechamento] = horaFechamentoStr.split(':').map(Number);

    const horaMinutosAgora = horaAgora * 60 + minutoAgora;
    const minutosAbertura = hAbertura * 60 + mAbertura;
    const minutosFechamento = hFechamento * 60 + mFechamento;

    let aberto = false;
    let mensagem = '';

    if (horaMinutosAgora >= minutosAbertura && horaMinutosAgora < minutosFechamento) {
      aberto = true;
      mensagem = 'Aberto agora';
    } else if (horaMinutosAgora < minutosAbertura) {
      aberto = false;
      mensagem = `Abre às ${horaAberturaStr}`;
    } else {
      aberto = false;
      mensagem = `Fechou às ${horaFechamentoStr}`;
    }

    return {
      dia: diaHojeNome,
      aberto,
      horario: `${horaAberturaStr} - ${horaFechamentoStr}`,
      mensagem,
    };
  };

  const getHorariosSemana = () => {
    const diasMap: { [key: string]: string } = {
      'segunda': 'Segunda-feira',
      'terca': 'Terça-feira',
      'quarta': 'Quarta-feira',
      'quinta': 'Quinta-feira',
      'sexta': 'Sexta-feira',
      'sabado': 'Sábado',
      'domingo': 'Domingo',
    };

    const horarios = [];
    for (const [key, label] of Object.entries(diasMap)) {
      const aberto = config?.dias_abertura?.[key] || false;
      const horario = config?.[`horario_${key}`] || '---';

      horarios.push({
        dia: label,
        aberto: aberto,
        horario: aberto ? horario : 'Fechado',
      });
    }
    return horarios;
  };

  useEffect(() => {
    const clienteSalvo = localStorage.getItem('clienteLogado');
    if (clienteSalvo) {
      const parsed = JSON.parse(clienteSalvo);
      setClienteLogado(parsed);
      setFormData(prev => ({
        ...prev,
        nome_cliente: parsed.nome,
        telefone_cliente: parsed.telefone,
        data_nascimento_cliente: parsed.data_nascimento,
      }));
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (Object.keys(config).length > 0) {
      setStatusHoje(calcularStatusHoje());
    }
  }, [config]);

  useEffect(() => {
    if (formData.data_agendamento && formData.profissional_id && servicosSelecionados.length > 0) {
      calcularHorariosDisponiveis();
    }
  }, [formData.data_agendamento, formData.profissional_id, agendamentos, servicosSelecionados]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [servicosRes, profissionaisRes, agendamentosRes, configRes] = await Promise.all([
        supabase.from('servicos').select('*'),
        supabase.from('profissionais').select('*'),
        supabase.from('agendamentos').select('*'),
        supabase.from('configuracoes').select('*').limit(1),
      ]);

      setServicos(servicosRes.data || []);
      setProfissionais(profissionaisRes.data || []);
      setAgendamentos(agendamentosRes.data || []);

      if (configRes.data && configRes.data.length > 0) {
        setConfig(configRes.data[0]);
        setStatusHoje(calcularStatusHoje());
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcularHorariosDisponiveis = () => {
    const horarios: string[] = [];
    
    // Determinar qual é o dia selecionado
    const dataSelecionada = new Date(formData.data_agendamento);
    const diaSemana = dataSelecionada.getDay();
    
    const diasMap: { [key: number]: string } = {
      1: 'segunda',
      2: 'terca',
      3: 'quarta',
      4: 'quinta',
      5: 'sexta',
      6: 'sabado',
      0: 'domingo',
    };
    
    const diaHoje = diasMap[diaSemana];
    
    // Pegar horário específico do dia
    const horarioDia = config?.[`horario_${diaHoje}`] || '08:00-18:00';
    const [horaAberturaStr, horaFechamentoStr] = horarioDia.split('-');
    const [hInicio, mInicio] = horaAberturaStr.split(':').map(Number);
    const [hFim, mFim] = horaFechamentoStr.split(':').map(Number);

    const inicioMinutos = hInicio * 60 + mInicio;
    const fimMinutos = hFim * 60 + mFim;
    const duracaoTotal = servicosSelecionados.reduce((sum, s) => sum + s.duracao_minutos, 0);

    const hoje = new Date().toISOString().split('T')[0];
    const isHoje = formData.data_agendamento === hoje;

    let horaAtualMinutos = 0;
    if (isHoje) {
      const agora = new Date();
      horaAtualMinutos = agora.getHours() * 60 + agora.getMinutes();
      horaAtualMinutos = Math.ceil(horaAtualMinutos / 30) * 30;
    }

    for (let i = inicioMinutos; i < fimMinutos; i += 30) {
      if (isHoje && i < horaAtualMinutos) {
        continue;
      }

      const h = Math.floor(i / 60);
      const m = i % 60;
      const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      if (!isHorarioOcupado(hora, duracaoTotal)) {
        horarios.push(hora);
      }
    }

    setHorariosDisponiveis(horarios);
  };

  const isHorarioOcupado = (hora: string, duracao: number): boolean => {
    const [h, m] = hora.split(':').map(Number);
    const horaMinutos = h * 60 + m;
    const fimMinutos = horaMinutos + duracao;

    return agendamentos.some(agendamento => {
      if (agendamento.profissional_id !== formData.profissional_id ||
          agendamento.data_agendamento !== formData.data_agendamento ||
          agendamento.status === 'cancelado') {
        return false;
      }

      const servico = servicos.find(s => s.id === agendamento.servico_id);
      const duracaoAgendado = servico?.duracao_minutos || 30;
      const [hA, mA] = agendamento.hora_agendamento.split(':').map(Number);
      const inicioAgendado = hA * 60 + mA;
      const fimAgendado = inicioAgendado + duracaoAgendado;

      return !(fimMinutos <= inicioAgendado || horaMinutos >= fimAgendado);
    });
  };

  const handleServicoSelect = (servico: any) => {
    setServicosSelecionados([{
      id: servico.id,
      nome: servico.nome,
      preco: servico.preco,
      duracao_minutos: servico.duracao_minutos,
    }]);
    setShowModal(true);
    setErro('');

    if (clienteLogado) {
      setEstapa('profissional');
    } else {
      setEstapa('dados');
    }
  };

  const handleAdicionarServico = (servico: any) => {
    const jaExiste = servicosSelecionados.some(s => s.id === servico.id);
    if (!jaExiste) {
      setServicosSelecionados([...servicosSelecionados, {
        id: servico.id,
        nome: servico.nome,
        preco: servico.preco,
        duracao_minutos: servico.duracao_minutos,
      }]);
      setShowServicosList(false);
    }
  };

  const handleRemoverServico = (servicoId: string) => {
    setServicosSelecionados(servicosSelecionados.filter(s => s.id !== servicoId));
  };

  const calcularTotal = () => {
    return servicosSelecionados.reduce((sum, s) => sum + s.preco, 0);
  };

  const calcularDuracaoTotal = () => {
    return servicosSelecionados.reduce((sum, s) => sum + s.duracao_minutos, 0);
  };

  const verificarCliente = async () => {
    setErro('');

    if (!formData.nome_cliente || !formData.telefone_cliente || !formData.data_nascimento_cliente) {
      setErro('Preencha todos os campos');
      return;
    }

    // 📱 Normalizar telefone antes de buscar
    const telefonNormalizado = normalizarTelefone(formData.telefone_cliente);

    try {
      // Buscar por telefone normalizado (55 + número)
      const { data: clienteExistente, error } = await supabase
        .from('clientes')
        .select('id, nome, telefone, data_nascimento')
        .eq('telefone', telefonNormalizado)
        .single();

      if (clienteExistente) {
        const clienteData = {
          id: clienteExistente.id,
          nome: clienteExistente.nome,
          telefone: clienteExistente.telefone,
          data_nascimento: clienteExistente.data_nascimento || '',
        };

        localStorage.setItem('clienteLogado', JSON.stringify(clienteData));
        setClienteLogado(clienteData);
        setFormData(prev => ({
          ...prev,
          telefone_cliente: clienteExistente.telefone,
          data_nascimento_cliente: clienteExistente.data_nascimento || '',
        }));
        setEstapa('profissional');
      } else {
        criarNovoClienteSemEmail(telefonNormalizado);
      }
    } catch (error: any) {
      if (error.code === 'PGRST116') {
        criarNovoClienteSemEmail(telefonNormalizado);
      } else {
        setErro('Erro ao verificar cliente');
        console.error(error);
      }
    }
  };

  const criarNovoClienteSemEmail = async (telefonNormalizado: string) => {
    if (!formData.nome_cliente || !formData.data_nascimento_cliente) {
      setErro('Preencha todos os campos');
      return;
    }

    try {
      const { data: novoCliente, error } = await supabase
        .from('clientes')
        .insert([{
          nome: formData.nome_cliente,
          telefone: telefonNormalizado, // ✅ Usar telefone normalizado
          data_nascimento: formData.data_nascimento_cliente,
        }])
        .select()
        .single();

      if (error || !novoCliente) {
        setErro('Erro ao criar cadastro');
        return;
      }

      const clienteData = {
        id: novoCliente.id,
        nome: novoCliente.nome,
        telefone: novoCliente.telefone,
        data_nascimento: novoCliente.data_nascimento || '',
      };

      localStorage.setItem('clienteLogado', JSON.stringify(clienteData));
      setClienteLogado(clienteData);
      setEstapa('profissional');
    } catch (error) {
      setErro('Erro ao criar cadastro');
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formData.profissional_id || !formData.data_agendamento || !formData.hora_agendamento) {
      setErro('Preencha todos os campos');
      return;
    }

    if (servicosSelecionados.length === 0) {
      setErro('Selecione pelo menos um serviço');
      return;
    }

    if (!isHorarioDisponivel(formData.hora_agendamento, calcularDuracaoTotal())) {
      setErro('Este horário não está mais disponível');
      return;
    }

    try {
      if (!clienteLogado) {
        setErro('Erro: Cliente não identificado');
        return;
      }

      for (const servico of servicosSelecionados) {
        const { error } = await supabase.from('agendamentos').insert([{
          cliente_id: clienteLogado.id,
          profissional_id: formData.profissional_id,
          servico_id: servico.id,
          data_agendamento: formData.data_agendamento,
          hora_agendamento: formData.hora_agendamento,
          status: 'pendente',
        }]);

        if (error) {
          console.error('Erro ao inserir agendamento:', error);
          setErro('Erro ao confirmar agendamento');
          return;
        }
      }

      setSucesso(true);

      setFormData(prev => ({
        ...prev,
        profissional_id: '',
        data_agendamento: '',
        hora_agendamento: '',
      }));
      setServicosSelecionados([]);
      setShowModal(false);
      setEstapa('confirmado');
      fetchData();

      setTimeout(() => {
        setSucesso(false);
        setEstapa('dados');
      }, 3000);
    } catch (error) {
      setErro('Erro ao confirmar agendamento');
      console.error(error);
    }
  };

  const isHorarioDisponivel = (hora: string, duracao: number): boolean => {
    const [h, m] = hora.split(':').map(Number);
    const horaMinutos = h * 60 + m;
    const fimMinutos = horaMinutos + duracao;

    return !agendamentos.some(agendamento => {
      if (agendamento.profissional_id !== formData.profissional_id ||
          agendamento.data_agendamento !== formData.data_agendamento ||
          agendamento.status === 'cancelado') {
        return false;
      }

      const servico = servicos.find(s => s.id === agendamento.servico_id);
      const duracaoAgendado = servico?.duracao_minutos || 30;
      const [hA, mA] = agendamento.hora_agendamento.split(':').map(Number);
      const inicioAgendado = hA * 60 + mA;
      const fimAgendado = inicioAgendado + duracaoAgendado;

      return !(fimMinutos <= inicioAgendado || horaMinutos >= fimAgendado);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('clienteLogado');
    setClienteLogado(null);
    setFormData({
      nome_cliente: '',
      telefone_cliente: '',
      data_nascimento_cliente: '',
      profissional_id: '',
      data_agendamento: '',
      hora_agendamento: '',
    });
    setServicosSelecionados([]);
    setShowModal(false);
    setEstapa('dados');
    setAbaAtiva('inicio');
  };

  const horariosSemana = getHorariosSemana();
  const corTema = config?.cor_tema || '#6366f1';
  const servicosFiltrados = servicos.filter(s => s.nome.toLowerCase().includes(buscaServico.toLowerCase()));

  // Componente para renderizar a lista de serviços
  const ListaServicos = ({ servicos: servicosParaMostrar }: { servicos: any[] }) => (
    <div className="space-y-3 max-w-2xl mx-auto">
      <h3 className="text-lg font-bold text-white mb-4">Serviços</h3>
      {servicosParaMostrar.length > 0 ? (
        servicosParaMostrar.map((servico) => (
          <div
            key={servico.id}
            className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/20 hover:bg-white/10 transition-all"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <span className="text-xl">✂️</span>
            </div>

            <div className="flex-1">
              <h4 className="text-white font-bold text-sm">{servico.nome}</h4>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-emerald-400 font-bold">R$ {parseFloat(servico.preco).toFixed(2)}</span>
                <div className="flex items-center gap-1 text-slate-400 text-xs">
                  <Clock size={14} />
                  {servico.duracao_minutos} min
                </div>
              </div>
            </div>

            <button
              onClick={() => handleServicoSelect(servico)}
              className="flex-shrink-0 px-4 py-2 rounded-lg font-bold text-white transition-all hover:shadow-lg"
              style={{ backgroundColor: corTema }}
            >
              Agendar
            </button>
          </div>
        ))
      ) : (
        <div className="text-center p-8 text-white/60">
          Nenhum serviço encontrado
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-200 text-lg font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden pb-20">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-40 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-40 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        {/* HEADER - REFORMULADO */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-purple-600/10 via-indigo-600/10 to-purple-600/10 backdrop-blur-xl border-b border-white/10 p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            {/* LOGO PEQUENA */}
            <div>
              <img 
                src="/images/logo.png" 
                alt="Logo" 
                className="h-12 w-auto"
              />
            </div>

            {/* NOME DO CLIENTE + MENU HAMBÚRGUER */}
            <div className="flex items-center gap-4">
              {clienteLogado && (
                <div className="text-right hidden sm:block">
                  <p className="text-white font-semibold text-base">
                    {clienteLogado.nome.split(' ')[0]}
                  </p>
                  <p className="text-purple-200/60 text-xs">Agendamentos</p>
                </div>
              )}

              {/* MENU HAMBÚRGUER */}
              <div className="relative group">
                <button
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                >
                  <Menu size={24} />
                </button>

                {/* DROPDOWN MENU */}
                <div className="absolute right-0 mt-2 w-56 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-xl border border-white/20 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden">
                  <div className="p-4">
                    {clienteLogado ? (
                      <>
                        <div className="mb-4 pb-4 border-b border-white/10">
                          <p className="text-xs text-purple-200/60 mb-1">Logado como</p>
                          <p className="text-white font-semibold text-base">{clienteLogado.nome}</p>
                          <p className="text-purple-200/60 text-xs mt-1">{clienteLogado.telefone}</p>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all font-medium"
                        >
                          <LogOut size={18} />
                          Sair
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setFormData({
                              nome_cliente: '',
                              telefone_cliente: '',
                              data_nascimento_cliente: '',
                              profissional_id: '',
                              data_agendamento: '',
                              hora_agendamento: '',
                            });
                            setShowModal(true);
                            setEstapa('dados');
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
                          style={{ backgroundColor: corTema }}
                        >
                          <Eye size={18} />
                          Fazer Login
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* ABA INÍCIO - COM SERVIÇOS */}
            {abaAtiva === 'inicio' && (
              <>
                {/* IMAGEM DE CAPA */}
                {config?.imagem_capa && (
                  <div className="mb-8 rounded-2xl overflow-hidden shadow-2xl">
                    <img
                      src={config.imagem_capa}
                      alt="Capa da loja"
                      className="w-full h-auto max-h-96 object-cover"
                    />
                  </div>
                )}

                {/* LOGO */}
                <div className="text-center mb-8">
                  <img 
                    src="/images/logo.png" 
                    alt="AgendeZap" 
                    className="h-32 mx-auto mb-4"
                  />
                </div>

                {/* DESCRIÇÃO */}
                {config?.descricao_loja && (
                  <div className="mb-8 max-w-2xl mx-auto">
                    <div className="text-center p-6 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/15 backdrop-blur-sm">
                      <p className="text-white/80 text-base leading-relaxed">
                        {config.descricao_loja}
                      </p>
                    </div>
                  </div>
                )}

                {/* CARD INFO */}
                <div className="mb-12 max-w-2xl mx-auto">
                  <div className="rounded-lg border border-white/15 backdrop-blur-sm bg-white/[0.03] p-4 shadow-sm">
                    <div className="mb-3">
                      {config?.nome_estabelecimento && (
                        <h2 className="text-lg font-bold text-white mb-2">
                          {config.nome_estabelecimento}
                        </h2>
                      )}

                      {(config?.endereco || config?.rua) && (
                        <div className="flex items-start gap-2 mb-2">
                          <MapPin size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-white/70">
                            {config?.endereco || `${config.rua}${config.numero ? ', ' + config.numero : ''}${config.cidade ? ' - ' + config.cidade : ''}`}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3 text-xs">
                        {config?.telefone_estabelecimento && (
                          <div className="flex items-center gap-1">
                            <Phone size={12} className="text-purple-400" />
                            <span className="text-white/70">{config.telefone_estabelecimento}</span>
                          </div>
                        )}
                        {config?.whatsapp_numero && (
                          <div className="flex items-center gap-1">
                            <span className="text-green-400">💬</span>
                            <span className="text-white/70">{config.whatsapp_numero}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/10 my-3"></div>

                    {statusHoje && (
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${statusHoje.aberto ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'}`}></div>
                          <div>
                            <p className="text-xs text-white/60">{statusHoje.dia}</p>
                            <p className={`text-sm font-semibold ${statusHoje.aberto ? 'text-emerald-300' : 'text-orange-300'}`}>
                              {statusHoje.horario}
                            </p>
                          </div>
                        </div>
                        <p className={`text-xs font-medium ${statusHoje.aberto ? 'text-emerald-300' : 'text-orange-300'}`}>
                          {statusHoje.mensagem}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => setExpandirHorarios(!expandirHorarios)}
                      className="w-full text-xs font-medium py-2 flex items-center justify-between border-t border-white/10 mt-2 transition-colors"
                      style={{ color: corTema }}
                    >
                      <span>Ver semana</span>
                      <ChevronDown size={14} className={`transition-transform ${expandirHorarios ? 'rotate-180' : ''}`} />
                    </button>

                    {expandirHorarios && (
                      <div className="mt-2 space-y-1.5 pt-2 border-t border-white/10">
                        {horariosSemana.map((h, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-white/70">{h.dia}</span>
                            <span className={`font-semibold ${h.aberto ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {h.horario}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(config?.facebook_url || config?.instagram_url || config?.linkedin_url || config?.youtube_url) && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-white/60 mb-2 text-center">Redes Sociais</p>
                        <div className="flex gap-2 justify-center">
                          {config?.facebook_url && (
                            <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                              <Facebook size={16} />
                            </a>
                          )}
                          {config?.instagram_url && (
                            <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                              <Instagram size={16} />
                            </a>
                          )}
                          {config?.linkedin_url && (
                            <a href={config.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                              <Linkedin size={16} />
                            </a>
                          )}
                          {config?.youtube_url && (
                            <a href={config.youtube_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                              <Youtube size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SERVIÇOS NO INÍCIO */}
                {sucesso && (
                  <div className="mb-8 mx-auto max-w-2xl">
                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-6 backdrop-blur-xl flex items-start gap-4">
                      <CheckCircle2 size={28} className="text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-white text-lg">Agendamento confirmado! 🎉</p>
                        <p className="text-sm text-green-200 mt-1">Você receberá uma confirmação por WhatsApp em breve</p>
                      </div>
                    </div>
                  </div>
                )}
                <ListaServicos servicos={servicos} />
              </>
            )}

            {/* ABA BUSCAR - COM FILTRO */}
            {abaAtiva === 'buscar' && (
              <>
                <div className="mb-6 max-w-2xl mx-auto">
                  <input
                    type="text"
                    placeholder="Pesquisar"
                    value={buscaServico}
                    onChange={(e) => setBuscaServico(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 backdrop-blur-xl"
                    style={{ '--focus-ring-color': corTema } as any}
                  />
                </div>

                {sucesso && (
                  <div className="mb-8 mx-auto max-w-2xl">
                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-6 backdrop-blur-xl flex items-start gap-4">
                      <CheckCircle2 size={28} className="text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-white text-lg">Agendamento confirmado! 🎉</p>
                        <p className="text-sm text-green-200 mt-1">Você receberá uma confirmação por WhatsApp em breve</p>
                      </div>
                    </div>
                  </div>
                )}
                <ListaServicos servicos={servicosFiltrados} />
              </>
            )}

            {/* ABA PERFIL */}
            {abaAtiva === 'perfil' && (
              <>
                {!clienteLogado ? (
                  <div className="max-w-2xl mx-auto text-center p-8 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-2xl border border-white/15 backdrop-blur-sm">
                    <p className="text-white/80 text-lg mb-4">Para ver seus agendamentos, faça login</p>
                    <button
                      onClick={() => {
                        setFormData({
                          nome_cliente: '',
                          telefone_cliente: '',
                          data_nascimento_cliente: '',
                          profissional_id: '',
                          data_agendamento: '',
                          hora_agendamento: '',
                        });
                        setShowModal(true);
                        setEstapa('dados');
                      }}
                      className="px-6 py-3 text-white rounded-lg font-medium transition-colors shadow-lg"
                      style={{ backgroundColor: corTema }}
                    >
                      Fazer Login
                    </button>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl border border-white/15 backdrop-blur-sm p-8">
                      <h3 className="text-2xl font-bold text-white mb-6">Meus Agendamentos</h3>
                      <p className="text-white/70 mb-4">Clique no botão abaixo para ver todos seus agendamentos:</p>
                      <button
                        onClick={() => window.location.href = '/meu-agendamento'}
                        className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
                        style={{ backgroundColor: corTema }}
                      >
                        <Calendar size={20} />
                        Ver Agendamentos
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="text-center mt-12 text-purple-300/50">
              <p className="text-sm font-light">© 2024 AgendeZap • Agendamentos Inteligentes</p>
            </div>
          </div>
        </div>

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-white/20 shadow-2xl">
              <div className="sticky top-0 z-10 p-6 flex items-center justify-between backdrop-blur-xl border-b border-white/10" style={{ backgroundColor: `${corTema}20`, borderColor: corTema }}>
                <button onClick={() => setShowModal(false)} className="flex items-center gap-2 text-white hover:text-purple-100 transition-colors group">
                  <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="font-semibold">Voltar</span>
                </button>
                <button onClick={() => setShowModal(false)} className="text-white hover:text-purple-100 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl p-6 border border-purple-400/30 backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white text-xl">Serviços Selecionados</h3>
                    <button type="button" onClick={() => setShowServicosList(!showServicosList)} className="flex items-center gap-2 px-3 py-1.5 text-white rounded-lg text-sm transition-colors" style={{ backgroundColor: corTema }}>
                      <Plus size={16} />
                      Adicionar
                    </button>
                  </div>

                  <div className="space-y-2">
                    {servicosSelecionados.map(servico => (
                      <div key={servico.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10">
                        <div>
                          <p className="text-white font-semibold">{servico.nome}</p>
                          <p className="text-xs text-purple-200/60">{servico.duracao_minutos} min • R$ {servico.preco.toFixed(2)}</p>
                        </div>
                        <button type="button" onClick={() => handleRemoverServico(servico.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-purple-400/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-200 text-sm font-medium">Duração Total</span>
                      <span className="font-bold text-white">{calcularDuracaoTotal()} minutos</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-purple-200 text-sm font-medium">Preço Total</span>
                      <span className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        R$ {calcularTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {erro && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 backdrop-blur-xl">
                    <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200">{erro}</p>
                  </div>
                )}

                {estapa === 'dados' ? (
                  <div className="space-y-4">
                    <h4 className="font-bold text-white">Seus Dados</h4>
                    <div>
                      <label className="block text-xs text-purple-200 mb-2 font-semibold">Nome Completo</label>
                      <input 
                        type="text" 
                        value={formData.nome_cliente} 
                        onChange={(e) => setFormData({...formData, nome_cliente: e.target.value})} 
                        placeholder="João Silva" 
                        className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent backdrop-blur-xl transition-all" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-purple-200 mb-2 font-semibold">Telefone</label>
                      <input 
                        type="tel" 
                        value={formData.telefone_cliente} 
                        onChange={(e) => setFormData({...formData, telefone_cliente: e.target.value})} 
                        placeholder="(11) 99999-9999" 
                        className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent backdrop-blur-xl transition-all" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-purple-200 mb-2 font-semibold">📅 Data de Nascimento</label>
                      <input 
                        type="date" 
                        value={formData.data_nascimento_cliente} 
                        onChange={(e) => setFormData({...formData, data_nascimento_cliente: e.target.value})} 
                        className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:border-transparent backdrop-blur-xl transition-all" 
                      />
                      <p className="text-xs text-purple-200/60 mt-1">Selecione sua data de nascimento</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={verificarCliente} 
                      disabled={!formData.nome_cliente || !formData.telefone_cliente || !formData.data_nascimento_cliente} 
                      className="w-full py-3 text-white font-bold rounded-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                      style={{ backgroundColor: corTema }}
                    >
                      Continuar
                    </button>
                  </div>
                ) : null}

                {estapa === 'profissional' ? (
                  <>
                    <div className="space-y-4">
                      <h4 className="font-bold text-white">Escolha o Profissional</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {profissionais.map(prof => (
                          <label key={prof.id} className="p-4 border-2 rounded-xl cursor-pointer transition-all backdrop-blur-xl" style={formData.profissional_id === prof.id ? { borderColor: corTema, backgroundColor: `${corTema}20` } : { borderColor: 'rgba(255, 255, 255, 0.2)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                            <input type="radio" name="profissional" value={prof.id} checked={formData.profissional_id === prof.id} onChange={(e) => {setFormData({...formData, profissional_id: e.target.value, data_agendamento: '', hora_agendamento: ''});}} className="mr-3" />
                            <div className="inline-block">
                              <p className="font-bold text-white">{prof.nome}</p>
                              {prof.especialidade && <p className="text-xs text-purple-200/60 mt-1">{prof.especialidade}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {formData.profissional_id && (
                      <div className="space-y-4">
                        <h4 className="font-bold text-white">Escolha Data e Hora</h4>
                        <input type="date" value={formData.data_agendamento} onChange={(e) => setFormData({...formData, data_agendamento: e.target.value, hora_agendamento: ''})} min={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 backdrop-blur-xl" />

                        {formData.data_agendamento && (
                          <div>
                            <label className="block text-sm font-medium text-purple-200 mb-3">Horários</label>
                            {horariosDisponiveis.length > 0 ? (
                              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                                {horariosDisponiveis.map(hora => (
                                  <label key={hora} className="p-3 border-2 rounded-xl text-center cursor-pointer transition-all font-bold backdrop-blur-xl" style={formData.hora_agendamento === hora ? { backgroundColor: `${corTema}40`, borderColor: corTema } : { borderColor: 'rgba(255, 255, 255, 0.2)', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'rgb(187, 134, 252)' }}>
                                    <input type="radio" name="hora" value={hora} checked={formData.hora_agendamento === hora} onChange={(e) => setFormData({...formData, hora_agendamento: e.target.value})} className="hidden" />
                                    {hora}
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-center backdrop-blur-xl">
                                Nenhum horário disponível nesta data
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <button type="submit" disabled={!formData.profissional_id || !formData.data_agendamento || !formData.hora_agendamento || servicosSelecionados.length === 0} className="w-full py-4 text-white font-bold rounded-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg" style={{ backgroundColor: corTema }}>
                      Confirmar Agendamento
                    </button>

                    <p className="text-xs text-purple-200/60 text-center">
                      Você receberá uma confirmação por WhatsApp
                    </p>
                  </>
                ) : null}
              </form>
            </div>
          </div>
        )}

        {/* BOTTOM NAV BAR */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-slate-950 via-slate-950 to-slate-950/80 backdrop-blur-xl border-t border-white/10">
          <div className="max-w-6xl mx-auto flex justify-around items-center h-20 px-4">
            <button
              onClick={() => setAbaAtiva('inicio')}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all ${
                abaAtiva === 'inicio'
                  ? 'text-white'
                  : 'text-white/60 hover:text-white'
              }`}
              style={abaAtiva === 'inicio' ? { backgroundColor: `${corTema}20` } : {}}
            >
              <Home size={24} />
              <span className="text-xs font-medium">Início</span>
            </button>

            <button
              onClick={() => setAbaAtiva('buscar')}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all ${
                abaAtiva === 'buscar'
                  ? 'text-white'
                  : 'text-white/60 hover:text-white'
              }`}
              style={abaAtiva === 'buscar' ? { backgroundColor: `${corTema}20` } : {}}
            >
              <Search size={24} />
              <span className="text-xs font-medium">Buscar</span>
            </button>

            <button
              onClick={() => setAbaAtiva('perfil')}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all ${
                abaAtiva === 'perfil'
                  ? 'text-white'
                  : 'text-white/60 hover:text-white'
              }`}
              style={abaAtiva === 'perfil' ? { backgroundColor: `${corTema}20` } : {}}
            >
              <User size={24} />
              <span className="text-xs font-medium">Perfil</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicBooking;