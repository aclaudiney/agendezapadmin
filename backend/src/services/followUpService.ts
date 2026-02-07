import { db } from '../supabase.js';
import { enviarMensagemManual } from '../whatsapp.js';
import { format, differenceInMinutes, parseISO, subMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FollowUpSettings {
    company_id: string;
    is_active: boolean;
    warning_time: string; // "08:00:00"
    reminder_minutes: number;
    message_template_warning: string;
    message_template_reminder: string;
}

export const FollowUpService = {
    /**
     * Processa todas as empresas para verificar follow-ups
     * (Idealmente chamado por Cron)
     */
    async processAllCompanies() {
        console.log('⏰ [FOLLOW-UP] Iniciando verificação global...');
        const companies = await db.listarEmpresas();

        for (const company of companies) {
            if (company.active) {
                await this.checkAndSendFollowUps(company.id);
            }
        }
    },

    /**
     * Verifica e envia mensagens para uma empresa específica
     */
    async checkAndSendFollowUps(companyId: string) {
        // 1. Obter configurações
        const settings = await db.getFollowUpSettings(companyId);

        if (!settings || !settings.is_active) {
            return; // Follow-up desativado ou não configurado
        }

        const hoje = new Date();
        const dataHojeStr = format(hoje, 'yyyy-MM-dd');
        const horaAtualStr = format(hoje, 'HH:mm');

        // 2. Buscar agendamentos de hoje (não cancelados, não finalizados)
        // OBS: getAgendamentos retorna array. Precisamos filtrar status.
        const agendamentos = await db.getAgendamentos(companyId, {
            data: dataHojeStr,
            status: 'pendente'
            // Poderíamos incluir 'confirmado' se existir esse status, assumindo 'pendente' por enquanto
        });

        console.log(`🔎 [FOLLOW-UP] Empresa ${companyId}: ${agendamentos.length} agendamentos hoje.`);

        for (const agendam of agendamentos) {
            await this.processAppointment(companyId, agendam, settings, hoje, horaAtualStr);
        }
    },

    async processAppointment(companyId: string, agendamento: any, settings: FollowUpSettings, agora: Date, horaAtualStr: string) {
        // Obter cliente e profissional para template
        const cliente = await db.getClienteById(agendamento.cliente_id, companyId);
        const profissional = await db.getProfissionalById(agendamento.profissional_id, companyId);
        const servico = await db.getServicoById(agendamento.servico_id, companyId); // Se houver

        if (!cliente) return;

        // Variables for template
        const vars = {
            cliente_nome: cliente.nome,
            profissional: profissional ? profissional.nome : 'Profissional',
            servico: servico ? servico.nome : 'Serviço',
            horario: agendamento.hora_agendamento || agendamento.horario || '',
            minutos: settings.reminder_minutes
        };

        // ==========================================
        // TIPO 1: AVISO DO DIA (WARNING) - ex: 08:00
        // ==========================================
        // Verifica se já passou da hora de aviso configurada (margem de 10 min para não enviar muito atrasado se o cron falhar, opcional)
        // Lógica simplificada: Se hora atual == hora aviso (ou dentro do range do cron)
        // Melhor lógica: Se hora atual >= hora aviso E ainda não enviado.

        const warningTimeParts = settings.warning_time.split(':');
        const warningHour = parseInt(warningTimeParts[0]);
        const warningMin = parseInt(warningTimeParts[1]);

        const horaAviso = new Date(agora);
        horaAviso.setHours(warningHour, warningMin, 0, 0);

        // Se agora é maior que hora do aviso, e ainda é "de manhã" (ex: não enviar aviso de bom dia às 18h)
        // Vamos assumir que o cron roda a cada minuto. Se agora >= warningTime
        if (agora >= horaAviso) {
            const jaEnviou = await db.checkFollowUpSent(agendamento.id, 'warning');

            if (!jaEnviou) {
                // Enviar Aviso
                console.log(`🚀 [FOLLOW-UP] Enviando AVISO para ${cliente.nome} (${agendamento.hora_agendamento || agendamento.horario || 'sem horário'})`);
                const msg = this.replaceTemplate(settings.message_template_warning, vars);
                await this.sendMessage(companyId, cliente.telefone, agendamento.id, 'warning', msg);
            }
        }

        // ==========================================
        // TIPO 2: LEMBRETE (REMINDER) - ex: 30 min antes
        // ==========================================

        // Calcular hora do agendamento
        const horaStr = agendamento.hora_agendamento || agendamento.horario;
        if (!horaStr) {
            console.log(`⚠️ [FOLLOW-UP] Agendamento ${agendamento.id} sem hora definida. Pulando lembrete.`);
            return;
        }
        const agendamentoHoraParts = horaStr.split(':');
        const agendamentoDate = new Date(agora);
        agendamentoDate.setHours(parseInt(agendamentoHoraParts[0]), parseInt(agendamentoHoraParts[1]), 0, 0);

        const diffMinutos = differenceInMinutes(agendamentoDate, agora);

        // Se faltam X minutos (com uma margem de segurança, ex: entre X e X-5)
        // Ou simplesmente: Se diff <= reminder_minutes E diff > 0
        if (diffMinutos <= settings.reminder_minutes && diffMinutos > 0) {
            const jaEnviou = await db.checkFollowUpSent(agendamento.id, 'reminder');

            if (!jaEnviou) {
                // Enviar Lembrete
                console.log(`🚀 [FOLLOW-UP] Enviando LEMBRETE para ${cliente.nome} (Faltam ${diffMinutos}m)`);
                const msg = this.replaceTemplate(settings.message_template_reminder, vars);
                await this.sendMessage(companyId, cliente.telefone, agendamento.id, 'reminder', msg);
            }
        }
    },

    replaceTemplate(template: string, vars: any) {
        const safe = (v: any, def: string = '') => (v === undefined || v === null ? def : String(v));
        let msg = template || '';
        msg = msg.replace(/{cliente_nome}/g, safe(vars.cliente_nome));
        msg = msg.replace(/{profissional}/g, safe(vars.profissional));
        msg = msg.replace(/{servico}/g, safe(vars.servico));
        msg = msg.replace(/{horario}/g, safe(vars.horario));
        msg = msg.replace(/{minutos}/g, safe(vars.minutos));
        return msg;
    },

    async sendMessage(companyId: string, telefone: string, agendamentoId: string, type: string, message: string) {
        try {
            await enviarMensagemManual(companyId, telefone, message);
            await db.logFollowUpMessage(companyId, agendamentoId, type, 'sent');
        } catch (error: any) {
            console.error(`❌ [FOLLOW-UP] Erro ao enviar (${type}):`, error.message);
            await db.logFollowUpMessage(companyId, agendamentoId, type, 'failed');
        }
    }
};
