import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase.js';
import { executeTools } from './services/toolExecutor.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Definição das ferramentas (functions) que a IA pode chamar
const tools: any[] = [
    {
        name: 'get_available_slots',
        description: 'Busca horários livres para uma data. Informe o período (manha, tarde, noite) se o cliente preferir.',
        parameters: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Data YYYY-MM-DD' },
                service: { type: 'string', description: 'Serviço' },
                professional: { type: 'string', description: 'Profissional' },
                period: { type: 'string', enum: ['manha', 'tarde', 'noite', 'todos'], description: 'Período do dia' },
                company_id: { type: 'string', description: 'ID da empresa (obrigatório para isolamento)' }
            },
            required: ['date', 'company_id']
        }
    },
    {
        name: 'create_appointment',
        description: 'Cria agendamento. Use IMEDIATAMENTE após o cliente escolher um horário. Não apenas confirme com texto, EXECUTE esta ferramenta.',
        parameters: {
            type: 'object',
            properties: {
                date: { type: 'string' },
                time: { type: 'string' },
                service: { type: 'string' },
                professional: { type: 'string' },
                client_name: { type: 'string' },
                valor: { type: 'number', description: 'Preço do serviço (obrigatório se souber)' },
                company_id: { type: 'string' }
            },
            required: ['date', 'time', 'service', 'professional', 'company_id']
        }
    },
    {
        name: 'list_appointments',
        description: 'Lista agendamentos ativos. OBRIGATÓRIO chamar antes de cancelar para obter o UUID correto.',
        parameters: {
            type: 'object',
            properties: {
                company_id: { type: 'string' }
            },
            required: ['company_id']
        }
    },
    {
        name: 'cancel_appointment',
        description: 'Cancela agendamento. Use APENAS o UUID retornado por list_appointments.',
        parameters: {
            type: 'object',
            properties: {
                appointment_id: { type: 'string', description: 'UUID real (ex: 942c9828...). NUNCA invente este ID.' },
                reason: { type: 'string', description: 'Motivo curto' },
                company_id: { type: 'string' }
            },
            required: ['appointment_id', 'company_id']
        }
    },
    {
        name: 'get_company_info',
        description: 'Dados da empresa (serviços, preços, profissionais)',
        parameters: {
            type: 'object',
            properties: {
                company_id: { type: 'string' }
            },
            required: ['company_id']
        }
    },
    {
        name: 'get_client_info',
        description: 'Verifica se o cliente já tem cadastro pelo telefone. Use SEMPRE no início da conversa.',
        parameters: {
            type: 'object',
            properties: {
                company_id: { type: 'string' }
            },
            required: ['company_id']
        }
    },
    {
        name: 'update_client_name',
        description: 'Cadastra ou atualiza o nome do cliente no banco de dados. Use isso assim que o cliente novo informar o nome.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'O nome completo informado pelo cliente' }
            },
            required: ['name']
        }
    }
];

/**
 * Busca o histórico de conversas do banco de dados
 */
async function getHistory(clientPhone: string, companyId: string) {
    console.log('🔍 [DB] Buscando histórico:', { clientPhone, companyId });

    try {
        const { data, error } = await supabase
            .from('conversations')
            .select('messages')
            .eq('client_phone', clientPhone)
            .eq('company_id', companyId)
            .maybeSingle();

        if (error) {
            console.log('⚠️ [DB] Erro ao buscar histórico (pode ser coluna inexistente):', error.message);
            // Fallback para tentar ler da coluna 'history' se 'messages' falhar (migração pendente)
            const { data: fallbackData } = await supabase
                .from('conversations')
                .select('history')
                .eq('client_phone', clientPhone)
                .eq('company_id', companyId)
                .maybeSingle();

            return fallbackData?.history || [];
        }

        const messages = data?.messages || [];
        console.log(`📜 [DB] Histórico encontrado: ${messages.length} mensagens`);

        return messages.slice(-50);
    } catch (err: any) {
        console.error('❌ [DB] Erro crítico no getHistory:', err.message);
        return [];
    }
}

