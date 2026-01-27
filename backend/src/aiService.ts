import axios from 'axios';
import { db, supabase } from "./supabase.js";
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || "";
const MODELO = "models/gemini-2.0-flash-lite"; 
const URL = `https://generativelanguage.googleapis.com/v1beta/${MODELO}:generateContent?key=${API_KEY}`;

const LINK_BOOKING = "https://aclaudiney-agendezap.vercel.app/agendar";

const chatsMemoria: Record<string, any[]> = {};
const agendamentoPendente: Record<string, any> = {};
const clienteBemVindo: Record<string, boolean> = {}; // Rastreia se já mandou boas-vindas
const cumprimentoDodia: Record<string, string> = {}; // Rastreia data do último cumprimento

const formatarDataHumanizada = (data: string) => {
  const hoje = new Date().toISOString().split('T')[0];
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];
  if (data === hoje) return "hoje";
  if (data === amanhaStr) return "amanhã";
  const partes = data.split('-');
  return `${partes[2]}/${partes[1]}`;
};

const converterDataTexto = (textoData: string): string => {
  const hoje = new Date().toISOString().split('T')[0];
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];

  const texto = textoData.toLowerCase().trim();
  if (texto.includes('amanhã') || texto.includes('amanha')) return amanhaStr;
  if (texto.includes('hoje')) return hoje;
  
  return texto;
};

const converterHoraTexto = (textoHora: string): string => {
  const texto = textoHora.toLowerCase().trim();
  
  if (/^\d{2}:\d{2}$/.test(texto)) return texto;
  
  const match = texto.match(/(\d{1,2})\s*(?:h|horas?|hora)/);
  if (match) {
    return `${match[1].padStart(2, '0')}:00`;
  }
  
  return texto;
};

const filtrarHorariosValidos = (horarios: string[], data: string): string[] => {
  const hoje = new Date().toISOString().split('T')[0];
  
  if (data !== hoje) {
    return horarios;
  }

  const agora = new Date();
  const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  
  return horarios.filter(h => h >= horaAtual);
};

// 🕐 Determinar cumprimento baseado na hora
const obterCumprimento = () => {
  const agora = new Date();
  const hora = agora.getHours();
  
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
};

// ✅ Verificar se já cumpriu hoje
const jaCumprimouHoje = (telefone: string): boolean => {
  const hoje = new Date().toISOString().split('T')[0];
  return cumprimentoDodia[telefone] === hoje;
};

// 🤖 Puxar dados do agente
const obterConfigAgente = async () => {
  try {
    const { data, error } = await supabase
      .from('agente_config')
      .select('nome_agente, prompt')
      .eq('ativo', true)
      .single();

    if (error || !data) {
      return { nome: 'Maia', prompt: 'Você é legal' };
    }

    return { nome: data.nome_agente, prompt: data.prompt };
  } catch (error) {
    console.error('Erro ao puxar config do agente:', error);
    return { nome: 'Maia', prompt: 'Você é legal' };
  }
};

