import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { API_URL } from '../config/api';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface LoginProps {
  onLoginSuccess: () => void;
}

interface Usuario {
  id: string;
  email: string;
  role: 'super_admin' | 'empresa';
  company_id?: string;
  nome?: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      // ✅ Buscar usuário com role
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, email, role, company_id, nome')
        .eq('email', email)
        .eq('senha', senha)
        .single();

      if (error || !data) {
        setErro('Email ou senha incorretos');
        return;
      }

      // ✅ Validar se role é válido
      if (!['admin', 'super_admin', 'empresa'].includes(data.role)) {
        setErro('Erro: role inválido no banco de dados');
        return;
      }

      // Normalizar admin para super_admin se necessário
      const effectiveRole = data.role === 'admin' ? 'super_admin' : data.role;

      // ✅ SE FOR EMPRESA, VERIFICAR SE ESTÁ ATIVA (DIRETO NO SUPABASE)
      if (effectiveRole === 'empresa') {
        console.log('🔍 Verificando se empresa está ativa no Supabase...');

        const { data: empresa, error: erroEmpresa } = await supabase
          .from('companies')
          .select('active')
          .eq('id', data.company_id)
          .single();

        if (erroEmpresa || !empresa?.active) {
          console.error('❌ Empresa bloqueada ou não encontrada:', erroEmpresa);
          setErro('🚫 Sua empresa foi desativada pelo administrador');
          return;
        }

        console.log('✅ Empresa está ativa!');
      }

      // ✅ Salvar dados do usuário no localStorage
      const usuario: Usuario = {
        id: data.id,
        email: data.email,
        role: effectiveRole,
        company_id: data.company_id,
        nome: data.nome
      };

      localStorage.setItem('usuario', JSON.stringify(usuario));
      localStorage.setItem('autenticado', 'true');
      localStorage.setItem('userRole', effectiveRole);
      localStorage.setItem('companyId', data.company_id || '');

      console.log('✅ Login bem-sucedido:', usuario);

      // ✅ CALLBACK
      onLoginSuccess();

      // ✅ REDIRECIONAR BASEADO NO ROLE
      if (effectiveRole === 'super_admin') {
        console.log('🔐 Redirecionando para painel ADMIN');
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 500);
      } else if (effectiveRole === 'empresa') {
        console.log('🏢 Redirecionando para painel EMPRESA');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      }
    } catch (error) {
      setErro('Erro ao fazer login. Tente novamente.');
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        {/* Card de Login */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <img 
              src="/images/logo1.png" 
              alt="AgendeZap" 
              className="w-64 h-auto object-contain"
            />
          </div>

          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bem-vindo de volta</h2>
            <p className="text-slate-500 text-sm mt-2">Entre com suas credenciais para acessar o painel</p>
          </div>

          {erro && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
              <AlertCircle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700 font-medium">{erro}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Botão Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                'Acessar Sistema'
              )}
            </button>
          </form>
        </div>
        
        <p className="text-center mt-8 text-slate-400 text-xs font-medium">
          &copy; {new Date().getFullYear()} AgendeZap. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;