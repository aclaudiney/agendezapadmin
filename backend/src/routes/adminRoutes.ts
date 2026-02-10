import express, { Request, Response } from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// ============================================
// 📊 ESTATÍSTICAS DE VENDAS POR CATEGORIA
// ============================================

router.get('/analytics/sales-by-category', async (req: Request, res: Response) => {
    try {
        // Buscar agendamentos concluídos com os nomes dos serviços
        const { data: agendamentos, error } = await supabase
            .from('agendamentos')
            .select(`
                id,
                servico:servicos(nome)
            `)
            .eq('status', 'confirmado');

        if (error) {
            console.error('❌ Erro ao buscar dados para analytics:', error);
            return res.status(500).json({ error: 'Erro ao processar estatísticas' });
        }

        // Mapeamento manual de categorias com base nas palavras-chave (conforme extração)
        const categorias: Record<string, number> = {
            'Cabelo': 0,
            'Barba': 0,
            'Pele': 0,
            'Combo': 0,
            'Outros': 0
        };

        agendamentos?.forEach((ag: any) => {
            const nome = ag.servico?.nome?.toLowerCase() || '';

            if (nome.includes('combo') || (nome.includes('cabelo') && nome.includes('barba'))) {
                categorias['Combo']++;
            } else if (nome.includes('cabelo') || nome.includes('corte') || nome.includes('cortar')) {
                categorias['Cabelo']++;
            } else if (nome.includes('barba')) {
                categorias['Barba']++;
            } else if (nome.includes('pele') || nome.includes('limpeza')) {
                categorias['Pele']++;
            } else {
                categorias['Outros']++;
            }
        });

        // Formatar para o Recharts
        const chartData = Object.entries(categorias)
            .filter(([_, value]) => value > 0)
            .map(([name, value]) => ({ name, value }));

        res.json({
            success: true,
            data: chartData
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
