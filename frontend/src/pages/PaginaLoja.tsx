import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Save, AlertCircle, CheckCircle2, Image, Palette, Share2, Type, Loader, Trash2 } from 'lucide-react';

const PaginaLoja: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imagemUrl, setImagemUrl] = useState<string>('');

  const [formData, setFormData] = useState({
    descricao_loja: '',
    cor_tema: '#6366f1',
    imagem_capa: '',
    facebook_url: '',
    instagram_url: '',
    linkedin_url: '',
    tiktok_url: '',
    youtube_url: '',
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .limit(1);

      if (data && data.length > 0) {
        const config = data[0];
        console.log('Dados carregados:', config);
        setFormData({
          descricao_loja: config.descricao_loja || '',
          cor_tema: config.cor_tema || '#6366f1',
          imagem_capa: config.imagem_capa || '',
          facebook_url: config.facebook_url || '',
          instagram_url: config.instagram_url || '',
          linkedin_url: config.linkedin_url || '',
          tiktok_url: config.tiktok_url || '',
          youtube_url: config.youtube_url || '',
        });
        if (config.imagem_capa) {
          setImagemUrl(config.imagem_capa);
          setImagePreview(config.imagem_capa);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar:', error);
      setErro('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      setErro('');

      // Validar tamanho (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErro('Imagem muito grande (máximo 5MB)');
        setUploadingImage(false);
        return;
      }

      // Gerar nome único para a imagem
      const timestamp = Date.now();
      const fileName = `capa-loja-${timestamp}.${file.name.split('.').pop()}`;

      // Upload para Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('loja-imagens')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Erro upload:', uploadError);
        setErro('Erro ao fazer upload da imagem: ' + uploadError.message);
        setUploadingImage(false);
        return;
      }

      // Obter URL pública da imagem
      const { data: publicUrlData } = supabase.storage
        .from('loja-imagens')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      console.log('URL pública:', publicUrl);

      // Atualizar preview e URL
      setImagePreview(publicUrl);
      setImagemUrl(publicUrl);
      setFormData(prev => ({
        ...prev,
        imagem_capa: publicUrl
      }));

      setErro('');
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      setErro('Erro ao fazer upload da imagem: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoverImagem = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.confirm('Tem certeza que deseja remover a imagem de capa?')) {
      setImagePreview('');
      setImagemUrl('');
      setFormData(prev => ({
        ...prev,
        imagem_capa: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso(false);

    try {
      setSaving(true);

      const { data: existingData } = await supabase
        .from('configuracoes')
        .select('id')
        .limit(1);

      const dadosParaSalvar = {
        descricao_loja: formData.descricao_loja,
        cor_tema: formData.cor_tema,
        imagem_capa: formData.imagem_capa,
        facebook_url: formData.facebook_url,
        instagram_url: formData.instagram_url,
        linkedin_url: formData.linkedin_url,
        tiktok_url: formData.tiktok_url,
        youtube_url: formData.youtube_url,
      };

      if (existingData && existingData.length > 0) {
        const { error } = await supabase
          .from('configuracoes')
          .update(dadosParaSalvar)
          .eq('id', existingData[0].id);

        if (error) {
          console.error('Erro:', error);
          setErro('Erro ao salvar: ' + error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from('configuracoes')
          .insert([dadosParaSalvar]);

        if (error) {
          console.error('Erro:', error);
          setErro('Erro ao salvar: ' + error.message);
          return;
        }
      }

      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    } catch (error: any) {
      setErro('Erro ao salvar: ' + error.message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-slate-500">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Perfil da Loja</h2>
        <p className="text-slate-500">Customize a aparência da sua página de agendamento</p>
      </header>

      <div className="max-w-4xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          {erro && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {sucesso && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 font-semibold">✓ Alterações salvas com sucesso!</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* SEÇÃO 1: IMAGEM DE CAPA */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Image size={24} className="text-indigo-600" />
                Imagem de Capa
              </h3>

              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer relative group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {uploadingImage && (
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-slate-600 font-medium">Enviando imagem...</p>
                  </div>
                )}

                {!uploadingImage && imagePreview ? (
                  <div className="space-y-4 pointer-events-none">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <p className="text-sm text-slate-600">Clique para trocar a imagem</p>
                  </div>
                ) : !uploadingImage ? (
                  <div className="space-y-2 pointer-events-none">
                    <div className="flex justify-center">
                      <div className="p-3 bg-indigo-100 rounded-full group-hover:bg-indigo-200 transition-colors">
                        <Image size={32} className="text-indigo-600" />
                      </div>
                    </div>
                    <p className="text-slate-700 font-medium">Clique ou arraste para adicionar</p>
                    <p className="text-xs text-slate-500">PNG, JPG ou GIF (máx 5MB)</p>
                  </div>
                ) : null}
              </div>

              {imagePreview && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleRemoverImagem}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                    Remover Imagem
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-600 mt-3">
                💡 Esta imagem será exibida no topo da sua página de agendamento e salva permanentemente no Supabase.
              </p>
            </div>

            {/* SEÇÃO 2: COR DO TEMA */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Palette size={24} className="text-indigo-600" />
                Cor do Tema
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Escolha a cor principal
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      name="cor_tema"
                      value={formData.cor_tema}
                      onChange={handleChange}
                      className="w-24 h-24 border-2 border-slate-300 rounded-lg cursor-pointer"
                    />
                    <div>
                      <p className="text-sm text-slate-600 mb-2">Valor hex:</p>
                      <input
                        type="text"
                        value={formData.cor_tema}
                        onChange={(e) => setFormData(prev => ({...prev, cor_tema: e.target.value}))}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-3">Pré-visualização:</p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      style={{ backgroundColor: formData.cor_tema }}
                      className="w-full py-3 text-white font-bold rounded-lg transition-all hover:shadow-lg"
                    >
                      Botão Agendar
                    </button>
                    <div
                      style={{ backgroundColor: formData.cor_tema }}
                      className="w-full h-12 rounded-lg"
                    ></div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 mt-4">
                💡 Esta cor será usada nos botões e destaque da sua página
              </p>
            </div>

            {/* SEÇÃO 3: DESCRIÇÃO */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Type size={24} className="text-indigo-600" />
                Descrição da Loja
              </h3>

              <label className="block text-sm font-medium text-slate-700 mb-2">
                Texto de boas-vindas
              </label>
              <textarea
                name="descricao_loja"
                value={formData.descricao_loja}
                onChange={handleChange}
                placeholder="Descreva sua loja, serviços e o que torna você especial..."
                rows={5}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />

              <p className="text-xs text-slate-600 mt-2">
                💡 Este texto será exibido na página de agendamento
              </p>
            </div>

            {/* SEÇÃO 4: REDES SOCIAIS */}
            <div className="pb-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Share2 size={24} className="text-indigo-600" />
                Redes Sociais
              </h3>

              <p className="text-sm text-slate-600 mb-4">
                Adicione links das suas redes sociais (deixe em branco se não tiver)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Facebook */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    🔵 Facebook
                  </label>
                  <input
                    type="url"
                    name="facebook_url"
                    value={formData.facebook_url}
                    onChange={handleChange}
                    placeholder="https://facebook.com/seu-perfil"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* Instagram */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    📸 Instagram
                  </label>
                  <input
                    type="url"
                    name="instagram_url"
                    value={formData.instagram_url}
                    onChange={handleChange}
                    placeholder="https://instagram.com/seu-perfil"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* LinkedIn */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    💼 LinkedIn
                  </label>
                  <input
                    type="url"
                    name="linkedin_url"
                    value={formData.linkedin_url}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/company/sua-empresa"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* TikTok */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    🎵 TikTok
                  </label>
                  <input
                    type="url"
                    name="tiktok_url"
                    value={formData.tiktok_url}
                    onChange={handleChange}
                    placeholder="https://tiktok.com/@seu-usuario"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* YouTube */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    ▶️ YouTube
                  </label>
                  <input
                    type="url"
                    name="youtube_url"
                    value={formData.youtube_url}
                    onChange={handleChange}
                    placeholder="https://youtube.com/@seu-canal"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* INFORMAÇÕES IMPORTANTES */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-900 mb-2">ℹ️ Informações Importantes</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>✓ A imagem de capa será salva permanentemente no Supabase Storage</li>
                <li>✓ A cor do tema será aplicada nos botões e destaques</li>
                <li>✓ As redes sociais aparecerão com ícones clicáveis</li>
                <li>✓ Deixe em branco as redes que não tiver</li>
                <li>✓ Você pode remover a imagem a qualquer momento</li>
              </ul>
            </div>

            {/* Botão Salvar */}
            <div className="flex gap-3 pt-6 border-t border-slate-200">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={20} />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaginaLoja;