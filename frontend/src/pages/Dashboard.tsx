import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  TrendingUp, Users, Calendar, Scissors,
  Clock, Filter,
  ArrowUpRight, ArrowDownRight, MoreHorizontal
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { dashboardService } from '../services/dashboardService';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [empresaBloqueada, setEmpresaBloqueada] = useState(false);
  const [period, setPeriod] = useState(30);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [professionalsList, setProfessionalsList] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    verificarEmpresaAtiva();
  }, [period, selectedProfessional]);

  const verificarEmpresaAtiva = async () => {
    try {
      setLoading(true);
      const companyId = localStorage.getItem('companyId');

      if (!companyId) {
        window.location.href = '/login';
        return;
      }

      try {
        const CACHE_TTL_MS = 120000;
        const cacheKey = `cache_dashboard_${companyId}_${period}_${selectedProfessional || 'all'}`;
        const cache = localStorage.getItem(cacheKey);
        if (cache) {
          const parsed = JSON.parse(cache);
          const now = Date.now();
          if (parsed && parsed.data && now - (parsed.ts || 0) < CACHE_TTL_MS) {
            setData(parsed.data);
            setLoading(false);
          }
        }
        const profCache = localStorage.getItem(`cache_profissionais_${companyId}`);
        if (profCache && professionalsList.length === 0) {
          const parsedProfs = JSON.parse(profCache);
          const now2 = Date.now();
          if (parsedProfs && parsedProfs.data && now2 - (parsedProfs.ts || 0) < CACHE_TTL_MS) {
            setProfessionalsList(parsedProfs.data);
          }
        }
      } catch {}

      // Checa status da empresa
      const { data: empresa, error: erroEmpresa } = await supabase
        .from('companies')
        .select('active')
        .eq('id', companyId)
        .single();

      if (erroEmpresa || !empresa?.active) {
        setEmpresaBloqueada(true);
        return;
      }

      // Carrega lista de profissionais (se ainda não carregou)
      if (professionalsList.length === 0) {
        const { data: profs } = await supabase
          .from('profissionais')
          .select('id, nome')
          .eq('company_id', companyId);
        if (profs) setProfessionalsList(profs);
        try {
          localStorage.setItem(`cache_profissionais_${companyId}`, JSON.stringify({ ts: Date.now(), data: profs || [] }));
        } catch {}
      }

      // Busca dados do Dashboard com filtro de profissional
      const dashData = await dashboardService.fetchDashboardData(
        companyId,
        period,
        selectedProfessional || undefined
      );
      setData(dashData);
      try {
        const cacheKey = `cache_dashboard_${companyId}_${period}_${selectedProfessional || 'all'}`;
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: dashData }));
      } catch {}
    } catch (error: any) {
      console.error('Erro dashboard:', error);
      setEmpresaBloqueada(true);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'confirmado' || s === 'confirmed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'pendente' || s === 'pending') return 'bg-amber-100 text-amber-700';
    if (s === 'cancelado' || s === 'cancelled') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-700';
  };

  if (empresaBloqueada) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">🚫</div>
        <h2 className="text-2xl font-bold text-rose-600">Empresa Bloqueada</h2>
        <p className="text-slate-500 text-center max-w-md">Sua empresa foi desativada pelo administrador.</p>
        <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-lg font-semibold transition-all hover:scale-105">Voltar ao Login</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  const { stats, revenueFlow, popularServices, ranking, todayAppointments } = data;

  // Filtrar dados por profissional se selecionado
  const filteredRanking = selectedProfessional
    ? ranking.filter((p: any) => p.id === selectedProfessional)
    : ranking;

  const filteredTodayAppointments = selectedProfessional
    ? todayAppointments.filter((apt: any) => apt.profissional_id === selectedProfessional)
    : todayAppointments;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-10 animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1">Visualize e gerencie todos os agendamentos da sua agenda.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Filtro de Profissional */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Users size={16} className="text-slate-400" />
            <select
              value={selectedProfessional}
              onChange={(e) => setSelectedProfessional(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-slate-700 focus:ring-0 py-0"
            >
              <option value="">Todos Profissionais</option>
              {professionalsList.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          {/* Período */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${period === d ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* FATURAMENTO */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-indigo-50 transition-colors">
                <TrendingUp size={20} className="text-slate-900 group-hover:text-indigo-600 transition-colors" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-bold ${stats.revenue.trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {stats.revenue.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(stats.revenue.trend).toFixed(1)}%
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500">Faturamento</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">R$ {stats.revenue.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-slate-400 mt-1">vs. período anterior</p>
          </div>
        </div>

        {/* AGENDAMENTOS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-indigo-50 transition-colors">
              <Calendar size={20} className="text-slate-900 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div className={`flex items-center gap-1 text-sm font-bold ${stats.appointments.trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {stats.appointments.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(stats.appointments.trend).toFixed(1)}%
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Agendamentos</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.appointments.total}</h3>
          <p className="text-xs text-slate-400 mt-1">este período</p>
        </div>

        {/* PROFISSIONAIS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-indigo-50 transition-colors">
              <Users size={20} className="text-slate-900 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div className="flex items-center gap-1 text-sm font-bold text-emerald-600">
              <ArrowUpRight size={14} /> +{stats.professionals.trend || 2}
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Profissionais</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.professionals.total}</h3>
          <p className="text-xs text-slate-400 mt-1">ativos</p>
        </div>

        {/* SERVIÇOS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-indigo-50 transition-colors">
              <Scissors size={20} className="text-slate-900 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div className="flex items-center gap-1 text-sm font-bold text-slate-400 font-mono">
              -3
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Serviços</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.services.total}</h3>
          <p className="text-xs text-slate-400 mt-1">catálogo</p>
        </div>
      </div>

      {/* MIDDLE SECTION: CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FLUXO DE RECEITAS */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Fluxo de Receitas</h3>
              <p className="text-sm text-slate-400 mt-0.5">Faturamento dos últimos 7 dias</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-600">
              <TrendingUp size={14} className="text-indigo-500" /> R$ {revenueFlow.reduce((acc: number, curr: any) => acc + curr.total, 0).toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueFlow} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 13, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 12 }}
                  tickFormatter={(val) => `${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`}
                />
                <Tooltip
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Faturamento']}
                />
                <Bar dataKey="total" fill="#0F172A" radius={[8, 8, 8, 8]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SERVIÇOS POPULARES */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-1">Serviços Populares</h3>
          <p className="text-sm text-slate-400 mb-8">Distribuição por categoria</p>

          <div className="h-[220px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={popularServices}
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="percentage"
                >
                  {popularServices.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-black text-slate-900">{popularServices[0]?.percentage || 0}%</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Crescimento</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-8">
            {popularServices.map((service: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: service.color }}></div>
                  <span className="text-sm font-semibold text-slate-600">{service.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{service.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TENDÊNCIA SEMANAL */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Tendência Semanal</h3>
            <p className="text-sm text-slate-400 mt-0.5">Comparativo receita x agendamentos</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-900"></div>
              <span className="text-xs font-bold text-slate-600">Receita</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-200"></div>
              <span className="text-xs font-bold text-slate-600">Agendamentos</span>
            </div>
          </div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[
              { name: 'Sem 1', total: 28000, apts: 190 },
              { name: 'Sem 2', total: 32000, apts: 210 },
              { name: 'Sem 3', total: 30000, apts: 200 },
              { name: 'Sem 4', total: 40000, apts: 280 },
            ]} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F172A" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#0F172A"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTotal)"
                dot={{ r: 4, fill: '#0F172A', strokeWidth: 2, stroke: '#FFF' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BOTTOM SECTION: RANKING & TODAY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TOP PROFISSIONAIS */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Top Profissionais</h3>
              <p className="text-sm text-slate-400 mt-0.5">Ranking por faturamento</p>
            </div>
            <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={20} /></button>
          </div>
          <div className="space-y-6">
            {filteredRanking.map((prof: any) => (
              <div key={prof.id} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-950 flex items-center justify-center text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                    {prof.initials}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{prof.nome}</h4>
                    <p className="text-xs font-bold text-slate-400 mt-0.5 tracking-tight">{prof.count} atend.</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">R$ {prof.total.toLocaleString('pt-BR')}</p>
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-slate-950 rounded-full"
                      style={{ width: `${(prof.total / (filteredRanking[0]?.total || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AGENDAMENTOS DE HOJE */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Agendamentos de Hoje</h3>
              <p className="text-sm text-slate-400 mt-0.5">Próximos atendimentos</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg text-xs font-bold text-amber-700">
              <Clock size={14} /> {filteredTodayAppointments.filter((a: any) => a.status === 'pendente').length} pendentes
            </div>
          </div>

          {filteredTodayAppointments.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Calendar size={40} strokeWidth={1} />
              <p className="text-sm font-medium">Nenhum agendamento para hoje</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTodayAppointments.slice(0, 5).map((apt: any) => (
                <div key={apt.id} className="p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 transition-all flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-base font-black text-slate-900 w-12">{apt.hora_agendamento.slice(0, 5)}</div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm leading-tight">{apt.cliente_nome}</h4>
                      <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{apt.servico_nome} - Prof. {apt.profissional_nome}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${getStatusColor(apt.status)}`}>
                      {apt.status === 'confirmed' ? 'confirmado' : apt.status}
                    </span>
                    <span className="font-black text-slate-900 text-sm">R$ {apt.valor}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
