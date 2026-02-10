import React, { useState, useEffect } from 'react';
import {
    Save,
    Clock,
    MessageSquare,
    AlertCircle,
    ToggleLeft,
    ToggleRight,
    CheckCircle2,
    Bell,
    Send,
    Phone,
    Plus,
    Trash2,
    Edit2,
    Settings2
} from 'lucide-react';
import { API_URL } from '../config/api';

const FollowUpPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // States para teste
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('Olá! Este é um teste do AgendeZap.');

    const [baseSettings, setBaseSettings] = useState<any>(null);
    const [systemActive, setSystemActive] = useState(false);
    const [modes, setModes] = useState<any[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameModeId, setRenameModeId] = useState<string | null>(null);
    const [renameModeName, setRenameModeName] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');

    const companyId = localStorage.getItem('companyId');

    useEffect(() => {
        fetchSettings();
        checkWsStatus();
        const timer = setInterval(checkWsStatus, 10000);
        return () => clearInterval(timer);
    }, []);

    const checkWsStatus = async () => {
        try {
            if (!companyId) return;
            const response = await fetch(`${API_URL}/api/follow-up/status/${companyId}`);
            const data = await response.json();
            if (data.success) setWsStatus(data.status);
        } catch { }
    };

    const fetchSettings = async () => {
        try {
            if (!companyId) return;
            const response = await fetch(`${API_URL}/api/follow-up/settings/${companyId}`);
            const data = await response.json();

            if (data.success && data.settings) {
                setBaseSettings(data.settings);
                setSystemActive(!!data.settings.is_active);
            }
            if (data.modes && Array.isArray(data.modes)) {
                setModes(data.modes.filter((m: any) => String(m.id) !== 'default'));
            } else {
                setModes([]);
            }
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            setMessage({ text: 'Erro Conecte o Whatsapp.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const saveSystemActive = async (next: boolean) => {
        if (!companyId) return;
        setSystemActive(next);
        try {
            const payload = { ...(baseSettings || {}), is_active: next };
            const response = await fetch(`${API_URL}/api/follow-up/settings/${companyId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success && data.settings) {
                setBaseSettings(data.settings);
            }
        } catch { }
    };

    const saveMode = async (modeId: string, payload: any) => {
        const companyId = localStorage.getItem('companyId') as string;
        if (!companyId) return;
        if (modeId === 'default') return;
        const resp = await fetch(`${API_URL}/api/follow-up/modes/${companyId}/${modeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (data.success) {
            setModes(data.modes || []);
            setMessage({ text: 'Módulo salvo!', type: 'success' });
        } else {
            setMessage({ text: 'Erro ao salvar módulo: ' + data.error, type: 'error' });
        }
    };

    const createModeByType = async (tipo: 'aviso' | 'lembrete' | 'recorrencia' | 'pos_corte') => {
        if (!companyId) return;
        setMessage(null);
        const presets: any = {
            aviso: {
                name: 'Aviso',
                trigger_type: 'time_fixed',
                warning_time: '08:00:00',
                reminder_minutes: 60,
                trigger_days: null,
                message_template_warning: 'Olá {cliente_nome}, passando pra lembrar do seu agendamento hoje com {profissional}.',
                message_template_reminder: ''
            },
            lembrete: {
                name: 'Lembrete',
                trigger_type: 'antecedencia',
                warning_time: '08:00:00',
                reminder_minutes: 60,
                trigger_days: null,
                message_template_warning: '',
                message_template_reminder: 'Olá {cliente_nome}, seu agendamento é em {minutos} minutos! Estamos te esperando.'
            },
            recorrencia: {
                name: 'Recorrência',
                trigger_type: 'dias_apos',
                trigger_days: 15,
                warning_time: '08:00:00',
                reminder_minutes: 60,
                message_template_warning: 'Olá {cliente_nome}, bora agendar de novo? Já faz um tempo desde seu último atendimento com {profissional}.',
                message_template_reminder: ''
            },
            pos_corte: {
                name: 'Pós-Corte',
                trigger_type: 'dias_apos',
                trigger_days: 10,
                warning_time: '08:00:00',
                reminder_minutes: 60,
                message_template_warning: 'Olá {cliente_nome}, como ficou o corte? Se precisar é só chamar!',
                message_template_reminder: ''
            }
        };
        const preset = presets[tipo];
        try {
            const response = await fetch(`${API_URL}/api/follow-up/modes/${companyId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...preset, is_active: false })
            });
            const data = await response.json();
            if (data.success) {
                setModes((data.modes || []).filter((m: any) => String(m.id) !== 'default'));
                setMessage({ text: `Modo "${preset.name}" criado!`, type: 'success' });
            } else {
                setMessage({ text: 'Erro ao criar modo: ' + data.error, type: 'error' });
            }
        } catch {
            setMessage({ text: 'Erro ao criar modo.', type: 'error' });
        } finally {
            setShowCreateModal(false);
        }
    };

    const handleTestSend = async () => {
        if (!testPhone) {
            setMessage({ text: 'Digite um número de telefone para o teste.', type: 'error' });
            return;
        }

        setTesting(true);
        setMessage(null);

        try {
            const response = await fetch(`${API_URL}/api/crm/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    clientPhone: testPhone.replace(/\D/g, ''), // Remove não numéricos
                    message: testMessage
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ text: 'Mensagem de teste enviada com sucesso!', type: 'success' });
            } else {
                // Caso específico de erro de conexão
                if (data.error && data.error.includes('não está conectado')) {
                    setMessage({ text: 'WhatsApp desconectado. Conecte no menu "Conectar WhatsApp".', type: 'error' });
                } else {
                    setMessage({ text: 'Erro ao enviar teste: ' + (data.error || 'Erro desconhecido'), type: 'error' });
                }
            }

        } catch (error) {
            console.error('Erro no teste:', error);
            setMessage({ text: 'Erro ao conectar com servidor.', type: 'error' });
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="relative w-16 h-16">
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-10 animate-in fade-in duration-700">
            {/* WHATSAPP STATUS BANNER */}
            {wsStatus !== 'connected' && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-rose-600" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-rose-900">WhatsApp Desconectado</h4>
                            <p className="text-xs text-rose-700">O sistema de follow-up não poderá enviar mensagens até que você conecte o dispositivo.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => window.location.href = '/whatsapp'}
                        className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors"
                    >
                        CONECTAR AGORA
                    </button>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Follow-up Automático</h1>
                    <p className="text-slate-500 mt-1">Configure o envio automático de mensagens para seus clientes.</p>
                </div>

                <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <span className={`text-sm font-bold ${systemActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {systemActive ? 'SISTEMA ATIVO' : 'SISTEMA INATIVO'}
                    </span>
                    <button
                        onClick={() => saveSystemActive(!systemActive)}
                        className="focus:outline-none transition-transform active:scale-95"
                    >
                        {systemActive
                            ? <ToggleRight className="w-10 h-10 text-emerald-500" />
                            : <ToggleLeft className="w-10 h-10 text-slate-400" />
                        }
                    </button>
                    <div className="w-px h-6 bg-slate-200" />
                    <Settings2 className="w-6 h-6 text-slate-500" />
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                    >
                        <Plus size={16} /> Novo Modo
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {modes.map((m, idx) => (
                    <div key={m.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-xl">
                                    <Clock className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Módulo {idx + 1}: {m.name}</h3>
                                    <p className="text-xs text-slate-500">
                                        {m.trigger_type === 'antecedencia' ? 'Antecedência' : m.trigger_type === 'dias_apos' ? 'Dias após finalização' : 'Horário fixo'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    title="Renomear"
                                    onClick={() => { setRenameModeId(m.id); setRenameModeName(m.name || ''); setShowRenameModal(true); }}
                                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    title="Excluir"
                                    onClick={() => setConfirmDeleteId(m.id)}
                                    className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button
                                    onClick={async () => {
                                        const next = modes.map(mm => mm.id === m.id ? { ...mm, is_active: !mm.is_active } : mm);
                                        setModes(next);
                                        const payload = { ...m, is_active: !m.is_active };
                                        await saveMode(m.id, payload);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                                >
                                    {m.is_active ? 'Ativo' : 'Inativo'}
                                </button>
                            </div>
                        </div>

                        {m.trigger_type === 'time_fixed' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Horário</label>
                                    <input
                                        type="time"
                                        value={(m.warning_time || '08:00:00').slice(0, 5)}
                                        onChange={(e) => {
                                            const next = modes.map(mm => mm.id === m.id ? { ...mm, warning_time: e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value } : mm);
                                            setModes(next);
                                        }}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                                    />
                                </div>
                            </div>
                        )}

                        {m.trigger_type === 'antecedencia' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Antecedência</label>
                                    <select
                                        value={m.reminder_minutes ?? 60}
                                        onChange={(e) => {
                                            const next = modes.map(mm => mm.id === m.id ? { ...mm, reminder_minutes: parseInt(e.target.value) } : mm);
                                            setModes(next);
                                        }}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 bg-white"
                                    >
                                        <option value={15}>15 minutos antes</option>
                                        <option value={30}>30 minutos antes</option>
                                        <option value={60}>1 hora antes</option>
                                        <option value={120}>2 horas antes</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {m.trigger_type === 'dias_apos' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Dias após último atendimento</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={m.trigger_days ?? 10}
                                        onChange={(e) => {
                                            const next = modes.map(mm => mm.id === m.id ? { ...mm, trigger_days: parseInt(e.target.value) } : mm);
                                            setModes(next);
                                        }}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Mensagem</label>
                            <textarea
                                value={
                                    m.trigger_type === 'antecedencia'
                                        ? (m.message_template_reminder || '')
                                        : (m.message_template_warning || '')
                                }
                                onChange={(e) => {
                                    const next = modes.map(mm => {
                                        if (mm.id !== m.id) return mm;
                                        if (mm.trigger_type === 'antecedencia') return { ...mm, message_template_reminder: e.target.value };
                                        return { ...mm, message_template_warning: e.target.value };
                                    });
                                    setModes(next);
                                }}
                                rows={3}
                                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none bg-slate-50 focus:bg-white"
                                placeholder="Digite a mensagem..."
                            />
                            <div className="flex flex-wrap gap-2 mt-3">
                                {['cliente_nome', 'horario', 'profissional', 'minutos'].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => {
                                            const text = m.trigger_type === 'antecedencia' ? (m.message_template_reminder || '') : (m.message_template_warning || '');
                                            const nextText = `${text} {${v}}`;
                                            const next = modes.map(mm => {
                                                if (mm.id !== m.id) return mm;
                                                if (mm.trigger_type === 'antecedencia') return { ...mm, message_template_reminder: nextText };
                                                return { ...mm, message_template_warning: nextText };
                                            });
                                            setModes(next);
                                        }}
                                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                    >
                                        + {v}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={async () => {
                                    const payload = { ...m };
                                    await saveMode(m.id, payload);
                                }}
                                className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg"
                            >
                                <Save size={18} />
                                Salvar Módulo
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                    } animate-in slide-in-from-top-2 duration-300`}>
                    {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            {/* MODAL: NOVO MODO */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Settings2 className="w-5 h-5 text-slate-700" />
                            <h4 className="text-lg font-bold text-slate-800">Novo Modo</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => createModeByType('aviso')}
                                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 text-left"
                            >
                                Aviso (HH:mm)
                            </button>
                            <button
                                onClick={() => createModeByType('lembrete')}
                                className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 text-left"
                            >
                                Lembrete (minutos)
                            </button>
                            <button
                                onClick={() => createModeByType('recorrencia')}
                                className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 text-left"
                            >
                                Recorrência (dias)
                            </button>
                            <button
                                onClick={() => createModeByType('pos_corte')}
                                className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 text-left"
                            >
                                Pós-Corte (dias)
                            </button>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="mt-4 w-full px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL: RENOMEAR MODO */}
            {showRenameModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Edit2 className="w-5 h-5 text-slate-700" />
                            <h4 className="text-lg font-bold text-slate-800">Renomear Modo</h4>
                        </div>
                        <input
                            type="text"
                            value={renameModeName}
                            onChange={(e) => setRenameModeName(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowRenameModal(false); setRenameModeId(null); setRenameModeName(''); }}
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    const companyId = localStorage.getItem('companyId');
                                    if (!companyId || !renameModeId) return;
                                    const response = await fetch(`${API_URL}/api/follow-up/modes/${companyId}/${renameModeId}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ name: renameModeName.trim() })
                                    });
                                    const data = await response.json();
                                    if (data.success) {
                                        setModes((data.modes || []).filter((m: any) => String(m.id) !== 'default'));
                                        setMessage({ text: 'Modo renomeado!', type: 'success' });
                                    } else {
                                        setMessage({ text: 'Erro ao renomear modo: ' + data.error, type: 'error' });
                                    }
                                    setShowRenameModal(false);
                                    setRenameModeId(null);
                                    setRenameModeName('');
                                }}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMAR EXCLUSÃO */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Trash2 className="w-5 h-5 text-rose-700" />
                            <h4 className="text-lg font-bold text-slate-800">Excluir Modo</h4>
                        </div>
                        <p className="text-slate-700 mb-4">Tem certeza que deseja excluir este modo? Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    const companyId = localStorage.getItem('companyId');
                                    const modeId = confirmDeleteId!;
                                    setConfirmDeleteId(null);
                                    if (!companyId) return;
                                    const response = await fetch(`${API_URL}/api/follow-up/modes/${companyId}/${modeId}`, {
                                        method: 'DELETE'
                                    });
                                    const data = await response.json();
                                    if (data.success) {
                                        setModes((data.modes || []).filter((m: any) => String(m.id) !== 'default'));
                                        setMessage({ text: 'Modo excluído!', type: 'success' });
                                    } else {
                                        setMessage({ text: 'Erro ao excluir modo: ' + data.error, type: 'error' });
                                    }
                                }}
                                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUpPage;