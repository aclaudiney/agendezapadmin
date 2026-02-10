import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Phone, User, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface ClientLoginProps {
  onLoginSuccess: (clienteId: string, nome: string, telefone: string, email: string) => void;
}

const ClientLogin: React.FC<ClientLoginProps> = ({ onLoginSuccess }) => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setLoading(true);

    try {
      // Validar campos obrigatórios
      if (!nome.trim() || !telefone.trim()) {
        setErro('Nome e telefone são obrigatórios');
        setLoading(false);
        return;
      }

      // Buscar cliente no banco
      const { data: clienteExistente, error: erroFetch } = await supabase
        .from('clientes')
        .select('id, nome, telefone, email')
        .eq('telefone', telefone)
        .single();

      if (clienteExistente) {
        // Cliente existe - fazer login
        setSucesso(`Bem-vindo de volta, ${clienteExistente.nome}! 👋`);
        localStorage.setItem('clienteLogado', JSON.stringify({
          id: clienteExistente.id,
          nome: clienteExistente.nome,
          telefone: clienteExistente.telefone,
          email: clienteExistente.email,
        }));
        
        setTimeout(() => {
          onLoginSuccess(
            clienteExistente.id,
            clienteExistente.nome,
            clienteExistente.telefone,
            clienteExistente.email || ''
          );
        }, 1500);
      } else {
        // Cliente não existe - criar novo cadastro
        const { data: novoCliente, error: erroInsert } = await supabase
          .from('clientes')
          .insert([{
            nome: nome.trim(),
            telefone: telefone.trim(),
            email: email.trim() || null,
          }])
          .select()
          .single();

        if (erroInsert || !novoCliente) {
          setErro('Erro ao criar cadastro. Tente novamente.');
          setLoading(false);
          return;
        }

        setSucesso(`Bem-vindo, ${nome}! Cadastro criado com sucesso! 🎉`);
        localStorage.setItem('clienteLogado', JSON.stringify({
          id: novoCliente.id,
          nome: novoCliente.nome,
          telefone: novoCliente.telefone,
          email: novoCliente.email || '',
        }));

        setTimeout(() => {
          onLoginSuccess(
            novoCliente.id,
            novoCliente.nome,
            novoCliente.telefone,
            novoCliente.email || ''
          );
        }, 1500);
      }
    } catch (error) {
      setErro('Erro ao processar login. Tente novamente.');
      console.error('Erro:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Efeitos de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-40 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-40 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl blur-xl opacity-75"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl">
                <Zap className="text-white" size={32} strokeWidth={3} />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-200 via-white to-indigo-200 bg-clip-text text-transparent mb-2">
            AgendeZap
          </h1>
          <p className="text-purple-200/60">Agende seus serviços com facilidade</p>
        </div>

        {/* Card de Login */}
        <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl border border-white/20 backdrop-blur-xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-100 bg-clip-text text-transparent mb-2">
            Acesse sua conta
          </h2>
          <p className="text-purple-200/60 text-sm mb-6">
            Coloque seu nome e telefone para entrar
          </p>

          {/* Mensagem de Sucesso */}
          {sucesso && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3 animate-in fade-in duration-300">
              <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-200">{sucesso}</p>
            </div>
          )}

          {/* Mensagem de Erro */}
          {erro && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{erro}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-purple-400" size={20} />
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-xl transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 text-purple-400" size={20} />
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-xl transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email (Opcional) */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">Email (Opcional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-xl transition-all"
                disabled={loading}
              />
            </div>

            {/* Botão Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-purple-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? 'Verificando...' : 'Entrar ou Criar Conta'}
            </button>
          </form>

          {/* Informação */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-purple-200/60 text-center">
              💡 Se for sua primeira vez, vamos criar seu cadastro automaticamente!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientLogin;