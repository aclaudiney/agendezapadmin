import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogOut, Calendar, Clock, User, ChevronDown } from 'lucide-react';

interface Agendamento {
  id: string;
  data_agendamento: string;
  hora_agendamento: string;
  status: string;
  servico_id: string;
  profissional_id: string;
  created_at: string;
  servicos?: { id: string; nome: string; preco: number; duracao_minutos: number };
  profissionais?: { id: string; nome: string };
  company_id: string;
}

interface ClientDashboardProps {
  clienteId: string;
  onLogout: () => void;
}

type ModalStep = 'none' | 'reservar';

const ClientDashboard: React.FC<ClientDashboardProps> = ({ clienteId, onLogout }) => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientSlug, setClientSlug] = useState('');
  const [modalStep, setModalStep] = useState<ModalStep>('none');
  const [agendamentoParaReservar, setAgendamentoParaReservar] = useState<Agendamento | null>(null);
  const [servicos, setServicos] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [diaAtual, setDiaAtual] = useState<string>('');
  const [horaAtual, setHoraAtual] = useState<string>('');

  const proximosDias = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  useEffect(() => {
    const clienteSalvo = localStorage.getItem('clienteLogado');
    if (!clienteSalvo) {
      onLogout();
      return;
    }

    const parsedClient = JSON.parse(clienteSalvo);
    console.log('✅ Cliente Logado:', parsedClient); // Debug
    
    setClientName(parsedClient.nome);
    setClientPhone(parsedClient.telefone);
    setCompanyId(parsedClient.company_id);

    // Buscar slug da empresa
    buscarSlugEmpresa(parsedClient.company_id);
    
    // ✅ USAR O ID DO CLIENTE SALVO NO LOCALSTORAGE
    fetchAgendamentos(parsedClient.id, parsedClient.company_id);
  }, [onLogout]);

  const buscarSlugEmpresa = async (companyId: string) => {
    try {
      const { data } = await supabase
        .from('companies')
        .select('slug')
        .eq('id', companyId)
        .single();

      if (data) {
        setClientSlug(data.slug);
      }
    } catch (error) {
      console.error('Erro ao buscar slug:', error);
    }
  };

  const fetchAgendamentos = async (clienteId: string, companyId: string) => {
    try {
      setLoading(true);
      console.log('🔍 Buscando agendamentos para:', { clienteId, companyId });

      const { data: agendamentosData, error: agendError } = await supabase
        .from('agendamentos')
        .select('id, data_agendamento, hora_agendamento, status, servico_id, profissional_id, company_id, created_at')
        .eq('cliente_id', clienteId)
        .eq('company_id', companyId)
        .order('data_agendamento', { ascending: true });

      console.log('📊 Agendamentos encontrados:', agendamentosData?.length || 0, agendamentosData);
      if (agendError) console.error('❌ Erro ao buscar agendamentos:', agendError);

      if (!agendamentosData) {
        console.warn('⚠️ Nenhum agendamento retornado');
        return;
      }

      const [servicosRes, profissionaisRes, configRes] = await Promise.all([
        supabase
          .from('servicos')
          .select('id, nome, preco, duracao_minutos, ativo')
          .eq('company_id', companyId),
        supabase
          .from('profissionais')
          .select('id, nome, ativo')
          .eq('company_id', companyId),
        supabase
          .from('configuracoes')
          .select('*')
          .eq('company_id', companyId)
          .single()
      ]);

      setServicos(servicosRes.data || []);
      setProfissionais(profissionaisRes.data || []);
      setConfig(configRes.data || null);

      const agendamentosCompletos = (agendamentosData || []).map(apt => ({
        ...apt,
        servicos: (servicosRes.data || []).find(s => s.id === apt.servico_id),
        profissionais: (profissionaisRes.data || []).find(p => p.id === apt.profissional_id),
      }));

      console.log('✅ Agendamentos completos:', agendamentosCompletos);
      setAgendamentos(agendamentosCompletos);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ AGENDAMENTOS EM ABERTO - MOSTRAR TODOS POR ENQUANTO
  const agendamentosAbertos = agendamentos.filter(apt => {
    console.log('🔍 Agendamento:', apt.data_agendamento, 'Status:', apt.status);
    return apt.status === 'confirmado'; // ✅ SÓ CONFIRMADO, SEM FILTRO DE DATA
  });

  console.log('📌 Agendamentos em aberto encontrados:', agendamentosAbertos.length, agendamentosAbertos);

  // ✅ ÚLTIMOS 4 FINALIZADOS/CANCELADOS
  const agendamentosFinalizados = agendamentos
    .filter(apt => apt.status === 'finalizado' || apt.status === 'cancelado')
    .slice(-4)
    .reverse();

  const handleCancelarAgendamento = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) return;

    try {
      await supabase
        .from('agendamentos')
        .update({ status: 'cancelado' })
        .eq('id', id);

      setAgendamentos(agendamentos.map(apt =>
        apt.id === id ? { ...apt, status: 'cancelado' } : apt
      ));
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      alert('Erro ao cancelar agendamento');
    }
  };

  const handleReservarNovamente = (apt: Agendamento) => {
    setAgendamentoParaReservar(apt);
    setDiaAtual('');
    setHoraAtual('');
    setModalStep('reservar');
  };

  const handleConfirmarNovaReserva = async () => {
    if (!diaAtual || !horaAtual || !agendamentoParaReservar || !companyId) {
      alert('Preencha data e hora');
      return;
    }

    try {
      const { error } = await supabase
        .from('agendamentos')
        .insert([{
          cliente_id: clienteId,
          servico_id: agendamentoParaReservar.servico_id,
          profissional_id: agendamentoParaReservar.profissional_id || null,
          data_agendamento: diaAtual,
          hora_agendamento: horaAtual,
          status: 'confirmado',
          origem: 'web',
          company_id: companyId,
        }]);

      if (error) throw error;

      setModalStep('none');
      fetchAgendamentos(clienteId, companyId);
      alert('✅ Agendamento realizado com sucesso!');
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao reservar');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('clienteLogado');
    // Redireciona para o slug da empresa
    window.location.href = `/${clientSlug}`;
  };

  const formatarData = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split('-');
    const data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'cancelado') return { label: 'Cancelado', color: 'bg-red-600' };
    if (status === 'finalizado') return { label: 'Finalizado', color: 'bg-blue-600' };
    return { label: 'Não comparecimento', color: 'bg-yellow-600' };
  };

  const corTema = config?.cor_tema || '#0891b2';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando seus agendamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER PRETO - ESTILO BOOKSY */}
      <header className="bg-black sticky top-0 z-40 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* LOGO - CLICÁVEL */}
          <button
            onClick={() => window.location.href = `/${clientSlug}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Voltar para agendamentos"
          >
            <img src="/images/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
          </button>

          {/* NOME DO CLIENTE - CENTRALIZADO */}
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-white">{clientName}</h1>
            <p className="text-xs text-gray-400">📱 {clientPhone}</p>
          </div>

          {/* BOTÕES DIREITA */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = `/${clientSlug}`}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-semibold"
              title="Agendar novo serviço"
            >
              + Agendar
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* AGENDAMENTOS EM ABERTO */}
        {agendamentosAbertos.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Próximos Agendamentos</h2>
            <div className="space-y-4">
              {agendamentosAbertos.map(apt => (
                <div key={apt.id} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    {/* INFORMAÇÕES */}
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-slate-900 mb-4">{apt.servicos?.nome || 'Serviço'}</h3>
                      <div className="space-y-3 text-base text-slate-700">
                        <div className="flex items-center gap-3">
                          <Calendar size={20} className="text-cyan-600" />
                          <span>{formatarData(apt.data_agendamento)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Clock size={20} className="text-cyan-600" />
                          <span>{apt.hora_agendamento}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <User size={20} className="text-cyan-600" />
                          <span>{apt.profissionais?.nome || 'Sem preferência'}</span>
                        </div>
                      </div>
                    </div>

                    {/* AÇÃO */}
                    <button
                      onClick={() => handleCancelarAgendamento(apt.id)}
                      className="md:self-center px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HISTÓRICO */}
        {agendamentosFinalizados.length > 0 && (
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Histórico de Agendamentos</h2>
            <div className="space-y-4">
              {agendamentosFinalizados.map(apt => {
                const statusInfo = getStatusBadge(apt.status);
                return (
                  <div key={apt.id} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      {/* INFORMAÇÕES */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <h3 className="text-2xl font-bold text-slate-900">{apt.servicos?.nome || 'Serviço'}</h3>
                          <span className={`${statusInfo.color} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="space-y-3 text-base text-slate-700">
                          <div className="flex items-center gap-3">
                            <Calendar size={20} className="text-cyan-600" />
                            <span>{formatarData(apt.data_agendamento)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Clock size={20} className="text-cyan-600" />
                            <span>{apt.hora_agendamento}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <User size={20} className="text-cyan-600" />
                            <span>{apt.profissionais?.nome || 'Sem preferência'}</span>
                          </div>
                        </div>
                      </div>

                      {/* BOTÃO RESERVAR NOVAMENTE */}
                      {apt.status === 'finalizado' && (
                        <button
                          onClick={() => handleReservarNovamente(apt)}
                          className="md:self-center px-6 py-3 rounded-lg font-bold text-white transition-all hover:shadow-lg whitespace-nowrap"
                          style={{ backgroundColor: corTema }}
                        >
                          Reservar novamente
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SEM AGENDAMENTOS */}
        {agendamentosAbertos.length === 0 && agendamentosFinalizados.length === 0 && (
          <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
            <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">Você não tem agendamentos</p>
          </div>
        )}
      </div>

      {/* MODAL - RESERVAR NOVAMENTE */}
      {modalStep === 'reservar' && agendamentoParaReservar && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50">
          <div className="w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl bg-white shadow-2xl max-h-[98vh] md:max-h-[95vh] overflow-y-auto flex flex-col">
            {/* HEADER */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900">Escolha data e hora</h3>
              <button
                onClick={() => setModalStep('none')}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* CONTEÚDO */}
            <div className="p-6 space-y-6 flex-1">
              {/* CALENDÁRIO */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-4">Data</label>
                <div className="flex gap-2 overflow-x-auto pb-4">
                  {proximosDias.map((dia, idx) => {
                    const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
                    const diaStr = dia.toISOString().split('T')[0];
                    const isSelected = diaAtual === diaStr;

                    return (
                      <button
                        key={idx}
                        onClick={() => setDiaAtual(diaStr)}
                        className={`flex flex-col items-center justify-center min-w-[80px] p-3 rounded-lg font-bold transition-all flex-shrink-0 ${
                          isSelected
                            ? 'bg-cyan-600 text-white'
                            : 'bg-gray-100 text-slate-900 hover:bg-gray-200'
                        }`}
                      >
                        <span className="text-xs">{diasNomes[dia.getDay()]}</span>
                        <span className="text-lg">{dia.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* HORÁRIOS */}
              {diaAtual && (
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-4">Hora</label>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'].map(hora => (
                      <button
                        key={hora}
                        onClick={() => setHoraAtual(hora)}
                        className={`py-2 px-3 rounded-lg font-bold text-sm transition-all ${
                          horaAtual === hora
                            ? 'bg-cyan-600 text-white'
                            : 'bg-gray-100 text-slate-900 hover:bg-gray-200'
                        }`}
                      >
                        {hora}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* RESUMO */}
              {diaAtual && horaAtual && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="font-bold text-slate-900 mb-2">{agendamentoParaReservar.servicos?.nome}</h4>
                  <p className="text-sm text-slate-600">
                    {new Date(diaAtual).toLocaleDateString('pt-BR')} às {horaAtual}
                  </p>
                </div>
              )}

              {/* BOTÃO CONFIRMAR */}
              <button
                onClick={handleConfirmarNovaReserva}
                disabled={!diaAtual || !horaAtual}
                className="w-full py-4 rounded-lg font-bold text-white transition-all disabled:opacity-50 text-lg"
                style={{ backgroundColor: corTema }}
              >
                Confirmar Reserva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
