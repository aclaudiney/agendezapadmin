import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogOut, Calendar, Clock, User, Trash2, AlertCircle, MessageCircle, Send } from 'lucide-react';

interface Appointment {
  id: string;
  date: string;
  time: string;
  service_name: string;
  professional_name: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

interface ClientDashboardProps {
  clienteId: string;
  onLogout: () => void;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ clienteId, onLogout }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  useEffect(() => {
    const clienteSalvo = localStorage.getItem('clienteLogado');
    if (!clienteSalvo) {
      onLogout();
      return;
    }

    const parsedClient = JSON.parse(clienteSalvo);
    setClientName(parsedClient.nome);
    setClientEmail(parsedClient.email);

    fetchAppointments(clienteId);
    fetchWhatsappNumber();
  }, [clienteId, onLogout]);

  // NOVO: Reagir quando filtro muda
  useEffect(() => {
    // Força re-render ao mudar filtro
  }, [filter]);

  const fetchWhatsappNumber = async () => {
    try {
      const { data } = await supabase
        .from('configuracoes')
        .select('*')
        .limit(1);

      if (data && data.length > 0) {
        const config = data[0];
        const numero = 
          config.whatsapp_numero || 
          config.numero_whatsapp || 
          config.telefone_whatsapp || 
          config.whatsapp || 
          config.telefone || 
          '';
        
        if (numero) setWhatsappNumber(numero);
      }
    } catch (error) {
      console.error('Erro ao buscar número WhatsApp:', error);
    }
  };

  const fetchAppointments = async (clienteId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          id,
          data_agendamento,
          hora_agendamento,
          status,
          created_at,
          servicos:servico_id(nome),
          profissionais:profissional_id(nome)
        `)
        .eq('cliente_id', clienteId)
        .order('data_agendamento', { ascending: true });

      if (error) throw error;

      console.log('DADOS BRUTOS DO SUPABASE:', data);

      const formatted = data.map((apt: any) => ({
        id: apt.id,
        date: apt.data_agendamento,
        time: apt.hora_agendamento,
        service_name: apt.servicos?.nome || 'Serviço',
        professional_name: apt.profissionais?.nome || 'Profissional',
        status: apt.status,
        created_at: apt.created_at,
      }));

      console.log('DADOS FORMATADOS:', formatted);
      setAppointments(formatted);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      setAppointments(appointments.map(apt =>
        apt.id === appointmentId ? { ...apt, status: 'cancelled' } : apt
      ));
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      alert('Erro ao cancelar agendamento');
    }
  };

  const handleLogoutClick = () => {
    localStorage.removeItem('clienteLogado');
    onLogout();
  };

  const handleWhatsappClick = () => {
    if (whatsappNumber) {
      const numeroLimpo = whatsappNumber.replace(/\D/g, '');
      const mensagem = encodeURIComponent(`Olá! Gostaria de falar sobre meu agendamento.`);
      window.open(`https://wa.me/${numeroLimpo}?text=${mensagem}`, '_blank');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'pending':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'completed':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmado';
      case 'pending':
        return 'Pendente';
      case 'completed':
        return 'Realizado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      // NÃO usar new Date() porque converte timezone!
      const [year, month, day] = dateStr.split('-');
      const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 
                      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const monthName = months[parseInt(month) - 1];
      return `${parseInt(day)} de ${monthName} de ${year}`;
    } catch (error) {
      return dateStr;
    }
  };

  // FILTRO SIMPLES E DIRETO - calculado no render
  const now = new Date();
  const displayed = appointments.filter(apt => {
    // Nunca mostrar cancelados
    if (apt.status === 'cancelled') return false;

    // Parse data e hora
    const parts = apt.date.split('-');
    const [year, month, day] = [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
    const timeParts = apt.time.split(':');
    const [hours, minutes] = [parseInt(timeParts[0]), parseInt(timeParts[1])];
    const appointmentTime = new Date(year, month - 1, day, hours, minutes, 0);

    const isFuture = appointmentTime.getTime() > now.getTime();

    // Aplicar filtro
    if (filter === 'all') return isFuture;
    if (filter === 'upcoming') return isFuture;
    if (filter === 'completed') return !isFuture;

    return false;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex justify-between items-start backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Meus Agendamentos</h1>
            <p className="text-gray-300">{clientName}</p>
            <p className="text-gray-400 text-sm">{clientEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            {whatsappNumber && (
              <button
                onClick={handleWhatsappClick}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-lg transition-all duration-300 text-sm"
                title="Enviar mensagem via WhatsApp"
              >
                <Send size={16} />
              </button>
            )}
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all duration-300"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-4xl mx-auto mb-6 flex gap-3">
        {(['all', 'upcoming', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
              filter === f
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'upcoming' ? 'Próximos' : 'Finalizados'}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-gray-300 mt-4">Carregando seus agendamentos...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <Calendar size={48} className="mx-auto text-gray-500 mb-4" />
            <p className="text-gray-300 text-lg">
              {filter === 'all'
                ? 'Você não tem agendamentos ainda'
                : filter === 'upcoming'
                ? 'Nenhum agendamento próximo'
                : 'Nenhum agendamento finalizado'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(apt => (
              <div
                key={apt.id}
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300 shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{apt.service_name}</h3>
                    <div className="space-y-2 text-gray-300">
                      <div className="flex items-center gap-3">
                        <Calendar size={18} className="text-blue-400" />
                        <span>{formatDate(apt.date)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock size={18} className="text-blue-400" />
                        <span>{apt.time}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <User size={18} className="text-blue-400" />
                        <span>{apt.professional_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <span className={`px-4 py-1 rounded-full text-sm font-medium border ${getStatusColor(apt.status)}`}>
                      {getStatusLabel(apt.status)}
                    </span>

                    {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                      <button
                        onClick={() => handleCancel(apt.id)}
                        className="flex items-center gap-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-sm transition-all duration-300"
                      >
                        <Trash2 size={16} />
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {apt.status === 'cancelled' && (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle size={18} className="text-red-400" />
                    <span className="text-red-300 text-sm">Este agendamento foi cancelado</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;