// 🏪 Puxar configurações da loja (horários)
const obterConfigLoja = async () => {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('horario_segunda, horario_terca, horario_quarta, horario_quinta, horario_sexta, horario_sabado, horario_domingo, dias_abertura, nome_estabelecimento, telefone_estabelecimento')
      .single();

    if (error || !data) {
      return {
        horarios: {
          segunda: '08:00-18:00',
          terca: '08:00-18:00',
          quarta: '08:00-18:00',
          quinta: '08:00-18:00',
          sexta: '08:00-18:00',
          sabado: '08:00-18:00',
          domingo: '08:00-18:00',
        },
        diasAbertos: {
          segunda: true,
          terca: true,
          quarta: true,
          quinta: true,
          sexta: true,
          sabado: false,
          domingo: false,
        },
        nome: 'Barbearia',
        telefone: ''
      };
    }

    const diasAbertos = data.dias_abertura || {
      segunda: true,
      terca: true,
      quarta: true,
      quinta: true,
      sexta: true,
      sabado: false,
      domingo: false,
    };

    return {
      horarios: {
        segunda: data.horario_segunda || '08:00-18:00',
        terca: data.horario_terca || '08:00-18:00',
        quarta: data.horario_quarta || '08:00-18:00',
        quinta: data.horario_quinta || '08:00-18:00',
        sexta: data.horario_sexta || '08:00-18:00',
        sabado: data.horario_sabado || '08:00-18:00',
        domingo: data.horario_domingo || '08:00-18:00',
      },
      diasAbertos: diasAbertos,
      nome: data.nome_estabelecimento || 'Barbearia',
      telefone: data.telefone_estabelecimento || ''
    };
  } catch (error) {
    console.error('Erro ao puxar config da loja:', error);
    return {
      horarios: {
        segunda: '08:00-18:00',
        terca: '08:00-18:00',
        quarta: '08:00-18:00',
        quinta: '08:00-18:00',
        sexta: '08:00-18:00',
        sabado: '08:00-18:00',
        domingo: '08:00-18:00',
      },
      diasAbertos: {
        segunda: true,
        terca: true,
        quarta: true,
        quinta: true,
        sexta: true,
        sabado: false,
        domingo: false,
      },
      nome: 'Barbearia',
      telefone: ''
    };
  }
};

const tools = [
  {
    function_declarations: [
      {
        name: "agendar",
        description: "Agenda um atendimento quando o cliente informou serviço, data, hora e profissional",
        parameters: {
          type: "OBJECT",
          properties: {
            servico: { type: "STRING", description: "Nome do serviço (ex: corte, barba, depilção)" },
            data: { type: "STRING", description: "Data (ex: amanhã, hoje, ou AAAA-MM-DD)" },
            hora: { type: "STRING", description: "Hora (ex: 9h, 14:00)" },
            profissional: { type: "STRING", description: "Nome do profissional" }
          },
          required: ["servico", "data", "hora", "profissional"]
        }
      },
      {
        name: "responder",
        description: "Responde algo quando não tem dados suficientes para agendar ou quando perguntam preço",
        parameters: {
          type: "OBJECT",
          properties: {
            mensagem: { type: "STRING", description: "A resposta para o cliente" }
          },
          required: ["mensagem"]
        }
      }
    ]
  }
];

