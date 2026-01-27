import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const db = {
    // Busca cliente pelo telefone (Tabela clientes)
    async getCliente(telefone: string) {
        console.log(`🔎 [DEDO DURO] Buscando na tabela 'clientes' o telefone: ${telefone}`);
        const { data, error } = await supabase
            .from('clientes') // CORRIGIDO: minúsculo
            .select('*')
            .eq('telefone', telefone)
            .maybeSingle();
        
        if (error) console.error("❌ [DEDO DURO] Erro em 'clientes':", error.message);
        return data;
    },

    // Busca profissionais (Tabela profissionais)
    async getProfissionais() {
        console.log("🛠️ [DEDO DURO] Tentando ler tabela 'profissionais'...");
        
        const { data, error, status, statusText } = await supabase
            .from('profissionais') // CORRIGIDO: minúsculo
            .select('*');

        if (error) {
            console.error("❌ [DEDO DURO] Erro na Tabela 'profissionais':", {
                mensagem: error.message,
                status: status,
                statusText: statusText
            });
            return [];
        }

        if (!data || data.length === 0) {
            console.warn("⚠️ [DEDO DURO] Tabela 'profissionais' retornou VAZIA []. Verifique no site do Supabase se há linhas nela.");
        } else {
            console.log(`✅ [DEDO DURO] Sucesso! Encontrados ${data.length} profissionais.`);
        }

        return data || [];
    },

    // Busca serviços (Tabela servicos)
    async getServicos() {
        console.log("🛠️ [DEDO DURO] Tentando ler tabela 'servicos'...");
        const { data, error } = await supabase
            .from('servicos') // CORRIGIDO: minúsculo
            .select('*');

        if (error) {
            console.error("❌ [DEDO DURO] Erro na Tabela 'servicos':", error.message);
            return [];
        }

        if (!data || data.length === 0) {
            console.warn("⚠️ [DEDO DURO] Tabela 'servicos' retornou VAZIA [].");
        }

        return data || [];
    },

    // Verifica disponibilidade (Tabela configuracoes)
    async getAvailability(profissionalId: string, dataBusca: string) {
        const dataFormatada = dataBusca.trim();
        console.log(`📅 [DEDO DURO] Checando agenda para ID: ${profissionalId} em ${dataFormatada}`);

        const { data: config, error: errConfig } = await supabase
            .from('configuracoes') // CORRIGIDO: minúsculo
            .select('*')
            .single();

        if (errConfig || !config) {
            console.error("❌ [DEDO DURO] Erro em 'configuracoes':", errConfig?.message);
            return ["Erro ao carregar horários."];
        }

        const diasSemana = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
        const dataObjeto = new Date(dataFormatada + 'T12:00:00');
        const diaNome = diasSemana[dataObjeto.getDay()];
        
        const diasAbertura = typeof config.dias_abertura === 'string' 
            ? JSON.parse(config.dias_abertura) 
            : config.dias_abertura;

        if (!diasAbertura[diaNome]) return ["A barbearia não abre neste dia."];

        const { data: ocupados } = await supabase
            .from('agendamentos') // Já estava minúsculo
            .select('hora_agendamento')
            .eq('profissional_id', profissionalId)
            .eq('data_agendamento', dataFormatada)
            .neq('status', 'cancelado');

        const horasOcupadas = ocupados?.map(o => o.hora_agendamento.substring(0, 5)) || [];

        const horariosLivres: string[] = [];
        let [horaAtual, minAtual] = config.horario_inicio.split(':').map(Number);
        const [horaFim, minFim] = config.horario_fim.split(':').map(Number);

        while (horaAtual < horaFim || (horaAtual === horaFim && minAtual < minFim)) {
            const hFormatada = `${String(horaAtual).padStart(2, '0')}:${String(minAtual).padStart(2, '0')}`;
            if (!horasOcupadas.includes(hFormatada)) horariosLivres.push(hFormatada);
            minAtual += 30;
            if (minAtual >= 60) { minAtual = 0; horaAtual++; }
        }

        return horariosLivres;
    },

    async cadastrarCliente(nome: string, telefone: string) {
        const { data, error } = await supabase
            .from('clientes') // CORRIGIDO: minúsculo
            .insert([{ nome, telefone }])
            .select()
            .single();
        
        if (error) console.error("❌ Erro ao cadastrar cliente:", error.message);
        return data;
    },

    async criarAgendamento(dados: any) {
        const { data, error } = await supabase
            .from('agendamentos')
            .insert([{ ...dados, status: 'pendente', created_at: new Date().toISOString() }])
            .select();
        
        if (error) throw error;
        return data;
    }
};