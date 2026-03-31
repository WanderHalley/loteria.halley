/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  LotoQuant — Aplicação Principal (app.js)           ║
 * ║  Controla navegação, interações e renderização       ║
 * ╚══════════════════════════════════════════════════════╝
 */

const App = {
    currentJogo: 'mega-sena',
    currentPage: 'dashboard',

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    init() {
        this.setupNavigation();
        this.setupJogoSelector();
        this.setupButtons();
        this.setupConfig();
        this.setupMobileMenu();
        this.loadDashboard();
        console.log('🎯 LotoQuant inicializado');
    },

    // ==========================================
    // MENU MOBILE
    // ==========================================
    setupMobileMenu() {
        const btn = document.getElementById('mobile-menu-btn');
        const sidebar = document.getElementById('sidebar');
        if (btn && sidebar) {
            btn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
            // Fechar ao clicar em item do menu (mobile)
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => {
                    sidebar.classList.remove('open');
                });
            });
        }
    },

    // ==========================================
    // NAVEGAÇÃO
    // ==========================================
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`)?.classList.add('active');

        this.currentPage = page;

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ==========================================
    // SELETOR DE JOGO
    // ==========================================
    setupJogoSelector() {
        const selector = document.getElementById('jogo-selector');
        if (!selector) return;

        selector.addEventListener('change', () => {
            this.currentJogo = selector.value;

            // Atualizar tag do dashboard
            const tag = document.getElementById('dash-jogo-nome');
            if (tag) tag.textContent = Utils.jogosNomes[this.currentJogo] || this.currentJogo;

            // Toggle campo de trevos
            const trevosGroup = document.getElementById('trevos-group');
            const trevosValGroup = document.getElementById('trevos-val-group');
            if (this.currentJogo === 'mais-milionaria') {
                if (trevosGroup) trevosGroup.classList.remove('hidden');
                if (trevosValGroup) trevosValGroup.classList.remove('hidden');
            } else {
                if (trevosGroup) trevosGroup.classList.add('hidden');
                if (trevosValGroup) trevosValGroup.classList.add('hidden');
            }

            // Recarregar se estiver no dashboard
            if (this.currentPage === 'dashboard') {
                this.loadDashboard();
            }
        });
    },

    // ==========================================
    // SETUP BOTÕES
    // ==========================================
    setupButtons() {
        // Análise
        document.getElementById('btn-analisar')?.addEventListener('click', () => this.executarAnalise());

        // Previsões
        document.getElementById('btn-prever')?.addEventListener('click', () => {
            const qtd = parseInt(document.getElementById('num-cartelas')?.value) || 3;
            this.gerarPrevisoes(qtd);
        });

        // Validar
        document.getElementById('btn-validar')?.addEventListener('click', () => this.validarJogo());

        // Fechamento
        document.getElementById('btn-fechamento')?.addEventListener('click', () => this.gerarFechamento());

        // Backtesting
        document.getElementById('btn-backtest')?.addEventListener('click', () => this.executarBacktest());

        // Alertas
        document.getElementById('btn-verificar-alertas')?.addEventListener('click', () => this.verificarAlertas());

        // Inserir
        document.getElementById('btn-inserir')?.addEventListener('click', () => this.inserirResultado());

        // Forçar atualização
        document.getElementById('btn-forcar-update')?.addEventListener('click', () => this.forcarAtualizacao());
    },

    // ==========================================
    // CONFIGURAÇÃO (Backend URL + API Key)
    // ==========================================
    setupConfig() {
        const urlInput = document.getElementById('backend-url-input');
        const keyInput = document.getElementById('api-key-input');

        if (urlInput) urlInput.value = API.baseUrl || '';

        document.getElementById('btn-save-url')?.addEventListener('click', () => {
            if (urlInput) {
                API.setBaseUrl(urlInput.value.trim());
                Utils.showFeedback('config-feedback', '✅ URL do backend salva!', 'success');
                // Tentar carregar dashboard com nova URL
                this.loadDashboard();
            }
        });

        document.getElementById('btn-save-key')?.addEventListener('click', () => {
            if (keyInput) {
                API.setApiKey(keyInput.value.trim());
                Utils.showFeedback('config-feedback', '✅ API Key salva!', 'success');
            }
        });
    },

    // ==========================================
    // DASHBOARD
    // ==========================================
    async loadDashboard() {
        try {
            const data = await API.getResultados(this.currentJogo, 10);

            if (data.resultados && data.resultados.length > 0) {
                const primeiro = data.resultados[0];
                document.getElementById('stat-total-concursos').textContent =
                    primeiro.concurso.toLocaleString('pt-BR');
                document.getElementById('stat-ultimo-concurso').textContent =
                    `#${primeiro.concurso}`;
                document.getElementById('stat-ultimo-data').textContent =
                    Utils.formatDate(primeiro.data_sorteio);
                document.getElementById('stat-proximo').textContent =
                    `#${primeiro.concurso + 1}`;

                this.renderResultados(data.resultados);
            }

            // Tentar carregar ranking
            try {
                const ranking = await API.getRanking(this.currentJogo);
                if (ranking.ranking && ranking.ranking.length > 0) {
                    Charts.renderFrequencia('chart-frequencia', ranking.ranking);

                    const top10freq = ranking.ranking.slice(0, 10).map(r => ({
                        numero: r.numero,
                        value: r.score_total
                    }));
                    Charts.renderTop10('chart-top10', top10freq, 'Score', 'rgba(239, 68, 68, 0.7)');

                    const byAtraso = [...ranking.ranking]
                        .sort((a, b) => b.scores.atraso - a.scores.atraso)
                        .slice(0, 10)
                        .map(r => ({ numero: r.numero, value: r.scores.atraso }));
                    Charts.renderTop10('chart-atrasados', byAtraso, 'Score Atraso', 'rgba(59, 130, 246, 0.7)');
                }
            } catch (e) {
                // Modelo ainda não treinado - ok
                console.log('Ranking não disponível (modelo não treinado ainda)');
            }

        } catch (error) {
            console.warn('Dashboard:', error.message);
            if (error.message.includes('não configurada')) {
                document.getElementById('ultimos-resultados').innerHTML =
                    '<p class="text-muted">⚠️ Configure a URL do backend em "Inserir Dados" para começar.</p>';
            }
        }
    },

    renderResultados(resultados) {
        const container = document.getElementById('ultimos-resultados');
        if (!container) return;

        if (!resultados || resultados.length === 0) {
            container.innerHTML = '<p class="text-muted">Nenhum resultado encontrado.</p>';
            return;
        }

        container.innerHTML = resultados.map(r => `
            <div class="resultado-item">
                <span class="resultado-concurso">#${r.concurso}</span>
                <span class="resultado-data">${Utils.formatDate(r.data_sorteio)}</span>
                <div class="resultado-numeros">
                    ${r.numeros.map(n => Utils.createBall(n)).join('')}
                    ${(r.trevos && r.trevos.length > 0)
                        ? r.trevos.map(t => Utils.createBall(t, 'trevo')).join('')
                        : ''}
                </div>
            </div>
        `).join('');
    },

    // ==========================================
    // ANÁLISE COMPLETA
    // ==========================================
    async executarAnalise() {
        const btn = document.getElementById('btn-analisar');
        if (btn) btn.disabled = true;
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
            if (btn) btn.disabled = false;
        }
    },

    renderAnalise(data) {
        const analise = data.analise;

        // Ranking grid
        const rankingGrid = document.getElementById('ranking-grid');
        if (rankingGrid && analise.ranking_top20) {
            const maxScore = analise.ranking_top20[0]?.score_total || 1;
            rankingGrid.innerHTML = analise.ranking_top20.map((r, i) => `
                <div class="numero-ball ${Utils.getBallClass(r.score_total, maxScore)}"
                     title="Posição #${i + 1} | Score: ${r.score_total.toFixed(1)} | Freq: ${(r.scores.frequencia * 100).toFixed(0)}% | Atraso: ${(r.scores.atraso * 100).toFixed(0)}%">
                    ${String(r.numero).padStart(2, '0')}
                    <span class="score-tag">${r.score_total.toFixed(0)}</span>
                </div>
            `).join('');
        }

        // Distribuição
        const distInfo = document.getElementById('distribuicao-info');
        if (distInfo && analise.perfil_distribuicao) {
            const p = analise.perfil_distribuicao;
            distInfo.innerHTML = `
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Soma Média</span>
                        <span class="info-value">${p.soma_media?.toFixed(0) || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Soma Min/Max</span>
                        <span class="info-value">${p.soma_min || '-'} / ${p.soma_max || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Pares (média)</span>
                        <span class="info-value">${p.pares_media?.toFixed(1) || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ímpares (média)</span>
                        <span class="info-value">${p.impares_media?.toFixed(1) || '-'}</span>
                    </div>
                </div>
            `;
        }

        // Universo reduzido
        const universoInfo = document.getElementById('universo-info');
        if (universoInfo && analise.universo_reduzido) {
            const u = analise.universo_reduzido;
            universoInfo.innerHTML = `
                <p class="info-text">
                    Universo reduzido de <strong>${u.total_original}</strong> para
                    <strong>${u.total_reduzido}</strong> números
                    (redução de <strong>${u.reducao_percentual}%</strong>)
                </p>
                <div class="resultado-numeros" style="margin-top:12px;">
                    ${u.universo_reduzido.map(n => Utils.createBall(n)).join('')}
                </div>
            `;
        }

        // Pares
        const paresList = document.getElementById('pares-list');
        if (paresList && analise.melhores_pares) {
            paresList.innerHTML = `
                <div class="pares-grid">
                    ${analise.melhores_pares.slice(0, 15).map(p => `
                        <div class="par-item">
                            <span class="par-nums">${String(p.par[0]).padStart(2, '0')} — ${String(p.par[1]).padStart(2, '0')}</span>
                            <span class="par-freq">${p.frequencia}x</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Atrasados
        const atrasadosList = document.getElementById('atrasados-list');
        if (atrasadosList && analise.atrasados_criticos) {
            if (analise.atrasados_criticos.length === 0) {
                atrasadosList.innerHTML = '<p class="text-muted">Nenhum número com atraso crítico no momento.</p>';
            } else {
                atrasadosList.innerHTML = analise.atrasados_criticos.map(a => `
                    <div class="alerta-card severidade-2">
                        <div class="alerta-titulo">Número ${String(a.numero).padStart(2, '0')}</div>
                        <div class="alerta-descricao">
                            Atraso: <strong>${a.atraso}</strong> concursos |
                            Esperado: ${a.atraso_esperado} |
                            Ratio: <strong>${a.ratio}x</strong> acima do esperado
                        </div>
                    </div>
                `).join('');
            }
        }
    },

    // ==========================================
    // PREVISÕES
    // ==========================================
    async gerarPrevisoes(quantidade) {
        const btn = document.getElementById('btn-prever');
        if (btn) btn.disabled = true;
        Utils.showLoading('previsoes-loading');

        try {
            const data = await API.gerarPrevisoes(this.currentJogo, quantidade);
            this.renderPrevisoes(data);

            // Carregar histórico
            const historico = await API.getHistoricoPrevisoes(this.currentJogo);
            this.renderHistoricoPrevisoes(historico);
        } catch (error) {
            alert(`Erro nas previsões: ${error.message}`);
        } finally {
            Utils.hideLoading('previsoes-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderPrevisoes(data) {
        const container = document.getElementById('previsoes-resultado');
        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <h3>🎯 Jogos Sugeridos para Concurso #${data.concurso_alvo}</h3>
                <p class="info-text">${data.disclaimer}</p>
                ${data.jogos_sugeridos.map((jogo, i) => `
                    <div class="previsao-card">
                        <div class="previsao-header">
                            <span class="previsao-label">Jogo ${i + 1}</span>
                            <span class="previsao-score ${Utils.getScoreClass(jogo.score_confianca)}">
                                Score: ${jogo.score_confianca.toFixed(1)}
                            </span>
                        </div>
                        <div class="resultado-numeros">
                            ${jogo.numeros.map(n => Utils.createBall(n)).join('')}
                            ${(jogo.trevos && jogo.trevos.length > 0)
                                ? jogo.trevos.map(t => Utils.createBall(t, 'trevo')).join('')
                                : ''}
                        </div>
                        <div class="previsao-details">
                            ${Object.entries(jogo.detalhes.scores_individuais || {}).map(([num, score]) =>
                                `<span class="detail-chip">${String(num).padStart(2, '0')}: ${score.toFixed(0)}</span>`
                            ).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderHistoricoPrevisoes(data) {
        const container = document.getElementById('previsoes-historico');
        if (!container) return;

        if (!data.previsoes || data.previsoes.length === 0) {
            container.innerHTML = '<p class="text-muted">Nenhuma previsão anterior.</p>';
            return;
        }

        container.innerHTML = data.previsoes.slice(0, 5).map(p => `
            <div class="resultado-item">
                <span class="resultado-concurso">Alvo #${p.concurso_alvo}</span>
                <span class="previsao-score ${Utils.getScoreClass(p.score_confianca)}" style="font-size:13px;">
                    ${p.score_confianca.toFixed(1)}
                </span>
                <div class="resultado-numeros">
                    ${p.numeros_sugeridos.map(n => Utils.createBall(n)).join('')}
                </div>
            </div>
        `).join('');
    },

    // ==========================================
    // VALIDAR JOGO
    // ==========================================
    async validarJogo() {
        const btn = document.getElementById('btn-validar');
        if (btn) btn.disabled = true;
        Utils.showLoading('validacao-loading');

        const numerosStr = document.getElementById('val-numeros')?.value || '';
        const trevosStr = document.getElementById('val-trevos')?.value || '';

        const numeros = numerosStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        const trevos = trevosStr
            ? trevosStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
            : [];

        if (numeros.length === 0) {
            alert('Insira os números do seu jogo.');
            if (btn) btn.disabled = false;
            Utils.hideLoading('validacao-loading');
            return;
        }

        try {
            const response = await API.request('/api/validacao/validar-jogo', {
                method: 'POST',
                body: JSON.stringify({
                    jogo_slug: this.currentJogo,
                    numeros: numeros,
                    trevos: trevos
                })
            });
            this.renderValidacao(response);
        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            Utils.hideLoading('validacao-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderValidacao(data) {
        const container = document.getElementById('validacao-resultado');
        if (!container) return;

        const scoreClass = data.score_medio >= 65 ? 'score-high' :
                           data.score_medio >= 40 ? 'score-mid' : 'score-low';

        container.innerHTML = `
            <div class="card">
                <div class="validacao-header">
                    <div class="validacao-classificacao">${data.classificacao}</div>
                    <div class="previsao-score ${scoreClass}" style="font-size:32px;">
                        Score: ${data.score_medio}
                    </div>
                    <div class="text-muted">Posição média no ranking: ${data.posicao_media}</div>
                </div>

                <h3>Seus Números</h3>
                <div class="resultado-numeros" style="margin-bottom:20px;">
                    ${data.numeros.map(n => {
                        const score = data.scores_individuais[String(n)]?.score_ensemble || 0;
                        const cls = score >= 60 ? 'hot' : score >= 40 ? 'warm' : score >= 20 ? 'neutral' : 'cold';
                        return `<div class="numero-ball ${cls}" title="Score: ${score.toFixed(1)}">
                            ${String(n).padStart(2, '0')}
                            <span class="score-tag">${score.toFixed(0)}</span>
                        </div>`;
                    }).join('')}
                </div>

                <h3>Distribuição</h3>
                <div class="resultado-item" style="margin-bottom:16px;">
                    Soma: <strong>${data.validacao_distribuicao.soma}</strong>
                    (ideal: ${data.validacao_distribuicao.soma_ideal_range[0]}
                    - ${data.validacao_distribuicao.soma_ideal_range[1]})
                    ${data.validacao_distribuicao.soma_dentro_padrao ? ' ✅' : ' ⚠️'}
                    &nbsp;|&nbsp;
                    Pares: <strong>${data.validacao_distribuicao.pares}</strong>
                    &nbsp;|&nbsp;
                    Ímpares: <strong>${data.validacao_distribuicao.impares}</strong>
                </div>

                ${data.recomendacoes.length > 0 ? `
                    <h3>Recomendações</h3>
                    ${data.recomendacoes.map(r => `
                        <div class="alerta-card severidade-${r.tipo === 'critico' ? '3' : r.tipo === 'aviso' ? '2' : '1'}">
                            <div class="alerta-descricao">${r.mensagem}</div>
                        </div>
                    `).join('')}
                ` : '<p class="info-text">✅ Nenhuma recomendação — jogo bem equilibrado!</p>'}

                ${data.substituicoes_sugeridas.length > 0 ? `
                    <h3>Substituições Sugeridas</h3>
                    ${data.substituicoes_sugeridas.map(s => `
                        <div class="resultado-item" style="margin-bottom:8px;">
                            Trocar
                            <span class="numero-ball cold" style="width:36px;height:36px;font-size:13px;display:inline-flex;">
                                ${String(s.remover).padStart(2, '0')}
                            </span>
                            <span class="text-muted">(score ${s.remover_score.toFixed(0)})</span>
                            &nbsp;➜&nbsp;
                            <span class="numero-ball hot" style="width:36px;height:36px;font-size:13px;display:inline-flex;">
                                ${String(s.adicionar).padStart(2, '0')}
                            </span>
                            <span class="text-muted">(score ${s.adicionar_score.toFixed(0)})</span>
                        </div>
                    `).join('')}
                ` : ''}
            </div>
        `;
    },

    // ==========================================
    // FECHAMENTO
    // ==========================================
    async gerarFechamento() {
        const btn = document.getElementById('btn-fechamento');
        if (btn) btn.disabled = true;
        Utils.showLoading('fechamento-loading');

        const universo = parseInt(document.getElementById('fech-universo')?.value) || 18;
        const garantia = document.getElementById('fech-garantia')?.value || 'quadra';

        try {
            const data = await API.gerarFechamento(this.currentJogo, garantia, universo);
            this.renderFechamento(data);
        } catch (error) {
            alert(`Erro no fechamento: ${error.message}`);
        } finally {
            Utils.hideLoading('fechamento-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderFechamento(data) {
        const container = document.getElementById('fechamento-resultado');
        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <h3>🔒 Fechamento Gerado</h3>

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

                <h4>Universo de Números:</h4>
                <div class="resultado-numeros" style="margin:8px 0 20px;">
                    ${data.universo.map(n => Utils.createBall(n)).join('')}
                </div>

                <h4>Cartelas (${data.total_cartelas}):</h4>
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

    // ==========================================
    // BACKTESTING
    // ==========================================
    async executarBacktest() {
        const btn = document.getElementById('btn-backtest');
        if (btn) btn.disabled = true;
        Utils.showLoading('backtest-loading');

        const concursos = parseInt(document.getElementById('bt-concursos')?.value) || 50;
        const cartelas = parseInt(document.getElementById('bt-cartelas')?.value) || 3;

        try {
            const data = await API.executarBacktest(this.currentJogo, concursos, cartelas);
            this.renderBacktest(data);
        } catch (error) {
            alert(`Erro no backtesting: ${error.message}`);
        } finally {
            Utils.hideLoading('backtest-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderBacktest(data) {
        const container = document.getElementById('backtest-resultado');
        if (!container) return;

        const acertos = data.distribuicao_acertos || {};
        const taxas = data.taxa_acerto_por_faixa || {};

        container.innerHTML = `
            <div class="card">
                <h3>📈 Resultados do Backtesting</h3>

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
                        <div class="stat-value">${Utils.formatDate(data.periodo?.inicio)}</div>
                        <div class="stat-label">Período Início</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${Utils.formatDate(data.periodo?.fim)}</div>
                        <div class="stat-label">Período Fim</div>
                    </div>
                </div>

                <h4>Distribuição de Acertos:</h4>
                <div class="backtest-results">
                    ${Object.entries(acertos)
                        .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                        .map(([k, v]) => {
                            const pct = taxas[k] || 0;
                            const barWidth = Math.min(pct * 3, 100);
                            return `
                                <div class="backtest-row">
                                    <span class="backtest-label">${k} acertos</span>
                                    <div class="backtest-bar-container">
                                        <div class="backtest-bar" style="width:${barWidth}%"></div>
                                    </div>
                                    <span class="backtest-value">${v} cartelas (${pct}%)</span>
                                </div>
                            `;
                        }).join('')}
                </div>
            </div>
        `;
    },

    // ==========================================
    // ALERTAS
    // ==========================================
    async verificarAlertas() {
        const btn = document.getElementById('btn-verificar-alertas');
        if (btn) btn.disabled = true;
        Utils.showLoading('alertas-loading');

        try {
            const data = await API.verificarAlertas(this.currentJogo);
            this.renderAlertas(data.alertas || []);
        } catch (error) {
            alert(`Erro nos alertas: ${error.message}`);
        } finally {
            Utils.hideLoading('alertas-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderAlertas(alertas) {
        const container = document.getElementById('alertas-lista');
        if (!container) return;

        if (alertas.length === 0) {
            container.innerHTML = '<p class="text-muted">Nenhum alerta detectado no momento.</p>';
            return;
        }

        container.innerHTML = alertas.map(a => `
            <div class="alerta-card severidade-${a.severidade}">
                <div class="alerta-titulo">${a.titulo}</div>
                <div class="alerta-descricao">${a.descricao}</div>
                ${(a.numeros && a.numeros.length > 0) ? `
                    <div class="resultado-numeros" style="margin-top:8px;">
                        ${a.numeros.map(n => Utils.createBall(n)).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Badge
        const badge = document.getElementById('alertas-badge');
        if (badge && alertas.length > 0) {
            badge.textContent = alertas.length;
            badge.classList.remove('hidden');
        }
    },

    // ==========================================
    // INSERIR RESULTADO
    // ==========================================
    async inserirResultado() {
        const concurso = parseInt(document.getElementById('inp-concurso')?.value);
        const data = document.getElementById('inp-data')?.value;
        const numerosStr = document.getElementById('inp-numeros')?.value || '';
        const trevosStr = document.getElementById('inp-trevos')?.value || '';
        const premio = parseFloat(document.getElementById('inp-premio')?.value) || 0;
        const acumulou = document.getElementById('inp-acumulou')?.checked || false;

        if (!concurso || !data || !numerosStr.trim()) {
            Utils.showFeedback('inserir-feedback', '⚠️ Preencha concurso, data e números.', 'error');
            return;
        }

        const numeros = numerosStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        const trevos = trevosStr
            ? trevosStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
            : [];

        try {
            await API.inserirResultado({
                jogo_slug: this.currentJogo,
                concurso: concurso,
                data_sorteio: data,
                numeros: numeros,
                trevos: trevos,
                premio_principal: premio,
                acumulou: acumulou
            });

            Utils.showFeedback('inserir-feedback', `✅ Concurso #${concurso} inserido com sucesso!`, 'success');

            // Limpar campos
            document.getElementById('inp-concurso').value = '';
            document.getElementById('inp-numeros').value = '';
            if (document.getElementById('inp-trevos')) {
                document.getElementById('inp-trevos').value = '';
            }

        } catch (error) {
            Utils.showFeedback('inserir-feedback', `❌ Erro: ${error.message}`, 'error');
        }
    },

    // ==========================================
    // FORÇAR ATUALIZAÇÃO
    // ==========================================
    async forcarAtualizacao() {
        const btn = document.getElementById('btn-forcar-update');
        if (btn) btn.disabled = true;

        try {
            const data = await API.request('/api/atualizar', {
                method: 'POST'
            });

            let msg = '🔄 Atualização concluída:<br>';
            if (data.resultados) {
                data.resultados.forEach(r => {
                    const icon = r.status === 'novo_resultado' ? '✅' :
                                 r.status === 'sem_novidade' ? '➖' : '⚠️';
                    msg += `${icon} ${r.slug}: ${r.status}`;
                    if (r.concurso) msg += ` (#${r.concurso})`;
                    msg += '<br>';
                });
            }

            Utils.showFeedback('update-feedback', msg, 'success');
            // Recarregar dashboard
            this.loadDashboard();

        } catch (error) {
            Utils.showFeedback('update-feedback', `❌ Erro: ${error.message}`, 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }
};

// ==========================================
// INICIALIZAR
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
