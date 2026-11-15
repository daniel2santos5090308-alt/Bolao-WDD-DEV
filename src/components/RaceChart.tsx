import { useEffect, useMemo, useState } from 'react';
import { formatPoints } from '../services/scoring';

/**
 * "Corrida pelo titulo": pontos acumulados por rodada, uma linha por participante.
 * - Cor segue o participante (ordem alfabetica fixa), nunca a posicao.
 * - Paleta categorica validada (CVD/contraste) contra a superficie escura do app.
 * - Legenda sempre presente + rotulo direto no fim de cada linha + tooltip com crosshair.
 */
export const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

interface RaceChartProps {
  history: RankingHistoryRow[];
}

interface Series {
  userId: string;
  name: string;
  color: string;
  points: Array<{ roundNumber: number; roundName: string; total: number; roundPoints: number; position: number }>;
}

const HEIGHT = 260;
const PAD = { top: 16, right: 96, bottom: 28, left: 40 };

/** Passo "redondo" (1, 2, 2,5, 5 x 10^n) para ~4 divisões; evita eixos como 38 / 113. */
function niceStep(maxValue: number): number {
  const raw = Math.max(1, maxValue) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const candidates = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude);
  return candidates.find((step) => step >= raw) ?? 10 * magnitude;
}

export function RaceChart({ history }: RaceChartProps) {
  // Callback ref: o grafico so monta quando ha dados; o observer liga quando o elemento aparece.
  const [plotNode, setPlotNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!plotNode) return;
    setWidth(Math.max(280, plotNode.clientWidth));
    const observer = new ResizeObserver((entries) => setWidth(Math.max(280, entries[0].contentRect.width)));
    observer.observe(plotNode);
    return () => observer.disconnect();
  }, [plotNode]);

  const { rounds, series } = useMemo(() => {
    const roundMap = new Map<number, string>();
    const byUser = new Map<string, Series>();
    history.forEach((row) => {
      roundMap.set(row.roundNumber, row.roundName);
      if (!byUser.has(row.userId)) byUser.set(row.userId, { userId: row.userId, name: row.userName, color: '', points: [] });
      byUser.get(row.userId)!.points.push({
        roundNumber: row.roundNumber, roundName: row.roundName, total: row.totalPoints,
        roundPoints: row.roundPoints, position: row.position
      });
    });
    const ordered = [...byUser.values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, SERIES_COLORS.length)
      .map((item, index) => ({ ...item, color: SERIES_COLORS[index], points: item.points.sort((a, b) => a.roundNumber - b.roundNumber) }));
    return {
      rounds: [...roundMap.entries()].sort((a, b) => a[0] - b[0]).map(([number, name]) => ({ number, name })),
      series: ordered
    };
  }, [history]);

  if (rounds.length < 2 || series.length === 0) {
    return <div className="empty-state">A corrida pelo título aparece a partir da 2ª rodada encerrada.</div>;
  }

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const dataMax = Math.max(...series.flatMap((item) => item.points.map((point) => point.total)));
  const step = niceStep(dataMax);
  const maxY = Math.max(step, Math.ceil(dataMax / step) * step);
  const x = (index: number) => PAD.left + (rounds.length === 1 ? plotW / 2 : (index / (rounds.length - 1)) * plotW);
  const y = (value: number) => PAD.top + plotH - (value / maxY) * plotH;
  const ticks = Array.from({ length: Math.round(maxY / step) + 1 }, (_, index) => index * step);
  const xLabelEvery = Math.max(1, Math.ceil(rounds.length / Math.max(2, Math.floor(plotW / 48))));

  // Rotulos no fim das linhas, afastados para nao colidir
  const endLabels = series
    .map((item) => ({ item, y: y(item.points[item.points.length - 1]?.total ?? 0) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i += 1) {
    if (endLabels[i].y - endLabels[i - 1].y < 15) endLabels[i].y = endLabels[i - 1].y + 15;
  }

  const hovered = hoverIndex !== null ? rounds[hoverIndex] : null;
  const tooltipRows = hovered
    ? series
      .map((item) => ({ item, point: item.points.find((point) => point.roundNumber === hovered.number) }))
      .filter((row) => row.point)
      .sort((a, b) => (a.point!.position - b.point!.position))
    : [];

  return (
    <div className="race-chart">
      <ul className="chart-legend">
        {series.map((item) => (
          <li key={item.userId}><span className="chart-legend__swatch" style={{ background: item.color }} />{item.name}</li>
        ))}
      </ul>

      <div className="race-chart__plot" ref={setPlotNode} onMouseLeave={() => setHoverIndex(null)}>
        <svg width={width} height={HEIGHT} role="img" aria-label="Pontos acumulados por rodada de cada participante">
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="chart-grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(tick)} y2={y(tick)} />
              <text className="chart-axis-label" x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">{tick}</text>
            </g>
          ))}
          {rounds.map((round, index) => (index % xLabelEvery === 0 || index === rounds.length - 1) ? (
            <text key={round.number} className="chart-axis-label" x={x(index)} y={HEIGHT - 8} textAnchor="middle">R{round.number}</text>
          ) : null)}

          {hoverIndex !== null ? (
            <line className="chart-crosshair" x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD.top} y2={PAD.top + plotH} />
          ) : null}

          {series.map((item) => {
            const path = item.points
              .map((point) => {
                const index = rounds.findIndex((round) => round.number === point.roundNumber);
                return `${x(index)},${y(point.total)}`;
              })
              .join(' L ');
            const last = item.points[item.points.length - 1];
            const lastIndex = rounds.findIndex((round) => round.number === last.roundNumber);
            return (
              <g key={item.userId}>
                <path d={`M ${path}`} fill="none" stroke={item.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(lastIndex)} cy={y(last.total)} r={4.5} fill={item.color} className="chart-marker" />
                {hoverIndex !== null ? (() => {
                  const point = item.points.find((entry) => entry.roundNumber === rounds[hoverIndex].number);
                  return point ? <circle cx={x(hoverIndex)} cy={y(point.total)} r={4.5} fill={item.color} className="chart-marker" /> : null;
                })() : null}
              </g>
            );
          })}

          {endLabels.map(({ item, y: labelY }) => (
            <text key={item.userId} className="chart-end-label" x={PAD.left + plotW + 10} y={labelY} dy="0.32em">
              {item.name.split(' ')[0]}
            </text>
          ))}

          {rounds.map((round, index) => {
            const half = rounds.length > 1 ? plotW / (rounds.length - 1) / 2 : plotW / 2;
            return (
              <rect
                key={round.number}
                x={x(index) - half}
                y={PAD.top}
                width={half * 2}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
                onClick={() => setHoverIndex(index)}
              />
            );
          })}
        </svg>

        {hovered ? (
          <div
            className="chart-tooltip"
            style={{ left: Math.min(x(hoverIndex!) + 12, width - 190), top: PAD.top }}
          >
            <strong>{hovered.name}</strong>
            {tooltipRows.map(({ item, point }) => (
              <div key={item.userId} className="chart-tooltip__row">
                <span className="chart-legend__swatch" style={{ background: item.color }} />
                <span>{point!.position}º {item.name.split(' ')[0]}</span>
                <strong>{formatPoints(point!.total)}</strong>
                <small>+{formatPoints(point!.roundPoints)}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
