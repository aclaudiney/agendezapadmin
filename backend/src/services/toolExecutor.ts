import { createClient } from '@supabase/supabase-js';
import { NotificationService } from './notificationService.js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function executeTools(toolCalls: any[], companyId: string, clientPhone: string) {
    const results = [];

    for (const call of toolCalls) {
        const functionName = call.name;
        const args = call.args || {};

        console.log(`🛠️ [TOOL] Executando: ${functionName}`, args);

        try {
            let responseData: any = {};

            switch (functionName) {

                case 'get_available_slots':
                    let serviceIdOrName = args.service || args.service_id;
                    let professionalIdOrName = args.professional || args.barber_id;
                    let period = args.period || 'todos';
                    let requestedDate = args.date;

                    // 1. Buscar configuração centralizada para saber horários de abertura/fechamento
                    const { db: database } = await import('../supabase.js');
                    const config = await database.getConfiguracao(companyId);
                    
                    if (!config) {
                        responseData = { success: false, error: 'Configuração da empresa não encontrada.' };
                        break;
                    }

                    // 2. Resolver Serviço e Profissional
                    let finalServiceId = null;
                    let serviceDuration = 30;
                    let finalProfessionalId = null;

                    if (serviceIdOrName) {
                        const { data: s } = await supabase.from('servicos')
                            .select('id, duracao')
                            .eq('company_id', companyId)
                            .or(`id.eq.${serviceIdOrName},nome.ilike.%${serviceIdOrName}%`)
                            .limit(1)
                            .maybeSingle();
                        if (s) {
                            finalServiceId = s.id;
                            serviceDuration = s.duracao || 30;
                        }
                    }

                    if (professionalIdOrName) {
                        const { data: p } = await supabase.from('profissionais')
                            .select('id')
                            .eq('company_id', companyId)
                            .or(`id.eq.${professionalIdOrName},nome.ilike.%${professionalIdOrName}%`)
                            .limit(1)
                            .maybeSingle();
                        if (p) finalProfessionalId = p.id;
                    }

                    // 3. Chamar a RPC atualizada ou usar lógica TS para buscar slots REAIS
                    // ✅ IMPORTANTE: Vamos usar a RPC mas passar os parâmetros de duração e período corretamente.
                    // A RPC ainda tem o problema de horários fixos (08:00-20:00), mas vamos tentar mitigar 
                    // ou idealmente usaríamos uma lógica que lê do config.
                    
                    console.log('📞 [TOOL] RPC get_available_slots:', {
                        p_company_id: companyId, p_date: requestedDate, p_service_id: finalServiceId,
                        p_profissional_id: finalProfessionalId, p_duration_minutes: serviceDuration, p_period: period
                    });

                    const { data: rawSlots, error: slotsError } = await supabase.rpc('get_available_slots', {
                        p_company_id: companyId,
                        p_date: requestedDate,
                        p_service_id: finalServiceId,
                        p_profissional_id: finalProfessionalId,
                        p_duration_minutes: serviceDuration,
                        p_period: period
                    });

                    if (slotsError) {
                        console.error(`❌ [TOOL] Erro na RPC get_available_slots:`, slotsError);
                        responseData = { success: false, error: slotsError.message };
                        break;
                    }

                    // 4. FILTRAGEM EXTRA (TS) para garantir:
                    // a) Não mostrar horários passados (se for hoje)
                    // b) Respeitar abertura/fechamento do config (caso a RPC falhe nisso)
                    
                    const agora = new Date();
                    const formatterData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
                    const formatterHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
                    
                    const [diaA, mesA, anoA] = formatterData.format(agora).split('/');
                    const dataAtualISO = `${anoA}-${mesA}-${diaA}`;
                    const [hA, mA] = formatterHora.format(agora).split(':').map(Number);
                    const minutoAtual = hA * 60 + mA;

                    const slotsFiltrados = (rawSlots || []).filter((slot: any) => {
                        if (!slot.time) return false;
                        
                        // Filtro de horário passado (hoje)
                        if (requestedDate === dataAtualISO) {
                            const [sH, sM] = slot.time.split(':').map(Number);
                            const minutoSlot = sH * 60 + sM;
                            if (minutoSlot <= (minutoAtual + 30)) return false; // Margem de 30min
                        }

                        // Filtro de horário de funcionamento (config)
                        const dataObj = new Date(`${requestedDate}T12:00:00-03:00`);
                        const nomesDiaIngles = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
                        const diaSemana = nomesDiaIngles[dataObj.getDay()];
                        
                        // Verifica primeiro se o dia está marcado como aberto
                        const diasAbertura = config.dias_abertura || {};
                        if (diasAbertura[diaSemana] === false) return false;

                        const horarioDoDia = config[`horario_${diaSemana}`];
                        
                        if (horarioDoDia && horarioDoDia !== 'FECHADO') {
                            const [open, close] = horarioDoDia.split('-');
                            if (open && close) {
                                const [oH, oM] = open.split(':').map(Number);
                                const [cH, cM] = close.split(':').map(Number);
                                const [sH, sM] = slot.time.split(':').map(Number);
                                const minutoSlot = sH * 60 + sM;
                                const minutoOpen = oH * 60 + oM;
                                const minutoClose = cH * 60 + cM;
                                
                                if (minutoSlot < minutoOpen || minutoSlot > minutoClose) return false;
                            }
                        }

                        return true;
                    });

                    responseData = {
                        success: slotsFiltrados.length > 0,
                        slots: slotsFiltrados,
                        count: slotsFiltrados.length,
                        period_info: period !== 'todos' ? `Filtrado para o período: ${period}` : 'Todos os horários'
                    };
                    break;

                case 'create_appointment':
                    let aptServiceName = args.service || args.service_id;
                    let aptProfessionalName = args.professional || args.barber_id;

                    let finalAptServiceId = null;
                    let finalAptProfessionalId = null;
                    let servicePrice = args.valor || 0;

                    // ⭐ CONVERTE SERVIÇO (RESILIENTE A ID OU NOME)
                    if (aptServiceName) {
                        const isUuid = aptServiceName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                        let query = supabase.from('servicos').select('id, preco, nome').eq('company_id', companyId);

                        if (isUuid) {
                            query = query.eq('id', aptServiceName);
                        } else {
                            // 1. Busca exata (ex: "Corte e Barba")
                            const { data: exactS } = await supabase.from('servicos')
                                .select('id, preco, nome')
                                .eq('company_id', companyId)
                                .ilike('nome', aptServiceName.trim())
                                .limit(1)
                                .maybeSingle();
                            
                            if (exactS) {
                                finalAptServiceId = exactS.id;
                                if (!servicePrice) servicePrice = exactS.preco || 0;
                            } else {
                                // 2. Busca por termos e prioriza combos (ex: "Corte e Barba")
                                const cleanName = aptServiceName.trim().toLowerCase();
                                const terms = cleanName.split(/\s+(?:e|&|,|mais|com)\s+|\s+/i).filter(t => t.length > 2);
                                
                                let termQuery = supabase.from('servicos').select('id, preco, nome').eq('company_id', companyId).eq('ativo', true);
                                let orFilter = terms.map(t => `nome.ilike.%${t}%`).join(',');
                                
                                const { data: fuzzyS } = await termQuery.or(orFilter).limit(20);
                                
                                if (fuzzyS && fuzzyS.length > 0) {
                                    // Pontuação para encontrar a melhor correspondência
                                    const scoredMatches = fuzzyS.map(s => {
                                        const sName = s.nome.toLowerCase();
                                        // Conta quantos termos do cliente estão no nome do serviço
                                        const matchCount = terms.filter(t => sName.includes(t)).length;
                                        // Bonus se o tamanho for similar (evita pegar "Corte" quando pediu "Corte e Barba")
                                        const lengthBonus = Math.abs(sName.length - cleanName.length) < 5 ? 1 : 0;
                                        // Bonus se o nome do serviço contiver múltiplos termos (provável combo)
                                        const isCombo = sName.includes(' e ') || sName.includes('&') || sName.includes(',') || sName.includes(' mais ') ? 1 : 0;
                                        
                                        return { 
                                            ...s, 
                                            score: (matchCount * 10) + lengthBonus + (isCombo * 2)
                                        };
                                    });

                                    const bestMatch = scoredMatches.sort((a, b) => b.score - a.score)[0];

                                    if (bestMatch && bestMatch.score > 5) { // Score mínimo para evitar falsos positivos
                                        finalAptServiceId = bestMatch.id;
                                        if (!servicePrice) servicePrice = bestMatch.preco || 0;
                                        console.log(`🎯 [TOOL] Melhor correspondência (resiliente) para "${aptServiceName}": ${bestMatch.nome} (Score: ${bestMatch.score})`);
                                    }
                                }

                                // 3. Fallback original se ainda não achou
                                if (!finalAptServiceId) {
                                    query = query.ilike('nome', `%${aptServiceName.trim()}%`);
                                }
                            }
                        }

                        if (!finalAptServiceId) {
                            const { data: s } = await query.limit(1).maybeSingle();
                            if (s) {
                                finalAptServiceId = s.id;
                                if (!servicePrice) servicePrice = s.preco || 0;
                            } else if (isUuid) {
                                finalAptServiceId = aptServiceName;
                            }
                        }
                    }

                    // ⭐ CONVERTE BARBEIRO (RESILIENTE A ID OU NOME)
                    if (aptProfessionalName) {
                        const isUuid = aptProfessionalName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                        let query = supabase.from('profissionais').select('id').eq('company_id', companyId);

                        if (isUuid) {
                            query = query.eq('id', aptProfessionalName);
                        } else {
                            query = query.ilike('nome', `%${aptProfessionalName}%`);
                        }

                        const { data: p } = await query.limit(1).maybeSingle();

                        if (p) {
                            finalAptProfessionalId = p.id;
                        } else if (isUuid) {
                            finalAptProfessionalId = aptProfessionalName;
                        }
                    }

                    // ⭐ RPC TRATA O CADASTRO DO CLIENTE (NOME) DE FORMA ATÔMICA
                    const clientNameVar = args.client_name || 'Cliente WhatsApp';

                    // ⭐ BLOQUEIO RIGOROSO: NOME E PROFISSIONAL
                    if (clientNameVar === 'Cliente WhatsApp') {
                        responseData = {
                            success: false,
                            error: 'NOME OBRIGATÓRIO: Por favor, pergunte o nome do cliente antes de finalizar o agendamento.'
                        };
                        break;
                    }

                    if (!finalAptProfessionalId) {
                        const { data: allP } = await supabase.from('profissionais').select('nome').eq('company_id', companyId).eq('ativo', true);
                        const names = (allP || []).map(p => p.nome).join(', ');
                        responseData = {
                            success: false,
                            error: `PROFISSIONAL OBRIGATÓRIO: Por favor, peça ao cliente para escolher um dos profissionais: ${names}`
                        };
                        break;
                    }

                    const { data: apt, error: aptError } = await supabase.rpc('create_appointment_atomic', {
                        p_company_id: companyId,
                        p_client_phone: clientPhone,
                        p_client_name: clientNameVar,
                        p_date: args.date,
                        p_time: args.time,
                        p_service_id: finalAptServiceId,
                        p_profissional_id: finalAptProfessionalId,
                        p_valor: servicePrice
                    });

                    if (aptError || (apt && apt.success === false)) {
                        console.error(`❌ [TOOL] Erro na RPC create_appointment_atomic:`, aptError || apt.error);
                    } else if (apt && apt.appointment_id) {
                        // 🔔 NOTIFICAR PROFISSIONAL (IA)
                        NotificationService.notifyProfessionalNewAppointment(companyId, apt.appointment_id).catch(err => 
                            console.error('⚠️ Erro ao notificar profissional (IA):', err)
                        );
                    }

                    responseData = apt || { success: false, error: aptError?.message || 'Erro ao criar agendamento' };
                    break;

                case 'list_appointments':
                    console.log(`🔍 [TOOL] list_appointments: Buscando para Empresa ${companyId} e Telefone ${clientPhone}`);
                    // 1. Busca o ID do cliente pelo telefone
                    const { data: client } = await supabase
                        .from('clientes')
                        .select('id')
                        .eq('telefone', clientPhone)
                        .eq('company_id', companyId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (!client) {
                        console.log(`❌ [TOOL] list_appointments: Cliente não cadastrado nesta empresa.`);
                        responseData = { success: true, appointments: [], error: 'Cliente não cadastrado' };
                        break;
                    }

                    console.log(`✅ [TOOL] list_appointments: ClienteID ${client.id} identificado.`);

                    // 2. Busca os agendamentos usando o cliente_id
                    const now = new Date();
                    const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                    const todayStr = brDate.getFullYear() + '-' + String(brDate.getMonth() + 1).padStart(2, '0') + '-' + String(brDate.getDate()).padStart(2, '0');
                    const currentTime = String(brDate.getHours()).padStart(2, '0') + ':' + String(brDate.getMinutes()).padStart(2, '0');

                    console.log(`📅 [TOOL] list_appointments: Filtrando >= ${todayStr} (Agora: ${currentTime} Brasília)`);

                    const { data: apts, error: aptsError } = await supabase
                        .from('agendamentos')
                        .select(`
                            id, 
                            data_agendamento, 
                            hora_agendamento, 
                            status, 
                            servico:servicos(nome), 
                            profissional:profissionais(nome)
                        `)
                        .eq('company_id', companyId)
                        .eq('cliente_id', client.id)
                        .in('status', ['confirmado', 'pendente'])
                        .gte('data_agendamento', todayStr)
                        .order('data_agendamento', { ascending: true })
                        .order('hora_agendamento', { ascending: true });

                    if (aptsError) console.error(`❌ [TOOL] Erro na query de lista:`, aptsError.message);

                    // Filtrar horários passados se for hoje
                    const futureApts = (apts || []).filter(apt => {
                        if (apt.data_agendamento > todayStr) return true;
                        const aptTime = (apt.hora_agendamento || '').substring(0, 5);
                        return aptTime > currentTime;
                    });

                    console.log(`📦 [TOOL] list_appointments: Retornando ${futureApts.length} agendamentos. IDs:`, futureApts.map(a => a.id).join(', '));

                    responseData = {
                        success: !aptsError,
                        appointments: futureApts.map(apt => ({
                            id: apt.id,
                            date: apt.data_agendamento,
                            time: (apt.hora_agendamento || '').substring(0, 5),
                            status: apt.status,
                            service: (apt as any).servico?.nome || 'Serviço',
                            barber: (apt as any).profissional?.nome || 'Profissional'
                        })),
                        error: aptsError?.message
                    };
                    break;

                case 'cancel_appointment':
                    const inputId = args.appointment_id;
                    console.log(`🗑️ [TOOL] cancel_appointment: Recebido ID [${inputId}] | Empresa ${companyId}`);

                    // Validação robusta de UUID
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (!uuidRegex.test(inputId)) {
                        console.error(`❌ [TOOL] ID Inválido (não é UUID): ${inputId}`);
                        responseData = { success: false, error: `O ID informado (${inputId}) não é um UUID válido. Use apenas o ID retornado pela listagem.` };
                        break;
                    }

                    const { data: cancelRes, error: cancelError } = await supabase.rpc('cancel_appointment_atomic', {
                        p_company_id: companyId,
                        p_appointment_id: inputId,
                        p_motivo: args.reason || 'Cancelado pelo cliente'
                    });

                    if (cancelError) {
                        console.error(`❌ [TOOL] Erro RPC cancel_appointment:`, cancelError.message);
                    }

                    responseData = cancelRes || { success: false, error: cancelError?.message || 'Erro inesperado ao cancelar' };
                    console.log(`✅ [TOOL] Resultado cancelamento:`, JSON.stringify(responseData));
                    break;

                case 'get_company_info':
                    // 1. Busca dados básicos e configurações de horários
                    const [{ data: bData }, { data: sList }, { data: pList }, { data: configData }] = await Promise.all([
                        supabase.from('empresas').select('nome').eq('id', companyId).maybeSingle(),
                        supabase.from('servicos').select('nome, preco, duracao, ativo').eq('company_id', companyId),
                        supabase.from('profissionais').select('nome, ativo').eq('company_id', companyId),
                        supabase.from('configuracoes').select('*').eq('company_id', companyId).maybeSingle()
                    ]);

                    const activeS = (sList || []).filter(s => s.ativo !== false);
                    const activeP = (pList || []).filter(p => p.ativo !== false);

                    console.log(`📊 [TOOL] get_company_info: ${activeS.length} serviços, ${activeP.length} profissionais`);

                    // Formatar horários de funcionamento
                    const dFunc = configData?.dias_abertura || {};
                    const businessHours = [
                        `Segunda: ${dFunc.segunda === false ? 'FECHADO' : (configData?.horario_segunda || 'Não informado')}`,
                        `Terça: ${dFunc.terca === false ? 'FECHADO' : (configData?.horario_terca || 'Não informado')}`,
                        `Quarta: ${dFunc.quarta === false ? 'FECHADO' : (configData?.horario_quarta || 'Não informado')}`,
                        `Quinta: ${dFunc.quinta === false ? 'FECHADO' : (configData?.horario_quinta || 'Não informado')}`,
                        `Sexta: ${dFunc.sexta === false ? 'FECHADO' : (configData?.horario_sexta || 'Não informado')}`,
                        `Sábado: ${dFunc.sabado === false ? 'FECHADO' : (configData?.horario_sabado || 'Não informado')}`,
                        `Domingo: ${dFunc.domingo === false ? 'FECHADO' : (configData?.horario_domingo || 'Não informado')}`
                    ].join('\n');

                    // Formatar endereço
                    const addressStr = configData?.rua 
                        ? `${configData.rua}${configData.numero ? `, ${configData.numero}` : ''}${configData.cidade ? ` - ${configData.cidade}` : ''}`
                        : 'Endereço não informado';

                    responseData = {
                        success: true,
                        business_name: bData?.nome || 'Estabelecimento',
                        business_hours: businessHours,
                        address: addressStr,
                        services_and_prices: activeS.map(s => `• ${s.nome}: R$ ${s.preco} (${s.duracao} min)`).join('\n'),
                        available_professionals: activeP.map(p => `• ${p.nome}`).join('\n'),
                        single_professional: activeP.length === 1 ? activeP[0].nome : null
                    };
                    break;

                case 'get_client_info':
                    const { data: clientInfo, error: clientError } = await supabase
                        .from('clientes')
                        .select('id, nome, telefone, created_at')
                        .eq('telefone', clientPhone)
                        .eq('company_id', companyId)
                        .maybeSingle();

                    responseData = clientInfo || { exists: false, error: clientError?.message };
                    break;

                case 'update_client_name':
                    const newName = args.name;
                    if (!newName) {
                        responseData = { success: false, error: 'O nome é obrigatório' };
                        break;
                    }

                    console.log(`👤 [TOOL] update_client_name: Atualizando para "${newName}" | Telefone: ${clientPhone}`);

                    // 1. Upsert do cliente (Tenta inserir ou atualizar se já existir)
                    // Usamos getCliente primeiro para evitar erro de constraint se o upsert falhar
                    const { db: dbUtils } = await import('../supabase.js');
                    const existingClient = await dbUtils.getCliente(clientPhone, companyId);
                    
                    let clientObj, clientErr;

                    if (existingClient) {
                        // Atualiza se já existir
                        const { data, error } = await supabase
                            .from('clientes')
                            .update({ nome: newName, ativo: true })
                            .eq('id', existingClient.id)
                            .select()
                            .single();
                        clientObj = data;
                        clientErr = error;
                    } else {
                        // Insere se for novo
                        const { data, error } = await supabase
                            .from('clientes')
                            .insert({
                                company_id: companyId,
                                telefone: clientPhone,
                                nome: newName,
                                ativo: true
                            })
                            .select()
                            .single();
                        clientObj = data;
                        clientErr = error;
                    }

                    if (clientErr) {
                        console.error('❌ [TOOL] Erro ao cadastrar cliente:', clientErr.message);
                        responseData = { success: false, error: clientErr.message };
                        break;
                    }

                    // 2. Atualizar histórico retroativamente em whatsapp_messages e whatsapp_conversations
                    // Isso garante que o CRM mude de "PushName" para o nome informado
                    try {
                        // Aguardar um pequeno delay para garantir que a mensagem atual foi salva no banco antes de atualizar
                        await new Promise(resolve => setTimeout(resolve, 1500));

                        await Promise.all([
                            supabase.from('whatsapp_messages')
                                .update({ client_name: newName })
                                .eq('company_id', companyId)
                                .eq('client_phone', clientPhone),
                            supabase.from('whatsapp_conversations')
                                .update({ client_name: newName })
                                .eq('company_id', companyId)
                                .eq('client_phone', clientPhone)
                        ]);
                        console.log(`✅ [TOOL] Histórico de mensagens atualizado para o nome: ${newName}`);
                    } catch (updErr: any) {
                        console.warn(`⚠️ [TOOL] Erro ao atualizar nomes retroativos:`, updErr.message);
                    }

                    responseData = { 
                        success: true, 
                        message: `Cliente ${newName} cadastrado com sucesso e histórico atualizado.`,
                        client: clientObj
                    };
                    break;

                default:
                    responseData = { error: 'Função desconhecida' };
            }

            // ⭐ FORMATO CORRETO PARA GEMINI 2.0
            results.push({
                functionResponse: {
                    name: functionName,
                    response: responseData  // ← OBJETO, não string!
                }
            });

            console.log(`✅ [TOOL] Sucesso: ${functionName} retornou campos`);

        } catch (error: any) {
            console.error(`❌ [TOOL] Erro em ${functionName}:`, error.message);

            // ⭐ MESMO EM ERRO, RETORNA NO FORMATO CORRETO
            results.push({
                functionResponse: {
                    name: call.name,
                    response: {
                        success: false,
                        error: error.message || 'Erro desconhecido'
                    }
                }
            });
        }
    }

    console.log(`📦 [TOOL] Retornando ${results.length} respostas`);
    return results;
}
