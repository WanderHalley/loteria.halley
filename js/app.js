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
            btn.addEventListener('click', function() {
                sidebar.classList.toggle('open');
            });
            document.querySelectorAll('.nav-item').forEach(function(item) {
                item.addEventListener('click', function() {
                    sidebar.classList.remove('open');
                });
            });
        }
    },

    // ==========================================
    // NAVEGAÇÃO
    // ==========================================
    setupNavigation() {
        var self = this;
        document.querySelectorAll('.nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var page = item.dataset.page;
                self.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        document.querySelectorAll('.nav-item').forEach(function(i) {
            i.classList.remove('active');
        });
        var activeNav = document.querySelector('.nav-item[data-page="' + page + '"]');
        if (activeNav) activeNav.classList.add('active');

        document.querySelectorAll('.page').forEach(function(p) {
            p.classList.remove('active');
        });
        var activePage = document.getElementById('page-' + page);
        if (activePage) activePage.classList.add('active');

        this.currentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ==========================================
    // SELETOR DE JOGO
    // ==========================================
    setupJogoSelector() {
        var self = this;
        var selector = document.getElementById('jogo-selector');
        if (!selector) return;

        selector.addEventListener('change', function() {
            self.currentJogo = selector.value;

            var tag = document.getElementById('dash-jogo-nome');
            if (tag) tag.textContent = Utils.jogosNomes[self.currentJogo] || self.currentJogo;

            var trevosGroup = document.getElementById('trevos-group');
            var trevosValGroup = document.getElementById('trevos-val-group');

            if (self.currentJogo === 'mais-milionaria') {
                if (trevosGroup) trevosGroup.classList.remove('hidden');
                if (trevosValGroup) trevosValGroup.classList.remove('hidden');
            } else {
                if (trevosGroup) trevosGroup.classList.add('hidden');
                if (trevosValGroup) trevosValGroup.classList.add('hidden');
            }

            if (self.currentPage === 'dashboard') {
                self.loadDashboard();
            }
        });
    },

    // ==========================================
    // SETUP DE TODOS OS BOTÕES
    // ==========================================
    setupButtons() {
        var self = this;

        // Análise
        var btnAnalisar = document.getElementById('btn-analisar');
        if (btnAnalisar) {
            btnAnalisar.addEventListener('click', function() {
                self.executarAnalise();
            });
        }

        // Previsões
        var btnPrever = document.getElementById('btn-prever');
        if (btnPrever) {
            btnPrever.addEventListener('click', function() {
                var qtd = parseInt(document.getElementById('num-cartelas').value) || 3;
                self.gerarPrevisoes(qtd);
            });
        }

        // Validar
        var btnValidar = document.getElementById('btn-validar');
        if (btnValidar) {
            btnValidar.addEventListener('click', function() {
                self.validarJogo();
            });
        }

        // Fechamento
        var btnFechamento = document.getElementById('btn-fechamento');
        if (btnFechamento) {
            btnFechamento.addEventListener('click', function() {
                self.gerarFechamento();
            });
        }

        // Backtesting
        var btnBacktest = document.getElementById('btn-backtest');
        if (btnBacktest) {
            btnBacktest.addEventListener('click', function() {
                self.executarBacktest();
            });
        }

        // Alertas
        var btnAlertas = document.getElementById('btn-verificar-alertas');
        if (btnAlertas) {
            btnAlertas.addEventListener('click', function() {
                self.verificarAlertas();
            });
        }

        // Inserir resultado
        var btnInserir = document.getElementById('btn-inserir');
        if (btnInserir) {
            btnInserir.addEventListener('click', function() {
                self.inserirResultado();
            });
        }

        // Forçar atualização
        var btnUpdate = document.getElementById('btn-forcar-update');
        if (btnUpdate) {
            btnUpdate.addEventListener('click', function() {
                self.forcarAtualizacao();
            });
        }

        // Importar histórico
        var btnImportar = document.getElementById('btn-importar-todos');
        if (btnImportar) {
            btnImportar.addEventListener('click', function() {
                self.importarHistorico();
            });
        }
    },

    // ==========================================
    // CONFIGURAÇÃO (Backend URL + API Key)
    // ==========================================
    setupConfig() {
        var urlInput = document.getElementById('backend-url-input');
        var keyInput = document.getElementById('api-key-input');

        if (urlInput) urlInput.value = API.baseUrl || '';

        var self = this;

        var btnSaveUrl = document.getElementById('btn-save-url');
        if (btnSaveUrl) {
            btnSaveUrl.addEventListener('click', function() {
                if (urlInput) {
                    API.setBaseUrl(urlInput.value.trim());
                    Utils.showFeedback('config-feedback', '✅ URL do backend salva!', 'success');
                    self.loadDashboard();
                }
            });
        }

        var btnSaveKey = document.getElementById('btn-save-key');
        if (btnSaveKey) {
            btnSaveKey.addEventListener('click', function() {
                if (keyInput) {
                    API.setApiKey(keyInput.value.trim());
                    Utils.showFeedback('config-feedback', '✅ API Key salva!', 'success');
                }
            });
        }
    },

    // ==========================================
    // DASHBOARD
    // ==========================================
    async loadDashboard() {
        try {
            var data = await API.getResultados(this.currentJogo, 10);

            if (data.resultados && data.resultados.length > 0) {
                var primeiro = data.resultados[0];
                document.getElementById('stat-total-concursos').textContent =
                    primeiro.concurso.toLocaleString('pt-BR');
                document.getElementById('stat-ultimo-concurso').textContent =
                    '#' + primeiro.concurso;
                document.getElementById('stat-ultimo-data').textContent =
                    Utils.formatDate(primeiro.data_sorteio);
                document.getElementById('stat-proximo').textContent =
                    '#' + (primeiro.concurso + 1);

                this.renderResultados(data.resultados);
            } else {
                document.getElementById('ultimos-resultados').innerHTML =
                    '<p class="text-muted">Nenhum resultado encontrado. Vá em "Inserir Dados" e importe o histórico.</p>';
            }

            // Tentar carregar ranking se modelo já treinado
            try {
                var ranking = await API.getRanking(this.currentJogo);
                if (ranking.ranking && ranking.ranking.length > 0) {
                    Charts.renderFrequencia('chart-frequencia', ranking.ranking);

                    var top10freq = ranking.ranking.slice(0, 10).map(function(r) {
                        return { numero: r.numero, value: r.score_total };
                    });
                    Charts.renderTop10('chart-top10', top10freq, 'Score', 'rgba(239, 68, 68, 0.7)');

                    var rankingCopy = ranking.ranking.slice();
                    rankingCopy.sort(function(a, b) {
                        return b.scores.atraso - a.scores.atraso;
                    });
                    var byAtraso = rankingCopy.slice(0, 10).map(function(r) {
                        return { numero: r.numero, value: r.scores.atraso };
                    });
                    Charts.renderTop10('chart-atrasados', byAtraso, 'Score Atraso', 'rgba(59, 130, 246, 0.7)');
                }
            } catch (e) {
                console.log('Ranking não disponível (modelo não treinado ainda)');
            }

        } catch (error) {
            console.warn('Dashboard:', error.message);
            if (error.message.includes('não configurada') || error.message.includes('Backend URL')) {
                document.getElementById('ultimos-resultados').innerHTML =
                    '<p class="text-muted">⚠️ Configure a URL do backend em "Inserir Dados" para começar.</p>';
            }
        }
    },

    renderResultados(resultados) {
        var container = document.getElementById('ultimos-resultados');
        if (!container) return;

        if (!resultados || resultados.length === 0) {
            container.innerHTML = '<p class="text-muted">Nenhum resultado encontrado.</p>';
            return;
        }

        var html = '';
        for (var i = 0; i < resultados.length; i++) {
            var r = resultados[i];
            var numerosHtml = '';
            for (var j = 0; j < r.numeros.length; j++) {
                numerosHtml += Utils.createBall(r.numeros[j]);
            }
            if (r.trevos && r.trevos.length > 0) {
                for (var t = 0; t < r.trevos.length; t++) {
                    numerosHtml += Utils.createBall(r.trevos[t], 'trevo');
                }
            }
            html += '<div class="resultado-item">' +
                '<span class="resultado-concurso">#' + r.concurso + '</span>' +
                '<span class="resultado-data">' + Utils.formatDate(r.data_sorteio) + '</span>' +
                '<div class="resultado-numeros">' + numerosHtml + '</div>' +
                '</div>';
        }
        container.innerHTML = html;
    },

    // ==========================================
    // ANÁLISE COMPLETA
    // ==========================================
    async executarAnalise() {
        var btn = document.getElementById('btn-analisar');
        if (btn) btn.disabled = true;
        Utils.showLoading('analise-loading');
        Utils.hideElement('analise-resultado');

        try {
            var data = await API.getAnaliseCompleta(this.currentJogo);
            this.renderAnalise(data);
            Utils.showElement('analise-resultado');
        } catch (error) {
            alert('Erro na análise: ' + error.message);
        } finally {
            Utils.hideLoading('analise-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderAnalise(data) {
        var analise = data.analise;

        // Ranking grid
        var rankingGrid = document.getElementById('ranking-grid');
        if (rankingGrid && analise.ranking_top20) {
            var maxScore = analise.ranking_top20[0] ? analise.ranking_top20[0].score_total : 1;
            var html = '';
            for (var i = 0; i < analise.ranking_top20.length; i++) {
                var r = analise.ranking_top20[i];
                var cls = Utils.getBallClass(r.score_total, maxScore);
                html += '<div class="numero-ball ' + cls + '" title="Posição #' + (i + 1) +
                    ' | Score: ' + r.score_total.toFixed(1) + '">' +
                    String(r.numero).padStart(2, '0') +
                    '<span class="score-tag">' + r.score_total.toFixed(0) + '</span>' +
                    '</div>';
            }
            rankingGrid.innerHTML = html;
        }

        // Distribuição
        var distInfo = document.getElementById('distribuicao-info');
        if (distInfo && analise.perfil_distribuicao) {
            var p = analise.perfil_distribuicao;
            distInfo.innerHTML =
                '<div class="info-grid">' +
                '<div class="info-item"><span class="info-label">Soma Média</span><span class="info-value">' + (p.soma_media ? p.soma_media.toFixed(0) : '-') + '</span></div>' +
                '<div class="info-item"><span class="info-label">Soma Min/Max</span><span class="info-value">' + (p.soma_min || '-') + ' / ' + (p.soma_max || '-') + '</span></div>' +
                '<div class="info-item"><span class="info-label">Pares (média)</span><span class="info-value">' + (p.pares_media ? p.pares_media.toFixed(1) : '-') + '</span></div>' +
                '<div class="info-item"><span class="info-label">Ímpares (média)</span><span class="info-value">' + (p.impares_media ? p.impares_media.toFixed(1) : '-') + '</span></div>' +
                '</div>';
        }

        // Universo reduzido
        var universoInfo = document.getElementById('universo-info');
        if (universoInfo && analise.universo_reduzido) {
            var u = analise.universo_reduzido;
            var ballsHtml = '';
            for (var k = 0; k < u.universo_reduzido.length; k++) {
                ballsHtml += Utils.createBall(u.universo_reduzido[k]);
            }
            universoInfo.innerHTML =
                '<p class="info-text">Universo reduzido de <strong>' + u.total_original +
                '</strong> para <strong>' + u.total_reduzido +
                '</strong> números (redução de <strong>' + u.reducao_percentual + '%</strong>)</p>' +
                '<div class="resultado-numeros" style="margin-top:12px;">' + ballsHtml + '</div>';
        }

        // Pares
        var paresList = document.getElementById('pares-list');
        if (paresList && analise.melhores_pares) {
            var paresHtml = '<div class="pares-grid">';
            var maxPares = Math.min(analise.melhores_pares.length, 15);
            for (var m = 0; m < maxPares; m++) {
                var par = analise.melhores_pares[m];
                paresHtml += '<div class="par-item">' +
                    '<span class="par-nums">' + String(par.par[0]).padStart(2, '0') + ' — ' + String(par.par[1]).padStart(2, '0') + '</span>' +
                    '<span class="par-freq">' + par.frequencia + 'x</span>' +
                    '</div>';
            }
            paresHtml += '</div>';
            paresList.innerHTML = paresHtml;
        }

        // Atrasados
        var atrasadosList = document.getElementById('atrasados-list');
        if (atrasadosList && analise.atrasados_criticos) {
            if (analise.atrasados_criticos.length === 0) {
                atrasadosList.innerHTML = '<p class="text-muted">Nenhum número com atraso crítico no momento.</p>';
            } else {
                var atHtml = '';
                for (var a = 0; a < analise.atrasados_criticos.length; a++) {
                    var at = analise.atrasados_criticos[a];
                    atHtml += '<div class="alerta-card severidade-2">' +
                        '<div class="alerta-titulo">Número ' + String(at.numero).padStart(2, '0') + '</div>' +
                        '<div class="alerta-descricao">Atraso: <strong>' + at.atraso +
                        '</strong> concursos | Esperado: ' + at.atraso_esperado +
                        ' | Ratio: <strong>' + at.ratio + 'x</strong> acima do esperado</div></div>';
                }
                atrasadosList.innerHTML = atHtml;
            }
        }
    },

    // ==========================================
    // PREVISÕES
    // ==========================================
    async gerarPrevisoes(quantidade) {
        var btn = document.getElementById('btn-prever');
        if (btn) btn.disabled = true;
        Utils.showLoading('previsoes-loading');

        try {
            var data = await API.gerarPrevisoes(this.currentJogo, quantidade);
            this.renderPrevisoes(data);

            var historico = await API.getHistoricoPrevisoes(this.currentJogo);
            this.renderHistoricoPrevisoes(historico);
        } catch (error) {
            alert('Erro nas previsões: ' + error.message);
        } finally {
            Utils.hideLoading('previsoes-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderPrevisoes(data) {
        var container = document.getElementById('previsoes-resultado');
        if (!container) return;

        var jogosHtml = '';
        for (var i = 0; i < data.jogos_sugeridos.length; i++) {
            var jogo = data.jogos_sugeridos[i];
            var numsHtml = '';
            for (var j = 0; j < jogo.numeros.length; j++) {
                numsHtml += Utils.createBall(jogo.numeros[j]);
            }
            if (jogo.trevos && jogo.trevos.length > 0) {
                for (var t = 0; t < jogo.trevos.length; t++) {
                    numsHtml += Utils.createBall(jogo.trevos[t], 'trevo');
                }
            }

            var detailsHtml = '';
            if (jogo.detalhes && jogo.detalhes.scores_individuais) {
                var keys = Object.keys(jogo.detalhes.scores_individuais);
                for (var d = 0; d < keys.length; d++) {
                    var numKey = keys[d];
                    var sc = jogo.detalhes.scores_individuais[numKey];
                    detailsHtml += '<span class="detail-chip">' + String(numKey).padStart(2, '0') + ': ' + sc.toFixed(0) + '</span>';
                }
            }

            var scoreClass = Utils.getScoreClass(jogo.score_confianca);

            jogosHtml += '<div class="previsao-card">' +
                '<div class="previsao-header">' +
                '<span class="previsao-label">Jogo ' + (i + 1) + '</span>' +
                '<span class="previsao-score ' + scoreClass + '">Score: ' + jogo.score_confianca.toFixed(1) + '</span>' +
                '</div>' +
                '<div class="resultado-numeros">' + numsHtml + '</div>' +
                '<div class="previsao-details">' + detailsHtml + '</div>' +
                '</div>';
        }

        container.innerHTML = '<div class="card">' +
            '<h3>🎯 Jogos Sugeridos para Concurso #' + data.concurso_alvo + '</h3>' +
            '<p class="info-text">' + data.disclaimer + '</p>' +
            jogosHtml +
            '</div>';
    },

    renderHistoricoPrevisoes(data) {
        var container = document.getElementById('previsoes-historico');
        if (!container) return;

        if (!data.previsoes || data.previsoes.length === 0) {
            container.innerHTML = '<p class="text-muted">Nenhuma previsão anterior.</p>';
            return;
        }

        var html = '';
        var max = Math.min(data.previsoes.length, 5);
        for (var i = 0; i < max; i++) {
            var p = data.previsoes[i];
            var numsHtml = '';
            for (var j = 0; j < p.numeros_sugeridos.length; j++) {
                numsHtml += Utils.createBall(p.numeros_sugeridos[j]);
            }
            var scoreClass = Utils.getScoreClass(p.score_confianca);
            html += '<div class="resultado-item">' +
                '<span class="resultado-concurso">Alvo #' + p.concurso_alvo + '</span>' +
                '<span class="previsao-score ' + scoreClass + '" style="font-size:13px;">' + p.score_confianca.toFixed(1) + '</span>' +
                '<div class="resultado-numeros">' + numsHtml + '</div>' +
                '</div>';
        }
        container.innerHTML = html;
    },

    // ==========================================
    // VALIDAR JOGO
    // ==========================================
    async validarJogo() {
        var btn = document.getElementById('btn-validar');
        if (btn) btn.disabled = true;
        Utils.showLoading('validacao-loading');

        var numerosStr = document.getElementById('val-numeros') ? document.getElementById('val-numeros').value : '';
        var trevosStr = document.getElementById('val-trevos') ? document.getElementById('val-trevos').value : '';

        var numeros = numerosStr.split(',').map(function(n) { return parseInt(n.trim()); }).filter(function(n) { return !isNaN(n); });
        var trevos = [];
        if (trevosStr && trevosStr.trim()) {
            trevos = trevosStr.split(',').map(function(n) { return parseInt(n.trim()); }).filter(function(n) { return !isNaN(n); });
        }

        if (numeros.length === 0) {
            alert('Insira os números do seu jogo.');
            if (btn) btn.disabled = false;
            Utils.hideLoading('validacao-loading');
            return;
        }

        try {
            var response = await API.request('/api/validacao/validar-jogo', {
                method: 'POST',
                body: JSON.stringify({
                    jogo_slug: this.currentJogo,
                    numeros: numeros,
                    trevos: trevos
                })
            });
            this.renderValidacao(response);
        } catch (error) {
            alert('Erro: ' + error.message);
        } finally {
            Utils.hideLoading('validacao-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderValidacao(data) {
        var container = document.getElementById('validacao-resultado');
        if (!container) return;

        var scoreClass = data.score_medio >= 65 ? 'score-high' :
                         data.score_medio >= 40 ? 'score-mid' : 'score-low';

        // Números com bolas coloridas
        var numsHtml = '';
        for (var i = 0; i < data.numeros.length; i++) {
            var n = data.numeros[i];
            var score = data.scores_individuais[String(n)] ? data.scores_individuais[String(n)].score_ensemble : 0;
            var cls = score >= 60 ? 'hot' : score >= 40 ? 'warm' : score >= 20 ? 'neutral' : 'cold';
            numsHtml += '<div class="numero-ball ' + cls + '" title="Score: ' + score.toFixed(1) + '">' +
                String(n).padStart(2, '0') +
                '<span class="score-tag">' + score.toFixed(0) + '</span></div>';
        }

        // Recomendações
        var recsHtml = '';
        if (data.recomendacoes.length > 0) {
            recsHtml = '<h3>Recomendações</h3>';
            for (var r = 0; r < data.recomendacoes.length; r++) {
                var rec = data.recomendacoes[r];
                var sev = rec.tipo === 'critico' ? '3' : rec.tipo === 'aviso' ? '2' : '1';
                recsHtml += '<div class="alerta-card severidade-' + sev + '">' +
                    '<div class="alerta-descricao">' + rec.mensagem + '</div></div>';
            }
        } else {
            recsHtml = '<p class="info-text">✅ Nenhuma recomendação — jogo bem equilibrado!</p>';
        }

        // Substituições
        var subsHtml = '';
        if (data.substituicoes_sugeridas.length > 0) {
            subsHtml = '<h3>Substituições Sugeridas</h3>';
            for (var s = 0; s < data.substituicoes_sugeridas.length; s++) {
                var sub = data.substituicoes_sugeridas[s];
                subsHtml += '<div class="resultado-item" style="margin-bottom:8px;">' +
                    'Trocar <span class="numero-ball cold" style="width:36px;height:36px;font-size:13px;display:inline-flex;">' +
                    String(sub.remover).padStart(2, '0') + '</span>' +
                    ' <span class="text-muted">(score ' + sub.remover_score.toFixed(0) + ')</span>' +
                    ' ➜ ' +
                    '<span class="numero-ball hot" style="width:36px;height:36px;font-size:13px;display:inline-flex;">' +
                    String(sub.adicionar).padStart(2, '0') + '</span>' +
                    ' <span class="text-muted">(score ' + sub.adicionar_score.toFixed(0) + ')</span>' +
                    '</div>';
            }
        }

        var v = data.validacao_distribuicao;
        var somaIcon = v.soma_dentro_padrao ? ' ✅' : ' ⚠️';

        container.innerHTML = '<div class="card">' +
            '<div class="validacao-header">' +
            '<div class="validacao-classificacao">' + data.classificacao + '</div>' +
            '<div class="previsao-score ' + scoreClass + '" style="font-size:32px;">Score: ' + data.score_medio + '</div>' +
            '<div class="text-muted">Posição média no ranking: ' + data.posicao_media + '</div>' +
            '</div>' +
            '<h3>Seus Números</h3>' +
            '<div class="resultado-numeros" style="margin-bottom:20px;">' + numsHtml + '</div>' +
            '<h3>Distribuição</h3>' +
            '<div class="resultado-item" style="margin-bottom:16px;">' +
            'Soma: <strong>' + v.soma + '</strong> (ideal: ' + v.soma_ideal_range[0] + ' - ' + v.soma_ideal_range[1] + ')' + somaIcon +
            ' | Pares: <strong>' + v.pares + '</strong> | Ímpares: <strong>' + v.impares + '</strong>' +
            '</div>' +
            recsHtml +
            subsHtml +
            '</div>';
    },

    // ==========================================
    // FECHAMENTO
    // ==========================================
    async gerarFechamento() {
        var btn = document.getElementById('btn-fechamento');
        if (btn) btn.disabled = true;
        Utils.showLoading('fechamento-loading');

        var universo = parseInt(document.getElementById('fech-universo').value) || 18;
        var garantia = document.getElementById('fech-garantia').value || 'quadra';

        try {
            var data = await API.gerarFechamento(this.currentJogo, garantia, universo);
            this.renderFechamento(data);
        } catch (error) {
            alert('Erro no fechamento: ' + error.message);
        } finally {
            Utils.hideLoading('fechamento-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderFechamento(data) {
        var container = document.getElementById('fechamento-resultado');
        if (!container) return;

        var universoHtml = '';
        for (var i = 0; i < data.universo.length; i++) {
            universoHtml += Utils.createBall(data.universo[i]);
        }

        var cartelasHtml = '';
        for (var c = 0; c < data.cartelas.length; c++) {
            var cartela = data.cartelas[c];
            var cartelaNums = '';
            for (var n = 0; n < cartela.length; n++) {
                cartelaNums += Utils.createBall(cartela[n]);
            }
            cartelasHtml += '<div class="cartela-item">' +
                '<span class="cartela-num">#' + (c + 1) + '</span>' +
                '<div class="resultado-numeros">' + cartelaNums + '</div>' +
                '</div>';
        }

        container.innerHTML = '<div class="card">' +
            '<h3>🔒 Fechamento Gerado</h3>' +
            '<div class="stats-grid">' +
            '<div class="stat-card"><div class="stat-value">' + data.total_cartelas + '</div><div class="stat-label">Cartelas</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + data.universo_tamanho + '</div><div class="stat-label">Números Base</div></div>' +
            '<div class="stat-card accent"><div class="stat-value">' + Utils.formatMoney(data.custo_total) + '</div><div class="stat-label">Custo Total</div></div>' +
            '</div>' +
            '<p class="info-text">' + data.garantia + '</p>' +
            '<h4>Universo de Números:</h4>' +
            '<div class="resultado-numeros" style="margin:8px 0 20px;">' + universoHtml + '</div>' +
            '<h4>Cartelas (' + data.total_cartelas + '):</h4>' +
            '<div class="cartelas-grid">' + cartelasHtml + '</div>' +
            '</div>';
    },

    // ==========================================
    // BACKTESTING
    // ==========================================
    async executarBacktest() {
        var btn = document.getElementById('btn-backtest');
        if (btn) btn.disabled = true;
        Utils.showLoading('backtest-loading');

        var concursos = parseInt(document.getElementById('bt-concursos').value) || 50;
        var cartelas = parseInt(document.getElementById('bt-cartelas').value) || 3;

        try {
            var data = await API.executarBacktest(this.currentJogo, concursos, cartelas);
            this.renderBacktest(data);
        } catch (error) {
            alert('Erro no backtesting: ' + error.message);
        } finally {
            Utils.hideLoading('backtest-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderBacktest(data) {
        var container = document.getElementById('backtest-resultado');
        if (!container) return;

        var acertos = data.distribuicao_acertos || {};
        var taxas = data.taxa_acerto_por_faixa || {};

        var acertosKeys = Object.keys(acertos).sort(function(a, b) { return parseInt(b) - parseInt(a); });

        var rowsHtml = '';
        for (var i = 0; i < acertosKeys.length; i++) {
            var k = acertosKeys[i];
            var v = acertos[k];
            var pct = taxas[k] || 0;
            var barWidth = Math.min(pct * 3, 100);
            rowsHtml += '<div class="backtest-row">' +
                '<span class="backtest-label">' + k + ' acertos</span>' +
                '<div class="backtest-bar-container"><div class="backtest-bar" style="width:' + barWidth + '%"></div></div>' +
                '<span class="backtest-value">' + v + ' cartelas (' + pct + '%)</span>' +
                '</div>';
        }

        container.innerHTML = '<div class="card">' +
            '<h3>📈 Resultados do Backtesting</h3>' +
            '<div class="stats-grid">' +
            '<div class="stat-card"><div class="stat-value">' + data.total_concursos_testados + '</div><div class="stat-label">Concursos Testados</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + data.total_cartelas_geradas + '</div><div class="stat-label">Cartelas Geradas</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatDate(data.periodo ? data.periodo.inicio : '') + '</div><div class="stat-label">Período Início</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatDate(data.periodo ? data.periodo.fim : '') + '</div><div class="stat-label">Período Fim</div></div>' +
            '</div>' +
            '<h4>Distribuição de Acertos:</h4>' +
            '<div class="backtest-results">' + rowsHtml + '</div>' +
            '</div>';
    },

    // ==========================================
    // ALERTAS
    // ==========================================
    async verificarAlertas() {
        var btn = document.getElementById('btn-verificar-alertas');
        if (btn) btn.disabled = true;
        Utils.showLoading('alertas-loading');

        try {
            var data = await API.verificarAlertas(this.currentJogo);
            this.renderAlertas(data.alertas || []);
        } catch (error) {
            alert('Erro nos alertas: ' + error.message);
        } finally {
            Utils.hideLoading('alertas-loading');
            if (btn) btn.disabled = false;
        }
    },

    renderAlertas(alertas) {
        var container = document.getElementById('alertas-lista');
        if (!container) return;

        if (alertas.length === 0) {
            container.innerHTML = '<p class="text-muted">Nenhum alerta detectado no momento.</p>';
            return;
        }

        var html = '';
        for (var i = 0; i < alertas.length; i++) {
            var a = alertas[i];
            var numsHtml = '';
            var nums = a.numeros || a.numeros_envolvidos || [];
            if (nums.length > 0) {
                numsHtml = '<div class="resultado-numeros" style="margin-top:8px;">';
                for (var j = 0; j < nums.length; j++) {
                    numsHtml += Utils.createBall(nums[j]);
                }
                numsHtml += '</div>';
            }

            html += '<div class="alerta-card severidade-' + a.severidade + '">' +
                '<div class="alerta-titulo">' + a.titulo + '</div>' +
                '<div class="alerta-descricao">' + a.descricao + '</div>' +
                numsHtml +
                '</div>';
        }
        container.innerHTML = html;

        var badge = document.getElementById('alertas-badge');
        if (badge && alertas.length > 0) {
            badge.textContent = alertas.length;
            badge.classList.remove('hidden');
        }
    },

    // ==========================================
    // INSERIR RESULTADO MANUAL
    // ==========================================
    async inserirResultado() {
        var concurso = parseInt(document.getElementById('inp-concurso').value);
        var dataSorteio = document.getElementById('inp-data').value;
        var numerosStr = document.getElementById('inp-numeros').value || '';
        var trevosStr = document.getElementById('inp-trevos') ? document.getElementById('inp-trevos').value : '';
        var premio = parseFloat(document.getElementById('inp-premio').value) || 0;
        var acumulou = document.getElementById('inp-acumulou').checked || false;

        if (!concurso || !dataSorteio || !numerosStr.trim()) {
            Utils.showFeedback('inserir-feedback', '⚠️ Preencha concurso, data e números.', 'error');
            return;
        }

        var numeros = numerosStr.split(',').map(function(n) { return parseInt(n.trim()); }).filter(function(n) { return !isNaN(n); });
        var trevos = [];
        if (trevosStr && trevosStr.trim()) {
            trevos = trevosStr.split(',').map(function(n) { return parseInt(n.trim()); }).filter(function(n) { return !isNaN(n); });
        }

        try {
            await API.inserirResultado({
                jogo_slug: this.currentJogo,
                concurso: concurso,
                data_sorteio: dataSorteio,
                numeros: numeros,
                trevos: trevos,
                premio_principal: premio,
                acumulou: acumulou
            });

            Utils.showFeedback('inserir-feedback', '✅ Concurso #' + concurso + ' inserido com sucesso!', 'success');

            document.getElementById('inp-concurso').value = '';
            document.getElementById('inp-numeros').value = '';
            if (document.getElementById('inp-trevos')) {
                document.getElementById('inp-trevos').value = '';
            }

        } catch (error) {
            Utils.showFeedback('inserir-feedback', '❌ Erro: ' + error.message, 'error');
        }
    },

    // ==========================================
    // IMPORTAR HISTÓRICO
    // ==========================================
    async importarHistorico() {
        var btn = document.getElementById('btn-importar-todos');
        if (btn) btn.disabled = true;

        var desdeAno = parseInt(document.getElementById('import-desde').value) || 2020;

        Utils.showFeedback('import-feedback',
            '⏳ Importando dados da Caixa... Isso pode levar vários minutos. <strong>NÃO feche esta página.</strong>',
            'success'
        );

        try {
            var data = await API.request('/api/importar-todos?desde_ano=' + desdeAno, {
                method: 'POST'
            });

            var msg = '✅ <strong>Importação concluída!</strong><br><br>';
            if (data.resultados) {
                for (var i = 0; i < data.resultados.length; i++) {
                    var r = data.resultados[i];
                    var icon = r.status === 'importado' ? '✅' :
                               r.status === 'ja_atualizado' ? '➖' : '⚠️';
                    msg += icon + ' <strong>' + r.jogo + '</strong>: ' + r.status;
                    if (r.inseridos !== undefined) msg += ' (' + r.inseridos + ' inseridos)';
                    if (r.range) msg += ' [' + r.range + ']';
                    msg += '<br>';
                }
            }
            msg += '<br>🎉 Agora volte ao Dashboard e execute a Análise IA!';

            Utils.showFeedback('import-feedback', msg, 'success');
            this.loadDashboard();

        } catch (error) {
            Utils.showFeedback('import-feedback', '❌ Erro: ' + error.message, 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    // ==========================================
    // FORÇAR ATUALIZAÇÃO
    // ==========================================
    async forcarAtualizacao() {
        var btn = document.getElementById('btn-forcar-update');
        if (btn) btn.disabled = true;

        try {
            var data = await API.request('/api/atualizar', {
                method: 'POST'
            });

            var msg = '🔄 Atualização concluída:<br>';
            if (data.resultados) {
                for (var i = 0; i < data.resultados.length; i++) {
                    var r = data.resultados[i];
                    var icon = r.status === 'novo_resultado' ? '✅' :
                               r.status === 'sem_novidade' ? '➖' : '⚠️';
                    msg += icon + ' ' + r.slug + ': ' + r.status;
                    if (r.concurso) msg += ' (#' + r.concurso + ')';
                    msg += '<br>';
                }
            }

            Utils.showFeedback('update-feedback', msg, 'success');
            this.loadDashboard();

        } catch (error) {
            Utils.showFeedback('update-feedback', '❌ Erro: ' + error.message, 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }
};

// ==========================================
// INICIALIZAR QUANDO DOM ESTIVER PRONTO
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});
