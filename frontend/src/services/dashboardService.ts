import { supabase } from './supabaseClient';

export interface DashboardStats {
    revenue: {
        total: number;
        trend: number;
    };
    appointments: {
        total: number;
        trend: number;
    };
    professionals: {
        total: number;
        active: number;
        trend: number;
    };
    services: {
        total: number;
        active: number;
        trend: number;
    };
}

export interface ChartDataItem {
    name: string;
    total: number;
}

export interface PopularService {
    name: string;
    percentage: number;
    color: string;
}

export interface ProfessionalRanking {
    id: string;
    nome: string;
    total: number;
    count: number;
    initials: string;
}

export const dashboardService = {
    fetchDashboardData: async (companyId: string, days: number = 30) => {
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(now.getDate() - days);

        const prevStartDate = new Date();
        prevStartDate.setDate(startDate.getDate() - days);

        // 1. Receitas (Faturamento)
        const { data: currentPeriodRevenue } = await supabase
            .from('financeiro')
            .select('*')
            .eq('company_id', companyId)
            .eq('tipo', 'receita')
            .gte('data_transacao', startDate.toISOString());

        const { data: prevPeriodRevenue } = await supabase
            .from('financeiro')
            .select('valor')
            .eq('company_id', companyId)
            .eq('tipo', 'receita')
            .gte('data_transacao', prevStartDate.toISOString())
            .lt('data_transacao', startDate.toISOString());

        const currentRevenue = currentPeriodRevenue?.reduce((sum, r) => sum + r.valor, 0) || 0;
        const prevRevenue = prevPeriodRevenue?.reduce((sum, r) => sum + r.valor, 0) || 0;
        const revenueTrend = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        // 2. Agendamentos
        const { data: currentPeriodApts } = await supabase
            .from('agendamentos')
            .select('id, data_agendamento, status, servico_id, profissional_id, hora_agendamento, cliente_id')
            .eq('company_id', companyId)
            .gte('data_agendamento', startDate.toISOString().split('T')[0]);

        const { data: prevPeriodApts } = await supabase
            .from('agendamentos')
            .select('id')
            .eq('company_id', companyId)
            .gte('data_agendamento', prevStartDate.toISOString().split('T')[0])
            .lt('data_agendamento', startDate.toISOString().split('T')[0]);

        const currentApts = currentPeriodApts?.length || 0;
        const prevApts = prevPeriodApts?.length || 0;
        const aptsTrend = prevApts > 0 ? ((currentApts - prevApts) / prevApts) * 100 : 0;

        // 3. Profissionais, Serviços e Clientes
        const { data: professionals } = await supabase.from('profissionais').select('*').eq('company_id', companyId);
        const { data: services } = await supabase.from('servicos').select('*').eq('company_id', companyId);
        const { data: clients } = await supabase.from('clientes').select('*').eq('company_id', companyId);

        // 4. Fluxo de Receitas (Últimos 7 dias)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const revenueFlow: ChartDataItem[] = last7Days.map(date => {
            const dayName = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            const total = currentPeriodRevenue?.filter(r => r.data_transacao.startsWith(date))
                .reduce((sum, r) => sum + r.valor, 0) || 0;
            return { name: dayName.charAt(0).toUpperCase() + dayName.slice(1), total };
        });

        // 5. Serviços Populares (Top 3)
        const serviceCounts: { [key: string]: number } = {};
        currentPeriodApts?.forEach(apt => {
            const servico = services?.find(s => s.id === apt.servico_id);
            const name = servico?.nome || 'Outros';
            serviceCounts[name] = (serviceCounts[name] || 0) + 1;
        });

        const totalApts = currentPeriodApts?.length || 1;
        const popularServices: PopularService[] = Object.entries(serviceCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count], i) => ({
                name,
                percentage: Math.round((count / totalApts) * 100),
                color: ['#000000', '#6B7280', '#D1D5DB'][i]
            }));

        // 6. Ranking de Profissionais
        const profRanking: { [key: string]: { total: number, count: number, nome: string } } = {};
        currentPeriodRevenue?.forEach(receita => {
            const apt = currentPeriodApts?.find(a => a.id === receita.agendamento_id);
            if (apt) {
                const prof = professionals?.find(p => p.id === apt.profissional_id);
                if (prof) {
                    if (!profRanking[prof.id]) {
                        profRanking[prof.id] = { total: 0, count: 0, nome: prof.nome };
                    }
                    profRanking[prof.id].total += receita.valor;
                    profRanking[prof.id].count += 1;
                }
            }
        });

        const ranking: ProfessionalRanking[] = Object.entries(profRanking)
            .map(([id, data]) => ({
                id,
                nome: data.nome,
                total: data.total,
                count: data.count,
                initials: data.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        return {
            stats: {
                revenue: { total: currentRevenue, trend: revenueTrend },
                appointments: { total: currentApts, trend: aptsTrend },
                professionals: { total: professionals?.length || 0, active: professionals?.filter(p => p.ativo).length || 0, trend: 0 },
                services: { total: services?.length || 0, active: services?.filter(s => s.ativo).length || 0, trend: 0 }
            },
            revenueFlow,
            popularServices,
            ranking,
            todayAppointments: currentPeriodApts?.filter(apt => apt.data_agendamento === now.toISOString().split('T')[0])
                .sort((a, b) => a.hora_agendamento.localeCompare(b.hora_agendamento))
                .map(apt => ({
                    ...apt,
                    cliente_nome: clients?.find(c => c.id === apt.cliente_id)?.nome || 'Cliente Desconhecido',
                    servico_nome: services?.find(s => s.id === apt.servico_id)?.nome || 'Serviço Desconhecido',
                    profissional_nome: professionals?.find(p => p.id === apt.profissional_id)?.nome || 'Profissional Desconhecido',
                    valor: services?.find(s => s.id === apt.servico_id)?.preco || 0
                })) || []
        };
    }
};
