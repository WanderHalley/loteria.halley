// ============================================================
// js/app.js - LotoQuant Frontend v2.2 (+ Meus Jogos)
// ============================================================
const App = {
    currentPage: 'dashboard',
    currentGame: 'mega-sena',
    config: {
        backendUrl: localStorage.getItem('lotoquant_backend_url') || '',
        apiKey: localStorage.getItem('lotoquant_api_key') || ''
    },
    jogosConfig: {
        'mega-sena':      { nome: 'Mega-Sena',    min: 1,  max: 60, escolha: 6,  apiNome: 'megasena',       trevos: false },
        'lotofacil':      { nome: 'Lotofácil',     min: 1,  max: 25, escolha: 15, apiNome: 'lotofacil',      trevos: false },
        'lotomania':      { nome: 'Lotomania',     min: 0,  max: 99, escolha: 50, apiNome: 'lotomania',      trevos: false },
        'mais-milionaria':{ nome: '+Milionária',   min: 1,  max: 50, escolha: 6,  apiNome: 'maismilionaria', trevos: true, trevosMin:1, trevosMax:6, trevosEscolha:2 }
    },

    // Armazena último resultado de previsões/validação/fechamento para "Salvar Jogo"
    _lastPrevisoes: [],
    _lastValidacao: null,
    _lastFechamento: [],

    // ========================================
    // HELPER: Parse arrays que vem como string
    // ========================================
    parseArray(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch(e) { return []; }
        }
        return [];
    },

    // ========================================
    // MEUS JOGOS: Storage
    // ========================================
    getMeusJogos() {
        try {
            return JSON.parse(localStorage.getItem('lotoquant_meus_jogos') || '[]');
        } catch(e) { return []; }
    },
    salvarMeusJogos(jogos) {
        localStorage.setItem('lotoquant_meus_jogos', JSON.stringify(jogos));
    },
    gerarId() {
        return 'jogo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    },

    // ========================================
    // INIT
    // ========================================
    init() {
        this.setupNavigation();
        this.setupGameSelector();
        this.setupButtons();
        this.setupConfig();
        this.setupMeusJogos();
        this.showPage('dashboard');
        if (this.config.backendUrl) {
            this.loadDashboard();
        }
    },

    // ========================================
    // NAVIGATION
    // ========================================
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.getAttribute('data-page');
                this.showPage(page);
            });
        });
    },
    showPage(page) {
        this.currentPage = page;
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
        document.getElementById(`page-${page}`)?.classList.add('active');
        if (page === 'meus-jogos') {
            this.renderMeusJogos();
        }
    },

    // ========================================
    // GAME SELECTOR
    // ========================================
    setupGameSelector() {
        const selector = document.getElementById('game-selector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.currentGame = e.target.value;
                if (this.config.backendUrl) { this.loadDashboard(); }
            });
        }
    },

    // ========================================
    // CONFIG
    // ========================================
    setupConfig() {
        const urlInput = document.getElementById('config-backend-url');
        const keyInput = document.getElementById('config-api-key');
        const saveBtn  = document.getElementById('btn-save-config');
        if (urlInput) urlInput.value = this.config.backendUrl;
        if (keyInput) keyInput.value = this.config.apiKey;
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const url = document.getElementById('config-backend-url')?.value?.trim().replace(/\/+$/, '');
                const key = document.getElementById('config-api-key')?.value?.trim();
                if (url) {
                    this.config.backendUrl = url;
                    this.config.apiKey = key || '';
                    localStorage.setItem('lotoquant_backend_url', url);
                    localStorage.setItem('lotoquant_api_key', key || '');
                    this.showNotification('Configuração salva com sucesso!', 'success');
                    this.loadDashboard();
                } else {
                    this.showNotification('Preencha a URL do backend', 'error');
                }
            });
        }
    },

    // ========================================
    // BUTTONS
    // ========================================
    setupButtons() {
        document.getElementById('btn-analise')?.addEventListener('click', () => this.executarAnalise());
        document.getElementById('btn-previsoes')?.addEventListener('click', () => this.gerarPrevisoes());
        document.getElementById('btn-validar')?.addEventListener('click', () => this.validarJogo());
        document.getElementById('btn-fechamento')?.addEventListener('click', () => this.gerarFechamento());
        document.getElementById('btn-backtest')?.addEventListener('click', () => this.executarBacktest());
        document.getElementById('btn-alertas')?.addEventListener('click', () => this.verificarAlertas());
        document.getElementById('btn-inserir')?.addEventListener('click', () => this.inserirResultado());
        document.getElementById('btn-importar-todos')?.addEventListener('click', () => this.importarHistoricoProxy());
        document.getElementById('btn-importar-jogo')?.addEventListener('click', () => this.importarJogoIndividual());
        document.getElementById('btn-atualizar')?.addEventListener('click', () => this.forcarAtualizacao());
    },

    // ========================================
    // API REQUEST
    // ========================================
    async apiRequest(endpoint, options = {}) {
        if (!this.config.backendUrl) {
            this.showNotification('Configure a URL do backend primeiro!', 'error');
            throw new Error('Backend URL não configurada');
        }
        const url = this.config.backendUrl + endpoint;
        const headers = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) { headers['x-api-key'] = this.config.apiKey; }
        const resp = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: resp.statusText }));
            throw new Error(err.detail || `Erro ${resp.status}`);
        }
        return resp.json();
    },

    // ========================================
    // DASHBOARD
    // ========================================
    async loadDashboard() {
        const container = document.getElementById('dashboard-content');
        if (!container) return;
        try {
            container.innerHTML = '<p style="color:#888;text-align:center;">Carregando dashboard...</p>';
            const data = await this.apiRequest(`/api/resultados/?jogo_slug=${this.currentGame}&limit=10`);
            let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#00d4ff;">${data.total || 0}</p>
                    <p style="color:#888;font-size:13px;">Total de Concursos</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#00ff88;">${data.resultados?.[0]?.concurso || '-'}</p>
                    <p style="color:#888;font-size:13px;">Último Concurso</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#feca57;">${data.resultados?.[0]?.data_sorteio || '-'}</p>
                    <p style="color:#888;font-size:13px;">Data do Último Sorteio</p>
                </div>
            </div>
            <h3 style="color:#e0e0e0;margin-bottom:12px;">Últimos 10 Resultados</h3>`;
            if (data.resultados && data.resultados.length > 0) {
                html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#0d0d1a;"><th style="padding:10px;color:#00d4ff;text-align:left;">Concurso</th><th style="padding:10px;color:#00d4ff;text-align:left;">Data</th><th style="padding:10px;color:#00d4ff;text-align:left;">Números</th><th style="padding:10px;color:#00d4ff;text-align:right;">Prêmio</th></tr></thead><tbody>';
                for (const r of data.resultados) {
                    const nums = this.parseArray(r.numeros).map(n => `<span style="background:#00d4ff;color:#0d0d1a;padding:2px 7px;border-radius:50%;font-size:13px;font-weight:bold;margin:1px;">${String(n).padStart(2,'0')}</span>`).join(' ');
                    const trevosArr = this.parseArray(r.trevos);
                    const trevos = trevosArr.length > 0 ? ' + ' + trevosArr.map(t => `<span style="background:#feca57;color:#0d0d1a;padding:2px 7px;border-radius:50%;font-size:13px;font-weight:bold;margin:1px;">${t}</span>`).join(' ') : '';
                    const premio = r.premio_principal ? `R$ ${Number(r.premio_principal).toLocaleString('pt-BR', {minimumFractionDigits:2})}` : '-';
                    html += `<tr style="border-bottom:1px solid #222;"><td style="padding:10px;color:#e0e0e0;">${r.concurso}</td><td style="padding:10px;color:#e0e0e0;">${r.data_sorteio || '-'}</td><td style="padding:10px;">${nums}${trevos}</td><td style="padding:10px;color:#00ff88;text-align:right;">${premio}</td></tr>`;
                }
                html += '</tbody></table></div>';
            } else {
                html += '<p style="color:#888;text-align:center;padding:40px;">Nenhum resultado encontrado. Importe os dados na aba "Inserir Dados".</p>';
            }
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div style="text-align:center;padding:40px;"><p style="color:#e74c3c;font-size:18px;">❌ Erro ao carregar dashboard: ${err.message}</p><p style="color:#888;margin-top:8px;">Verifique a configuração do backend na aba "Inserir Dados".</p></div>`;
        }
    },

    // ========================================
    // ANÁLISE IA
    // ========================================
    async executarAnalise() {
        const container = document.getElementById('analise-content');
        if (!container) return;
        try {
            container.innerHTML = '<p style="color:#888;text-align:center;">Executando análise com 6 modelos de IA...</p>';
            const data = await this.apiRequest(`/api/analises/completa?jogo_slug=${this.currentGame}`);
            let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px;">
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#00d4ff;">${data.total_concursos}</p>
                    <p style="color:#888;font-size:13px;">Concursos Analisados</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#00ff88;">${data.ultimo_concurso}</p>
                    <p style="color:#888;font-size:13px;">Último Concurso</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#feca57;">${data.modelos_usados?.length || 6}</p>
                    <p style="color:#888;font-size:13px;">Modelos de IA</p>
                </div>
            </div>
            <h3 style="color:#e0e0e0;margin-bottom:12px;">🔥 Top 15 Números Quentes</h3>
            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px;">`;
            for (const n of (data.top_quentes || [])) {
                const cor = n.classificacao === 'quente' ? '#e74c3c' : n.classificacao === 'morno' ? '#f39c12' : '#3498db';
                html += `<div style="background:#1a1a2e;border-left:4px solid ${cor};padding:12px;border-radius:8px;min-width:120px;">
                    <p style="font-size:24px;font-weight:bold;color:${cor};">${String(n.numero).padStart(2,'0')}</p>
                    <p style="color:#e0e0e0;font-size:13px;">${(n.score*100).toFixed(1)}%</p>
                    <p style="color:#888;font-size:11px;">${n.classificacao}</p>
                    <p style="color:#666;font-size:10px;">Freq: ${(n.frequencia_recente*100).toFixed(1)}% | Atraso: ${n.atraso}</p>
                </div>`;
            }
            html += '</div>';
            html += '<h3 style="color:#e0e0e0;margin-bottom:12px;">❄️ Top 10 Números Frios</h3><div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px;">';
            for (const n of (data.top_frios || [])) {
                html += `<div style="background:#1a1a2e;border-left:4px solid #3498db;padding:12px;border-radius:8px;min-width:100px;">
                    <p style="font-size:20px;font-weight:bold;color:#3498db;">${String(n.numero).padStart(2,'0')}</p>
                    <p style="color:#e0e0e0;font-size:13px;">${(n.score*100).toFixed(1)}%</p>
                    <p style="color:#888;font-size:11px;">${n.classificacao}</p>
                </div>`;
            }
            html += '</div>';
            if (data.pares_frequentes) {
                html += '<h3 style="color:#e0e0e0;margin-bottom:12px;">👯 Pares Mais Frequentes</h3><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">';
                const pares = Object.entries(data.pares_frequentes).slice(0, 15);
                for (const [par, freq] of pares) {
                    html += `<div style="background:#1a1a2e;padding:8px 14px;border-radius:8px;border:1px solid #333;">
                        <span style="color:#00d4ff;">${par}</span> <span style="color:#888;">${freq}x</span>
                    </div>`;
                }
                html += '</div>';
            }
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:20px;">❌ ${err.message}</p>`;
        }
    },

    // ========================================
    // PREVISÕES (com botão Salvar Jogo)
    // ========================================
    async gerarPrevisoes() {
        const container = document.getElementById('previsoes-content');
        if (!container) return;
        const qtd = parseInt(document.getElementById('qtd-previsoes')?.value || '5');
        try {
            container.innerHTML = '<p style="color:#888;text-align:center;">Gerando previsões com ensemble de 6 modelos...</p>';
            const data = await this.apiRequest('/api/previsoes/gerar', {
                method: 'POST',
                body: JSON.stringify({ jogo_slug: this.currentGame, quantidade_jogos: qtd })
            });
            this._lastPrevisoes = (data.previsoes || []).map(p => ({
                numeros: this.parseArray(p.numeros),
                trevos: this.parseArray(p.trevos),
                confianca: p.confianca || 0,
                score: p.score || 0,
                jogo_slug: this.currentGame
            }));

            let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#00d4ff;">${data.total_concursos_analisados}</p>
                    <p style="color:#888;font-size:13px;">Concursos Analisados</p>
                </div>
            </div>`;
            html += '<div style="display:grid;gap:16px;">';
            data.previsoes?.forEach((p, i) => {
                const nums = this.parseArray(p.numeros).map(n => `<span style="background:#00d4ff;color:#0d0d1a;padding:4px 10px;border-radius:50%;font-weight:bold;font-size:15px;margin:2px;">${String(n).padStart(2,'0')}</span>`).join(' ');
                const trevosArr = this.parseArray(p.trevos);
                const trevos = trevosArr.length > 0 ? ' + ' + trevosArr.map(t => `<span style="background:#feca57;color:#0d0d1a;padding:4px 10px;border-radius:50%;font-weight:bold;font-size:15px;margin:2px;">${t}</span>`).join(' ') : '';
                const confCor = p.confianca > 70 ? '#27ae60' : p.confianca > 50 ? '#f39c12' : '#e74c3c';
                html += `<div style="background:#1a1a2e;padding:20px;border-radius:12px;border:1px solid #333;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h4 style="color:#e0e0e0;margin:0;">Jogo ${i+1}</h4>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="background:${confCor};color:#fff;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold;">${p.confianca}%</span>
                            <button onclick="App.salvarJogoDaPrevisao(${i})" style="background:#00d4ff;color:#0d0d1a;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;" title="Salvar em Meus Jogos">💾 Salvar</button>
                        </div>
                    </div>
                    <div style="margin-bottom:8px;">${nums}${trevos}</div>
                    <p style="color:#888;font-size:12px;">Score: ${p.score}</p>
                </div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:20px;">❌ ${err.message}</p>`;
        }
    },

    salvarJogoDaPrevisao(index) {
        const p = this._lastPrevisoes[index];
        if (!p) { this.showNotification('Previsão não encontrada', 'error'); return; }
        const cfg = this.jogosConfig[p.jogo_slug];
        const nome = `${cfg.nome} - Previsão ${index+1}`;
        this.adicionarJogoAoStorage(p.jogo_slug, nome, p.numeros, p.trevos, p.confianca);
    },

    // ========================================
    // VALIDAÇÃO (com botão Salvar Jogo)
    // ========================================
    async validarJogo() {
        const container = document.getElementById('validacao-content');
        if (!container) return;
        const numerosStr = document.getElementById('validar-numeros')?.value || '';
        const trevosStr  = document.getElementById('validar-trevos')?.value || '';
        const numeros = numerosStr.split(/[,\s]+/).filter(n => n).map(Number);
        const trevos  = trevosStr ? trevosStr.split(/[,\s]+/).filter(n => n).map(Number) : [];
        if (numeros.length === 0 || numeros.some(isNaN)) {
            this.showNotification('Preencha os números corretamente', 'error');
            return;
        }
        try {
            container.innerHTML = '<p style="color:#888;text-align:center;">Validando jogo...</p>';
            const data = await this.apiRequest('/api/validacao/validar-jogo', {
                method: 'POST',
                body: JSON.stringify({ jogo_slug: this.currentGame, numeros, trevos })
            });
            this._lastValidacao = {
                numeros: numeros,
                trevos: trevos,
                confianca: data.confianca || 0,
                jogo_slug: this.currentGame
            };

            const confCor = data.confianca > 70 ? '#27ae60' : data.confianca > 50 ? '#f39c12' : '#e74c3c';
            let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:24px;">
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:2px solid ${confCor};">
                    <p style="font-size:36px;font-weight:bold;color:${confCor};">${data.confianca}%</p>
                    <p style="color:#888;font-size:13px;">Confiança</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:24px;font-weight:bold;color:#e0e0e0;">${data.classificacao}</p>
                    <p style="color:#888;font-size:13px;">Classificação</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:24px;font-weight:bold;color:#e0e0e0;">${data.distribuicao?.pares}P / ${data.distribuicao?.impares}I</p>
                    <p style="color:#888;font-size:13px;">Par/Ímpar</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:24px;font-weight:bold;color:#e0e0e0;">${data.distribuicao?.soma}</p>
                    <p style="color:#888;font-size:13px;">Soma</p>
                </div>
            </div>
            <div style="text-align:center;margin-bottom:24px;">
                <button onclick="App.salvarJogoDaValidacao()" style="background:#00d4ff;color:#0d0d1a;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;">💾 Salvar em Meus Jogos</button>
            </div>
            <h3 style="color:#e0e0e0;margin-bottom:12px;">Análise por Número</h3>
            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px;">`;
            for (const n of (data.numeros_analise || [])) {
                const cor = n.classificacao === 'quente' ? '#e74c3c' : n.classificacao === 'morno' ? '#f39c12' : '#3498db';
                html += `<div style="background:#1a1a2e;border-left:4px solid ${cor};padding:10px;border-radius:8px;min-width:80px;text-align:center;">
                    <p style="font-size:22px;font-weight:bold;color:${cor};">${String(n.numero).padStart(2,'0')}</p>
                    <p style="color:#e0e0e0;font-size:12px;">${(n.score*100).toFixed(1)}%</p>
                    <p style="color:#888;font-size:10px;">${n.classificacao}</p>
                </div>`;
            }
            html += '</div>';
            if (data.sugestoes_melhoria?.length > 0) {
                html += '<h3 style="color:#e0e0e0;margin-bottom:12px;">Sugestões de Melhoria</h3><div style="margin-bottom:24px;">';
                for (const s of data.sugestoes_melhoria) {
                    html += `<p style="color:#e0e0e0;padding:8px;background:#1a1a2e;border-radius:6px;margin-bottom:6px;">Trocar <span style="color:#e74c3c;font-weight:bold;">${String(s.trocar).padStart(2,'0')}</span> por <span style="color:#27ae60;font-weight:bold;">${String(s.por).padStart(2,'0')}</span> (ganho: +${(s.ganho_score*100).toFixed(1)}%)</p>`;
                }
                html += '</div>';
            }
            if (data.recomendacoes?.length > 0) {
                html += '<h3 style="color:#e0e0e0;margin-bottom:12px;">Recomendações</h3><div style="margin-bottom:24px;">';
                for (const r of data.recomendacoes) {
                    html += `<p style="color:#e0e0e0;padding:6px 0;">• ${r}</p>`;
                }
                html += '</div>';
            }
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:20px;">❌ ${err.message}</p>`;
        }
    },

    salvarJogoDaValidacao() {
        const v = this._lastValidacao;
        if (!v) { this.showNotification('Nenhuma validação para salvar', 'error'); return; }
        const cfg = this.jogosConfig[v.jogo_slug];
        const nome = `${cfg.nome} - Validado ${v.confianca}%`;
        this.adicionarJogoAoStorage(v.jogo_slug, nome, v.numeros, v.trevos, v.confianca);
    },

    // ========================================
    // FECHAMENTO (com botão Salvar Jogo)
    // ========================================
    async gerarFechamento() {
        const container = document.getElementById('fechamento-content');
        if (!container) return;
        const garantia = document.getElementById('fechamento-garantia')?.value || 'quadra';
        const tamanho  = parseInt(document.getElementById('fechamento-tamanho')?.value || '18');
        try {
            container.innerHTML = '<p style="color:#888;text-align:center;">Gerando fechamento combinatório...</p>';
            const data = await this.apiRequest(`/api/previsoes/fechamento?jogo_slug=${this.currentGame}&garantia=${garantia}&tamanho_universo=${tamanho}`, { method: 'POST' });
            this._lastFechamento = (data.jogos || []).map(j => ({
                numeros: this.parseArray(j.numeros),
                trevos: this.parseArray(j.trevos),
                confianca: j.score || 0,
                jogo_slug: this.currentGame
            }));

            let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:24px;">
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#00d4ff;">${data.total_jogos}</p>
                    <p style="color:#888;font-size:13px;">Total de Jogos</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#00ff88;">${data.tamanho_universo}</p>
                    <p style="color:#888;font-size:13px;">Universo</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#feca57;">${data.cobertura}%</p>
                    <p style="color:#888;font-size:13px;">Cobertura</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#e74c3c;">${data.garantia}</p>
                    <p style="color:#888;font-size:13px;">Garantia</p>
                </div>
            </div>`;
            html += `<h3 style="color:#e0e0e0;margin-bottom:12px;">Universo Selecionado</h3>
                <div style="margin-bottom:24px;">${(data.universo||[]).map(n => `<span style="background:#00d4ff;color:#0d0d1a;padding:4px 10px;border-radius:50%;font-weight:bold;font-size:15px;margin:2px;display:inline-block;">${String(n).padStart(2,'0')}</span>`).join(' ')}</div>`;
            html += '<h3 style="color:#e0e0e0;margin-bottom:12px;">Jogos Gerados</h3><div style="display:grid;gap:12px;">';
            (data.jogos||[]).forEach((j, i) => {
                const nums = this.parseArray(j.numeros).map(n => `<span style="background:#00d4ff;color:#0d0d1a;padding:3px 8px;border-radius:50%;font-weight:bold;font-size:13px;margin:1px;">${String(n).padStart(2,'0')}</span>`).join(' ');
                const trevosArr = this.parseArray(j.trevos);
                const trevos = trevosArr.length > 0 ? ' + ' + trevosArr.map(t => `<span style="background:#feca57;color:#0d0d1a;padding:3px 8px;border-radius:50%;font-weight:bold;font-size:13px;margin:1px;">${t}</span>`).join(' ') : '';
                html += `<div style="background:#1a1a2e;padding:14px;border-radius:10px;border:1px solid #333;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div><strong style="color:#888;">Jogo ${i+1}</strong> ${nums}${trevos} <span style="color:#888;font-size:12px;margin-left:8px;">Score: ${j.score}</span></div>
                    <button onclick="App.salvarJogoDoFechamento(${i})" style="background:#00d4ff;color:#0d0d1a;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;" title="Salvar em Meus Jogos">💾</button>
                </div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:20px;">❌ ${err.message}</p>`;
        }
    },

    salvarJogoDoFechamento(index) {
        const j = this._lastFechamento[index];
        if (!j) { this.showNotification('Jogo não encontrado', 'error'); return; }
        const cfg = this.jogosConfig[j.jogo_slug];
        const nome = `${cfg.nome} - Fechamento ${index+1}`;
        this.adicionarJogoAoStorage(j.jogo_slug, nome, j.numeros, j.trevos, j.confianca);
    },

    // ========================================
    // BACKTESTING
    // ========================================
    async executarBacktest() {
        const container = document.getElementById('backtest-content');
        if (!container) return;
        const concursos = parseInt(document.getElementById('backtest-concursos')?.value || '50');
        const cartelas  = parseInt(document.getElementById('backtest-cartelas')?.value || '3');
        try {
            container.innerHTML = '<p style="color:#888;text-align:center;">Executando backtesting... Pode levar alguns minutos.</p>';
            const data = await this.apiRequest('/api/backtesting/executar', {
                method: 'POST',
                body: JSON.stringify({ jogo_slug: this.currentGame, concursos_teste: concursos, cartelas_por_concurso: cartelas })
            });
            let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px;">
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#00d4ff;">${data.concursos_testados}</p>
                    <p style="color:#888;font-size:13px;">Concursos Testados</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#00ff88;">${data.total_cartelas}</p>
                    <p style="color:#888;font-size:13px;">Total Cartelas</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#feca57;">${data.taxa_4_acertos}%</p>
                    <p style="color:#888;font-size:13px;">Taxa 4 Acertos</p>
                </div>
                <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;">
                    <p style="font-size:28px;font-weight:bold;color:#e74c3c;">${data.taxa_5_acertos}%</p>
                    <p style="color:#888;font-size:13px;">Taxa 5 Acertos</p>
                </div>
            </div>
            <h3 style="color:#e0e0e0;margin-bottom:12px;">Distribuição de Acertos</h3>
            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px;">`;
            if (data.distribuicao_acertos) {
                for (const [acertos, qtd] of Object.entries(data.distribuicao_acertos)) {
                    if (qtd > 0) {
                        html += `<div style="background:#1a1a2e;padding:16px;border-radius:10px;text-align:center;min-width:100px;border:1px solid #333;">
                            <p style="font-size:24px;font-weight:bold;color:#00d4ff;">${acertos}</p>
                            <p style="color:#888;font-size:11px;">acertos</p>
                            <p style="color:#00ff88;font-size:18px;font-weight:bold;">${qtd}x</p>
                        </div>`;
                    }
                }
            }
            html += '</div>';
            if (data.melhores_resultados?.length > 0) {
                html += '<h3 style="color:#e0e0e0;margin-bottom:12px;">Melhores Resultados</h3><div style="display:grid;gap:8px;margin-bottom:24px;">';
                for (const m of data.melhores_resultados) {
                    html += `<div style="background:#1a1a2e;padding:12px;border-radius:8px;border:1px solid #333;display:flex;justify-content:space-between;align-items:center;">
                        <span style="color:#e0e0e0;">Concurso ${m.concurso}</span>
                        <span style="color:#27ae60;font-weight:bold;">${m.acertos} acertos</span>
                        <span style="color:#888;font-size:12px;">${(m.sorteados||[]).map(n => String(n).padStart(2,'0')).join(', ')}</span>
                    </div>`;
                }
                html += '</div>';
            }
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:20px;">❌ ${err.message}</p>`;
        }
    },

    // ========================================
    // ALERTAS
    // ========================================
    async verificarAlertas() {
        const container = document.getElementById('alertas-content');
        if (!container) return;
        try {
            container.innerHTML = '<p style="color:#888;text-align:center;">Verificando alertas...</p>';
            const data = await this.apiRequest(`/api/alertas/verificar?jogo_slug=${this.currentGame}`, { method: 'POST' });
            if (!data.alertas || data.alertas.length === 0) {
                container.innerHTML = '<p style="color:#27ae60;text-align:center;padding:40px;font-size:18px;">✅ Nenhum alerta no momento.</p>';
                return;
            }
            let html = `<div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;border:1px solid #333;margin-bottom:24px;">
                <p style="font-size:28px;font-weight:bold;color:#e74c3c;">${data.total}</p>
                <p style="color:#888;font-size:13px;">Alertas Encontrados</p>
            </div><div style="display:grid;gap:12px;">`;
            for (const a of data.alertas) {
                const icon = a.tipo === 'atraso_critico' ? '⏰' : a.tipo === 'score_alto' ? '🔥' : '📊';
                const cor  = a.tipo === 'atraso_critico' ? '#e74c3c' : '#27ae60';
                html += `<div style="background:#1a1a2e;border-left:4px solid ${cor};padding:14px;border-radius:8px;">
                    <p style="color:#e0e0e0;">${icon} ${a.mensagem}</p>
                </div>`;
            }
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:20px;">❌ ${err.message}</p>`;
        }
    },

    // ========================================
    // INSERIR RESULTADO MANUAL
    // ========================================
    async inserirResultado() {
        const concurso   = parseInt(document.getElementById('inserir-concurso')?.value);
        const data       = document.getElementById('inserir-data')?.value;
        const numerosStr = document.getElementById('inserir-numeros')?.value || '';
        const trevosStr  = document.getElementById('inserir-trevos')?.value || '';
        const premio     = parseFloat(document.getElementById('inserir-premio')?.value || '0');
        const acumulou   = document.getElementById('inserir-acumulou')?.checked || false;
        const numeros = numerosStr.split(/[,\s]+/).filter(n => n).map(Number);
        const trevos  = trevosStr ? trevosStr.split(/[,\s]+/).filter(n => n).map(Number) : [];
        if (!concurso || !data || numeros.length === 0) {
            this.showNotification('Preencha todos os campos obrigatórios', 'error');
            return;
        }
        try {
            await this.apiRequest('/api/resultados/', {
                method: 'POST',
                body: JSON.stringify({ jogo_slug: this.currentGame, concurso, data_sorteio: data, numeros, trevos, premio_principal: premio, acumulou })
            });
            this.showNotification(`Concurso ${concurso} inserido com sucesso!`, 'success');
            this.loadDashboard();
        } catch (err) {
            this.showNotification(`Erro: ${err.message}`, 'error');
        }
    },

    // ========================================
    // IMPORTAR JOGO INDIVIDUAL
    // ========================================
    async importarJogoIndividual() {
        const jogo = document.getElementById('import-jogo-select')?.value || this.currentGame;
        const desdeAno = parseInt(document.getElementById('import-desde')?.value || '2022');
        await this.importarUmJogo(jogo, desdeAno, document.getElementById('import-status'));
        this.loadDashboard();
    },

    // ========================================
    // IMPORTAR HISTÓRICO VIA PROXY
    // ========================================
    async importarHistoricoProxy() {
        const btn = document.getElementById('btn-importar-todos');
        const statusEl = document.getElementById('import-status');
        if (!btn) return;
        const desdeAno = parseInt(document.getElementById('import-desde')?.value || '2022');
        btn.disabled = true;
        btn.textContent = 'Importando...';
        const jogos = ['mega-sena','lotofacil','lotomania','mais-milionaria'];
        let totalGeral = 0;
        let resultadoHtml = '';
        for (const jogo of jogos) {
            const resultado = await this.importarUmJogo(jogo, desdeAno, statusEl, resultadoHtml);
            resultadoHtml = resultado.html;
            totalGeral += resultado.inseridos;
        }
        resultadoHtml += `<p style="color:#00d4ff;font-weight:bold;margin-top:12px;">📊 Total importado: ${totalGeral} concursos</p>`;
        if (statusEl) statusEl.innerHTML = resultadoHtml;
        btn.disabled = false;
        btn.textContent = 'Importar Todos os Jogos';
        this.showNotification(`Importação concluída! ${totalGeral} concursos importados.`, 'success');
        this.loadDashboard();
    },

    async importarUmJogo(jogo, desdeAno, statusEl, prevHtml = '') {
        const apiNomes = { 'mega-sena':'megasena','lotofacil':'lotofacil','lotomania':'lotomania','mais-milionaria':'maismilionaria' };
        const estimativas = {
    'mega-sena':       {1996:1, 2000:150, 2005:500, 2010:1150, 2015:1700, 2018:2000, 2019:2100, 2020:2200, 2021:2330, 2022:2460, 2023:2600, 2024:2750, 2025:2880},
    'lotofacil':       {1996:1, 2000:1, 2003:1, 2005:200, 2010:800, 2015:1200, 2018:1600, 2019:1700, 2020:1900, 2021:2100, 2022:2400, 2023:2700, 2024:3100, 2025:3400},
    'lotomania':       {1996:1, 1999:1, 2000:50, 2005:500, 2010:1050, 2015:1550, 2018:1800, 2019:1900, 2020:2050, 2021:2150, 2022:2300, 2023:2450, 2024:2600, 2025:2750},
    'mais-milionaria': {1996:1, 2000:1, 2005:1, 2010:1, 2015:1, 2018:1, 2019:1, 2020:1, 2021:1, 2022:1, 2023:50, 2024:150, 2025:250}
};
        const caixaBase = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
        const apiNome = apiNomes[jogo];
        let resultadoHtml = prevHtml;
        let inseridos = 0;
        const updateStatus = (msg) => { if (statusEl) statusEl.innerHTML = msg; };
        try {
            updateStatus(resultadoHtml + `<p style="color:#888;">🔄 ${jogo}: buscando último concurso...</p>`);
            const respUltimo = await fetch(`${caixaBase}/${apiNome}`);
            if (!respUltimo.ok) {
                resultadoHtml += `<p style="color:#f39c12;">⚠️ ${jogo}: API da Caixa retornou ${respUltimo.status}</p>`;
                return { html: resultadoHtml, inseridos: 0 };
            }
            const dataUltimo = await respUltimo.json();
            const ultimoCaixa = dataUltimo.numero;
            let ultimoDB = 0;
            try { const respDB = await this.apiRequest(`/api/resultados/ultimo?jogo_slug=${jogo}`); ultimoDB = respDB.ultimo?.concurso || 0; } catch(e) { ultimoDB = 0; }
            const estJogo = estimativas[jogo] || {};
            const desdeConc = estJogo[desdeAno] || 1;
            const inicio = Math.max(desdeConc, ultimoDB + 1);
            if (inicio > ultimoCaixa) {
                resultadoHtml += `<p style="color:#27ae60;">✅ ${jogo}: já atualizado (concurso ${ultimoDB})</p>`;
                updateStatus(resultadoHtml);
                return { html: resultadoHtml, inseridos: 0 };
            }
            const totalConc = ultimoCaixa - inicio + 1;
            updateStatus(resultadoHtml + `<p style="color:#888;">🔄 ${jogo}: importando ${totalConc} concursos (${inicio} → ${ultimoCaixa})...</p>`);
            let batch = [];
            let erros = 0;
            for (let num = inicio; num <= ultimoCaixa; num++) {
                try {
                    const resp = await fetch(`${caixaBase}/${apiNome}/${num}`);
                    if (!resp.ok) { erros++; continue; }
                    const d = await resp.json();
                    batch.push({
                        concurso: d.numero || num,
                        data_sorteio: d.dataApuracao || '',
                        numeros: (d.listaDezenas || []).map(n => parseInt(n,10)),
                        trevos: (d.trevosSorteados || []).map(n => parseInt(n,10)),
                        premio_principal: d.listaRateioPremio?.[0]?.valorPremio || 0,
                        acumulou: d.acumulado || false
                    });
                    if (batch.length >= 30) {
                        try {
                            await this.apiRequest('/api/importar-proxy', { method:'POST', body:JSON.stringify({jogo_slug:jogo,resultados:batch}) });
                            inseridos += batch.length;
                        } catch(e) { erros += batch.length; console.error(`Erro batch ${jogo}:`, e); }
                        batch = [];
                        updateStatus(resultadoHtml + `<p style="color:#888;">🔄 ${jogo}: ${inseridos}/${totalConc} importados...</p>`);
                    }
                    if (num % 5 === 0) await new Promise(r => setTimeout(r, 150));
                } catch(e) { erros++; }
            }
            if (batch.length > 0) {
                try { await this.apiRequest('/api/importar-proxy', { method:'POST', body:JSON.stringify({jogo_slug:jogo,resultados:batch}) }); inseridos += batch.length; }
                catch(e) { erros += batch.length; }
            }
            resultadoHtml += `<p style="color:#27ae60;">✅ ${jogo}: ${inseridos} concursos importados${erros > 0 ? ` (${erros} erros)` : ''}</p>`;
            updateStatus(resultadoHtml);
        } catch(err) {
            resultadoHtml += `<p style="color:#e74c3c;">❌ ${jogo}: ${err.message}</p>`;
            updateStatus(resultadoHtml);
        }
        return { html: resultadoHtml, inseridos };
    },

    // ========================================
    // FORÇAR ATUALIZAÇÃO (via proxy)
    // ========================================
    async forcarAtualizacao() {
        const btn = document.getElementById('btn-atualizar');
        const statusEl = document.getElementById('update-status');
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = 'Atualizando...';
        await this.atualizarViaProxy(statusEl);
        btn.disabled = false;
        btn.textContent = 'Forçar Atualização';
        // Recalcular confiança dos jogos salvos após atualizar
        this.recalcularConfiancaTodos();
        this.loadDashboard();
    },

    async atualizarViaProxy(statusEl) {
        const caixaBase = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
        const apiNomes = { 'mega-sena':'megasena','lotofacil':'lotofacil','lotomania':'lotomania','mais-milionaria':'maismilionaria' };
        let html = '';
        for (const [jogo, apiNome] of Object.entries(apiNomes)) {
            try {
                const resp = await fetch(`${caixaBase}/${apiNome}`);
                if (!resp.ok) { html += `<p style="color:#f39c12;">⚠️ ${jogo}: erro ${resp.status}</p>`; continue; }
                const d = await resp.json();
                const concurso = d.numero;
                let ultimoDB = 0;
                try { const rDB = await this.apiRequest(`/api/resultados/ultimo?jogo_slug=${jogo}`); ultimoDB = rDB.ultimo?.concurso || 0; } catch(e){}
                if (concurso <= ultimoDB) {
                    html += `<p style="color:#888;">➡️ ${jogo}: já atualizado (${ultimoDB})</p>`;
                } else {
                    await this.apiRequest('/api/importar-proxy', {
                        method:'POST',
                        body:JSON.stringify({jogo_slug:jogo,resultados:[{
                            concurso,
                            data_sorteio: d.dataApuracao || '',
                            numeros: (d.listaDezenas||[]).map(n => parseInt(n,10)),
                            trevos: (d.trevosSorteados||[]).map(n => parseInt(n,10)),
                            premio_principal: d.listaRateioPremio?.[0]?.valorPremio || 0,
                            acumulou: d.acumulado || false
                        }]})
                    });
                    html += `<p style="color:#27ae60;">✅ ${jogo}: atualizado para concurso ${concurso}</p>`;
                }
            } catch(e) { html += `<p style="color:#e74c3c;">❌ ${jogo}: ${e.message}</p>`; }
        }
        if (statusEl) statusEl.innerHTML = html;
        this.showNotification('Atualização concluída!', 'success');
    },

    // ================================================================
    // MEUS JOGOS — Módulo completo
    // ================================================================
    setupMeusJogos() {
        // Botão Adicionar
        document.getElementById('btn-adicionar-jogo')?.addEventListener('click', () => this.abrirModalJogo());
        // Botão Recalcular
        document.getElementById('btn-recalcular-confianca')?.addEventListener('click', () => this.recalcularConfiancaTodos());
        // Modal: Cancelar
        document.getElementById('btn-modal-cancelar')?.addEventListener('click', () => this.fecharModalJogo());
        // Modal: Salvar
        document.getElementById('btn-modal-salvar')?.addEventListener('click', () => this.salvarJogoDoModal());
        // Modal: Tipo muda → atualizar labels
        document.getElementById('mj-tipo')?.addEventListener('change', () => this.atualizarModalPorTipo());
        // Fechar modal clicando fora
        document.getElementById('modal-jogo')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal-jogo') this.fecharModalJogo();
        });
    },

    _editandoJogoId: null,

    abrirModalJogo(jogoExistente = null) {
        const modal = document.getElementById('modal-jogo');
        if (!modal) return;
        this._editandoJogoId = jogoExistente ? jogoExistente.id : null;
        document.getElementById('modal-jogo-titulo').textContent = jogoExistente ? '✏️ Editar Jogo' : '➕ Adicionar Jogo';
        document.getElementById('mj-tipo').value = jogoExistente?.jogo_slug || this.currentGame;
        document.getElementById('mj-nome').value = jogoExistente?.nome || '';
        document.getElementById('mj-numeros').value = jogoExistente ? jogoExistente.numeros.join(', ') : '';
        document.getElementById('mj-trevos').value = jogoExistente?.trevos?.length > 0 ? jogoExistente.trevos.join(', ') : '';
        document.getElementById('mj-validacao-msg').style.display = 'none';
        // Se editando, desabilitar tipo
        document.getElementById('mj-tipo').disabled = !!jogoExistente;
        this.atualizarModalPorTipo();
        modal.style.display = 'flex';
    },

    fecharModalJogo() {
        const modal = document.getElementById('modal-jogo');
        if (modal) modal.style.display = 'none';
        this._editandoJogoId = null;
        document.getElementById('mj-tipo').disabled = false;
    },

    atualizarModalPorTipo() {
        const tipo = document.getElementById('mj-tipo')?.value || 'mega-sena';
        const cfg = this.jogosConfig[tipo];
        const label = document.getElementById('mj-numeros-label');
        const hint = document.getElementById('mj-numeros-hint');
        const trevosContainer = document.getElementById('mj-trevos-container');
        if (label) label.textContent = `Números (${cfg.escolha} números de ${String(cfg.min).padStart(2,'0')} a ${String(cfg.max).padStart(2,'0')})`;
        if (hint) {
            const placeholders = {
                'mega-sena': 'Ex: 04, 15, 23, 38, 45, 52',
                'lotofacil': 'Ex: 01, 02, 03, 05, 07, 08, 10, 11, 13, 14, 17, 18, 20, 22, 25',
                'lotomania': 'Ex: 00, 05, 12, 18, 23, 31, 37, 42, 49, 55, 61, 67, 73, 78, 84, 88, 90, 93, 96, 99',
                'mais-milionaria': 'Ex: 04, 15, 23, 28, 35, 42'
            };
            document.getElementById('mj-numeros').placeholder = placeholders[tipo] || '';
            hint.textContent = `Separados por vírgula ou espaço. ${tipo === 'lotomania' ? 'Escolha 20 números.' : ''}`;
        }
        if (trevosContainer) {
            trevosContainer.style.display = cfg.trevos ? 'block' : 'none';
        }
    },

    validarNumerosJogo(tipo, numeros, trevos) {
        const cfg = this.jogosConfig[tipo];
        if (!cfg) return { valido: false, msg: 'Tipo de jogo inválido' };
        if (numeros.length !== cfg.escolha) {
            return { valido: false, msg: `Insira exatamente ${cfg.escolha} números. Você colocou ${numeros.length}.` };
        }
        for (const n of numeros) {
            if (isNaN(n) || n < cfg.min || n > cfg.max) {
                return { valido: false, msg: `Número ${n} fora da faixa (${cfg.min}-${cfg.max}).` };
            }
        }
        const unicos = new Set(numeros);
        if (unicos.size !== numeros.length) {
            return { valido: false, msg: 'Há números repetidos.' };
        }
        if (cfg.trevos) {
            if (!trevos || trevos.length !== cfg.trevosEscolha) {
                return { valido: false, msg: `Insira exatamente ${cfg.trevosEscolha} trevos.` };
            }
            for (const t of trevos) {
                if (isNaN(t) || t < cfg.trevosMin || t > cfg.trevosMax) {
                    return { valido: false, msg: `Trevo ${t} fora da faixa (${cfg.trevosMin}-${cfg.trevosMax}).` };
                }
            }
            const unicosTrevos = new Set(trevos);
            if (unicosTrevos.size !== trevos.length) {
                return { valido: false, msg: 'Há trevos repetidos.' };
            }
        }
        return { valido: true, msg: '' };
    },

    salvarJogoDoModal() {
        const tipo = document.getElementById('mj-tipo')?.value || 'mega-sena';
        const nome = document.getElementById('mj-nome')?.value?.trim() || '';
        const numerosStr = document.getElementById('mj-numeros')?.value || '';
        const trevosStr = document.getElementById('mj-trevos')?.value || '';
        const msgEl = document.getElementById('mj-validacao-msg');
        const numeros = numerosStr.split(/[,\s]+/).filter(n => n !== '').map(Number);
        const cfg = this.jogosConfig[tipo];
        const trevos = cfg.trevos && trevosStr ? trevosStr.split(/[,\s]+/).filter(n => n !== '').map(Number) : [];
        // Validar
        const v = this.validarNumerosJogo(tipo, numeros, trevos);
        if (!v.valido) {
            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.style.background = '#3d1515';
                msgEl.style.color = '#e74c3c';
                msgEl.textContent = '❌ ' + v.msg;
            }
            return;
        }
        if (!nome) {
            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.style.background = '#3d1515';
                msgEl.style.color = '#e74c3c';
                msgEl.textContent = '❌ Dê um nome ao seu jogo.';
            }
            return;
        }

        const jogos = this.getMeusJogos();
        const sortedNums = [...numeros].sort((a,b) => a - b);
        const sortedTrevos = [...trevos].sort((a,b) => a - b);

        if (this._editandoJogoId) {
            // Editar existente
            const idx = jogos.findIndex(j => j.id === this._editandoJogoId);
            if (idx >= 0) {
                jogos[idx].nome = nome;
                jogos[idx].numeros = sortedNums;
                jogos[idx].trevos = sortedTrevos;
                jogos[idx].atualizado_em = new Date().toISOString();
                jogos[idx].confianca = null; // Será recalculado
            }
        } else {
            // Novo jogo
            jogos.push({
                id: this.gerarId(),
                jogo_slug: tipo,
                nome: nome,
                numeros: sortedNums,
                trevos: sortedTrevos,
                confianca: null,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString()
            });
        }

        this.salvarMeusJogos(jogos);
        this.fecharModalJogo();
        this.renderMeusJogos();
        this.showNotification(`Jogo "${nome}" salvo com sucesso!`, 'success');

        // Tentar calcular confiança em background
        this.recalcularConfiancaJogo(jogos[jogos.length - 1]?.id || this._editandoJogoId);
    },

    adicionarJogoAoStorage(jogo_slug, nome, numeros, trevos, confianca) {
        const jogos = this.getMeusJogos();
        const sortedNums = [...numeros].sort((a,b) => a - b);
        const sortedTrevos = [...(trevos || [])].sort((a,b) => a - b);
        jogos.push({
            id: this.gerarId(),
            jogo_slug,
            nome,
            numeros: sortedNums,
            trevos: sortedTrevos,
            confianca: confianca || null,
            criado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString()
        });
        this.salvarMeusJogos(jogos);
        this.showNotification(`Jogo "${nome}" salvo em Meus Jogos!`, 'success');
        if (this.currentPage === 'meus-jogos') {
            this.renderMeusJogos();
        }
    },

    excluirJogo(id) {
        if (!confirm('Tem certeza que deseja excluir este jogo?')) return;
        let jogos = this.getMeusJogos();
        jogos = jogos.filter(j => j.id !== id);
        this.salvarMeusJogos(jogos);
        this.renderMeusJogos();
        this.showNotification('Jogo excluído.', 'info');
    },

    editarJogo(id) {
        const jogos = this.getMeusJogos();
        const jogo = jogos.find(j => j.id === id);
        if (jogo) this.abrirModalJogo(jogo);
    },

    async recalcularConfiancaJogo(id) {
        if (!this.config.backendUrl) return;
        const jogos = this.getMeusJogos();
        const jogo = jogos.find(j => j.id === id);
        if (!jogo) return;
        try {
            const data = await this.apiRequest('/api/validacao/validar-jogo', {
                method: 'POST',
                body: JSON.stringify({
                    jogo_slug: jogo.jogo_slug,
                    numeros: jogo.numeros,
                    trevos: jogo.trevos || []
                })
            });
            jogo.confianca = data.confianca || 0;
            jogo.atualizado_em = new Date().toISOString();
            this.salvarMeusJogos(jogos);
            if (this.currentPage === 'meus-jogos') this.renderMeusJogos();
        } catch(e) {
            console.error(`Erro ao recalcular confiança para ${jogo.nome}:`, e);
        }
    },

    async recalcularConfiancaTodos() {
        if (!this.config.backendUrl) {
            this.showNotification('Configure o backend primeiro', 'error');
            return;
        }
        const jogos = this.getMeusJogos();
        if (jogos.length === 0) {
            this.showNotification('Nenhum jogo salvo para recalcular.', 'info');
            return;
        }
        const btn = document.getElementById('btn-recalcular-confianca');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Recalculando...'; }
        let atualizados = 0;
        for (const jogo of jogos) {
            try {
                const data = await this.apiRequest('/api/validacao/validar-jogo', {
                    method: 'POST',
                    body: JSON.stringify({
                        jogo_slug: jogo.jogo_slug,
                        numeros: jogo.numeros,
                        trevos: jogo.trevos || []
                    })
                });
                jogo.confianca = data.confianca || 0;
                jogo.atualizado_em = new Date().toISOString();
                atualizados++;
            } catch(e) {
                console.error(`Erro: ${jogo.nome}`, e);
            }
        }
        this.salvarMeusJogos(jogos);
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Recalcular Confiança'; }
        this.renderMeusJogos();
        this.showNotification(`Confiança atualizada para ${atualizados} jogos!`, 'success');
    },

    renderMeusJogos() {
        const container = document.getElementById('meus-jogos-lista');
        const totalEl = document.getElementById('meus-jogos-total');
        if (!container) return;
        const jogos = this.getMeusJogos();
        if (totalEl) totalEl.textContent = `${jogos.length} jogo${jogos.length !== 1 ? 's' : ''} salvo${jogos.length !== 1 ? 's' : ''}`;

        if (jogos.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#666;">
                <p style="font-size:48px;margin-bottom:16px;">🎫</p>
                <p style="font-size:16px;">Nenhum jogo salvo ainda.</p>
                <p style="font-size:14px;margin-top:8px;">Clique em "Adicionar Jogo" ou salve jogos das abas Previsões, Validação e Fechamento.</p>
            </div>`;
            return;
        }

        // Agrupar por jogo_slug
        const grupos = {};
        for (const j of jogos) {
            if (!grupos[j.jogo_slug]) grupos[j.jogo_slug] = [];
            grupos[j.jogo_slug].push(j);
        }

        let html = '';
        const icones = { 'mega-sena':'🎯', 'lotofacil':'🍀', 'lotomania':'🔮', 'mais-milionaria':'💎' };
        const cores = { 'mega-sena':'#27ae60', 'lotofacil':'#9b59b6', 'lotomania':'#e67e22', 'mais-milionaria':'#00d4ff' };

        for (const [slug, lista] of Object.entries(grupos)) {
            const cfg = this.jogosConfig[slug];
            const icon = icones[slug] || '🎫';
            const cor = cores[slug] || '#00d4ff';

            html += `<div style="margin-bottom:8px;">
                <h3 style="color:${cor};margin-bottom:12px;">${icon} ${cfg?.nome || slug} (${lista.length})</h3>
            </div>`;

            for (const jogo of lista) {
                const nums = jogo.numeros.map(n => `<span style="background:${cor};color:#0d0d1a;padding:3px 8px;border-radius:50%;font-weight:bold;font-size:13px;margin:1px;display:inline-block;">${String(n).padStart(2,'0')}</span>`).join(' ');
                const trevosHtml = jogo.trevos?.length > 0 ? ' + ' + jogo.trevos.map(t => `<span style="background:#feca57;color:#0d0d1a;padding:3px 8px;border-radius:50%;font-weight:bold;font-size:13px;margin:1px;display:inline-block;">${t}</span>`).join(' ') : '';

                let confHtml = '';
                if (jogo.confianca !== null && jogo.confianca !== undefined) {
                    const confCor = jogo.confianca > 70 ? '#27ae60' : jogo.confianca > 50 ? '#f39c12' : '#e74c3c';
                    confHtml = `<div style="text-align:center;">
                        <div style="width:56px;height:56px;border-radius:50%;border:3px solid ${confCor};display:flex;align-items:center;justify-content:center;margin:0 auto 4px;">
                            <span style="color:${confCor};font-size:16px;font-weight:bold;">${jogo.confianca}%</span>
                        </div>
                        <span style="color:#888;font-size:10px;">Confiança</span>
                    </div>`;
                } else {
                    confHtml = `<div style="text-align:center;">
                        <div style="width:56px;height:56px;border-radius:50%;border:3px solid #444;display:flex;align-items:center;justify-content:center;margin:0 auto 4px;">
                            <span style="color:#444;font-size:14px;">—</span>
                        </div>
                        <span style="color:#666;font-size:10px;">Não calculado</span>
                    </div>`;
                }

                const dataFormatada = jogo.atualizado_em ? new Date(jogo.atualizado_em).toLocaleDateString('pt-BR') : '';

                html += `<div style="background:#1a1a2e;border-radius:12px;padding:16px;border:1px solid #333;display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
                    <div style="flex:1;min-width:200px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <strong style="color:#e0e0e0;font-size:15px;">${jogo.nome}</strong>
                        </div>
                        <div style="margin-bottom:6px;">${nums}${trevosHtml}</div>
                        <span style="color:#666;font-size:11px;">Atualizado: ${dataFormatada}</span>
                    </div>
                    ${confHtml}
                    <div style="display:flex;gap:6px;flex-direction:column;">
                        <button onclick="App.editarJogo('${jogo.id}')" style="background:#333;color:#e0e0e0;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;" title="Editar">✏️ Editar</button>
                        <button onclick="App.excluirJogo('${jogo.id}')" style="background:#3d1515;color:#e74c3c;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;" title="Excluir">🗑️ Excluir</button>
                    </div>
                </div>`;
            }
        }

        container.innerHTML = html;
    },

    // ========================================
    // NOTIFICATION
    // ========================================
    showNotification(msg, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        const div = document.createElement('div');
        div.className = `notification notification-${type}`;
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.classList.add('show'), 10);
        setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, 4000);
    }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
