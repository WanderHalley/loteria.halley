/**
 * LotoQuant - Aplicação Principal
 */
const App = {
    currentJogo: 'mega-sena',
    currentPage: 'dashboard',

    init() {
        this.setupNavigation();
        this.setupJogoSelector();
        this.setupButtons();
        this.setupConfig();
        this.loadDashboard();
    },

    // ==================== NAVEGAÇÃO ====================
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        // Atualizar nav
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

        // Atualizar páginas
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`)?.classList.add('active');

        this.currentPage = page;
    },

    // ==================== SELETOR DE JOGO ====================
    setupJogoSelector() {
        const selector = document.getElementById('jogo-selector');
        selector.addEventListener('change', () => {
            this.currentJogo = selector.value;
            document.getElementById('dash-jogo-nome').textContent =
                Utils.jogosNomes[this.currentJogo];

            // Toggle campo de trevos
            const trevosGroup = document.getElementById('trevos-group');
            if (this.currentJogo === 'mais-milionaria') {
                trevosGroup.classList.remove('hidden');
            } else {
                trevosGroup.classList.add('hidden');
            }

            // Recarregar dashboard
            if (this.currentPage === 'dashboard') {
                this.loadDashboard();
            }
        });
    },

    // ==================== BOTÕES ====================
    setupButtons() {
        // Análise
        document.getElementById('btn-analisar')?.addEventListener('click', () => {
            this.executarAnalise();
        });

        // Previsões
        document.getElementById('btn-prever')?.addEventListener('click', () => {
            const qtd = parseInt(document.getElementById('num-cartelas').value) || 3;
            this.gerarPrevisoes(qtd);
        });

        // Fechamento
        document.getElementById('btn-fechamento')?.addEventListener('click', () => {
            this.gerarFechamento();
        });

        // Backtesting
        document.getElementById('btn-backtest')?.addEventListener('click', () => {
            this.executarBacktest();
        });

        // Alertas
        document.getElementById('btn-verificar-alertas')?.addEventListener('click', () => {
            this.verificarAlertas();
        });

        // Inserir
        document.getElementById('btn-inserir')?.addEventListener('click', () => {
            this.inserirResultado();
        });
    },

    // ==================== CONFIGURAÇÃO ====================
    setupConfig() {
        // Backend URL
        const urlInput = document.getElementById('backend-url-input');
        if (urlInput) {
            urlInput.value = API.baseUrl;
        }
        document.getElementById('btn-save-url')?.addEventListener('click', () => {
            API.setBaseUrl(urlInput.value);
            Utils.showFeedback('inserir-feedback', 'URL salva com sucesso!');
        });

        // API Key
        const keyInput = document.getElementById('api-key-input');
        document.getElementById('btn-save-key')?.addEventListener('click', () => {
            API.setApiKey(keyInput.value);
            Utils.showFeedback('inserir-feedback', 'API Key salva com sucesso!');
        });
    },

    // ==================== DASHBOARD ====================
    async loadDashboard() {
        try {
            // Carregar últimos resultados
            const data = await API.getResultados(this.currentJogo, 10);

            if (data.resultados && data.resultados.length > 0) {
                const primeiro = data.resultados[0];
                document.getElementById('stat-total-concursos').textContent = primeiro.concurso;
                document.getElementById('stat-ultimo-concurso').textContent = `#${primeiro.concurso}`;
                document.getElementById('stat-ultimo-data').textContent =
                    Utils.formatDate(primeiro.data_sorteio);
                document.getElementById('stat-proximo').textContent = `#${primeiro.concurso + 1}`;

                // Renderizar lista de resultados
                this.renderResultados(data.resultados);
            }

            // Tentar carregar ranking (se modelo já treinado)
            try {
                const ranking = await API.getRanking(this.currentJogo);
                if (ranking.ranking) {
                    Charts.renderFrequencia('chart-frequencia', ranking.ranking);

                    const top10freq = ranking.ranking.slice(0, 10).map(r => ({
                        numero: r.numero,
                        value: r.score_total
                    }));
                    Charts.renderTop10('chart-top10', top10freq, 'Score', 'rgba(239, 68, 68, 0.7)');

                    // Top 10 atrasados (por score de atraso)
                    const byAtraso = [...ranking.ranking]
                        .sort((a, b) => b.scores.atraso - a.scores.atraso)
                        .slice(0, 10)
                        .map(r => ({ numero: r.numero, value: r.scores.atraso }));
                    Charts.renderTop10('chart-atrasados', byAtraso, 'Atraso Score', 'rgba(59, 130, 246, 0.7)');
                }
            } catch (e) {
                // Modelo ainda não treinado — ok
            }

        } catch (error) {
            console.warn('Dashboard:', error.message);
        }
    },

    renderResultados(resultados) {
        const container = document.getElementById('ultimos-resultados');
        if (!container) return;

        container.innerHTML = resultados.map(r => `
            <div class="resultado-item">
                <span class="resultado-concurso">#${r.concurso}</span>
                <span class="resultado-data">${Utils.formatDate(r.data_sorteio)}</span>
                <div class="resultado-numeros">
                    ${r.numeros.map(n => Utils.createBall(n)).join('')}
                    ${(r.trevos || []).map(t => Utils.createBall(t, 'trevo')).join('')}
                </div>
            </div>
        `).join('');
    },

    // ==================== ANÁLISE ====================
    async executarAnalise() {
        const btn = document.getElementById('btn-analisar');
        btn.disabled = true;
        Utils.showLoading('analise-loading');
        Utils.hideElement('analise-resultado');

        try {
            const data = await API.getAnaliseCompleta(this.currentJogo);
            this.renderAnalise(data);
            Utils.showElement('analise-resultado');
        } catch (error) {
            alert(`Erro na análise: ${error.message}`);
        } finally {
            Utils.hideLoading('analise-loading');
            btn.disabled = false;
        }
    },

    renderAnalise(data) {
        const analise = data.analise;

        // Ranking grid (bolas coloridas)
        const rankingGrid = document.getElementById('ranking-grid');
        if (rankingGrid && analise.ranking_top20) {
            const maxScore = analise.ranking_top20[0]?.score_total || 1;
            rankingGrid.innerHTML = analise.ranking_top20.map(r => `
                <div class="numero-ball ${Utils.getBallClass(r.score_total, maxScore)}"
                     title="Score: ${r.score_total}">
                    ${String(r.numero).padStart(2, '0')}
                    <span class="score-tag">${r.score_total.toFixed(0)}</span>
                </div>
            `).join('');
        }

        // Pares
        const paresList = document.getElementById('pares-list');
        if (paresList && analise.melhores_pares) {
            paresList.innerHTML = analise.melhores_pares.map(p => `
                <span class="resultado-item" style="display:inline-flex;margin:4px;padding:8px 12px;">
                    <strong>${p.par[0]} - ${p.par[1]}</strong>
                    &nbsp;(${p.frequencia}x)
                </span>
            `).join('');
        }

        // Atrasados
        const atrasadosList = document.getElementById('atrasados-list');
        if (atrasadosList && analise.atrasados_criticos) {
            atrasadosList.innerHTML = analise.atrasados_criticos.map(a => `
                <div class="alerta-card severidade-2">
                    <div class="alerta-titulo">Número ${a.numero}</div>
                    <div class="alerta-descricao">
                        Atraso: ${a.atraso} concursos | Esperado: ${a.atraso_esperado} | Ratio: ${a.ratio}x
                    </div>
                </div>
            `).join('');
        }

        // Universo
        const universoInfo = document.getElementById('universo-info');
        if (universoInfo && analise.universo_reduzido) {
            const u = analise.universo_reduzido;
            universoInfo.innerHTML = `
                <p class="info-text">
                    Universo reduzido de <strong>${u.total_original}</strong> para
                    <strong>${u.total_reduzido}</strong> números
                    (redução de ${u.reducao_percentual}%)
                </p>
                <div class="resultado-numeros" style="margin-top:12px;">
                    ${u.universo_reduzido.map(n => Utils.createBall(n)).join('')}
                </div>
            `;
        }
    },

    // ==================== PREVISÕES ====================
    async gerarPrevisoes(quantidade) {
        const btn = document.getElementById('btn-prever');
        btn.disabled = true;
        Utils.showLoading('previsoes-loading');

        try {
            const data = await API.gerarPrevisoes(this.currentJogo, quantidade);
            this.renderPrevisoes(data);
        } catch (error) {
            alert(`Erro nas previsões: ${error.message}`);
        } finally {
            Utils.hideLoading('previsoes-loading');
            btn.disabled = false;
        }
    },

    renderPrevisoes(data) {
        const container = document.getElementById('previsoes-resultado');
        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <h3>Jogos Sugeridos para Concurso #${data.concurso_alvo}</h3>
                <p class="info-text">${data.disclaimer}</p>
                ${data.jogos_sugeridos.map((jogo, i) => `
                    <div class="previsao-card">
                        <div class="previsao-header">
                            <span>Jogo ${i + 1}</span>
                            <span class="previsao-score ${Utils.getScoreClass(jogo.score_confianca)}">
                                Score: ${jogo.score_confianca.toFixed(1)}
                            </span>
                        </div>
                        <div class="resultado-numeros">
                            ${jogo.numeros.map(n => Utils.createBall(n)).join('')}
                            ${(jogo.trevos || []).map(t => Utils.createBall(t, 'trevo')).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // ==================== FECHAMENTO ====================
    async gerarFechamento() {
        const btn = document.getElementById('btn-fechamento');
        btn.disabled = true;
        Utils.showLoading('fechamento-loading');

        const universo = parseInt(document.getElementById('fech-universo').value) || 18;
        const garantia = document.getElementById('fech-garantia').value;

        try {
            const data = await API.gerarFechamento(this.currentJogo, garantia, universo);
            this.renderFechamento(data);
        } catch (error) {
            alert(`Erro no fechamento: ${error.message}`);
        } finally {
            Utils.hideLoading('fechamento-loading');
            btn.disabled = false;
        }
    },

    renderFechamento(data) {
        const container = document.getElementById('fechamento-resultado');
        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <h3>Fechamento Gerado</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${data.total_cartelas}</div>
                        <div class="stat-label">Cartelas</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${data.universo_tamanho}</div>
                        <div class="stat-label">Números Base</div>
                    </div>
                    <div class="stat-card accent">
                        <div class="stat-value">${Utils.formatMoney(data.custo_total)}</div>
                        <div class="stat-label">Custo Total</div>
                    </div>
                </div>
                <p class="info-text">${data.garantia}</p>
                <h4 style="margin:16px 0 8px;">Universo de Números:</h4>
                <div class="resultado-numeros">
                    ${data.universo.map(n => Utils.createBall(n)).join('')}
                </div>
                <h4 style="margin:16px 0 8px;">Cartelas:</h4>
                <div class="cartelas-grid">
                    ${data.cartelas.map((c, i) => `
                        <div class="cartela-item">
                            <span class="cartela-num">#${i + 1}</span>
                            <div class="resultado-numeros">
                                ${c.map(n => Utils.createBall(n)).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // ==================== BACKTESTING ====================
    async executarBacktest() {
        const btn = document.getElementById('btn-backtest');
        btn.disabled = true;
        Utils.showLoading('backtest-loading');

        const concursos = parseInt(document.getElementById('bt-concursos').value) || 50;
        const cartelas = parseInt(document.getElementById('bt-cartelas').value) || 3;

        try {
            const data = await API.executarBacktest(this.currentJogo, concursos, cartelas);
            this.renderBacktest(data);
        } catch (error) {
            alert(`Erro no backtesting: ${error.message}`);
        } finally {
            Utils.hideLoading('backtest-loading');
            btn.disabled = false;
        }
    },

    renderBacktest(data) {
        const container = document.getElementById('backtest-resultado');
        if (!container) return;

        const acertos = data.distribuicao_acertos;
        const taxas = data.taxa_acerto_por_faixa;

        container.innerHTML = `
            <div class="card">
                <h3>Resultados do Backtesting</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${data.total_concursos_testados}</div>
                        <div class="stat-label">Concursos Testados</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${data.total_cartelas_geradas}</div>
                        <div class="stat-label">Cartelas Geradas</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${data.periodo.inicio}</div>
                        <div class="stat-label">Período Início</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${data.periodo.fim}</div>
                        <div class="stat-label">Período Fim</div>
                    </div>
                </div>
                <h4 style="margin:16px 0 8px;">Distribuição de Acertos:</h4>
                ${Object.entries(acertos).map(([k, v]) => `
                    <div class="resultado-item" style="margin-bottom:8px;">
                        <strong>${k} acertos:</strong> ${v} cartelas (${taxas[k]}%)
                    </div>
                `).join('')}
            </div>
        `;
    },

    // ==================== ALERTAS ====================
    async verificarAlertas() {
        const btn = document.getElementById('btn-verificar-alertas');
        btn.disabled = true;
        Utils.showLoading('alertas-loading');

        try {
            const data = await API.verificarAlertas(this.currentJogo);
            this.renderAlertas(data.alertas || []);
        } catch (error) {
            alert(`Erro nos alertas: ${error.message}`);
        } finally {
            Utils.hideLoading('alertas-loading');
            btn.disabled = false;
        }
    },

    renderAlertas(alertas) {
        const container = document.getElementById('alertas-lista');
        if (!container) return;

        if (alertas.length === 0) {
            container.innerHTML = '<p class="info-text">Nenhum alerta no momento.</p>';
            return;
        }

        container.innerHTML = alertas.map(a => `
            <div class="alerta-card severidade-${a.severidade}">
                <div class="alerta-titulo">${a.titulo}</div>
                <div class="alerta-descricao">${a.descricao}</div>
                <div class="resultado-numeros" style="margin-top:8px;">
                    ${(a.numeros || a.numeros_envolvidos || []).map(n => Utils.createBall(n)).join('')}
                </div>
            </div>
        `).join('');

        // Atualizar badge
        const badge = document.getElementById('alertas-badge');
        if (badge && alertas.length > 0) {
            badge.textContent = alertas.length;
            badge.classList.remove('hidden');
        }
    },

    // ==================== INSERIR DADOS ====================
    async inserirResultado() {
        const concurso = parseInt(document.getElementById('inp-concurso').value);
        const data = document.getElementById('inp-data').value;
        const numerosStr = document.getElementById('inp-numeros').value;
        const trevosStr = document.getElementById('inp-trevos').value;
        const premio = parseFloat(document.getElementById('inp-premio').value) || 0;
        const acumulou = document.getElementById('inp-acumulou').checked;

        if (!concurso || !data || !numerosStr) {
            Utils.showFeedback('inserir-feedback', 'Preencha todos os campos obrigatórios.', 'error');
            return;
        }

        const numeros = numerosStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        const trevos = trevosStr
            ? trevosStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
            : [];

        try {
            const payload = {
                jogo_slug: this.currentJogo,
                concurso,
                data_sorteio: data,
                numeros,
                trevos,
                premio_principal: premio,
                acumulou
            };

            await API.inserirResultado(payload);
            Utils.showFeedback('inserir-feedback', `Concurso #${concurso} inserido com sucesso!`);

            // Limpar campos
            document.getElementById('inp-concurso').value = '';
            document.getElementById('inp-numeros').value = '';
            document.getElementById('inp-trevos').value = '';

        } catch (error) {
            Utils.showFeedback('inserir-feedback', `Erro: ${error.message}`, 'error');
        }
    }
};

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
