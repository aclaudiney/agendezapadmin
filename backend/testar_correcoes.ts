const run = async () => {
    // Configurar ambiente ANTES de importar módulos
    process.env.SUPABASE_URL = "https://plnwhdsksrlnuzspchoi.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbndoZHNrc3JsbnV6c3BjaG9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUwNTI3MCwiZXhwIjoyMDg1MDgxMjcwfQ.UP92Y0mN_-ksnl_C3om1TFPdwItyohnwgAbH2fjMcUs";

    const { buscarHorariosDisponiveis } = await import('./src/services/appointmentService.ts');
    const { tentarAgendar } = await import('./src/AgendamentoController.ts');
    const { supabase } = await import('./src/supabase.ts');

    console.log('🔄 Buscando dados reais do banco...');
    const { data: profs } = await supabase.from('profissionais').select('*').limit(1);
    const prof = profs?.[0];

    if (!prof) {
        console.error('❌ Nenhum profissional encontrado no banco para teste.');
        return;
    }
    
    const { data: servs } = await supabase.from('servicos').select('*').eq('company_id', prof.company_id).limit(1);
    const serv = servs?.[0];

    const COMPANY_ID = prof.company_id; 
    const CLIENTE_PHONE = '5511999999999';
    
    console.log(`✅ Usando: Profissional=${prof.nome}, Serviço=${serv?.nome}, Company=${COMPANY_ID}`);

    console.log('\n--- TESTE 1: DIA FECHADO (Domingo) ---');
    // Vamos testar Domingo, geralmente fechado
    const dataDomingo = '2026-02-15'; 
    console.log(`Testando data: ${dataDomingo}`);
    
    const resultado = await buscarHorariosDisponiveis(
        COMPANY_ID,
        prof.id, 
        dataDomingo,
        30
    );
    
    console.log('Resultado buscarHorarios:', JSON.stringify(resultado, null, 2));
    
    if (resultado.status === 'fechado' || resultado.status === 'erro') {
        console.log('✅ PASSOU: Status fechado/erro retornado corretamente para Domingo');
    } else {
        console.log('ℹ️ RETORNOU:', resultado.status, '- Domingo está aberto?');
    }

    console.log('\n--- TESTE 2: INSERT AGENDAMENTO ---');
    // Usar um horário que sabemos que está livre (baseado no output anterior do dia 10)
    const dataLivre = '2026-02-10'; // Terça
    const horaLivre = '09:30';
    
    const args = {
        servico: serv?.nome || 'Corte',
        data: dataLivre,
        hora: horaLivre,
        profissional: prof.nome
    };
    
    console.log('Tentando agendar:', args);
    
    const { data: clientes } = await supabase.from('clientes').select('*').limit(1);
    const clienteId = clientes?.[0]?.id || 'cliente-id-mock';

    const resAgendar = await tentarAgendar(
        args,
        COMPANY_ID,
        clienteId, 
        CLIENTE_PHONE
    );
    
    console.log('Resultado tentarAgendar:', resAgendar);
};