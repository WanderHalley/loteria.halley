// ============================================================
// js/app.js - LotoQuant Frontend v3.0 (Corrigido + Inteligente)
// Compatível com Backend API v3.2.0 (8 modelos de IA)
// ============================================================
const App = {
    currentPage: 'dashboard',
    currentGame: 'mega-sena',
    config: {
        backendUrl: localStorage.getItem('lotoquant_backend_url') || '',
        apiKey: localStorage.getItem('lotoquant_api_key') || ''
    },
    jogosConfig: {
        'mega-sena':       { nome: 'Mega-Sena',     min: 1,  max: 60, escolha: 6,  escolhaMin: 6,  escolhaMax: 6,  apiNome: 'megasena',        trevos: false },
        'lotofacil':       { nome: 'Lotofácil',      min: 1,  max: 25, escolha: 15, escolhaMin: 15, escolhaMax: 20, apiNome: 'lotofacil',       trevos: false },
        'lotomania':       { nome: 'Lotomania',      min: 0,  max: 99, escolha: 20, escolhaMin: 1,  escolhaMax: 50, apiNome: 'lotomania',       trevos: false },
        'mais-milionaria': { nome: '+Milionária',    min: 1,  max: 50, escolha: 6,  escolhaMin: 6,  escolhaMax: 12, apiNome: 'maismilionaria',  trevos: true, trevosMin: 1, trevosMax: 6, trevosEscolha: 2 }
    },

    _lastPrevisoes: [],
    _lastValidacao: null,
    _lastFechamento: [],

    // ===================== HELPERS =====================
    parseArray(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
        if (typeof val === 'string') {
            val = val.trim();
            if (!val) return [];
            try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return parsed.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
            } catch (e) { /* not JSON */ }
            const parts = val.split(/[,;\s]+/).filter(p => p.length > 0);
            return parts.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
        }
        if (typeof val === 'number' && !isNaN(val)) return [val];
        return [];
    },

    formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    },

    formatPercent(v) {
        if (v == null || isNaN(v)) return '0%';
        return (v * 100).toFixed(1) + '%';
    },

    getScoreColor(score) {
        if (score >= 0.7) return '#27ae60';
        if (score >= 0.5) return '#f39c12';
        return '#e74c3c';
    },

    getClassificacaoLabel(c) {
        const map = { quente: '🔥 Quente', morno: '🌤 Morno', frio: '❄️ Frio' };
        return map[c] || c;
    },

    // ===================== STORAGE (Meus Jogos local) =====================
    getMeusJogos() {
        try { return JSON.parse(localStorage.getItem('lotoquant_meus_jogos') || '[]'); }
        catch (e) { return []; }
    },
    salvarMeusJogos(jogos) {
        localStorage.setItem('lotoquant_meus_jogos', JSON.stringify(jogos));
    },
    gerarId() {
        return 'jogo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    },

    // ===================== INIT =====================
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

    // ===================== NAVIGATION =====================
    setupNavigation() {
        document.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const page = el.getAttribute('data-page');
                this.showPage(page);
            });
        });
    },

    showPage(page) {
        this.currentPage = page;
        // hide all pages
        document.querySelectorAll('.page-content').forEach(p => {
            p.style.display = 'none';
        });
        // show target
        const target = document.getElementById('page-' + page);
        if (target) target.style.display = 'block';
        // update nav active
        document.querySelectorAll('[data-page]').forEach(el => {
            el.classList.toggle('active', el.getAttribute('data-page') === page);
        });
        // load page data
        if (page === 'meus-jogos') this.renderMeusJogos();
    },

    // ===================== GAME SELECTOR =====================
    setupGameSelector() {
        const sel = document.getElementById('game-selector');
        if (!sel) return;
        sel.addEventListener('change', () => {
            this.currentGame = sel.value;
            if (this.config.backendUrl) this.loadDashboard();
        });
    },

    // ===================== CONFIG =====================
    setupConfig() {
        const urlInput = document.getElementById('config-backend-url');
        const keyInput = document.getElementById('config-api-key');
        const btnSave = document.getElementById('btn-save-config');
        if (urlInput) urlInput.value = this.config.backendUrl;
        if (keyInput) keyInput.value = this.config.apiKey;
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const url = (urlInput?.value || '').trim().replace(/\/+$/, '');
                const key = (keyInput?.value || '').trim();
                this.config.backendUrl = url;
                this.config.apiKey = key;
                localStorage.setItem('lotoquant_backend_url', url);
                localStorage.setItem('lotoquant_api_key', key);
                this.showNotification('Configuração salva!', 'success');
                if (url) this.loadDashboard();
            });
        }
    },

    // ===================== BUTTONS =====================
    setupButtons() {
        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => fn.call(this));
        };
        bind('btn-analise', this.executarAnalise);
        bind('btn-previsoes', this.gerarPrevisoes);
        bind('btn-validar', this.validarJogo);
        bind('btn-fechamento', this.gerarFechamento);
        bind('btn-backtest', this.executarBacktest);
        bind('btn-importar-todos', this.importarHistoricoProxy);
        bind('btn-importar-jogo', this.importarJogoIndividual);
        bind('btn-atualizar', this.forcarAtualizacao);
        bind('btn-alertas', this.verificarAlertas);
        bind('btn-retreinar', this.retreinarModelos);
        // Meus Jogos
        bind('btn-salvar-jogo', this.salvarJogoManual);
        bind('btn-importar-previsao', this.importarPrevisaoParaMeusJogos);
        bind('btn-importar-fechamento', this.importarFechamentoParaMeusJogos);
    },

    // ===================== API REQUEST =====================
    async apiRequest(endpoint, options = {}) {
        if (!this.config.backendUrl) {
            this.showNotification('Configure a URL do backend primeiro!', 'error');
            throw new Error('Backend URL não configurada');
        }
        const url = this.config.backendUrl + endpoint;
        const headers = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) headers['x-api-key'] = this.config.apiKey;
        try {
            const resp = await fetch(url, {
                ...options,
                headers: { ...headers, ...(options.headers || {}) }
            });
            if (!resp.ok) {
                let errMsg = `Erro ${resp.status}`;
                try {
                    const errBody = await resp.json();
                    errMsg = errBody.detail || errMsg;
                } catch (e) { /* ignore parse error */ }
                throw new Error(errMsg);
            }
            return await resp.json();
        } catch (err) {
            if (err.message && !err.message.startsWith('Erro ')) {
                // network error
                console.error('API request failed:', err);
            }
            throw err;
        }
    },

    // ===================== HELPERS: último concurso =====================
    async getUltimoConcursoSalvo(jogo_slug) {
        try {
            const data = await this.apiRequest(`/api/resultados/?jogo_slug=${jogo_slug}&limit=1`);
            const concurso = data.resultados?.[0]?.concurso || 0;
            const total = data.total || 0;
            return { concurso, total };
        } catch (e) {
            return { concurso: 0, total: 0 };
        }
    },

    async getUltimoConcursoCaixa(apiNome) {
        try {
            const resp = await fetch(`https://servicebus2.caixa.gov.br/portaldeloterias/api/${apiNome}/`);
            if (!resp.ok) return 0;
            const d = await resp.json();
            return d.numero || 0;
        } catch (e) {
            return 0;
        }
    },

    // ===================== DASHBOARD =====================
    async loadDashboard() {
        const statusEl = document.getElementById('dashboard-status');
        if (statusEl) statusEl.innerHTML = '<p>Carregando dados do Supabase...</p>';
        try {
            // Health check
            const health = await this.apiRequest('/health');
            // Get last results for current game
            const salvo = await this.getUltimoConcursoSalvo(this.currentGame);
            // Get ranking
            let ranking = null;
            try {
                ranking = await this.apiRequest(`/api/analises/ranking?jogo_slug=${this.currentGame}`);
            } catch (e) { /* ranking unavailable */ }

            let html = '';
            html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">`;
            html += `<div style="background:#1a1a2e;padding:16px;border-radius:12px;border:1px solid #333;">
                        <div style="color:#888;font-size:12px;">Status Backend</div>
                        <div style="color:#27ae60;font-size:18px;font-weight:bold;">✅ v${health.version || '?'}</div>
                      </div>`;
            html += `<div style="background:#1a1a2e;padding:16px;border-radius:12px;border:1px solid #333;">
                        <div style="color:#888;font-size:12px;">Modelos IA</div>
                        <div style="color:#00d4ff;font-size:18px;font-weight:bold;">${(health.modelos || []).length} ativos</div>
                      </div>`;
            html += `<div style="background:#1a1a2e;padding:16px;border-radius:12px;border:1px solid #333;">
                        <div style="color:#888;font-size:12px;">${this.jogosConfig[this.currentGame]?.nome || this.currentGame}</div>
                        <div style="color:#f39c12;font-size:18px;font-weight:bold;">${this.formatNumber(salvo.total)} concursos</div>
                        <div style="color:#666;font-size:11px;">Último: #${salvo.concurso}</div>
                      </div>`;
            html += `<div style="background:#1a1a2e;padding:16px;border-radius:12px;border:1px solid #333;">
                        <div style="color:#888;font-size:12px;">Dados</div>
                        <div style="color:#9b59b6;font-size:18px;font-weight:bold;">Supabase ☁️</div>
                        <div style="color:#666;font-size:11px;">Persistentes na nuvem</div>
                      </div>`;
            html += `</div>`;

            // Top numbers
            if (ranking && ranking.ranking && ranking.ranking.length > 0) {
                const top10 = ranking.ranking.slice(0, 10);
                html += `<h3 style="color:#00d4ff;margin-bottom:12px;">🔥 Top 10 Números - ${this.jogosConfig[this.currentGame]?.nome || this.currentGame}</h3>`;
                html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">`;
                top10.forEach(n => {
                    const color = this.getScoreColor(n.score);
                    html += `<div style="background:#1a1a2e;border:2px solid ${color};border-radius:50%;width:56px;height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                                <span style="color:#fff;font-weight:bold;font-size:16px;">${String(n.numero).padStart(2,'0')}</span>
                                <span style="color:${color};font-size:10px;">${(n.score * 100).toFixed(0)}%</span>
                             </div>`;
                });
                html += `</div>`;

                // Modelos usados
                html += `<h3 style="color:#00d4ff;margin-bottom:8px;">🤖 8 Modelos de IA</h3>`;
                html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">`;
                const modelosNomes = {
                    frequencia: 'Frequência', atraso: 'Atraso', padrao: 'Padrões',
                    distribuicao: 'Distribuição', lstm: 'LSTM', xgboost: 'XGBoost',
                    monte_carlo: 'Monte Carlo', bayesiano: 'Bayesiano'
                };
                (health.modelos || []).forEach(m => {
                    html += `<span style="background:#16213e;color:#00d4ff;padding:6px 12px;border-radius:20px;font-size:12px;">${modelosNomes[m] || m}</span>`;
                });
                html += `</div>`;
            }

            if (statusEl) statusEl.innerHTML = html;
        } catch (err) {
            if (statusEl) statusEl.innerHTML = `<p style="color:#e74c3c;">❌ Erro: ${err.message}</p>`;
        }
    },

    // ===================== ANÁLISE =====================
    async executarAnalise() {
        const statusEl = document.getElementById('analise-resultado');
        if (statusEl) statusEl.innerHTML = '<p>Executando análise com 8 modelos de IA...</p>';
        try {
            const data = await this.apiRequest(`/api/analises/completa?jogo_slug=${this.currentGame}`);
            let html = '<h3 style="color:#00d4ff;">Análise Completa</h3>';

            // Info geral
            html += `<p>Jogo: <strong>${data.jogo || this.currentGame}</strong> | Concursos analisados: <strong>${data.total_concursos || '?'}</strong> | Último: <strong>#${data.ultimo_concurso || '?'}</strong></p>`;

            // Ranking
            if (data.ranking && data.ranking.length > 0) {
                html += `<h4 style="color:#f39c12;">Ranking dos Números</h4>`;
                html += `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">`;
                html += `<tr style="background:#16213e;color:#00d4ff;">
                            <th style="padding:8px;">Nº</th><th>Score</th><th>Class.</th>
                            <th>Freq.Geral</th><th>Freq.Recente</th><th>Atraso</th>
                            <th>Freq</th><th>Atr</th><th>Pad</th><th>Dist</th>
                            <th>LSTM</th><th>XGB</th><th>MC</th><th>Bay</th>
                         </tr>`;
                data.ranking.forEach(n => {
                    const sc = n.scores_modelos || {};
                    const color = this.getScoreColor(n.score);
                    html += `<tr style="border-bottom:1px solid #333;">
                        <td style="padding:6px;font-weight:bold;color:#fff;">${String(n.numero).padStart(2,'0')}</td>
                        <td style="color:${color};font-weight:bold;">${(n.score * 100).toFixed(1)}%</td>
                        <td>${this.getClassificacaoLabel(n.classificacao)}</td>
                        <td>${this.formatPercent(n.frequencia_geral)}</td>
                        <td>${this.formatPercent(n.frequencia_recente)}</td>
                        <td>${n.atraso ?? '-'}</td>
                        <td>${sc.frequencia != null ? (sc.frequencia * 100).toFixed(0) : '-'}</td>
                        <td>${sc.atraso != null ? (sc.atraso * 100).toFixed(0) : '-'}</td>
                        <td>${sc.padrao != null ? (sc.padrao * 100).toFixed(0) : '-'}</td>
                        <td>${sc.distribuicao != null ? (sc.distribuicao * 100).toFixed(0) : '-'}</td>
                        <td>${sc.lstm != null ? (sc.lstm * 100).toFixed(0) : '-'}</td>
                        <td>${sc.xgboost != null ? (sc.xgboost * 100).toFixed(0) : '-'}</td>
                        <td>${sc.monte_carlo != null ? (sc.monte_carlo * 100).toFixed(0) : '-'}</td>
                        <td>${sc.bayesiano != null ? (sc.bayesiano * 100).toFixed(0) : '-'}</td>
                    </tr>`;
                });
                html += `</table></div>`;
            }

            // Pares frequentes
            if (data.pares_frequentes && data.pares_frequentes.length > 0) {
                html += `<h4 style="color:#f39c12;margin-top:16px;">Pares Mais Frequentes</h4>`;
                html += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`;
                data.pares_frequentes.slice(0, 20).forEach(p => {
                    html += `<span style="background:#16213e;color:#00d4ff;padding:4px 10px;border-radius:12px;font-size:12px;">${p.par || p.numeros || '?'}: ${p.frequencia || p.count || '?'}x</span>`;
                });
                html += `</div>`;
            }

            // Modelos e pesos
            if (data.modelos_usados) {
                html += `<h4 style="color:#f39c12;margin-top:16px;">Modelos e Pesos</h4>`;
                html += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`;
                const pesos = data.pesos || {};
                (data.modelos_usados || []).forEach(m => {
                    const peso = pesos[m] != null ? (pesos[m] * 100).toFixed(0) + '%' : '?';
                    html += `<span style="background:#16213e;color:#9b59b6;padding:4px 10px;border-radius:12px;font-size:12px;">${m}: ${peso}</span>`;
                });
                html += `</div>`;
            }

            if (statusEl) statusEl.innerHTML = html;
        } catch (err) {
            if (statusEl) statusEl.innerHTML = `<p style="color:#e74c3c;">❌ ${err.message}</p>`;
        }
    },

    // ===================== PREVISÕES =====================
    async gerarPrevisoes() {
        const statusEl = document.getElementById('previsoes-resultado');
        const qtdInput = document.getElementById('previsoes-quantidade');
        const qtd = parseInt(qtdInput?.value || '5', 10) || 5;
        if (statusEl) statusEl.innerHTML = '<p>Gerando previsões com 8 modelos de IA...</p>';
        try {
            const data = await this.apiRequest('/api/previsoes/gerar', {
                method: 'POST',
                body: JSON.stringify({ jogo_slug: this.currentGame, quantidade_jogos: qtd })
            });
            this._lastPrevisoes = data.previsoes || [];
            let html = `<h3 style="color:#00d4ff;">Previsões - ${this.jogosConfig[this.currentGame]?.nome || this.currentGame}</h3>`;
            html += `<p>Concursos analisados: <strong>${data.total_concursos_analisados || '?'}</strong> | Modelos: <strong>${(data.modelos_usados || []).length}</strong></p>`;

            if (this._lastPrevisoes.length === 0) {
                html += `<p style="color:#f39c12;">Nenhuma previsão gerada. Verifique se há dados suficientes.</p>`;
            } else {
                this._lastPrevisoes.forEach((p, i) => {
                    const numeros = this.parseArray(p.numeros);
                    const trevos = this.parseArray(p.trevos);
                    const confianca = p.confianca != null ? p.confianca : p.confidence;
                    const confiancaPct = confianca != null ? (confianca * 100).toFixed(1) : '?';
                    const color = confianca != null ? this.getScoreColor(confianca) : '#888';
                    html += `<div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:12px;">`;
                    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">`;
                    html += `<span style="color:#00d4ff;font-weight:bold;">Jogo ${i + 1}</span>`;
                    html += `<span style="color:${color};font-weight:bold;font-size:18px;">${confiancaPct}%</span>`;
                    html += `</div>`;
                    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">`;
                    numeros.forEach(n => {
                        html += `<span style="background:#16213e;color:#fff;border:1px solid #00d4ff;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:bold;">${String(n).padStart(2,'0')}</span>`;
                    });
                    if (trevos.length > 0) {
                        trevos.forEach(t => {
                            html += `<span style="background:#f39c12;color:#000;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:bold;">☘${t}</span>`;
                        });
                    }
                    html += `</div>`;
                    if (p.estrategia) {
                        html += `<div style="color:#888;font-size:11px;">Estratégia: ${p.estrategia}</div>`;
                    }
                    html += `</div>`;
                });
            }

            if (statusEl) statusEl.innerHTML = html;
        } catch (err) {
            if (statusEl) statusEl.innerHTML = `<p style="color:#e74c3c;">❌ ${err.message}</p>`;
        }
    },

    // ===================== VALIDAÇÃO =====================
    async validarJogo() {
        const statusEl = document.getElementById('validacao-resultado');
        const inputEl = document.getElementById('validacao-numeros');
        const trevosEl = document.getElementById('validacao-trevos');
        const numerosStr = inputEl?.value || '';
        const trevosStr = trevosEl?.value || '';
        const numeros = this.parseArray(numerosStr);
        const trevos = this.parseArray(trevosStr);

        if (numeros.length === 0) {
            this.showNotification('Digite os números para validar!', 'error');
            return;
        }

        if (statusEl) statusEl.innerHTML = '<p>Validando jogo...</p>';
        try {
            const body = { jogo_slug: this.currentGame, numeros, trevos };
            const data = await this.apiRequest('/api/validacao/validar-jogo', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            this._lastValidacao = data;
            let html = `<h3 style="color:#00d4ff;">Resultado da Validação</h3>`;
            const score = data.score_geral != null ? data.score_geral : (data.score || data.confianca || 0);
            const color = this.getScoreColor(score);
            html += `<div style="text-align:center;margin:20px 0;">`;
            html += `<div style="font-size:48px;font-weight:bold;color:${color};">${(score * 100).toFixed(1)}%</div>`;
            html += `<div style="color:#888;">Confiança Geral</div>`;
            html += `</div>`;

            // Números avaliados
            html += `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:16px;">`;
            numeros.forEach(n => {
                const nd = (data.numeros_detalhes || data.detalhes || []).find(d => d.numero === n);
                const nScore = nd ? (nd.score || nd.confianca || 0) : 0;
                const nColor = this.getScoreColor(nScore);
                html += `<div style="text-align:center;">
                            <div style="background:#1a1a2e;border:2px solid ${nColor};border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
                                <span style="color:#fff;font-weight:bold;">${String(n).padStart(2,'0')}</span>
                            </div>
                            <div style="color:${nColor};font-size:10px;margin-top:2px;">${(nScore * 100).toFixed(0)}%</div>
                         </div>`;
            });
            html += `</div>`;

            // Classificação
            if (data.classificacao) {
                html += `<p style="text-align:center;font-size:16px;">${this.getClassificacaoLabel(data.classificacao)}</p>`;
            }

            // Scores por modelo
            if (data.scores_modelos || data.modelos) {
                const sm = data.scores_modelos || data.modelos || {};
                html += `<h4 style="color:#f39c12;margin-top:16px;">Scores por Modelo</h4>`;
                html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">`;
                const modelosNomes = {
                    frequencia: 'Frequência', atraso: 'Atraso', padrao: 'Padrões',
                    distribuicao: 'Distribuição', lstm: 'LSTM', xgboost: 'XGBoost',
                    monte_carlo: 'Monte Carlo', bayesiano: 'Bayesiano'
                };
                Object.entries(sm).forEach(([k, v]) => {
                    const mColor = this.getScoreColor(v);
                    html += `<div style="background:#1a1a2e;padding:8px;border-radius:8px;border-left:3px solid ${mColor};">
                                <div style="color:#888;font-size:11px;">${modelosNomes[k] || k}</div>
                                <div style="color:${mColor};font-weight:bold;">${(v * 100).toFixed(1)}%</div>
                             </div>`;
                });
                html += `</div>`;
            }

            if (statusEl) statusEl.innerHTML = html;
        } catch (err) {
            if (statusEl) statusEl.innerHTML = `<p style="color:#e74c3c;">❌ ${err.message}</p>`;
        }
    },

    // ===================== FECHAMENTO =====================
    async gerarFechamento() {
        const statusEl = document.getElementById('fechamento-resultado');
        const garantiaEl = document.getElementById('fechamento-garantia');
        const universoEl = document.getElementById('fechamento-universo');
        const garantia = garantiaEl?.value || 'quadra';
        const universo = parseInt(universoEl?.value || '15', 10) || 15;

        if (statusEl) statusEl.innerHTML = '<p>Gerando fechamento...</p>';
        try {
            const data = await this.apiRequest(
                `/api/previsoes/fechamento?jogo_slug=${this.currentGame}&garantia=${garantia}&tamanho_universo=${universo}`,
                { method: 'POST' }
            );
            this._lastFechamento = data.jogos || [];
            let html = `<h3 style="color:#00d4ff;">Fechamento - ${this.jogosConfig[this.currentGame]?.nome || this.currentGame}</h3>`;
            html += `<p>Garantia: <strong>${data.garantia || garantia}</strong> | Universo: <strong>${data.tamanho_universo || universo}</strong> | Total de jogos: <strong>${data.total_jogos || this._lastFechamento.length}</strong></p>`;

            if (data.universo && data.universo.length > 0) {
                html += `<h4 style="color:#f39c12;">Universo de Números</h4>`;
                html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">`;
                data.universo.forEach(n => {
                    html += `<span style="background:#16213e;color:#00d4ff;border:1px solid #00d4ff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;">${String(n).padStart(2,'0')}</span>`;
                });
                html += `</div>`;
            }

            if (data.cobertura) {
                html += `<p>Cobertura: <strong style="color:#27ae60;">${typeof data.cobertura === 'number' ? (data.cobertura * 100).toFixed(1) + '%' : data.cobertura}</strong></p>`;
            }

            if (this._lastFechamento.length > 0) {
                html += `<h4 style="color:#f39c12;">Jogos Gerados</h4>`;
                this._lastFechamento.forEach((j, i) => {
                    const nums = this.parseArray(j.numeros);
                    const score = j.score || j.confianca || 0;
                    const color = this.getScoreColor(score);
                    html += `<div style="background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">`;
                    html += `<span style="color:#888;min-width:50px;">Jogo ${i + 1}</span>`;
                    nums.forEach(n => {
                        html += `<span style="background:#16213e;color:#fff;border:1px solid ${color};border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">${String(n).padStart(2,'0')}</span>`;
                    });
                    html += `<span style="color:${color};font-weight:bold;margin-left:auto;">${(score * 100).toFixed(1)}%</span>`;
                    html += `</div>`;
                });
            } else {
                html += `<p style="color:#f39c12;">Nenhum jogo gerado.</p>`;
            }

            if (statusEl) statusEl.innerHTML = html;
        } catch (err) {
            if (statusEl) statusEl.innerHTML = `<p style="color:#e74c3c;">❌ ${err.message}</p>`;
        }
    },

    // ===================== BACKTESTING =====================
    async executarBacktest() {
        const statusEl = document.getElementById('backtest-resultado');
        const concursosEl = document.getElementById('backtest-concursos');
        const cartelasEl = document.getElementById('backtest-cartelas');
        const concursos = parseInt(concursosEl?.value || '50', 10) || 50;
        const cartelas = parseInt(cartelasEl?.value || '3', 10) || 3;

        if (statusEl) statusEl.innerHTML = '<p>Executando backtesting... Isso pode levar alguns segundos.</p>';
        try {
            const data = await this.apiRequest('/api/backtesting/executar', {
                method: 'POST',
                body: JSON.stringify({
                    jogo_slug: this.currentGame,
                    concursos_teste: concursos,
                    cartelas_por_concurso: cartelas
                })
            });
            let html = `<h3 style="color:#00d4ff;">Backtesting - ${this.jogosConfig[this.currentGame]?.nome || this.currentGame}</h3>`;
            html += `<p>Concursos testados: <strong>${data.concursos_testados || concursos}</strong> | Cartelas por concurso: <strong>${data.cartelas_por_concurso || cartelas}</strong></p>`;

            if (data.resultados_resumo || data.resumo) {
                const resumo = data.resultados_resumo || data.resumo || {};
                html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0;">`;
                Object.entries(resumo).forEach(([k, v]) => {
                    html += `<div style="background:#1a1a2e;padding:12px;border-radius:8px;border:1px solid #333;">
                                <div style="color:#888;font-size:12px;">${k}</div>
                                <div style="color:#00d4ff;font-size:20px;font-weight:bold;">${typeof v === 'number' ? v.toFixed(2) : v}</div>
                             </div>`;
                });
                html += `</div>`;
            }

            if (data.acertos_distribuicao || data.distribuicao) {
                const dist = data.acertos_distribuicao || data.distribuicao || {};
                html += `<h4 style="color:#f39c12;">Distribuição de Acertos</h4>`;
                html += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`;
                Object.entries(dist).forEach(([k, v]) => {
                    html += `<div style="background:#16213e;padding:8px 16px;border-radius:8px;text-align:center;">
                                <div style="color:#00d4ff;font-size:18px;font-weight:bold;">${v}</div>
                                <div style="color:#888;font-size:11px;">${k} acertos</div>
                             </div>`;
                });
                html += `</div>`;
            }

            if (statusEl) statusEl.innerHTML = html;
        } catch (err) {
            if (statusEl) statusEl.innerHTML = `<p style="color:#e74c3c;">❌ ${err.message}</p>`;
        }
    },

    // ===================== IMPORTAÇÃO INTELIGENTE =====================
    async importarUmJogo(jogo, statusEl, prevHtml = '') {
        const cfg = this.jogosConfig[jogo];
        if (!cfg) return { html: prevHtml, inseridos: 0 };
        const apiNome = cfg.apiNome;
        const caixaBase = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
        let html = prevHtml;
        let inseridos = 0;
        let erros = 0;
        const update = (s) => { if (statusEl) statusEl.innerHTML = s; };

        try {
            // último salvo no Supabase
            const salvo = await this.getUltimoConcursoSalvo(jogo);
            const ultimoSalvo = salvo.concurso;
            const totalSalvo = salvo.total;

            // último da Caixa
            const ultimoCaixa = await this.getUltimoConcursoCaixa(apiNome);

            if (!ultimoCaixa) {
                html += `<p style="color:#f39c12;">⚠️ ${cfg.nome}: API da Caixa indisponível</p>`;
                update(html);
                return { html, inseridos: 0 };
            }

            if (ultimoSalvo && ultimoSalvo >= ultimoCaixa) {
                html += `<p style="color:#27ae60;">✅ ${cfg.nome}: já atualizado (${totalSalvo} concursos, último #${ultimoSalvo})</p>`;
                update(html);
                return { html, inseridos: 0 };
            }

            const concursoInicial = ultimoSalvo > 0 ? ultimoSalvo + 1 : 1;
            const totalParaImportar = ultimoCaixa - concursoInicial + 1;
            html += `<p style="color:#00d4ff;">⏳ ${cfg.nome}: importando ${totalParaImportar} concursos (#${concursoInicial} a #${ultimoCaixa})...</p>`;
            update(html);

            const BATCH_SIZE = 30;
            let imported = 0;
            for (let start = concursoInicial; start <= ultimoCaixa; start += BATCH_SIZE) {
                const end = Math.min(start + BATCH_SIZE - 1, ultimoCaixa);
                const batch = [];
                for (let c = start; c <= end; c++) {
                    try {
                        const resp = await fetch(`${caixaBase}/${apiNome}/${c}`);
                        if (!resp.ok) { erros++; continue; }
                        const d = await resp.json();
                        const numeros = (d.listaDezenas || d.dezenasSorteadasOrdemSorteio || []).map(n => parseInt(n, 10));
                        const trevos = (d.trevosSorteados || d.listaTrevos || []).map(n => parseInt(n, 10));
                        let premio = 0;
                        if (d.listaRateioPremio && d.listaRateioPremio[0]) {
                            premio = d.listaRateioPremio[0].valorPremio || 0;
                        }
                        if (numeros.length > 0) {
                            batch.push({
                                jogo_slug: jogo,
                                concurso: d.numero || c,
                                data_sorteio: d.dataApuracao || '',
                                numeros,
                                trevos,
                                premio_principal: premio,
                                acumulou: d.acumulado || false
                            });
                        }
                    } catch (e) { erros++; }
                }
                if (batch.length > 0) {
                    try {
                        const res = await this.apiRequest('/api/importar-proxy', {
                            method: 'POST',
                            body: JSON.stringify({ jogo_slug: jogo, resultados: batch })
                        });
                        inseridos += res.inseridos || batch.length;
                        erros += res.erros || 0;
                    } catch (e) { erros += batch.length; }
                }
                imported += (end - start + 1);
                const pct = Math.min(100, (imported / totalParaImportar * 100)).toFixed(0);
                // Update progress inline (replace last line)
                const lines = html.split('</p>');
                lines.pop(); // remove empty trailing
                if (lines.length > 0) {
                    lines[lines.length - 1] = `<p style="color:#00d4ff;">⏳ ${cfg.nome}: ${pct}% (${imported}/${totalParaImportar})`;
                }
                html = lines.join('</p>') + '</p>';
                update(html);
                await new Promise(r => setTimeout(r, 80));
            }

            // Replace progress with final
            html = prevHtml + `<p style="color:#27ae60;">✅ ${cfg.nome}: ${inseridos} novos concursos importados${erros > 0 ? ` (${erros} erros)` : ''} — total agora: ${totalSalvo + inseridos}</p>`;
            update(html);
        } catch (err) {
            html += `<p style="color:#e74c3c;">❌ ${cfg.nome}: ${err.message}</p>`;
            update(html);
        }
        return { html, inseridos };
    },

    async importarHistoricoProxy() {
        const statusEl = document.getElementById('importar-status') || document.getElementById('dashboard-status');
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">Verificando dados no Supabase...</p>';
        const jogos = ['mega-sena', 'lotofacil', 'lotomania', 'mais-milionaria'];
        let html = '';
        let totalInseridos = 0;
        for (const jogo of jogos) {
            const result = await this.importarUmJogo(jogo, statusEl, html);
            html = result.html;
            totalInseridos += result.inseridos;
        }
        if (totalInseridos === 0) {
            html += `<p style="color:#27ae60;font-weight:bold;margin-top:12px;">🎉 Todos os jogos já estão atualizados no Supabase!</p>`;
        } else {
            html += `<p style="color:#27ae60;font-weight:bold;margin-top:12px;">🎉 Importação concluída: ${totalInseridos} novos concursos adicionados!</p>`;
        }
        if (statusEl) statusEl.innerHTML = html;
        this.showNotification(totalInseridos > 0 ? `${totalInseridos} novos concursos importados!` : 'Tudo atualizado!', 'success');
    },

    async importarJogoIndividual() {
        const statusEl = document.getElementById('importar-status') || document.getElementById('dashboard-status');
        if (statusEl) statusEl.innerHTML = '<p>Verificando...</p>';
        await this.importarUmJogo(this.currentGame, statusEl);
    },

    async forcarAtualizacao() {
        const statusEl = document.getElementById('dashboard-status');
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">Verificando atualizações...</p>';
        const jogos = ['mega-sena', 'lotofacil', 'lotomania', 'mais-milionaria'];
        let html = '';
        let totalInseridos = 0;
        for (const jogo of jogos) {
            const result = await this.importarUmJogo(jogo, statusEl, html);
            html = result.html;
            totalInseridos += result.inseridos;
        }
        if (totalInseridos === 0) {
            this.showNotification('Todos os jogos já estão atualizados!', 'success');
        } else {
            this.showNotification(`${totalInseridos} novos concursos importados!`, 'success');
        }
        // Reload dashboard
        await this.loadDashboard();
    },

    // ===================== ALERTAS =====================
    async verificarAlertas() {
        const statusEl = document.getElementById('alertas-resultado');
        if (statusEl) statusEl.innerHTML = '<p>Verificando alertas...</p>';
        try {
            await this.apiRequest(`/api/alertas/verificar?jogo_slug=${this.currentGame}`, { method: 'POST' });
            const data = await this.apiRequest(`/api/alertas/?jogo_slug=${this.currentGame}&apenas_nao_lidos=true`);
            const alertas = data.alertas || data || [];
            let html = `<h3 style="color:#00d4ff;">Alertas - ${this.jogosConfig[this.currentGame]?.nome || this.currentGame}</h3>`;
            if (alertas.length === 0) {
                html += `<p style="color:#27ae60;">✅ Nenhum alerta pendente.</p>`;
            } else {
                alertas.forEach(a => {
                    const typeColor = a.tipo === 'urgente' ? '#e74c3c' : (a.tipo === 'aviso' ? '#f39c12' : '#00d4ff');
                    html += `<div style="background:#1a1a2e;border-left:3px solid ${typeColor};padding:12px;border-radius:8px;margin-bottom:8px;">
                                <div style="color:${typeColor};font-weight:bold;">${a.titulo || a.tipo || 'Alerta'}</div>
                                <div style="color:#ccc;font-size:13px;">${a.mensagem || a.descricao || ''}</div>
                                <div style="color:#666;font-size:11px;margin-top:4px;">${a.created_at || ''}</div>
                             </div>`;
                });
            }
            if (statusEl) statusEl.innerHTML = html;
        } catch (err) {
            if (statusEl) statusEl.innerHTML = `<p style="color:#e74c3c;">❌ ${err.message}</p>`;
        }
    },

    // ===================== RETREINAR =====================
    async retreinarModelos() {
        this.showNotification('Retreinando modelos...', 'info');
        try {
            const data = await this.apiRequest(`/api/analises/retreinar?jogo_slug=${this.currentGame}`, { method: 'POST' });
            this.showNotification(data.message || data.mensagem || 'Modelos retreinados com sucesso!', 'success');
        } catch (err) {
            this.showNotification('Erro ao retreinar: ' + err.message, 'error');
        }
    },

    // ===================== MEUS JOGOS =====================
    setupMeusJogos() {
        // Setup tipo selector change event
        const tipoSel = document.getElementById('meus-jogos-tipo');
        if (tipoSel) {
            tipoSel.addEventListener('change', () => this.atualizarModalPorTipo());
            this.atualizarModalPorTipo();
        }
    },

    atualizarModalPorTipo() {
        const tipoSel = document.getElementById('meus-jogos-tipo');
        const labelEl = document.getElementById('meus-jogos-numeros-label');
        const inputEl = document.getElementById('meus-jogos-numeros');
        const trevosGroup = document.getElementById('meus-jogos-trevos-group');
        if (!tipoSel) return;
        const jogo = tipoSel.value;
        const cfg = this.jogosConfig[jogo];
        if (!cfg) return;

        const minEsc = cfg.escolhaMin || cfg.escolha;
        const maxEsc = cfg.escolhaMax || cfg.escolha;
        const rangeText = minEsc === maxEsc ? `${minEsc} números` : `${minEsc} a ${maxEsc} números`;

        if (labelEl) labelEl.textContent = `Números (${rangeText} de ${String(cfg.min).padStart(2,'0')} a ${String(cfg.max).padStart(2,'0')}):`;
        if (inputEl) inputEl.placeholder = `Ex: ${cfg.min}, ${cfg.min + 1}, ${cfg.min + 5}... (${rangeText})`;
        if (trevosGroup) trevosGroup.style.display = cfg.trevos ? 'block' : 'none';
    },

    validarNumerosJogo(numeros, jogo) {
        const cfg = this.jogosConfig[jogo];
        if (!cfg) return { valido: false, erro: 'Jogo não suportado' };

        const minEsc = cfg.escolhaMin || cfg.escolha;
        const maxEsc = cfg.escolhaMax || cfg.escolha;

        if (numeros.length < minEsc || numeros.length > maxEsc) {
            const rangeText = minEsc === maxEsc ? `exatamente ${minEsc}` : `de ${minEsc} a ${maxEsc}`;
            return { valido: false, erro: `${cfg.nome} precisa de ${rangeText} números. Você informou ${numeros.length}.` };
        }
        const fora = numeros.filter(n => n < cfg.min || n > cfg.max);
        if (fora.length > 0) {
            return { valido: false, erro: `Números fora do intervalo (${cfg.min}-${cfg.max}): ${fora.join(', ')}` };
        }
        const unicos = new Set(numeros);
        if (unicos.size !== numeros.length) {
            return { valido: false, erro: 'Há números duplicados.' };
        }
        return { valido: true };
    },

    salvarJogoManual() {
        const tipoSel = document.getElementById('meus-jogos-tipo');
        const inputEl = document.getElementById('meus-jogos-numeros');
        const trevosEl = document.getElementById('meus-jogos-trevos');
        const nomeEl = document.getElementById('meus-jogos-nome');
        const jogo = tipoSel?.value || this.currentGame;
        const numeros = this.parseArray(inputEl?.value || '');
        const trevos = this.parseArray(trevosEl?.value || '');
        const nome = (nomeEl?.value || '').trim();

        const val = this.validarNumerosJogo(numeros, jogo);
        if (!val.valido) {
            this.showNotification(val.erro, 'error');
            return;
        }

        const cfg = this.jogosConfig[jogo];
        if (cfg && cfg.trevos && trevos.length !== (cfg.trevosEscolha || 2)) {
            this.showNotification(`${cfg.nome} precisa de ${cfg.trevosEscolha || 2} trevos.`, 'error');
            return;
        }

        const jogos = this.getMeusJogos();
        jogos.push({
            id: this.gerarId(),
            jogo_slug: jogo,
            nome: nome || `Jogo Manual ${jogos.length + 1}`,
            numeros: numeros.sort((a, b) => a - b),
            trevos: trevos.sort((a, b) => a - b),
            fonte: 'manual',
            data: new Date().toISOString(),
            confianca: null
        });
        this.salvarMeusJogos(jogos);
        this.showNotification('Jogo salvo com sucesso!', 'success');
        if (inputEl) inputEl.value = '';
        if (trevosEl) trevosEl.value = '';
        if (nomeEl) nomeEl.value = '';
        this.renderMeusJogos();
    },

    importarPrevisaoParaMeusJogos() {
        if (!this._lastPrevisoes || this._lastPrevisoes.length === 0) {
            this.showNotification('Gere previsões primeiro na aba Previsões!', 'error');
            return;
        }
        const jogos = this.getMeusJogos();
        this._lastPrevisoes.forEach((p, i) => {
            const numeros = this.parseArray(p.numeros);
            const trevos = this.parseArray(p.trevos);
            const confianca = p.confianca != null ? p.confianca : (p.confidence || null);
            jogos.push({
                id: this.gerarId(),
                jogo_slug: this.currentGame,
                nome: `Previsão ${i + 1} - ${this.jogosConfig[this.currentGame]?.nome || this.currentGame}`,
                numeros: numeros.sort((a, b) => a - b),
                trevos: trevos.sort((a, b) => a - b),
                fonte: 'previsao',
                data: new Date().toISOString(),
                confianca,
                estrategia: p.estrategia || null
            });
        });
        this.salvarMeusJogos(jogos);
        this.showNotification(`${this._lastPrevisoes.length} previsões importadas!`, 'success');
        this.renderMeusJogos();
    },

    importarFechamentoParaMeusJogos() {
        if (!this._lastFechamento || this._lastFechamento.length === 0) {
            this.showNotification('Gere um fechamento primeiro na aba Fechamento!', 'error');
            return;
        }
        const jogos = this.getMeusJogos();
        this._lastFechamento.forEach((j, i) => {
            const numeros = this.parseArray(j.numeros);
            const score = j.score || j.confianca || null;
            jogos.push({
                id: this.gerarId(),
                jogo_slug: this.currentGame,
                nome: `Fechamento ${i + 1} - ${this.jogosConfig[this.currentGame]?.nome || this.currentGame}`,
                numeros: numeros.sort((a, b) => a - b),
                trevos: [],
                fonte: 'fechamento',
                data: new Date().toISOString(),
                confianca: score
            });
        });
        this.salvarMeusJogos(jogos);
        this.showNotification(`${this._lastFechamento.length} jogos do fechamento importados!`, 'success');
        this.renderMeusJogos();
    },

    removerMeuJogo(id) {
        let jogos = this.getMeusJogos();
        jogos = jogos.filter(j => j.id !== id);
        this.salvarMeusJogos(jogos);
        this.showNotification('Jogo removido.', 'info');
        this.renderMeusJogos();
    },

    limparMeusJogos() {
        if (!confirm('Tem certeza que deseja remover TODOS os seus jogos salvos?')) return;
        this.salvarMeusJogos([]);
        this.showNotification('Todos os jogos foram removidos.', 'info');
        this.renderMeusJogos();
    },

    async validarMeuJogo(id) {
        const jogos = this.getMeusJogos();
        const jogo = jogos.find(j => j.id === id);
        if (!jogo) return;
        try {
            const body = { jogo_slug: jogo.jogo_slug, numeros: jogo.numeros, trevos: jogo.trevos || [] };
            const data = await this.apiRequest('/api/validacao/validar-jogo', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            const score = data.score_geral != null ? data.score_geral : (data.score || data.confianca || 0);
            // Update confidence
            jogo.confianca = score;
            jogo.scores_modelos = data.scores_modelos || data.modelos || null;
            jogo.classificacao = data.classificacao || null;
            jogo.validado_em = new Date().toISOString();
            this.salvarMeusJogos(jogos);
            this.showNotification(`Confiança: ${(score * 100).toFixed(1)}%`, 'success');
            this.renderMeusJogos();
        } catch (err) {
            this.showNotification('Erro ao validar: ' + err.message, 'error');
        }
    },

    renderMeusJogos() {
        const container = document.getElementById('meus-jogos-lista');
        if (!container) return;
        const jogos = this.getMeusJogos();

        if (jogos.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">
                <p style="font-size:48px;">🎰</p>
                <p>Nenhum jogo salvo ainda.</p>
                <p style="font-size:13px;">Use o formulário acima para adicionar jogos manualmente ou importe da aba Previsões/Fechamento.</p>
            </div>`;
            return;
        }

        let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">`;
        html += `<span style="color:#888;">${jogos.length} jogo(s) salvo(s)</span>`;
        html += `<button onclick="App.limparMeusJogos()" style="background:#e74c3c;color:#fff;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:12px;">🗑 Limpar Todos</button>`;
        html += `</div>`;

        jogos.slice().reverse().forEach(j => {
            const cfg = this.jogosConfig[j.jogo_slug];
            const nomeJogo = cfg?.nome || j.jogo_slug;
            const numeros = this.parseArray(j.numeros);
            const trevos = this.parseArray(j.trevos);
            const confianca = j.confianca;
            const confiancaText = confianca != null ? (confianca * 100).toFixed(1) + '%' : 'Não validado';
            const confiancaColor = confianca != null ? this.getScoreColor(confianca) : '#888';
            const fonteLabel = { manual: '✏️ Manual', previsao: '🤖 Previsão IA', fechamento: '🔒 Fechamento' };

            html += `<div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:12px;">`;
            // Header
            html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">`;
            html += `<div>`;
            html += `<span style="color:#00d4ff;font-weight:bold;">${j.nome || 'Jogo'}</span>`;
            html += `<span style="color:#888;font-size:12px;margin-left:8px;">${nomeJogo}</span>`;
            html += `<span style="color:#666;font-size:11px;margin-left:8px;">${fonteLabel[j.fonte] || j.fonte}</span>`;
            html += `</div>`;
            html += `<div style="display:flex;gap:6px;">`;
            html += `<button onclick="App.validarMeuJogo('${j.id}')" style="background:#16213e;color:#00d4ff;border:1px solid #00d4ff;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">🔍 Validar</button>`;
            html += `<button onclick="App.removerMeuJogo('${j.id}')" style="background:#16213e;color:#e74c3c;border:1px solid #e74c3c;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">🗑</button>`;
            html += `</div>`;
            html += `</div>`;
            // Numbers
            html += `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">`;
            numeros.forEach(n => {
                html += `<span style="background:#16213e;color:#fff;border:1px solid #444;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">${String(n).padStart(2,'0')}</span>`;
            });
            if (trevos.length > 0) {
                trevos.forEach(t => {
                    html += `<span style="background:#f39c12;color:#000;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">☘${t}</span>`;
                });
            }
            html += `</div>`;
            // Confidence
            html += `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">`;
            html += `<span style="color:${confiancaColor};font-weight:bold;font-size:16px;">Confiança: ${confiancaText}</span>`;
            if (j.estrategia) {
                html += `<span style="color:#888;font-size:11px;">Estratégia: ${j.estrategia}</span>`;
            }
            if (j.validado_em) {
                html += `<span style="color:#666;font-size:11px;">Validado: ${new Date(j.validado_em).toLocaleString('pt-BR')}</span>`;
            }
            html += `</div>`;
            // Scores por modelo (if validated)
            if (j.scores_modelos) {
                const modelosNomes = {
                    frequencia: 'Freq', atraso: 'Atr', padrao: 'Pad',
                    distribuicao: 'Dist', lstm: 'LSTM', xgboost: 'XGB',
                    monte_carlo: 'MC', bayesiano: 'Bay'
                };
                html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">`;
                Object.entries(j.scores_modelos).forEach(([k, v]) => {
                    const c = this.getScoreColor(v);
                    html += `<span style="background:#0d1117;color:${c};padding:2px 8px;border-radius:10px;font-size:10px;">${modelosNomes[k] || k}: ${(v * 100).toFixed(0)}%</span>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
        });

        container.innerHTML = html;
    },

    // ===================== NOTIFICATION =====================
    showNotification(msg, type = 'info') {
        const existing = document.querySelector('.lotoquant-notification');
        if (existing) existing.remove();
        const colors = { success: '#27ae60', error: '#e74c3c', info: '#00d4ff', warning: '#f39c12' };
        const div = document.createElement('div');
        div.className = 'lotoquant-notification';
        div.style.cssText = `position:fixed;top:20px;right:20px;padding:14px 24px;border-radius:10px;color:#fff;font-size:14px;font-family:sans-serif;background:${colors[type] || colors.info};z-index:99999;opacity:0;transition:opacity 0.3s;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.5);`;
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => { div.style.opacity = '1'; }, 10);
        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        }, 4000);
    }
};

// ===================== BOOT =====================
document.addEventListener('DOMContentLoaded', () => App.init());
