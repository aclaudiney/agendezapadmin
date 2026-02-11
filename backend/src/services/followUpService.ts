import { db, supabase } from '../supabase.js';
import { evolutionAPI } from './whatsapp/evolutionAPI.js';
import fs from 'fs';
import path from 'path';
import { differenceInCalendarDays, differenceInMinutes, format } from 'date-fns';

interface FollowUpSettings {
    company_id: string;
    is_active: boolean;
    warning_time: string; // "08:00:00"
    reminder_minutes: number;
    message_template_warning: string;
    message_template_reminder: string;
}

export const FollowUpService = {
    async getModes(companyId: string, settings: FollowUpSettings) {
        try {
            const { data: dbModes, error } = await supabase
                .from('followup_modes')
                .select('*')
                .eq('company_id', companyId);

            if (error) throw error;

            const fileModes = dbModes || [];
            
            const defaultMode = {
                id: 'default',
                name: 'Aviso',
                is_active: true,
                warning_time: settings.warning_time || '08:00:00',
                reminder_minutes: settings.reminder_minutes ?? 60,
                message_template_warning: settings.message_template_warning || '',
                message_template_reminder: settings.message_template_reminder || '',
                trigger_type: 'time_fixed',
                trigger_days: null
            };

            const merged = [defaultMode, ...fileModes.filter(m => String(m?.id) !== 'default')];
            const normalized = merged.map((m: any) => {
                const triggerType = m.trigger_type
                    || ((m.trigger_days !== undefined && m.trigger_days !== null) ? 'dias_apos' : (m.name && String(m.name).toLowerCase().includes('lembrete') ? 'antecedencia' : 'time_fixed'));
                const triggerDays = triggerType === 'dias_apos' ? (m.trigger_days ?? 10) : null;
                return {
                    id: String(m.id || m.mode), // Fallback para mode se id não existir
                    name: m.name || m.mode || 'Modo',
                    is_active: m.is_active !== undefined ? !!m.is_active : true,
                    warning_time: m.warning_time || '08:00:00',
                    reminder_minutes: m.reminder_minutes ?? 60,
                    message_template_warning: m.message_template_warning || (m.settings?.message_template_warning) || '',
                    message_template_reminder: m.message_template_reminder || (m.settings?.message_template_reminder) || '',
                    trigger_type: triggerType,
                    trigger_days: triggerDays
                };
            });

            const uniq = new Map<string, any>();
            for (const m of normalized) uniq.set(m.id, m);
            return Array.from(uniq.values());
        } catch (error) {
            console.error(`❌ [FOLLOW-UP] Erro ao carregar modos do banco:`, error);
            return [];
        }
    },

    async setFollowUpMode(companyId: string, mode: string, settings: any) {
        return await supabase
            .from('followup_modes')
            .upsert({ 
                company_id: companyId, 
                mode, 
                settings, 
                updated_at: new Date().toISOString() 
            }, { onConflict: 'company_id' });
    },
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

        const modes = (await this.getModes(companyId, settings as FollowUpSettings)).filter(m => m.is_active);
        if (modes.length === 0) return;

        const hoje = new Date();
        const dataHojeStr = format(hoje, 'yyyy-MM-dd');
        const horaAtualStr = format(hoje, 'HH:mm');

        const clientes = await db.listarClientes(companyId);
        const clientesAtivos = (clientes || []).filter((c: any) => c?.ativo !== false);

        const clienteById = new Map<string, any>();
        const clienteModes = new Map<string, Set<string>>();
        for (const c of clientesAtivos) {
            clienteById.set(String(c.id), c);
            const raw = c.followup_mode;
            const ids = (typeof raw === 'string' ? raw.split(',').map((s: string) => s.trim()).filter(Boolean) : Array.isArray(raw) ? raw : []) as string[];
            clienteModes.set(String(c.id), new Set(ids.map(String)));
        }

        const agendamentosHoje = await db.getAgendamentos(companyId, {
            data: dataHojeStr,
            avisado: false
        });
        const agendamentos = (agendamentosHoje || []).filter((a: any) => a?.status !== 'cancelado' && a?.status !== 'finalizado');

        for (const agendamento of agendamentos) {
            const clienteId = String(agendamento.cliente_id);
            const selecionados = clienteModes.get(clienteId);
            if (!selecionados || selecionados.size === 0) continue;

            const cliente = clienteById.get(clienteId) || await db.getClienteById(clienteId, companyId);
            if (!cliente) continue;

            const profissional = await db.getProfissionalById(agendamento.profissional_id, companyId);
            const servico = await db.getServicoById(agendamento.servico_id, companyId);

            const vars = {
                cliente_nome: cliente.nome,
                profissional: profissional ? profissional.nome : 'Profissional',
                servico: servico ? servico.nome : 'Serviço',
                horario: agendamento.hora_agendamento || agendamento.horario || '',
                minutos: 0
            };

            for (const mode of modes) {
                if (!selecionados.has(String(mode.id))) continue;
                if (mode.trigger_type === 'time_fixed') {
                    const parts = String(mode.warning_time || '08:00:00').split(':');
                    const h = parseInt(parts[0] || '8');
                    const m = parseInt(parts[1] || '0');
                    const horaAviso = new Date(hoje);
                    horaAviso.setHours(h, m, 0, 0);
                    if (hoje >= horaAviso) {
                        const type = `mode:${mode.id}:time_fixed`;
                        const jaEnviou = await db.checkFollowUpSent(agendamento.id, type);
                        if (!jaEnviou) {
                            const msg = this.replaceTemplate(mode.message_template_warning, vars);
                            await this.sendMessage(companyId, cliente.telefone, agendamento.id, type, msg);
                        }
                    }
                }
                if (mode.trigger_type === 'antecedencia') {
                    const horaStr = agendamento.hora_agendamento || agendamento.horario;
                    if (!horaStr) continue;
                    const agendamentoHoraParts = String(horaStr).split(':');
                    const agendamentoDate = new Date(hoje);
                    agendamentoDate.setHours(parseInt(agendamentoHoraParts[0]), parseInt(agendamentoHoraParts[1]), 0, 0);
                    const diffMinutos = differenceInMinutes(agendamentoDate, hoje);
                    const lembreteMin = mode.reminder_minutes ?? settings.reminder_minutes;
                    if (diffMinutos <= lembreteMin && diffMinutos > 0) {
                        const type = `mode:${mode.id}:antecedencia`;
                        const jaEnviou = await db.checkFollowUpSent(agendamento.id, type);
                        if (!jaEnviou) {
                            const msg = this.replaceTemplate(mode.message_template_reminder, { ...vars, minutos: lembreteMin });
                            await this.sendMessage(companyId, cliente.telefone, agendamento.id, type, msg);
                        }
                    }
                }
            }
        }

        const diasModes = modes.filter(m => m.trigger_type === 'dias_apos' && (m.trigger_days ?? 0) > 0);
        if (diasModes.length === 0) return;

        for (const cliente of clientesAtivos) {
            const selecionados = clienteModes.get(String(cliente.id));
            if (!selecionados || selecionados.size === 0) continue;
            const ativos = diasModes.filter(m => selecionados.has(String(m.id)));
            if (ativos.length === 0) continue;

            const { data: lastFinalizado, error } = await supabase
                .from('agendamentos')
                .select('id, data_agendamento, hora_agendamento, profissional_id, servico_id')
                .eq('company_id', companyId)
                .eq('cliente_id', cliente.id)
                .eq('status', 'finalizado')
                .order('data_agendamento', { ascending: false })
                .order('hora_agendamento', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error || !lastFinalizado || !lastFinalizado.data_agendamento) continue;

            const lastDateParts = String(lastFinalizado.data_agendamento).split('-').map(Number);
            const lastDate = new Date(Date.UTC(lastDateParts[0], (lastDateParts[1] || 1) - 1, lastDateParts[2] || 1));
            const todayParts = dataHojeStr.split('-').map(Number);
            const todayDate = new Date(Date.UTC(todayParts[0], (todayParts[1] || 1) - 1, todayParts[2] || 1));
            const diffDias = differenceInCalendarDays(todayDate, lastDate);
            if (diffDias <= 0) continue;

            const profissional = await db.getProfissionalById(lastFinalizado.profissional_id, companyId);
            const servico = await db.getServicoById(lastFinalizado.servico_id, companyId);

            const vars = {
                cliente_nome: cliente.nome,
                profissional: profissional ? profissional.nome : 'Profissional',
                servico: servico ? servico.nome : 'Serviço',
                horario: lastFinalizado.hora_agendamento || '',
                minutos: 0
            };

            for (const mode of ativos) {
                const triggerDays = mode.trigger_days ?? 0;
                if (diffDias < triggerDays) continue;
                const type = `mode:${mode.id}:dias_apos:${triggerDays}`;
                const jaEnviou = await db.checkFollowUpSent(lastFinalizado.id, type);
                if (jaEnviou) continue;
                const msg = this.replaceTemplate(mode.message_template_warning, vars);
                await this.sendMessage(companyId, cliente.telefone, lastFinalizado.id, type, msg);
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
            await evolutionAPI.sendTextMessage(companyId, telefone, message);
            await db.logFollowUpMessage(companyId, agendamentoId, type, 'sent');

            // ✅ MARCAR COMO AVISADO PARA EVITAR LOOP
            await supabase
                .from('agendamentos')
                .update({ avisado: true })
                .eq('id', agendamentoId);

        } catch (error: any) {
            console.error(`❌ [FOLLOW-UP] Erro ao enviar (${type}):`, error.message);
            await db.logFollowUpMessage(companyId, agendamentoId, type, 'failed');

            // Se falhou por WhatsApp desconectado, registrar log detalhado
            if (error.message?.includes('WhatsApp não está conectado')) {
                console.warn(`⚠️ [FOLLOW-UP] Falha de conexão detectada para empresa ${companyId}`);
            }
        }
    }
};
