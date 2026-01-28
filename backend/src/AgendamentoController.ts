import { db, supabase } from "./supabase.js";
import { gerarRespostaIA } from "./aiService.js";

export const processarFluxoAgendamento = async (texto: string, telefone: string, companyId: string) => {
    try {
        // ✅ Buscar dados da empresa
        const [profissionais, servicos, cliente] = await Promise.all([
            db.getProfissionais(companyId),
            db.getServicos(companyId),
            db.getCliente(telefone, companyId)
        ]);

        // ✅ Buscar configurações da empresa
        const { data: configAgente } = await supabase
            .from('agente_config')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();

        const { data: configLoja } = await supabase
            .from('configuracoes')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();

        if (!configLoja || !configAgente) {
            return "Sistema em manutenção.";
        }

        const eSolo = profissionais.length === 1;

        // ✅ FUNÇÃO DE AGENDAMENTO COM COMPANY_ID CORRETO
        const tentarAgendar = async (args: any) => {
            // --- CONVERSÃO DE DATA (SOLUÇÃO DO ERRO) ---
            // Se vier DD/MM/YYYY, transforma em YYYY-MM-DD
            let dataFormatada = args.data;
            if (args.data.includes('/')) {
                const [dia, mes, ano] = args.data.split('/');
                dataFormatada = `${ano}-${mes}-${dia}`;
            }

            // --- BUSCAR PROFISSIONAL E SERVIÇO ---
            const prf = profissionais.find((p: any) =>
                p.nome.toLowerCase().includes(args.profissional.toLowerCase())
            );
            const srv = servicos.find((s: any) =>
                s.nome.toLowerCase().includes(args.servico.toLowerCase())
            );

            if (!prf) {
                return {
                    status: "erro",
                    mensagem: `Profissional ${args.profissional} não encontrado.`
                };
            }

            // ✅ VERIFICAR DISPONIBILIDADE COM COMPANY_ID
            const { data: ocupado } = await supabase
                .from('agendamentos')
                .select('id')
                .eq('profissional_id', prf.id)
                .eq('data_agendamento', dataFormatada)
                .eq('hora_agendamento', args.hora)
                .eq('company_id', companyId) // ✅ CRÍTICO: ADICIONAR COMPANY_ID
                .neq('status', 'cancelado') // Ignorar agendamentos cancelados
                .maybeSingle();

            if (ocupado) {
                return {
                    status: "ocupado",
                    profissional: prf.nome
                };
            }

            // --- VERIFICA SE CLIENTE EXISTE ---
            if (!cliente) {
                return {
                    status: "pedir_nome",
                    dados: { ...args, data: dataFormatada }
                };
            }

            // ✅ INSERIR AGENDAMENTO COM COMPANY_ID
            const { error } = await supabase
                .from('agendamentos')
                .insert([{
                    cliente_id: cliente.id,
                    profissional_id: prf.id,
                    servico_id: srv?.id || null,
                    data_agendamento: dataFormatada,
                    hora_agendamento: args.hora,
                    company_id: companyId, // ✅ CRÍTICO: ADICIONAR COMPANY_ID
                    origem: 'whatsapp',
                    status: 'confirmado' // Status padrão
                }]);

            if (error) {
                console.error("🔴 ERRO NO SUPABASE:", error.message);
                return {
                    status: "erro",
                    mensagem: error.message
                };
            }

            return {
                status: "sucesso",
                profissional: prf.nome,
                servico: srv?.nome || args.servico,
                data: dataFormatada,
                hora: args.hora
            };
        };

        // ✅ PREPARAR DADOS PARA IA COM COMPANY_ID E JID
        const dadosParaIA = {
            textoUsuario: texto,
            companyId: companyId, // ✅ NOVO: companyId para memória de chat
            jid: telefone, // ✅ NOVO: jid para memória de chat
            nomeAgente: configAgente.nome_agente,
            nomeLoja: configLoja.nome_estabelecimento,
            promptBase: configAgente.prompt,
            contextoCliente: cliente ? `Cliente: ${cliente.nome}` : `Novo`,
            servicos,
            profissionais,
            eSolo,
            tentarAgendar
        };

        return await gerarRespostaIA(dadosParaIA);

    } catch (error) {
        console.error("🔴 ERRO CRÍTICO:", error);
        return "Tive um erro interno. Pode repetir?";
    }
};

// ✅ FUNÇÃO AUXILIAR: CRIAR CLIENTE COM COMPANY_ID
export const criarCliente = async (
    nome: string,
    telefone: string,
    companyId: string,
    dataNascimento?: string
) => {
    const { data, error } = await supabase
        .from('clientes')
        .insert([{
            nome,
            telefone,
            company_id: companyId, // ✅ COMPANY_ID
            data_nascimento: dataNascimento || null,
            created_at: new Date()
        }])
        .select()
        .single();

    if (error) {
        console.error("❌ Erro ao criar cliente:", error.message);
        return null;
    }

    return data;
};

// ✅ FUNÇÃO AUXILIAR: BUSCAR HORÁRIOS DISPONÍVEIS
export const getHorariosDisponiveis = async (
    profissionalId: string,
    dataAgendamento: string,
    companyId: string
) => {
    try {
        const { data: config } = await supabase
            .from('configuracoes')
            .select('hora_abertura, hora_fechamento')
            .eq('company_id', companyId)
            .single();

        if (!config) {
            return [];
        }

        // Buscar horários ocupados
        const { data: ocupados } = await supabase
            .from('agendamentos')
            .select('hora_agendamento')
            .eq('profissional_id', profissionalId)
            .eq('data_agendamento', dataAgendamento)
            .eq('company_id', companyId) // ✅ COMPANY_ID
            .neq('status', 'cancelado');

        const horariosOcupados = ocupados?.map((a: any) => a.hora_agendamento) || [];

        // Gerar horários disponíveis (exemplo: 09:00 até 18:00, intervalo 30min)
        const horarios = [];
        const [horaAbertura, minAbertura] = (config.hora_abertura || '09:00').split(':');
        const [horaFechamento, minFechamento] = (config.hora_fechamento || '18:00').split(':');

        let hora = parseInt(horaAbertura);
        let min = parseInt(minAbertura);

        while (hora < parseInt(horaFechamento) || (hora === parseInt(horaFechamento) && min < parseInt(minFechamento))) {
            const horarioFormatado = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            if (!horariosOcupados.includes(horarioFormatado)) {
                horarios.push(horarioFormatado);
            }

            min += 30;
            if (min >= 60) {
                min = 0;
                hora += 1;
            }
        }

        return horarios;
    } catch (error) {
        console.error("❌ Erro ao buscar horários:", error);
        return [];
    }
};