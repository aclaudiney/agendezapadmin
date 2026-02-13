import { db } from '../supabase.js';
import { evolutionAPI } from './whatsapp/evolutionAPI.js';

export const NotificationService = {
    /**
     * Notifica o profissional sobre um novo agendamento
     */
    async notifyProfessionalNewAppointment(companyId: string, appointmentId: string) {
        try {
            console.log(`🔔 [NOTIFICAÇÃO] Iniciando aviso ao profissional para agendamento: ${appointmentId}`);

            // 1. Buscar detalhes completos do agendamento
            const { data: apt, error } = await (await import('../supabase.js')).supabase
                .from('agendamentos')
                .select(`
                    id,
                    data_agendamento,
                    hora_agendamento,
                    cliente:clientes(nome, telefone),
                    servico:servicos(nome),
                    profissional:profissionais(nome, telefone)
                `)
                .eq('id', appointmentId)
                .single();

            if (error || !apt) {
                console.error('❌ [NOTIFICAÇÃO] Erro ao buscar dados para notificação:', error);
                return;
            }

            const profissionalTelefone = apt.profissional?.telefone;
            if (!profissionalTelefone) {
                console.warn(`⚠️ [NOTIFICAÇÃO] Profissional ${apt.profissional?.nome} não tem telefone cadastrado.`);
                return;
            }

            // 2. Formatar a mensagem
            const dataFormatada = apt.data_agendamento.split('-').reverse().join('/');
            const horaFormatada = apt.hora_agendamento.substring(0, 5);
            
            const mensagem = `*📌 NOVO AGENDAMENTO!*
            
Olá *${apt.profissional.nome}*, um novo horário foi agendado para você:

👤 *Cliente:* ${apt.cliente?.nome || 'Não informado'}
📱 *Telefone:* ${apt.cliente?.telefone || 'Não informado'}
✂️ *Serviço:* ${apt.servico?.nome || 'Serviço'}
📅 *Data:* ${dataFormatada}
⏰ *Hora:* ${horaFormatada}

_Agendamento realizado via AgendeZap._`;

            // 3. Enviar via WhatsApp (usando a instância da própria empresa)
            await evolutionAPI.sendTextMessage(companyId, profissionalTelefone, mensagem);
            
            console.log(`✅ [NOTIFICAÇÃO] Profissional ${apt.profissional.nome} avisado com sucesso!`);

        } catch (error: any) {
            console.error('❌ [NOTIFICAÇÃO] Erro crítico ao notificar profissional:', error.message);
        }
    }
};