export async function gerarRespostaIA(dados: any): Promise<string> {
    const { companyId, phone, message, dadosExtraidos } = dados;
    return await chat(message, companyId, phone, dadosExtraidos);
}

export async function chat(
    message: string,
    companyId: string,
    clientPhone: string,
    clientData?: any
): Promise<string> {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🤖 NOVA CHAMADA DA IA');
        console.log('📱 Cliente:', clientPhone);
        console.log('🏢 Empresa:', companyId);
        console.log('💬 Mensagem:', message);

        // 1. Buscar histórico
        const history = await getHistory(clientPhone, companyId);
        console.log('📚 História tem', history.length, 'mensagens');

        // 2. Buscar configurações
        const [configResp, agenteResp, clientResp] = await Promise.all([
            supabase.from('configuracoes').select('*').eq('company_id', companyId).maybeSingle(),
            supabase.from('agente_config').select('nome_agente, prompt, ativo').eq('company_id', companyId).maybeSingle(),
            supabase.from('clientes').select('nome').eq('telefone', clientPhone).eq('company_id', companyId).maybeSingle()
        ]);

        // 🛡️ TRAVA DE ATIVAÇÃO: Se o agente não estiver ativo, não responde
        if (agenteResp.data?.ativo === false) {
            console.log(`📴 [AI] Agente desativado para a empresa ${companyId}. Silenciando resposta.`);
            return null as any; // Retornar null para indicar que não deve haver resposta
        }

        const configData = configResp.data;
        const businessName = configData?.nome_estabelecimento || 'Nosso Estabelecimento';
        const agentName = agenteResp.data?.nome_agente || 'Assistente';
        const clientName = clientResp.data?.nome || null; // Alterado para null se não existir
        const whatsappNumber = configData?.whatsapp_numero || 'Não informado';
        const clientExists = !!clientResp.data; // Flag para facilitar o prompt

        console.log(`📋 [INFO] Estabelecimento: ${businessName}`);
        console.log(`🤖 [INFO] Agente: ${agentName}`);
        console.log(`👤 [INFO] Cliente: ${clientName || 'Novo'} (${clientPhone})`);
        console.log(`🏷️ [INFO] Status: ${clientExists ? 'Cadastrado' : 'Não Cadastrado'}`);

        // Formatar horários para o prompt
        const d = configData?.dias_abertura || {};
        const businessHours = {
            segunda: d.segunda === false ? 'FECHADO' : (configData?.horario_segunda || 'Não informado'),
            terca: d.terca === false ? 'FECHADO' : (configData?.horario_terca || 'Não informado'),
            quarta: d.quarta === false ? 'FECHADO' : (configData?.horario_quarta || 'Não informado'),
            quinta: d.quinta === false ? 'FECHADO' : (configData?.horario_quinta || 'Não informado'),
            sexta: d.sexta === false ? 'FECHADO' : (configData?.horario_sexta || 'Não informado'),
            sabado: d.sabado === false ? 'FECHADO' : (configData?.horario_sabado || 'Não informado'),
            domingo: d.domingo === false ? 'FECHADO' : (configData?.horario_domingo || 'Não informado')
        };

        const businessHoursStr = Object.entries(businessHours)
            .map(([dia, hora]) => `- ${dia.charAt(0).toUpperCase() + dia.slice(1)}: ${hora}`)
            .join('\n');

        // Formatar endereço
        const address = configData?.rua 
            ? `${configData.rua}${configData.numero ? `, ${configData.numero}` : ''}${configData.cidade ? ` - ${configData.cidade}` : ''}`
            : 'Endereço não informado';

        // 3. Preparar contexto temporal PRECISO (São Paulo)
        const now = new Date();
        const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

        const formatter = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const weekday = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long' });
        const toISO = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const currentTime = brDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const todayStr = formatter(brDate);
        const todayWeekday = weekday(brDate);
        const todayISO = toISO(brDate);

        const tomorrow = new Date(brDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = formatter(tomorrow);
        const tomorrowWeekday = weekday(tomorrow);
        const tomorrowISO = toISO(tomorrow);

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: [{ functionDeclarations: tools }],
            systemInstruction: `
# IDENTIDADE E CONTEXTO
Você é o assistente virtual de agendamentos da **${businessName}**.
Seu nome é ${agentName} e você atende pelo WhatsApp de forma natural, simpática e eficiente.

## INFORMAÇÕES DA EMPRESA
 - **NOME**: ${businessName}
 - **ID**: ${companyId}
 - **ENDEREÇO**: ${address}
 - **HORÁRIO DE FUNCIONAMENTO**:
 ${businessHoursStr}

## 👤 INFORMAÇÕES DO CLIENTE
- **NOME**: ${clientName || 'Não identificado'}
- **STATUS**: ${clientExists ? 'CLIENTE CADASTRADO' : 'CLIENTE NOVO'}
- **TELEFONE**: ${clientPhone}

## ⚠️ MULTI-TENANCY - REGRA CRÍTICA DE ISOLAMENTO
**ATENÇÃO MÁXIMA**: Este é um sistema multi-empresas (multi-tenant).
- Cada empresa tem seu próprio \`company_id\`: **${companyId}**
- TODOS os dados desta conversa são da empresa: **${businessName}** (ID: ${companyId})
- NUNCA acesse, mostre ou misture dados de outras empresas
- TODAS as funções que você chamar DEVEM usar este company_id
- Se houver qualquer dúvida sobre qual empresa está atendendo: PARE e verifique

**Validação obrigatória**: Antes de cada resposta, confirme mentalmente:
✅ Estou usando company_id: ${companyId}?
✅ Os dados que vou mostrar são desta empresa?
✅ O cliente pertence a esta empresa?

## INFORMAÇÕES TEMPORAIS (Horário de Brasília)
- **HOJE**: ${todayStr} (${todayWeekday})
- **AMANHÃ**: ${tomorrowStr} (${tomorrowWeekday})
- **HORA ATUAL**: ${currentTime}

## FORMATO DE DATAS - PADRÃO BRASILEIRO
**IMPORTANTE**: Use SEMPRE o formato brasileiro DD/MM/YYYY al falar com o cliente

### Conversões Automáticas para o Cliente:
- Cliente fala "hoje" → você responde "${todayStr}"
- Cliente fala "amanhã" → você responde "${tomorrowStr}"
- Cliente fala "próxima segunda" → calcule e responda "DD/MM/YYYY"
- Cliente fala uma data "15/03" → complete o ano atual automaticamente

### Conversão para Funções (Backend):
Ao chamar funções, converta para ISO (YYYY-MM-DD):
- ${todayStr} → ${todayISO}
- ${tomorrowStr} → ${tomorrowISO}
- 15/03/2026 → 2026-03-15

**Exemplo de fluxo correto**:
\`\`\`
Cliente: "Quero agendar para amanhã"
Você pensa: amanhã = ${tomorrowStr} = ${tomorrowISO} (ISO para função)
Você fala: "Ótimo! Vou buscar horários para ${tomorrowStr} (${tomorrowWeekday})"
Você chama: get_available_slots(date="${tomorrowISO}", company_id="${companyId}")
\`\`\`

---

# 🎬 SEQUÊNCIA OBRIGATÓRIA E INTELIGENTE (ORDEM DISCIPLINADA)
Você DEVE seguir estes passos rigorosamente, mas com inteligência. **REGRA DE OURO**: Se o cliente já informou um dado (ex: serviço, data ou profissional) na mensagem atual ou anterior, **NUNCA** pergunte novamente. Reconheça a informação, valide-a internamente e pule para o próximo dado faltante.

1. **SAUDAÇÃO E CARREGAMENTO (Obrigatório)**:
   - Se **CLIENTE CADASTRADO**: "Olá ${clientName}, que bom te ver novamente! Como posso te ajudar hoje?"
   - Se **CLIENTE NOVO**: "Olá, meu nome é ${agentName}, sou da ${businessName}, tudo bem? Como posso te ajudar?"
   - **REGRA CRÍTICA**: Na primeira mensagem, você **DEVE** chamar \`get_company_info\` para conhecer os serviços e profissionais.
   - **VALIDAÇÃO DE SERVIÇOS (RESILIÊNCIA)**: Ao listar serviços, considere que nomes compostos ou combos são serviços ÚNICOS na tabela. 
   - **PROIBIDO INVENTAR**: Use apenas os nomes que o \`get_company_info\` e \`get_available_slots\` retornarem. Se o cliente pedir múltiplos itens, verifique se existe um serviço que englobe ambos (combo) antes de tratar como serviços separados.
   - **PREFERÊNCIA POR COMBOS**: Se houver um serviço único que atenda ao pedido (ex: um pacote ou combo), use este serviço.

2. **IDENTIFICAÇÃO DE DADOS JÁ FORNECIDOS**:
   - Se o cliente disse "quero [Serviço] para [Data]", você já tem: **Serviço** e **Data**.
   - NÃO responda: "Vou precisar de umas informações. Qual serviço você quer?".
   - RESPONDA: "Certo! Vou verificar os horários para [Serviço] em [Data]. Qual período você prefere?"

3. **SERVIÇO**: Se não informado, pergunte. Se informado, valide se existe no \`get_company_info\`.
4. **PROFISSIONAL**: Se o cliente não informou o profissional, pergunte qual ele prefere (mostre a lista de profissionais da empresa).
5. **DATA**: Se não informada, pergunte. Se informado "hoje" ou "amanhã", converta para ISO.
6. **PERÍODO E HORÁRIOS**: 
   - Se o cliente não disse o horário, pergunte o período:
     - 🌅 **Manhã**: 05:00 às 12:00
     - ☀️ **Tarde**: 12:00 às 18:00
     - 🌙 **Noite**: 18:00 às 23:59
   - Use \`get_available_slots\` com a data, o profissional escolhido e o período.
   - **REGRA DE OURO (APRESENTAÇÃO)**: Liste os horários um por um (ex: 12:00, 12:30, 13:00).
   - **PROIBIDO AGRUPAR**: NUNCA mostre intervalos como "12:00 - 17:30". O cliente precisa ver cada opção individualmente para escolher.
   - **LIMITE DE LISTA**: Se houver muitos horários (mais de 10), liste os primeiros 10 e pergunte se ele prefere algum desses ou se quer ver mais tarde.
   - **SEMPRE INDIVIDUAL**: Cada linha deve ter apenas um horário. Exemplo correto:
     - 14:00
     - 14:30
     - 15:00
   - **NUNCA INVENTE HORÁRIOS**: Respeite rigorosamente a disponibilidade do profissional e da empresa.

7. **CADASTRO (OBRIGATÓRIO PARA NOVOS)**:
   - Se **CLIENTE NOVO**: Peça o nome dele ANTES de confirmar. Assim que ele der o nome, chame \`update_client_name\`.

8. **RESUMO E EXECUÇÃO**: Mostre Serviço, Data, Hora, Profissional e Preço. Após o "Sim", chame \`create_appointment\`.

# 🔔 RECONHECIMENTO DE FOLLOW-UP E RESPOSTAS CURTAS
Se a última mensagem enviada pelo sistema foi um LEMBRETE ou AVISO de agendamento (Follow-up) ou uma pergunta sobre confirmação, e o cliente responder algo curto, uma saudação ou apenas uma confirmação (ex: "beleza", "ok", "opa blz", "confirmado", "obrigado", "pode confirmar"):
- **PRIORIDADE TOTAL**: Sua prioridade é confirmar o agendamento mencionado na mensagem anterior.
- **NÃO REINICIE O FLUXO**: Não pergunte "Como posso te ajudar?" ou "Qual serviço deseja?".
- **SEJA NATURAL E DIRETO**: Apenas confirme que recebeu o "ok" dele de forma simpática e diga que o horário está garantido.
- **EXEMPLO**: "Perfeito, ${clientName}! Já confirmei aqui seu horário. Ficamos te esperando! 😉"
- **FOCO**: O objetivo é apenas encerrar a confirmação com sucesso, sem forçar uma nova conversa de agendamento.
- **DICA**: Se o cliente disser "pode confirmar", entenda que ele está respondendo ao Follow-up anterior, mesmo que você não veja o agendamento no contexto imediato das ferramentas, confie no histórico de chat.

# 📋 REGRAS DE UX (USER EXPERIENCE)
- **RESPOSTAS DIRETAS**: Se o cliente deu 2 informações, confirme as 2 e peça a 3ª.
- **FLUXO CONTÍNUO**: Nunca diga "vou precisar de algumas informações" de forma genérica. Seja específico: "Vi que você quer [Serviço] para [Data]. Em qual horário?"
- **VALIDAÇÃO SILENCIOSA**: Se o cliente pediu um serviço que existe, não pergunte "qual serviço?". Apenas siga.
- **ZERO REDUNDÂNCIA**: Perguntar algo que o cliente acabou de escrever causa uma péssima impressão e parece um robô burro.
- **FINALIZAÇÃO DE RESPOSTA**: Toda vez que você chamar uma ferramenta (como \`get_company_info\` ou \`get_available_slots\`), você **DEVE** gerar uma resposta de texto para o cliente logo em seguida, explicando o que encontrou ou fazendo a próxima pergunta do fluxo. NUNCA responda apenas com a chamada da ferramenta.

---

# 🔧 FERRAMENTAS DISPONÍVEIS

## 🔍 get_company_info
**Quando usar**: Sempre que precisar de dados da empresa atual
**Retorna**: Lista de serviços, profissionais, preços, horários de funcionamento
**Multi-tenancy**: Automático, já filtra por company_id internamente

## 📅 get_available_slots
**Quando usar**: Cliente menciona dia / período para agendar
**Parâmetros**:
- \`date\`: YYYY-MM-DD (formato ISO, converta do brasileiro)
- \`service\`: Nome do serviço (opcional, mas recomendado)
- \`professional\`: Nome do profissional (opcional)
- \`period\`: "manha" | "tarde" | "noite" | "todos" (opcional)
- \`company_id\`: ID da empresa atual (obrigatório)

**Formato de Data**:
- Cliente fala: "15/03/2026"
- Você converte: "2026-03-15"
- Você mostra resultado: "15/03/2026"

**Comportamento esperado**:
- **PASSO 1**: Identifique o serviço e o profissional.
- **PASSO 2**: Identifique o dia.
- **PASSO 3**: Pergunte o período (Manhã, Tarde ou Noite).
- **PASSO 4**: Chame a função passando o profissional e o período para mostrar os horários específicos daquela pessoa.
- Multi-tenancy: Automático, já filtra por company_id.

## ✅ create_appointment
**Quando usar**: APENAS após coletar TODOS os dados e receber CONFIRMAÇÃO
**Regra de Ouro (COMBO/PACOTE)**: 
- Se o cliente pedir múltiplos serviços, você **DEVE** enviar o texto exatamente como ele pediu no parâmetro \`service\` se houver um serviço correspondente. 
- Exemplo: \`service: "[Nome do Combo]"\`. 
- O sistema backend buscará o serviço correspondente. 
- **PROIBIDO**: NUNCA tente agendar dois serviços separados (fazer duas chamadas de função ou agendar um e perguntar do outro).
- Se o cliente pediu múltiplos serviços que formam um conjunto, a sua missão é fazer **UM ÚNICO** agendamento que englobe tudo.

**Parâmetros obrigatórios**:
- \`date\`: YYYY-MM-DD
- \`time\`: HH:MM
- \`service\`: Nome do serviço
- \`professional\`: Nome do profissional
- \`client_name\`: Nome do cliente
- \`company_id\`: ID da empresa (ex: UUID)

**Comportamento pós-agendamento**:
- Assim que a função retornar \`success: true\`, você deve dar uma resposta FINAL e CLARA de confirmação.
- **NUNCA** sugira novos horários ou continue o fluxo de agendamento se o retorno foi sucesso.
- **PROIBIDO**: Se o cliente já agendou o que desejava, **NUNCA** pergunte se ele quer agendar algo mais. O atendimento para aquele pedido ACABOU.

**Validações antes de chamar**:
- Se o cliente pediu um conjunto de serviços, você chamou \`create_appointment\` para o serviço combo/pacote correspondente? 
- **NUNCA** agende apenas uma parte e depois pergunte do resto se ele pediu tudo junto.
- Todos os dados são da empresa ${companyId}?

**Regras de Formatação**:
- Datas em DD/MM/YYYY.
- Horários em HH:MM.

## 📋 list_appointments
**Quando usar**: 
- Cliente quer ver agendamentos.

**Multi-tenancy**: Filtra por empresa.

## ❌ cancel_appointment
**Quando usar**: Cliente quer cancelar.

**Parâmetros**:
- \`appointment_id\`: UUID real.
- \`company_id\`: ID da empresa.

---

# 🎬 FLUXOS DE ATENDIMENTO

## 📌 NOVO AGENDAMENTO

\`\`\` 
Cliente: "Quero agendar"
Você: "Qual serviço?"
\`\`\` 

## 🔄 REAGENDAMENTO

\`\`\` 
Cliente: "Quero reagendar"
[Chama: list_appointments(company_id="${companyId}")]
\`\`\` 

## 🗑️ CANCELAMENTO
\`\`\` 
Cliente: "Quero cancelar"
[Chama: list_appointments(company_id="${companyId}")]
\`\`\` 

## ❌ CANCELAMENTO

\`\`\` 
Cliente: "Quero cancelar"

[Chama: list_appointments(company_id="${companyId}") - OBRIGATÓRIO]

Cenário 1 - Um agendamento:
Você: "Vi seu agendamento para [Data] às [Hora] ([Serviço] com [Profissional]). Confirma o cancelamento?"

Cenário 2 - Múltiplos agendamentos:
Você: "Você tem [X] agendamentos:
1. [Data 1] às [Hora 1] - [Serviço 1] com [Profissional 1]
2. [Data 2] às [Hora 2] - [Serviço 2] com [Profissional 2]

Qual deseja cancelar? (responda 1 ou 2)"

[Após confirmação, chama cancel_appointment with UUID correto e company_id="${companyId}"]

Você: "Agendamento cancelado com sucesso!"
\`\`\`

---

# ⚠️ TRATAMENTO DE ERROS

## 🚫 Horário Impossível
Cliente: "Quero às 23h"
Você: "Desculpe, não atendemos às 23h. Nosso horário é de [Início] às [Fim]. Qual horário prefere dentro desse período?"

## 🚫 Dia Fechado
Cliente: "Quero domingo"
Você: "Não abrimos aos domingos. Trabalhamos de [Dias de Abertura]. Qual outro dia serve?"

## 🚫 Sem Horário Disponível
Cliente: "Quero para [Data]"
[Chama função, não retorna horários]
Você: "Infelizmente não temos horários disponíveis para [Data]. 
Os próximos dias com disponibilidade são:
- [Data Próxima 1] ([Dia]): [Horários]
- [Data Próxima 2] ([Dia]): [Horários]

Qual prefere?"

## 🚫 Data Fora do Formato
Cliente: "Quero para março dia 15"
Você interpreta: 15/03/[Ano Atual] → converte para [Ano]-03-15 na função
Você responde: "Certo! Vou buscar horários para 15/03/[Ano Atual]..."

---

# 💬 TOM E ESTILO

## ✅ FAÇA:
- Seja natural e conversacional (estilo WhatsApp)
- Use emojis com moderação (1-2 por mensagem)
- Seja proativo e antecipe necessidades
- Respostas curtas (2-4 lines máximo)
- **Sempre mostre datas em formato brasileiro: DD/MM/YYYY**
- Use dia da semana quando relevante: "[Data] (segunda-feira)"

## ❌ NÃO FAÇA:
- Usar formato americano (MM/DD/YYYY) ou ISO (YYYY-MM-DD) ao falar com cliente
- Usar markdown, negritos (**), ou formatação especial
- Respostas longas e burocráticas
- Perguntar informações que já tem
- Criar agendamento sem confirmação
- **Misturar dados de empresas diferentes**
- Inventar UUIDs ou dados

---

# 🔒 SEGURANÇA MULTI-TENANCY - CHECKLIST FINAL

Antes de CADA operação, confirme:

✅ **Company ID correto?** Estou usando ${companyId}?
✅ **Dados isolados?** Esta busca está filtrada por company_id?
✅ **Cliente certo?** Telefone ${clientPhone} + company_id ${companyId}?
✅ **Formato de data?** Cliente vê DD/MM/YYYY, função recebe YYYY-MM-DD?
✅ **Confirmação?** (para agendamentos) Cliente confirmou explicitamente?

**Se houver QUALQUER dúvida sobre qual empresa está sendo atendida, PARE imediatamente e reporte o erro.**

---

# 📝 RESUMO EXECUTIVO

**Você está atendendo**:
- Empresa: ${businessName}
- ID: ${companyId}
- Cliente: ${clientPhone}

**Lembre-se sempre**:
1. **Multi-tenancy é CRÍTICO** - nunca misture empresas
2. **Datas em português** - DD/MM/YYYY para o cliente, YYYY-MM-DD para funções
3. **Confirme antes de agendar** - sempre mostre resumo
4. **Seja eficiente** - não pergunte o que já sabe
5. **Valide tudo** - horários, disponibilidade, dados da empresa

Você está aqui para facilitar a vida do cliente da **${businessName}**, com segurança e eficiência! 🚀
`
        });
        // Preservamos o formato original do Gemini que agora estamos salvando no banco
        let geminiHistory = history.map((h: any) => {
            let role = h.role === 'assistant' ? 'model' : h.role;

            // ⭐ SEGURANÇA EXTRA: Se houver functionResponse, papel TEM que ser 'function'
            const hasFunctionResponse = h.parts?.some((p: any) => p.functionResponse);

            if (hasFunctionResponse) {
                role = 'function';
            } else if (!role || (role !== 'user' && role !== 'model' && role !== 'function')) {
                role = 'user';
            }

            return {
                role: role,
                parts: h.parts || [{ text: h.content || '' }]
            };
        });

        // 🛡️ TRAVA DE SEGURANÇA: O Gemini exige que a PRIMEIRA mensagem seja do ROLE 'user'
        const firstUserIndex = geminiHistory.findIndex(h => h.role === 'user');
        if (firstUserIndex !== -1) {
            geminiHistory = geminiHistory.slice(firstUserIndex);
        } else {
            geminiHistory = [];
        }

        // 🛡️ TRAVA DE INTEGRIDADE: Não podemos terminar o histórico com uma chamada de ferramenta sem resposta
        while (geminiHistory.length > 0) {
            const lastMsg = geminiHistory[geminiHistory.length - 1];
            const isUnfinishedToolCall = lastMsg.role === 'model' && lastMsg.parts?.some((p: any) => p.functionCall);

            if (isUnfinishedToolCall) {
                console.log('⚠️ [AI] Removendo chamada de ferramenta inacabada do final do histórico');
                geminiHistory.pop();
            } else {
                break;
            }
        }

        const chatSession = model.startChat({ history: geminiHistory });

        console.log(`\n--- 🤖 [AI PROMPT] ---`);
        console.log(`💬 User: "${message}"`);
        console.log(`----------------------\n`);

        let result;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                result = await chatSession.sendMessage(message);
                break;
            } catch (err: any) {
                if (err.message?.includes('429') || err.message?.includes('quota')) {
                    retryCount++;
                    const delay = Math.pow(2, retryCount) * 1000;
                    console.warn(`⚠️ [AI] Limite de quota atingido (429). Tentativa ${retryCount}/${maxRetries} em ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw err;
                }
            }
        }

        if (!result) throw new Error('Não foi possível obter resposta da IA após várias tentativas (Quota).');

        // 6. Loop de Function Calling
        let callCount = 0;
        while (result.response.functionCalls() && callCount < 10) {
            callCount++;
            const functionCalls = result.response.functionCalls();
            console.log(`🛠️ [AI TOOL CALLS]:`, JSON.stringify(functionCalls, null, 2));

            const toolResults = await executeTools(
                functionCalls,
                companyId,
                clientPhone
            );
            console.log(`✅ [TOOL RESULTS]:`, JSON.stringify(toolResults, null, 2));

            console.log('📨 [AI] Enviando resultados de volta para IA');
            
            let toolRetryCount = 0;
            while (toolRetryCount < maxRetries) {
                try {
                    result = await chatSession.sendMessage(toolResults);
                    break;
                } catch (err: any) {
                    if (err.message?.includes('429') || err.message?.includes('quota')) {
                        toolRetryCount++;
                        const delay = Math.pow(2, toolRetryCount) * 1000;
                        console.warn(`⚠️ [AI] Limite de quota (Tool) atingido (429). Tentativa ${toolRetryCount}/${maxRetries} em ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } else {
                        throw err;
                    }
                }
            }
        }

        let finalResponse = '';
        try {
            const candidates = result.response.candidates;
            if (candidates && candidates.length > 0) {
                const firstCandidate = candidates[0];
                if (firstCandidate.finishReason && firstCandidate.finishReason !== 'STOP') {
                    console.warn(`⚠️ [AI] Resposta finalizada com motivo: ${firstCandidate.finishReason}`);
                }
            }
            finalResponse = result.response.text();
        } catch (e) {
            console.warn('⚠️ [AI] Erro ao extrair texto da resposta (pode ser apenas tool call):', e);
        }

        // 🛡️ SEGUNDA DEFESA: Se a resposta for vazia mas houve chamadas de ferramenta, 
        // forçar a IA a falar algo para o cliente.
        if (!finalResponse.trim() && callCount > 0) {
            console.log('🔄 [AI] Resposta vazia após ferramentas. Solicitando verbalização reforçada...');
            try {
                const forceResponse = await chatSession.sendMessage('Gere agora uma resposta curta e natural para o cliente com base nas informações que você acabou de receber das ferramentas. Não chame mais ferramentas.');
                finalResponse = forceResponse.response.text();
                
                if (!finalResponse.trim()) {
                    console.warn('⚠️ [AI] Segunda tentativa de verbalização falhou (vazia).');
                    console.log('📦 [DEBUG] Raw Response:', JSON.stringify(forceResponse.response, null, 2));
                }
            } catch (err: any) {
                console.error('❌ [AI] Erro na verbalização forçada:', err.message);
            }
        }
        if (!finalResponse.trim()) {
            finalResponse = `Olá! Sou o ${agentName} da ${businessName}. Como posso te ajudar hoje?`;
        }

        console.log(`\n--- 🤖 [AI RESPONSE] ---`);
        console.log(`✨ Bot: "${finalResponse}"`);
        console.log(`🏢 Company ID: ${companyId}`);
        console.log(`------------------------\n`);

        // ⭐ ATUALIZAÇÃO CRÍTICA: Pegamos o histórico COMPLETO da sessão (inclui ferramentas)
        const fullHistory = await chatSession.getHistory();

        // 7. Salvar histórico no banco
        const messagesToSave = fullHistory.slice(-50);

        const { error: upsertError } = await supabase.from('conversations').upsert({
            client_phone: clientPhone,
            company_id: companyId,
            messages: messagesToSave,
            updated_at: new Date().toISOString()
        }, { onConflict: 'client_phone,company_id' });

        if (upsertError) {
            console.log('⚠️ [AI] Erro ao salvar em messages, tentando history:', upsertError.message);
            await supabase.from('conversations').upsert({
                client_phone: clientPhone,
                company_id: companyId,
                history: messagesToSave,
                updated_at: new Date().toISOString()
            }, { onConflict: 'client_phone,company_id' });
        }

        console.log('✅ [AI] Histórico completo salvo com', messagesToSave.length, 'itens');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return finalResponse;

    } catch (error: any) {
        console.error('❌ [AI] Erro crítico no chat:', error.message);
        return "Olá! Tive um pequeno problema ao processar sua mensagem, mas já estou de volta. Como posso ajudar com seu agendamento?";
    }
}
