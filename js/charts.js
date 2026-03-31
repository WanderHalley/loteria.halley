/**
 * LotoQuant - Gráficos (Chart.js)
 */
const Charts = {
    instances: {},

    defaultOptions: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#94a3b8', font: { size: 12 } }
            }
        },
        scales: {
            x: {
                ticks: { color: '#64748b', font: { size: 11 } },
                grid: { color: 'rgba(45, 55, 72, 0.5)' }
            },
            y: {
                ticks: { color: '#64748b', font: { size: 11 } },
                grid: { color: 'rgba(45, 55, 72, 0.5)' }
            }
        }
    },

    destroy(id) {
        if (this.instances[id]) {
            this.instances[id].destroy();
            delete this.instances[id];
        }
    },

    renderFrequencia(canvasId, ranking) {
        this.destroy(canvasId);

        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const labels = ranking.map(r => r.numero);
        const data = ranking.map(r => r.score_total);

        const colors = data.map(v => {
            const max = Math.max(...data);
            const ratio = v / max;
            if (ratio > 0.75) return 'rgba(239, 68, 68, 0.8)';
            if (ratio > 0.5) return 'rgba(245, 158, 11, 0.8)';
            if (ratio > 0.25) return 'rgba(59, 130, 246, 0.8)';
            return 'rgba(100, 116, 139, 0.5)';
        });

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Score Ensemble',
                    data,
                    backgroundColor: colors,
                    borderRadius: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: { display: false }
                }
            }
        });
    },

    renderTop10(canvasId, items, label, color) {
        this.destroy(canvasId);

        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: items.map(i => `Nº ${i.numero}`),
                datasets: [{
                    label,
                    data: items.map(i => i.value),
                    backgroundColor: color,
                    borderRadius: 6
                }]
            },
            options: {
                ...this.defaultOptions,
                indexAxis: 'y',
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: { display: false }
                }
            }
        });
    },

    renderModelosRadar(canvasId, numero, scores) {
        this.destroy(canvasId);

        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.instances[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Frequência', 'Atraso', 'Padrões', 'Distribuição', 'LSTM', 'XGBoost'],
                datasets: [{
                    label: `Nº ${numero}`,
                    data: [
                        scores.frequencia,
                        scores.atraso,
                        scores.padrao,
                        scores.distribuicao,
                        scores.lstm,
                        scores.xgboost
                    ],
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 0.8)',
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#fff',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(45, 55, 72, 0.5)' },
                        grid: { color: 'rgba(45, 55, 72, 0.5)' },
                        pointLabels: { color: '#94a3b8', font: { size: 12 } },
                        ticks: { display: false },
                        min: 0,
                        max: 1
                    }
                }
            }
        });
    }
};
