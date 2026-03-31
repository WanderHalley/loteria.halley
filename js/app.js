// ============================================================
// js/app.js - LotoQuant Frontend v2.0 (Proxy Import Fix)
// ============================================================

const App = {
    currentPage: 'dashboard',
    currentGame: 'mega-sena',
    config: {
        backendUrl: localStorage.getItem('lotoquant_backend_url') || '',
        apiKey: localStorage.getItem('lotoquant_api_key') || ''
    },
    jogosConfig: {
        'mega-sena': { nome: 'Mega-Sena', min: 1, max: 60, escolha: 6, apiNome: 'megasena', trevos: false },
        'lotofacil': { nome: 'Lotofácil', min: 1, max: 25, escolha: 15, apiNome: 'lotofacil', trevos: false },
        'lotomania': { nome: 'Lotomania', min: 0, max: 99, escolha: 50, apiNome: 'lotomania', trevos: false },
        'mais-milionaria': { nome: '+Milionária', min: 1, max: 50, escolha: 6, apiNome: 'maismilionaria', trevos: true, trevosMin: 1, trevosMax: 6, trevosEscolha: 2 }
    },

    // ========================================
    // INIT
    // ========================================
    init() {
        this.setupNavigation();
        this.setupGameSelector();
        this.setupButtons();
        this.setupConfig();
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
    },

    // ========================================
    // GAME SELECTOR
    // ========================================
    setupGameSelector() {
        const selector = document.getElementById('game-selector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.currentGame = e.target.value;
                if (this.config.backendUrl) {
                    this.loadDashboard();
                }
            });
        }
    },

    // ========================================
    // CONFIG
    // ========================================
    setupConfig() {
        const urlInput = document.getElementById('config-backend-url');
        const keyInput = document.getElementById('config-api-key');
        const saveBtn = document.getElementById('btn-save-config');

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
        if (this.config.apiKey) {
            headers['x-api-key'] = this.config.apiKey;
        }
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
            container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Carregando dashboard...</p></div>';
            const data = await this.apiRequest(`/api/resultados/?jogo_slug=${this.currentGame}&limit=10`);

            let html = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${data.total || 0}</div>
                        <div class="stat-label">Total de Concursos</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${data.resultados?.[0]?.concurso || '-'}</div>
                        <div class="stat-label">Último Concurso</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${data.resultados?.[0]?.data_sorteio || '-'}</div>
                        <div class="stat-label">Data do Último Sorteio</div>
                    </div>
                </div>
                <h3>Últimos 10 Resultados</h3>`;

            if (data.resultados && data.resultados.length > 0) {
                html += '<div class="results-table"><table><thead><tr><th>Concurso</th><th>Data</th><th>Números</th><th>Prêmio</th></tr></thead><tbody>';
                for (const r of data.resultados) {
                    const nums = (Array.isArray(r.numeros) ? r.numeros : JSON.parse(r.numeros || '[]'))
                        .map(n => `<span class="ball">${String(n).padStart(2, '0')}</span>`).join(' ');
                    const trevos = r.trevos && r.trevos.length > 0
                        ? ' + ' + r.trevos.map(t => `<span class="ball trevo">${t}</span>`).join(' ')
                        : '';
                    const premio = r.premio_principal ? `R$ ${Number(r.premio_principal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';
                    html += `<tr><td>${r.concurso}</td><td>${r.data_sorteio || '-'}</td><td>${nums}${trevos}</td><td>${premio}</td></tr>`;
                }
                html += '</tbody></table></div>';
            } else {
                html += '<div class="empty-state"><p>⚠️ Nenhum resultado encontrado. Importe os dados históricos na aba "Inserir Dados".</p></div>';
            }
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="error-state"><p>❌ Erro ao carregar dashboard: ${err.message}</p><p>Verifique a configuração do backend na aba "Inserir Dados".</p></div>`;
        }
    },

    // ========================================
    // ANÁLISE IA
    // ========================================
    async executarAnalise() {
        const container = document.getElementById('analise-content');
        if (!container) return;
        try {
            container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Executando análise com 6 modelos de IA...</p></div>';
            const data = await this.apiRequest(`/api/analises/completa?jogo_slug=${this.currentGame}`);

            let html = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${data.total_concursos}</div><div class="stat-label">Concursos Analisados</div></div>
                    <div class="stat-card"><div class="stat-value">${data.ultimo_concurso}</div><div class="stat-label">Último Concurso</div></div>
                    <div class="stat-card"><div class="stat-value">${data.modelos_usados?.length || 6}</div><div class="stat-label">Modelos de IA</div></div>
                </div>
                <h3>🔥 Top 15 Números Quentes</h3>
                <div class="numbers-grid">`;

            for (const n of (data.top_quentes || [])) {
                const cor = n.classificacao === 'quente' ? '#e74c3c' : n.classificacao === 'morno' ? '#f39c12' : '#3498db';
                html += `<div class="number-card" style="border-color:${cor}">
                    <div class="number">${String(n.numero).padStart(2, '0')}</div>
                    <div class="score" style="color:${cor}">${(n.score * 100).toFixed(1)}%</div>
                    <div class="class-label">${n.classificacao}</div>
                    <div class="details">Freq: ${(n.frequencia_recente * 100).toFixed(1)}% | Atraso: ${n.atraso}</div>
                </div>`;
            }
            html += '</div>';

            html += '<h3>❄️ Top 10 Números Frios</h3><div class="numbers-grid">';
            for (const n of (data.top_frios || [])) {
                html += `<div class="number-card" style="border-color:#3498db">
                    <div class="number">${String(n.numero).padStart(2, '0')}</div>
                    <div class="score" style="color:#3498db">${(n.score * 100).toFixed(1)}%</div>
                    <div class="class-label">${n.classificacao}</div>
                </div>`;
            }
            html += '</div>';

            if (data.pares_frequentes) {
                html += '<h3>👯 Pares Mais Frequentes</h3><div class="pairs-grid">';
                const pares = Object.entries(data.pares_frequentes).slice(0, 15);
                for (const [par, freq] of pares) {
                    html += `<div class="pair-card"><span class="pair">${par}</span><span class="freq">${freq}x</span></div>`;
                }
                html += '</div>';
            }

            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="error-state"><p>❌ ${err.message}</p></div>`;
        }
    },

    // ========================================
    // PREVISÕES
    // ========================================
    async gerarPrevisoes() {
        const container = document.getElementById('previsoes-content');
        if (!container) return;
        const qtd = parseInt(document.getElementById('qtd-previsoes')?.value || '5');
        try {
            container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Gerando previsões com ensemble de 6 modelos...</p></div>';
            const data = await this.apiRequest('/api/previsoes/gerar', {
                method: 'POST',
                body: JSON.stringify({ jogo_slug: this.currentGame, quantidade_jogos: qtd })
            });

            let html = `<div class="stat-card"><div class="stat-value">${data.total_concursos_analisados}</div><div class="stat-label">Concursos Analisados</div></div>`;
            html += '<div class="previsoes-list">';

            data.previsoes?.forEach((p, i) => {
                const nums = p.numeros.map(n => `<span class="ball">${String(n).padStart(2, '0')}</span>`).join(' ');
                const trevos = p.trevos?.length > 0 ? ' + ' + p.trevos.map(t => `<span class="ball trevo">${t}</span>`).join(' ') : '';
                const confCor = p.confianca > 70 ? '#27ae60' : p.confianca > 50 ? '#f39c12' : '#e74c3c';
                html += `<div class="previsao-card">
                    <div class="previsao-header">
                        <span class="previsao-num">Jogo ${i + 1}</span>
                        <span class="previsao-conf" style="color:${confCor}">Confiança: ${p.confianca}%</span>
                    </div>
                    <div class="previsao-nums">${nums}${trevos}</div>
                    <div class="previsao-score">Score: ${p.score}</div>
                </div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="error-state"><p>❌ ${err.message}</p></div>`;
        }
    },

    // ========================================
    // VALIDAÇÃO
    // ========================================
    async validarJogo() {
        const container = document.getElementById('validacao-content');
        if (!container) return;
        const numerosStr = document.getElementById('validar-numeros')?.value || '';
        const trevosStr = document.getElementById('validar-trevos')?.value || '';
        const numeros = numerosStr.split(/[,\s]+/).filter(n => n).map(Number);
        const trevos = trevosStr ? trevosStr.split(/[,\s]+/).filter(n => n).map(Number) : [];

        if (numeros.length === 0 || numeros.some(isNaN)) {
            this.showNotification('Preencha os números corretamente', 'error');
            return;
        }

        try {
            container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Validando jogo...</p></div>';
            const data = await this.apiRequest('/api/validacao/validar-jogo', {
                method: 'POST',
                body: JSON.stringify({ jogo_slug: this.currentGame, numeros, trevos })
            });

            const confCor = data.confianca > 70 ? '#27ae60' : data.confianca > 50 ? '#f39c12' : '#e74c3c';
            let html = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value" style="color:${confCor}">${data.confianca}%</div><div class="stat-label">Confiança</div></div>
                    <div class="stat-card"><div class="stat-value">${data.classificacao}</div><div class="stat-label">Classificação</div></div>
                    <div class="stat-card"><div class="stat-value">${data.distribuicao?.pares}P / ${data.distribuicao?.impares}I</div><div class="stat-label">Par/Ímpar</div></div>
                    <div class="stat-card"><div class="stat-value">${data.distribuicao?.soma}</div><div class="stat-label">Soma</div></div>
                </div>
                <h3>Análise por Número</h3><div class="numbers-grid">`;

            for (const n of (data.numeros_analise || [])) {
                const cor = n.classificacao === 'quente' ? '#e74c3c' : n.classificacao === 'morno' ? '#f39c12' : '#3498db';
                html += `<div class="number-card" style="border-color:${cor}">
                    <div class="number">${String(n.numero).padStart(2, '0')}</div>
                    <div class="score" style="color:${cor}">${(n.score * 100).toFixed(1)}%</div>
                    <div class="class-label">${n.classificacao}</div>
                </div>`;
            }
            html += '</div>';

            if (data.sugestoes_melhoria?.length > 0) {
                html += '<h3>💡 Sugestões de Melhoria</h3><div class="suggestions">';
                for (const s of data.sugestoes_melhoria) {
                    html += `<div class="suggestion-card">Trocar <span class="ball cold">${String(s.trocar).padStart(2, '0')}</span> por <span class="ball hot">${String(s.por).padStart(2, '0')}</span> (ganho: +${(s.ganho_score * 100).toFixed(1)}%)</div>`;
                }
                html += '</div>';
            }

            if (data.recomendacoes?.length > 0) {
                html += '<h3>📋 Recomendações</h3><ul class="recommendations">';
                for (const r of data.recomendacoes) {
                    html += `<li>${r}</li>`;
                }
                html += '</ul>';
            }

            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="error-state"><p>❌ ${err.message}</p></div>`;
        }
    },

    // ========================================
    // FECHAMENTO
    // ========================================
    async gerarFechamento() {
        const container = document.getElementById('fechamento-content');
        if (!container) return;
        const garantia = document.getElementById('fechamento-garantia')?.value || 'quadra';
        const tamanho = parseInt(document.getElementById('fechamento-tamanho')?.value || '18');

        try {
            container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Gerando fechamento combinatório...</p></div>';
            const data = await this.apiRequest(`/api/previsoes/fechamento?jogo_slug=${this.currentGame}&garantia=${garantia}&tamanho_universo=${tamanho}`, {
                method: 'POST'
            });

            let html = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${data.total_jogos}</div><div class="stat-label">Total de Jogos</div></div>
                    <div class="stat-card"><div class="stat-value">${data.tamanho_universo}</div><div class="stat-label">Universo</div></div>
                    <div class="stat-card"><div class="stat-value">${data.cobertura}%</div><div class="stat-label">Cobertura</div></div>
                    <div class="stat-card"><div class="stat-value">${data.garantia}</div><div class="stat-label">Garantia</div></div>
                </div>
                <h3>Universo Selecionado</h3>
                <div class="universo-nums">${data.universo?.map(n => `<span class="ball">${String(n).padStart(2, '0')}</span>`).join(' ')}</div>
                <h3>Jogos Gerados</h3><div class="fechamento-list">`;

            data.jogos?.forEach((j, i) => {
                const nums = j.numeros.map(n => `<span class="ball">${String(n).padStart(2, '0')}</span>`).join(' ');
                const trevos = j.trevos?.length > 0 ? ' + ' + j.trevos.map(t => `<span class="ball trevo">${t}</span>`).join(' ') : '';
                html += `<div class="fechamento-card">
                    <span class="jogo-num">Jogo ${i + 1}</span>
                    <span class="jogo-nums">${nums}${trevos}</span>
                    <span class="jogo-score">Score: ${j.score}</span>
                </div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="error-state"><p>❌ ${err.message}</p></div>`;
        }
    },

    // ========================================
    // BACKTESTING
    // ========================================
    async executarBacktest() {
        const container = document.getElementById('backtest-content');
        if (!container) return;
        const concursos = parseInt(document.getElementById('backtest-concursos')?.value || '50');
        const cartelas = parseInt(document.getElementById('backtest-cartelas')?.value || '3');

        try {
            container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Executando backtesting... Pode levar alguns minutos.</p></div>';
            const data = await this.apiRequest('/api/backtesting/executar', {
                method: 'POST',
                body: JSON.stringify({ jogo_slug: this.currentGame, concursos_teste: concursos, cartelas_por_concurso: cartelas })
            });

            let html = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${data.concursos_testados}</div><div class="stat-label">Concursos Testados</div></div>
                    <div class="stat-card"><div class="stat-value">${data.total_cartelas}</div><div class="stat-label">Total Cartelas</div></div>
                    <div class="stat-card"><div class="stat-value">${data.taxa_4_acertos}%</div><div class="stat-label">Taxa 4 Acertos</div></div>
                    <div class="stat-card"><div class="stat-value">${data.taxa_5_acertos}%</div><div class="stat-label">Taxa 5 Acertos</div></div>
                </div>
                <h3>Distribuição de Acertos</h3><div class="acertos-grid">`;

            if (data.distribuicao_acertos) {
                for (const [acertos, qtd] of Object.entries(data.distribuicao_acertos)) {
                    if (qtd > 0) {
                        html += `<div class="acerto-card"><div class="acerto-num">${acertos}</div><div class="acerto-label">acertos</div><div class="acerto-qtd">${qtd}x</div></div>`;
                    }
                }
            }
            html += '</div>';

            if (data.melhores_resultados?.length > 0) {
                html += '<h3>Melhores Resultados</h3><div class="melhores-list">';
                for (const m of data.melhores_resultados) {
                    html += `<div class="melhor-card">
                        <span>Concurso ${m.concurso}</span>
                        <span class="melhor-acertos">${m.acertos} acertos</span>
                        <span class="melhor-nums">${m.sorteados.map(n => String(n).padStart(2, '0')).join(', ')}</span>
                    </div>`;
                }
                html += '</div>';
            }
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="error-state"><p>❌ ${err.message}</p></div>`;
        }
    },

    // ========================================
    // ALERTAS
    // ========================================
    async verificarAlertas() {
        const container = document.getElementById('alertas-content');
        if (!container) return;
        try {
            container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Verificando alertas...</p></div>';
            const data = await this.apiRequest(`/api/alertas/verificar?jogo_slug=${this.currentGame}`, { method: 'POST' });

            if (!data.alertas || data.alertas.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>✅ Nenhum alerta no momento.</p></div>';
                return;
            }

            let html = `<div class="stat-card"><div class="stat-value">${data.total}</div><div class="stat-label">Alertas Encontrados</div></div><div class="alertas-list">`;
            for (const a of data.alertas) {
                const icon = a.tipo === 'atraso_critico' ? '⏰' : a.tipo === 'score_alto' ? '🔥' : '📊';
                const cor = a.tipo === 'atraso_critico' ? '#e74c3c' : '#27ae60';
                html += `<div class="alerta-card" style="border-left-color:${cor}">
                    <span class="alerta-icon">${icon}</span>
                    <span class="alerta-msg">${a.mensagem}</span>
                </div>`;
            }
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="error-state"><p>❌ ${err.message}</p></div>`;
        }
    },

    // ========================================
    // INSERIR RESULTADO MANUAL
    // ========================================
    async inserirResultado() {
        const concurso = parseInt(document.getElementById('inserir-concurso')?.value);
        const data = document.getElementById('inserir-data')?.value;
        const numerosStr = document.getElementById('inserir-numeros')?.value || '';
        const trevosStr = document.getElementById('inserir-trevos')?.value || '';
        const premio = parseFloat(document.getElementById('inserir-premio')?.value || '0');
        const acumulou = document.getElementById('inserir-acumulou')?.checked || false;

        const numeros = numerosStr.split(/[,\s]+/).filter(n => n).map(Number);
        const trevos = trevosStr ? trevosStr.split(/[,\s]+/).filter(n => n).map(Number) : [];

        if (!concurso || !data || numeros.length === 0) {
            this.showNotification('Preencha todos os campos obrigatórios', 'error');
            return;
        }

        try {
            await this.apiRequest('/api/resultados/', {
                method: 'POST',
                body: JSON.stringify({
                    jogo_slug: this.currentGame,
                    concurso,
                    data_sorteio: data,
                    numeros,
                    trevos,
                    premio_principal: premio,
                    acumulou
                })
            });
            this.showNotification(`Concurso ${concurso} inserido com sucesso!`, 'success');
            this.loadDashboard();
        } catch (err) {
            this.showNotification(`Erro: ${err.message}`, 'error');
        }
    },

    // ========================================
    // IMPORTAR HISTÓRICO VIA PROXY (NOVO!)
    // ========================================
    async importarHistoricoProxy() {
        const btn = document.getElementById('btn-importar-todos');
        const statusEl = document.getElementById('import-status');
        if (!btn) return;

        const desdeAno = parseInt(document.getElementById('import-desde')?.value || '2022');

        btn.disabled = true;
        btn.textContent = 'Importando...';

        const jogos = ['mega-sena', 'lotofacil', 'lotomania', 'mais-milionaria'];
        const apiNomes = {
            'mega-sena': 'megasena',
            'lotofacil': 'lotofacil',
            'lotomania': 'lotomania',
            'mais-milionaria': 'maismilionaria'
        };

        // Estimativas de concurso inicial por ano
        const estimativas = {
            'mega-sena':       { 2018: 2000, 2019: 2100, 2020: 2200, 2021: 2330, 2022: 2460, 2023: 2600, 2024: 2750, 2025: 2880 },
            'lotofacil':       { 2018: 1600, 2019: 1700, 2020: 1900, 2021: 2100, 2022: 2400, 2023: 2700, 2024: 3100, 2025: 3400 },
            'lotomania':       { 2018: 1800, 2019: 1900, 2020: 2050, 2021: 2150, 2022: 2300, 2023: 2450, 2024: 2600, 2025: 2750 },
            'mais-milionaria': { 2018: 1, 2019: 1, 2020: 1, 2021: 1, 2022: 1, 2023: 50, 2024: 150, 2025: 250 }
        };

        const caixaBase = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
        let totalGeral = 0;
        let resultadoHtml = '';

        const updateStatus = (msg) => {
            if (statusEl) statusEl.innerHTML = msg;
        };

        for (const jogo of jogos) {
            const apiNome = apiNomes[jogo];
            updateStatus(`🔄 Buscando último concurso de ${jogo}...`);

            try {
                // 1. Buscar último concurso da Caixa
                const respUltimo = await fetch(`${caixaBase}/${apiNome}`);
                if (!respUltimo.ok) {
                    resultadoHtml += `<div class="import-item">⚠️ ${jogo}: API da Caixa retornou ${respUltimo.status}</div>`;
                    continue;
                }
                const dataUltimo = await respUltimo.json();
                const ultimoCaixa = dataUltimo.numero;

                // 2. Buscar último concurso já no banco
                let ultimoDB = 0;
                try {
                    const respDB = await this.apiRequest(`/api/resultados/ultimo?jogo_slug=${jogo}`);
                    ultimoDB = respDB.ultimo?.concurso || 0;
                } catch (e) {
                    ultimoDB = 0;
                }

                // 3. Calcular range
                const estJogo = estimativas[jogo] || {};
                const desdeConc = estJogo[desdeAno] || 1;
                const inicio = Math.max(desdeConc, ultimoDB + 1);

                if (inicio > ultimoCaixa) {
                    resultadoHtml += `<div class="import-item">✅ ${jogo}: já atualizado (concurso ${ultimoDB})</div>`;
                    updateStatus(resultadoHtml);
                    continue;
                }

                const totalConc = ultimoCaixa - inicio + 1;
                updateStatus(resultadoHtml + `<div class="import-item">🔄 ${jogo}: importando ${totalConc} concursos (${inicio} → ${ultimoCaixa})...</div>`);

                // 4. Buscar concursos em lotes
                let batch = [];
                let inseridos = 0;
                let erros = 0;

                for (let num = inicio; num <= ultimoCaixa; num++) {
                    try {
                        const resp = await fetch(`${caixaBase}/${apiNome}/${num}`);
                        if (!resp.ok) { erros++; continue; }
                        const d = await resp.json();

                        const numeros = (d.listaDezenas || []).map(Number);
                        const trevos = (d.trevosSorteados || []).map(Number);
                        const premio = d.listaRateioPremio?.[0]?.valorPremio || 0;

                        batch.push({
                            concurso: num,
                            data_sorteio: d.dataApuracao || '',
                            numeros: numeros,
                            trevos: trevos,
                            premio_principal: premio,
                            acumulou: d.acumulado || false
                        });

                        // Enviar batch de 30
                        if (batch.length >= 30) {
                            await this.apiRequest('/api/importar-proxy', {
                                method: 'POST',
                                body: JSON.stringify({ jogo_slug: jogo, resultados: batch })
                            });
                            inseridos += batch.length;
                            batch = [];
                            updateStatus(resultadoHtml + `<div class="import-item">🔄 ${jogo}: ${inseridos}/${totalConc} importados...</div>`);
                        }

                        // Rate limit - 100ms entre requisições
                        await new Promise(r => setTimeout(r, 100));

                    } catch (e) {
                        erros++;
                    }
                }

                // Enviar batch restante
                if (batch.length > 0) {
                    try {
                        await this.apiRequest('/api/importar-proxy', {
                            method: 'POST',
                            body: JSON.stringify({ jogo_slug: jogo, resultados: batch })
                        });
                        inseridos += batch.length;
                    } catch (e) {
                        erros += batch.length;
                    }
                }

                totalGeral += inseridos;
                resultadoHtml += `<div class="import-item">✅ ${jogo}: ${inseridos} concursos importados${erros > 0 ? ` (${erros} erros)` : ''}</div>`;
                updateStatus(resultadoHtml);

            } catch (err) {
                resultadoHtml += `<div class="import-item">❌ ${jogo}: ${err.message}</div>`;
                updateStatus(resultadoHtml);
            }
        }

        resultadoHtml += `<div class="import-total">📊 Total importado: ${totalGeral} concursos</div>`;
        updateStatus(resultadoHtml);

        btn.disabled = false;
        btn.textContent = 'Importar Todos os Jogos';
        this.showNotification(`Importação concluída! ${totalGeral} concursos importados.`, 'success');
        this.loadDashboard();
    },

    // ========================================
    // FORÇAR ATUALIZAÇÃO
    // ========================================
    async forcarAtualizacao() {
        const btn = document.getElementById('btn-atualizar');
        const statusEl = document.getElementById('update-status');
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = 'Atualizando...';

        // Tenta via backend primeiro, se der 403, faz via proxy
        try {
            const data = await this.apiRequest('/api/atualizar', { method: 'POST' });
            const algumBloqueado = data.resultados?.some(r => r.status === 'api_bloqueada_403');

            if (algumBloqueado) {
                // Fallback: atualizar via proxy pelo navegador
                if (statusEl) statusEl.innerHTML = '🔄 Backend bloqueado pela Caixa. Atualizando via navegador...';
                await this.atualizarViaProxy();
            } else {
                let html = '';
                for (const r of (data.resultados || [])) {
                    const icon = r.status === 'atualizado' ? '✅' : r.status === 'ja_atualizado' ? '➡️' : '⚠️';
                    html += `<div class="import-item">${icon} ${r.jogo}: ${r.status}${r.concurso ? ` (concurso ${r.concurso})` : ''}</div>`;
                }
                if (statusEl) statusEl.innerHTML = html;
                this.showNotification('Atualização concluída!', 'success');
            }
        } catch (err) {
            // Fallback: proxy
            if (statusEl) statusEl.innerHTML = '🔄 Tentando via navegador...';
            await this.atualizarViaProxy();
        }

        btn.disabled = false;
        btn.textContent = 'Forçar Atualização';
        this.loadDashboard();
    },

    async atualizarViaProxy() {
        const statusEl = document.getElementById('update-status');
        const caixaBase = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
        const apiNomes = {
            'mega-sena': 'megasena',
            'lotofacil': 'lotofacil',
            'lotomania': 'lotomania',
            'mais-milionaria': 'maismilionaria'
        };
        let html = '';
        for (const [jogo, apiNome] of Object.entries(apiNomes)) {
            try {
                const resp = await fetch(`${caixaBase}/${apiNome}`);
                if (!resp.ok) { html += `<div class="import-item">⚠️ ${jogo}: erro ${resp.status}</div>`; continue; }
                const d = await resp.json();
                const concurso = d.numero;
                let ultimoDB = 0;
                try {
                    const rDB = await this.apiRequest(`/api/resultados/ultimo?jogo_slug=${jogo}`);
                    ultimoDB = rDB.ultimo?.concurso || 0;
                } catch (e) {}

                if (concurso <= ultimoDB) {
                    html += `<div class="import-item">➡️ ${jogo}: já atualizado (${ultimoDB})</div>`;
                } else {
                    const numeros = (d.listaDezenas || []).map(Number);
                    const trevos = (d.trevosSorteados || []).map(Number);
                    const premio = d.listaRateioPremio?.[0]?.valorPremio || 0;
                    await this.apiRequest('/api/importar-proxy', {
                        method: 'POST',
                        body: JSON.stringify({
                            jogo_slug: jogo,
                            resultados: [{
                                concurso, data_sorteio: d.dataApuracao || '',
                                numeros, trevos, premio_principal: premio,
                                acumulou: d.acumulado || false
                            }]
                        })
                    });
                    html += `<div class="import-item">✅ ${jogo}: atualizado para concurso ${concurso}</div>`;
                }
            } catch (e) {
                html += `<div class="import-item">❌ ${jogo}: ${e.message}</div>`;
            }
        }
        if (statusEl) statusEl.innerHTML = html;
        this.showNotification('Atualização via proxy concluída!', 'success');
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
        setTimeout(() => {
            div.classList.remove('show');
            setTimeout(() => div.remove(), 300);
        }, 4000);
    }
};

// ========================================
// INIT
// ========================================
document.addEventListener('DOMContentLoaded', function () {
    App.init();
});
