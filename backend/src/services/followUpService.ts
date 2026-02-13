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
    // Cache de memória para evitar disparos simultâneos
    sentCache: new Set<string>(),
    async getModes(companyId: string, settings: FollowUpSettings) {
        try {
            // 1. Carregar módulos do arquivo (onde o frontend está salvando)
            const baseDir = path.resolve(process.cwd(), 'backend', 'logs');
            const file = path.join(baseDir, `followup_modes_${companyId}.json`);
            
            let activeModes = [];
            if (fs.existsSync(file)) {
                try {
                    const raw = fs.readFileSync(file, 'utf-8');
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        activeModes = parsed.filter((m: any) => m.is_active === true || m.is_active === 'true');
                    }
                } catch (e) {
                    console.error(`❌ Erro ao ler arquivo de modos para ${companyId}:`, e);
                }
            }

            console.log(`\n🔍 [DEBUG MODOS] Empresa: ${companyId}`);
            console.log(`   -> Módulos Ativos no Arquivo: ${activeModes.length}`);

            if (activeModes.length === 0) {
                console.log(`   -> 🛑 TRAVA ABSOLUTA: Empresa sem nenhum módulo ativo. NADA será enviado.`);
                return []; 
            }

            console.log(`   -> Módulos que serão processados: ${activeModes.map((m: any) => m.name).join(', ')}`);

            const normalized = activeModes.map((m: any) => {
                const triggerType = m.trigger_type;
                
                return {
                    id: m.id,
                    name: m.name,
                    is_active: true,
                    trigger_type: triggerType,
                    warning_time: m.warning_time,
                    reminder_minutes: m.reminder_minutes,
                    trigger_days: m.trigger_days,
                    // Template específico do módulo (o frontend salva em campos diferentes dependendo do tipo)
                    message_template: m.message_template || m.message_template_warning || m.message_template_reminder || ''
                };
            });

            return normalized;
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
        
        // Log detalhado para depuração
        if (settings) {
            console.log(`🔍 [FOLLOW-UP] Empresa ${companyId}: is_active=${settings.is_active}, reminder_minutes=${settings.reminder_minutes}`);
        } else {
            console.log(`⚠️ [FOLLOW-UP] Empresa ${companyId}: Nenhuma configuração encontrada.`);
        }

        // Se não tem configuração, não faz nada. Se tem, e is_active não for explicitamente false, assume true.
        if (!settings || settings.is_active === false) {
            return;
        }

        const allModes = await this.getModes(companyId, settings as FollowUpSettings);
        const modes = allModes.filter(m => m.is_active);
        
        console.log(`🔍 [FOLLOW-UP] Modos ativos: ${modes.length} (${modes.map(m => m.name).join(', ')})`);
        
        if (modes.length === 0) return;

        // ✅ Usar timezone de Brasília para evitar problemas com UTC
        const agora = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
        const dataHojeStr = format(agora, 'yyyy-MM-dd');
        
        // ❌ REMOVIDO: avisado: false (Pois queremos verificar múltiplos avisos por agendamento)
        const agendamentosHoje = await db.getAgendamentos(companyId, {
            data: dataHojeStr
        });
        
        const agendamentos = (agendamentosHoje || []).filter((a: any) => 
            a?.status !== 'cancelado' && 
            a?.status !== 'finalizado' &&
            a?.status !== 'ausente'
        );

        console.log(`🔍 [FOLLOW-UP] Total de agendamentos hoje (${dataHojeStr}): ${agendamentos.length}`);

        const clientes = await db.listarClientes(companyId);
        const clienteById = new Map<string, any>();
        const clienteModes = new Map<string, Set<string>>();
        
        for (const c of (clientes || [])) {
            clienteById.set(String(c.id), c);
            const raw = c.followup_mode;
            const ids = (typeof raw === 'string' ? raw.split(',').map((s: string) => s.trim()).filter(Boolean) : Array.isArray(raw) ? raw : []) as string[];
            clienteModes.set(String(c.id), new Set(ids.map(String)));
        }

        for (const agendamento of agendamentos) {
            const clienteId = String(agendamento.cliente_id);
            const cliente = clienteById.get(clienteId);
            
            if (!cliente) {
                console.log(`⚠️ [FOLLOW-UP] Agendamento ${agendamento.id} sem cliente encontrado.`);
                continue;
            }

            console.log(`🔍 [FOLLOW-UP] Agendamento ${agendamento.id} (${agendamento.hora_agendamento}) - Cliente: ${cliente.nome}.`);

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
                // A lista 'modes' já contém APENAS módulos reais e ativos da empresa.
                console.log(`   -> 🔔 Verificando Gatilho: ${mode.name} (${mode.trigger_type})`);

                if (mode.trigger_type === 'time_fixed') {
                    const parts = String(mode.warning_time || '08:00:00').split(':');
                    const h = parseInt(parts[0] || '8');
                    const m = parseInt(parts[1] || '0');
                    const horaAviso = new Date(agora);
                    horaAviso.setHours(h, m, 0, 0);

                    // SÓ ENVIA SE: 
                    // 1. Já passou da hora do aviso (ex: 08:00)
                    // 2. O agendamento ainda NÃO aconteceu (agora < dataAgendamento)
                    if (agora >= horaAviso) {
                        const horaStr = agendamento.hora_agendamento || agendamento.horario;
                        if (horaStr) {
                            const agendamentoHoraParts = String(horaStr).split(':');
                            const dataAgendamento = new Date(agora);
                            dataAgendamento.setHours(parseInt(agendamentoHoraParts[0]), parseInt(agendamentoHoraParts[1]), 0, 0);

                            if (agora > dataAgendamento) {
                                console.log(`   -> ⏩ Ignorando Aviso Fixo: O agendamento das ${agendamento.hora_agendamento} já passou.`);
                                continue;
                            }
                        }

                        // Normalizar o tipo para a constraint do banco
                        const type = 'aviso';
                        
                        const jaEnviou = await db.checkFollowUpSent(agendamento.id, type);
                        if (!jaEnviou && !this.sentCache.has(`${agendamento.id}_${type}`)) {
                            console.log(`🚀 [FOLLOW-UP] DISPARANDO AVISO FIXO para ${cliente.nome}!`);
                            const msg = this.replaceTemplate(mode.message_template, vars);
                            await this.sendMessage(companyId, cliente.telefone, agendamento.id, type, msg);
                        } else {
                            // Se já enviou, alimenta o cache para garantir que não tente novamente nesta execução
                            this.sentCache.add(`${agendamento.id}_${type}`);
                            console.log(`   -> ✅ Aviso Fixo já enviado anteriormente para ${cliente.nome}.`);
                        }
                    } else {
                        console.log(`   -> ⏳ Hora do Aviso (${mode.warning_time}) ainda não chegou. Agora: ${format(agora, 'HH:mm')}`);
                    }
                }

                if (mode.trigger_type === 'antecedencia') {
                    const horaStr = agendamento.hora_agendamento || agendamento.horario;
                    if (!horaStr) continue;
                    
                    const agendamentoHoraParts = String(horaStr).split(':');
                    const agendamentoDate = new Date(agora);
                    agendamentoDate.setHours(parseInt(agendamentoHoraParts[0]), parseInt(agendamentoHoraParts[1]), 0, 0);
                    
                    const diffMinutos = differenceInMinutes(agendamentoDate, agora);
                    const lembreteMin = mode.reminder_minutes ?? 0;
                    
                    console.log(`   -> Modo: ${mode.name} | Faltam: ${diffMinutos} min | Gatilho: ${lembreteMin} min`);

                    // SÓ ENVIA SE:
                    // 1. Falta o tempo configurado (ex: 15 min)
                    // 2. O agendamento ainda NÃO aconteceu (diffMinutos > 0)
                    if (diffMinutos <= lembreteMin && diffMinutos > 0) {
                        const type = 'lembrete';
                        
                        const jaEnviou = await db.checkFollowUpSent(agendamento.id, type);
                        if (!jaEnviou && !this.sentCache.has(`${agendamento.id}_${type}`)) {
                            console.log(`🚀 [FOLLOW-UP] DISPARANDO LEMBRETE para ${cliente.nome}!`);
                            const msg = this.replaceTemplate(mode.message_template, { ...vars, minutos: lembreteMin });
                            await this.sendMessage(companyId, cliente.telefone, agendamento.id, type, msg);
                        } else {
                            // Se já enviou, alimenta o cache para garantir que não tente novamente nesta execução
                            this.sentCache.add(`${agendamento.id}_${type}`);
                            console.log(`   -> ✅ Lembrete já enviado anteriormente para ${cliente.nome}.`);
                        }
                    } else {
                        console.log(`   -> ⏳ Lembrete (${lembreteMin} min): Faltam ${diffMinutos} min. Ainda não é hora.`);
                    }
                }
            }
        }

        // --- Lógica de Recorrência (dias_apos) ---
        const diasModes = modes.filter(m => m.trigger_type === 'dias_apos' && (m.trigger_days ?? 0) > 0);
        if (diasModes.length === 0) return;

        const clientesAtivos = (clientes || []).filter((c: any) => c?.ativo !== false);
        for (const cliente of clientesAtivos) {
            const ativos = diasModes; // diasModes já são os módulos REAIS e ATIVOS do banco
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
            
            const todayDate = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
            const diffDias = differenceInCalendarDays(todayDate, lastDate);
            
            if (diffDias <= 0) continue;

            for (const mode of ativos) {
                const triggerDays = mode.trigger_days ?? 0;
                if (diffDias === triggerDays) { // Exatamente no dia X após o corte
                    const type = 'recorrencia';
                    
                    const jaEnviou = await db.checkFollowUpSent(lastFinalizado.id, type);
                    if (jaEnviou || this.sentCache.has(`${lastFinalizado.id}_${type}`)) {
                        // Alimenta o cache se já foi enviado para evitar re-checar no banco
                        this.sentCache.add(`${lastFinalizado.id}_${type}`);
                        continue;
                    }

                    const profissional = await db.getProfissionalById(lastFinalizado.profissional_id, companyId);
                    const servico = await db.getServicoById(lastFinalizado.servico_id, companyId);

                    const vars = {
                        cliente_nome: cliente.nome,
                        profissional: profissional ? profissional.nome : 'Profissional',
                        servico: servico ? servico.nome : 'Serviço',
                        horario: lastFinalizado.hora_agendamento || '',
                        minutos: 0
                    };

                    console.log(`🚀 [FOLLOW-UP] DISPARANDO RECORRÊNCIA para ${cliente.nome} (${diffDias} dias após)!`);
                    const msg = this.replaceTemplate(mode.message_template, vars);
                    await this.sendMessage(companyId, cliente.telefone, lastFinalizado.id, type, msg);
                }
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
        // ✅ NORMALIZAÇÃO CRÍTICA: O banco só aceita 'aviso', 'lembrete' ou 'recorrencia'
        // Se o tipo vier como 'antecedencia', 'time_fixed', etc, convertemos para o que o banco aceita
        let normalizedType = 'lembrete'; // padrão
        if (type === 'aviso' || type === 'time_fixed') normalizedType = 'aviso';
        if (type === 'lembrete' || type === 'antecedencia') normalizedType = 'lembrete';
        if (type === 'recorrencia' || type === 'dias_apos') normalizedType = 'recorrencia';

        const cacheKey = `${agendamentoId}_${normalizedType}`;

        // 0. TRAVA DE MEMÓRIA (Rápida)
        if (this.sentCache.has(cacheKey)) {
            console.log(`   -> ⏩ [CACHE] Bloqueado: ${normalizedType} já processado nesta execução.`);
            return;
        }
        
        try {
            // 1. TRAVA DE BANCO (Persistente)
            const { data: alreadySent, error: checkError } = await supabase
                .from('follow_up_messages')
                .select('id')
                .eq('appointment_id', agendamentoId)
                .eq('type', normalizedType)
                .eq('status', 'sent')
                .maybeSingle();

            if (alreadySent) {
                console.log(`   -> ⏩ [TRAVA BANCO] Abortando: ${normalizedType} já enviado para ${agendamentoId}.`);
                this.sentCache.add(cacheKey); // Alimenta o cache para não consultar o banco de novo
                return;
            }

            if (checkError) {
                console.error(` ❌ Erro ao verificar duplicidade:`, checkError.message);
            }

            // 2. DISPARAR NA EVOLUTION
            const result = await evolutionAPI.sendTextMessage(companyId, telefone, message);
            
            if (result.success) {
                console.log(` ✅ [Evolution] Mensagem enviada com sucesso!`);
                
                // 3. REGISTRAR IMEDIATAMENTE (Memória + Banco)
                this.sentCache.add(cacheKey);
                
                const { error: insertError } = await supabase.from('follow_up_messages').insert({
                    company_id: companyId,
                    appointment_id: agendamentoId,
                    type: normalizedType,
                    status: 'sent',
                    sent_at: new Date()
                });

                if (insertError) {
                    console.error(` ❌ Erro ao registrar no banco:`, insertError.message);
                }
            } else {
                console.error(` ❌ [Evolution] Falha ao enviar:`, result.error);
            }
        } catch (error: any) {
            console.error(` ❌ Erro crítico em sendMessage:`, error.message);
        }
    }
};