export const processarMensagemIA = async (texto: string, telefone: string) => {
  try {
    const profissionais = await db.getProfissionais();
    const servicos = await db.getServicos();
    let cliente = await db.getCliente(telefone);
    const configAgente = await obterConfigAgente();
    const configLoja = await obterConfigLoja();

    if (!chatsMemoria[telefone]) chatsMemoria[telefone] = [];

    const nomesProfissionais = profissionais?.map(p => p.nome).join(', ') || "";
    const nomeServicos = servicos?.map(s => s.nome).join(', ') || "";

    // 💰 Criar lista de preços com formatação correta
    const listaPrecos = servicos?.map(s => `${s.nome}: R$ ${parseFloat(s.preco).toFixed(2)}`).join('\n') || "";

    // 📋 Criar lista de horários por dia (respeitando dias abertos/fechados)
    const horariosFormatado = `
SEGUNDA: ${configLoja.diasAbertos.segunda ? configLoja.horarios.segunda : 'FECHADO'}
TERÇA: ${configLoja.diasAbertos.terca ? configLoja.horarios.terca : 'FECHADO'}
QUARTA: ${configLoja.diasAbertos.quarta ? configLoja.horarios.quarta : 'FECHADO'}
QUINTA: ${configLoja.diasAbertos.quinta ? configLoja.horarios.quinta : 'FECHADO'}
SEXTA: ${configLoja.diasAbertos.sexta ? configLoja.horarios.sexta : 'FECHADO'}
SÁBADO: ${configLoja.diasAbertos.sabado ? configLoja.horarios.sabado : 'FECHADO'}
DOMINGO: ${configLoja.diasAbertos.domingo ? configLoja.horarios.domingo : 'FECHADO'}`;

    // 👋 Se é primeira mensagem E não é pergunta sobre horários/preços, enviar boas-vindas
    const perguntaLower = texto.toLowerCase();
    
    const ehPerguntaHorario = 
      perguntaLower.includes('horario') || 
      perguntaLower.includes('funciona') ||
      perguntaLower.includes('abre') ||
      perguntaLower.includes('fecha');
      
    const ehPerguntaPreco = 
      perguntaLower.includes('prec') ||
      perguntaLower.includes('quanto custa') ||
      perguntaLower.includes('valor') ||
      perguntaLower.includes('custa');

    const ehPerguntaEspecifica = ehPerguntaHorario || ehPerguntaPreco ||
      perguntaLower.includes('agendar') || 
      perguntaLower.includes('marcar') ||
      perguntaLower.includes('serviço') ||
      perguntaLower.includes('profissional') ||
      perguntaLower.includes('quem você');

    if (!clienteBemVindo[telefone] && !ehPerguntaEspecifica) {
      clienteBemVindo[telefone] = true;
      const mensagemBoasVindas = `Oi! 👋 Meu nome é ${configAgente.nome}. Tudo bem? 

Deseja agendar algum tipo de serviço? Caso queira, você pode:
✅ Agendar comigo por aqui no WhatsApp
📱 Ou clicar no link abaixo para agendar pelo celular:
${LINK_BOOKING}

Como posso ajudar? 😊`;

      chatsMemoria[telefone].push({ role: "user", parts: [{ text: texto }] });
      return mensagemBoasVindas;
    }

    // Se é primeira mensagem COM pergunta específica, marca como visitado e continua normalmente
    if (!clienteBemVindo[telefone] && ehPerguntaEspecifica) {
      clienteBemVindo[telefone] = true;
    }

    // 🔍 Se tem agendamento pendente (aguardando nome)
    if (agendamentoPendente[telefone]) {
      const pendente = agendamentoPendente[telefone];
      const nomeCliente = texto.trim();

      console.log(`\n📝 Cadastrando novo cliente: ${nomeCliente}`);
      const novoCliente = await db.cadastrarCliente(nomeCliente, telefone);
      cliente = novoCliente;

      try {
        console.log(`\n✅ AGENDANDO (após cadastro): ${pendente.servico} | ${pendente.profissional} | ${pendente.data} ${pendente.hora}`);

        await db.criarAgendamento({
          cliente_id: cliente.id,
          profissional_id: pendente.profissional_id,
          servico_id: pendente.servico_id,
          data_agendamento: pendente.data,
          hora_agendamento: pendente.hora,
          status: 'pendente',
          origem: 'whatsapp_bot'
        });

        console.log(`✅ AGENDAMENTO SALVO!`);

        delete chatsMemoria[telefone];
        delete agendamentoPendente[telefone];

        return `✅ Perfeito, ${nomeCliente}! Seu agendamento foi confirmado!\n\n📋 ${pendente.servico_nome} com ${pendente.profissional_nome}\n📅 ${formatarDataHumanizada(pendente.data)} às ${pendente.hora}\n\nAté lá! 😊`;
      } catch (error: any) {
        console.error("❌ Erro ao agendar:", error.message);
        delete agendamentoPendente[telefone];
        return `Tive um erro ao salvar. Pode tentar de novo?`;
      }
    }

    const instrucoes = `Você é ${configAgente.nome}, recepcionista de ${configLoja.nome}. ${configAgente.prompt}

Sua tarefa é HUMANIZADA e SIMPÁTICA. Quando o cliente falar, responda com naturalidade.

OBJETIVO: Quando o cliente falar TODOS estes dados, AGENDE DIRETO:
✅ Um SERVIÇO (ex: corte, barba, depilção)
✅ Uma DATA (hoje, amanhã, ou data específica)
✅ Uma HORA (ex: 9h, 14:00, etc)
✅ Um PROFISSIONAL (nome do barbeiro)

QUANDO TEM TODOS OS 4 DADOS = Use "agendar"
QUANDO FALTA ALGUM = Use "responder" com uma resposta humanizada e simpática
QUANDO PERGUNTAM PREÇO = Use "responder" com o preço formatado em R$
QUANDO PERGUNTAM SOBRE PROFISSIONAIS = Use "responder" listando os profissionais
QUANDO PERGUNTAM HORÁRIOS = Use "responder" com os horários REAIS abaixo

PROFISSIONAIS DISPONÍVEIS: ${nomesProfissionais}
SERVIÇOS DISPONÍVEIS: ${nomeServicos}

💰 PREÇOS DOS SERVIÇOS:
${listaPrecos}

⏰ HORÁRIOS DE FUNCIONAMENTO:
${horariosFormatado}

⭐ COMO RESPONDER (HUMANIZADO):

QUANDO PERGUNTAM SOBRE HORÁRIOS:
- Cliente: "Que horas vocês funcionam?"
- Você: "Claro! Funcionamos de:
  Segunda a Sexta: ${configLoja.horarios.segunda}
  Sábado: ${configLoja.horarios.sabado}
  Domingo: ${configLoja.horarios.domingo}
  
  Quer agendar um horário?"

- Cliente: "Tem horário às 14h amanhã?"
- Você: "Opa! Tem sim! 😊 Deseja marcar? Qual serviço e qual profissional você prefere?"

QUANDO PERGUNTAM SOBRE CORTE/BARBEAR:
- Cliente: "Desejo cortar o cabelo amanhã"
- Você: "Opa! Tudo bem? 😊 Qual o horário que você prefere amanhã? E com qual profissional você gostaria? Temos o ${nomesProfissionais}."

QUANDO PERGUNTAM SOBRE PROFISSIONAIS:
- Cliente: "Quem você me indica pra cortar?"
- Você: "Ótimo! Temos o ${nomesProfissionais}. Qual você prefere?"

QUANDO PERGUNTAM PREÇO:
- Cliente: "Quanto custa um corte?"
- Você: "Claro! Um corte custa R$ 40.00. Deseja agendar?"

⭐ IMPORTANTE SOBRE SERVIÇOS:
- Se cliente falar "corte", procure por serviço que tem "corte" no nome
- Se cliente falar "barba", procure por serviço que tem "barba" no nome
- Se cliente falar "depilção", procure por "depilção"
- NÃO coloque um serviço que o cliente não pediu

⭐ IMPORTANTE - NATURALIDADE:
- Não comece TODA resposta com "Bom dia/tarde/noite" - fale SÓ UMA VEZ na primeira mensagem
- Se já respondeu sobre preço, não repita o preço em respostas seguintes
- Seja NATURAL, sem parecer um robô
- Não repita as mesmas informações várias vezes

Seja NATURAL, SIMPÁTICO e HUMANIZADO. Sem pressa. Entenda o contexto da conversa.
USE SEMPRE OS HORÁRIOS REAIS ACIMA quando perguntarem sobre funcionamento!`;

    chatsMemoria[telefone].push({ role: "user", parts: [{ text: texto }] });

    const payload = {
      contents: [{ role: "user", parts: [{ text: instrucoes }] }, ...chatsMemoria[telefone]],
      tools: tools,
      tool_config: { function_calling_config: { mode: "AUTO" } }
    };

    const response = await axios.post(URL, payload);
    
    if (!response.data.candidates || !response.data.candidates[0]) {
      return "Tive um problema. Pode repetir?";
    }

    const candidate = response.data.candidates[0];
    const part = candidate.content.parts[0];

    if (part.functionCall) {
      const { name, args } = part.functionCall;

      if (name === "responder") {
        chatsMemoria[telefone].push({ role: "model", parts: [{ text: args.mensagem }] });
        return args.mensagem;
      }

      if (name === "agendar") {
        const textoServico = args.servico.toLowerCase();
        
        let serv = servicos?.find(s => {
          const nomeServico = s.nome.toLowerCase();
          
          if (textoServico.includes('barba') && !textoServico.includes('corte')) {
            return nomeServico.includes('barba') && !nomeServico.includes('corte e barba');
          }
          
          if (textoServico.includes('corte') && !textoServico.includes('barba')) {
            return nomeServico.includes('corte') && !nomeServico.includes('e barba');
          }
          
          if (textoServico.includes('depil')) {
            return nomeServico.includes('depil');
          }
          
          return nomeServico.includes(textoServico);
        });

        if (!serv) {
          serv = servicos?.find(s => 
            s.nome.toLowerCase().includes(textoServico)
          );
        }

        const prof = profissionais?.find(p => 
          p.nome.toLowerCase().includes(args.profissional.toLowerCase())
        );

        if (!serv || !prof) {
          return `Desculpa, não encontrei o serviço ou profissional. Pode verificar?`;
        }

        const dataFormatada = converterDataTexto(args.data);
        const horaFormatada = converterHoraTexto(args.hora);

        try {
          let slots = await db.getAvailability(prof.id, dataFormatada);
          
          if (!slots || slots.length === 0 || slots[0].includes("não abre")) {
            return `Infelizmente não temos disponibilidade em ${formatarDataHumanizada(dataFormatada)}. Quer tentar outro dia?`;
          }

          slots = filtrarHorariosValidos(slots, dataFormatada);

          if (slots.length === 0) {
            return `Desculpa, os horários disponíveis já passaram hoje. Quer agendar para amanhã?`;
          }

          if (!slots.includes(horaFormatada)) {
            return `Desculpa, o horário ${horaFormatada} não está disponível. Horários livres: ${slots.slice(0, 5).join(', ')}`;
          }
        } catch (error) {
          console.error("Erro ao verificar disponibilidade:", error);
        }

        if (!cliente) {
          agendamentoPendente[telefone] = {
            servico_id: serv.id,
            profissional_id: prof.id,
            servico: serv.nome,
            servico_nome: serv.nome,
            profissional_nome: prof.nome,
            data: dataFormatada,
            hora: horaFormatada
          };
          
          return `Ótimo! Para confirmar o agendamento de ${serv.nome} com ${prof.nome} em ${formatarDataHumanizada(dataFormatada)} às ${horaFormatada}, qual é o seu nome?`;
        }

        try {
          console.log(`\n✅ AGENDANDO: ${serv.nome} | ${prof.nome} | ${dataFormatada} ${horaFormatada}`);

          await db.criarAgendamento({
            cliente_id: cliente.id,
            profissional_id: prof.id,
            servico_id: serv.id,
            data_agendamento: dataFormatada,
            hora_agendamento: horaFormatada,
            status: 'pendente',
            origem: 'whatsapp_bot'
          });

          console.log(`✅ AGENDAMENTO SALVO!`);

          delete chatsMemoria[telefone];

          return `✅ Perfeito! Seu agendamento foi confirmado!\n\n📋 ${serv.nome} com ${prof.nome}\n📅 ${formatarDataHumanizada(dataFormatada)} às ${horaFormatada}\n\nAté lá! 😊`;
        } catch (error: any) {
          console.error("❌ Erro ao agendar:", error.message);
          return `Tive um erro ao salvar. Pode tentar de novo?`;
        }
      }
    }

    return part.text;

  } catch (error: any) {
    console.error("Erro IA:", error);
    return "Tive um problema. Pode tentar de novo?";
  }
};