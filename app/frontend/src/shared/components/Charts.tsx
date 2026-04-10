import {
  Area,
  AreaChart,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
} from 'recharts';

interface LineChartProps {
  data: number[];
  color?: string;
  fillColor?: string;
  height?: number;
  showDots?: boolean;
  smooth?: boolean;
}

interface LineAreaChartProps {
  data: number[];
  color?: string;
  fillOpacity?: number;
  height?: number;
}

interface MultiLineChartDataset {
  data: number[];
  color: string;
  fillOpacity?: number;
}

interface MultiLineChartProps {
  datasets: MultiLineChartDataset[];
  height?: number;
}

interface LineMetricChartProps {
  data: number[];
  color?: string;
  fillOpacity?: number;
  height?: number;
  showArea?: boolean;
}

interface DualLineChartProps {
  data1: number[];
  data2: number[];
  height?: number;
  color1?: string;
  color2?: string;
  fillOpacity1?: number;
  fillOpacity2?: number;
}

interface BarChartProps {
  data: number[];
  color?: string;
  height?: number;
  gap?: number;
}

function toLineData(data: number[]) {
  return data.map((value, index) => ({ index, value }));
}

function gradientId(prefix: string, color: string, index = 0) {
  return `${prefix}-${color.replace(/[^a-zA-Z0-9]/g, '') || 'chart'}-${index}`;
}

export function LineChart({
  data,
  color = '#ff7043',
  fillColor = 'transparent',
  height = 76,
  showDots = true,
  smooth = true,
}: LineChartProps) {
  const chartData = toLineData(data);

  return (
    <div className="chart-wrap" style={{ height: `${height}px`, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={chartData}>
          <Line
            type={smooth ? 'monotone' : 'linear'}
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={showDots ? { r: 2, fill: color } : false}
            fill={fillColor}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineAreaChart({
  data,
  color = '#e8316a',
  fillOpacity = 0.15,
  height = 130,
}: LineAreaChartProps) {
  const chartData = toLineData(data);
  const id = gradientId('gradient', color);

  return (
    <div className="chart-wrap" style={{ height: `${height}px`, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiLineChart({
  datasets,
  height = 58,
}: MultiLineChartProps) {
  const maxLength = Math.max(...datasets.map((dataset) => dataset.data.length));
  const chartData = Array.from({ length: maxLength }, (_, index) => {
    const point: Record<string, number> = { index };
    datasets.forEach((dataset, datasetIndex) => {
      point[`value${datasetIndex}`] = dataset.data[index] ?? 0;
    });
    return point;
  });

  return (
    <div className="chart-wrap" style={{ height: `${height}px`, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            {datasets.map((dataset, index) => {
              const id = gradientId('gradient-multi', dataset.color, index);
              return (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={dataset.color}
                    stopOpacity={dataset.fillOpacity ?? 0.15}
                  />
                  <stop offset="100%" stopColor={dataset.color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          {datasets.map((dataset, index) => {
            const id = gradientId('gradient-multi', dataset.color, index);
            return (
              <Area
                key={id}
                type="monotone"
                dataKey={`value${index}`}
                stroke={dataset.color}
                strokeWidth={2}
                fill={`url(#${id})`}
                dot={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineMetricChart({
  data,
  color = '#ff7043',
  fillOpacity = 0.15,
  height = 76,
  showArea = false,
}: LineMetricChartProps) {
  if (showArea) {
    return (
      <LineAreaChart
        data={data}
        color={color}
        fillOpacity={fillOpacity}
        height={height}
      />
    );
  }

  return <LineChart data={data} color={color} height={height} showDots={false} />;
}

export function DualLineChart({
  data1,
  data2,
  height = 58,
  color1 = '#6c8ef0',
  color2 = '#9c7ef0',
  fillOpacity1 = 0.15,
  fillOpacity2 = 0.15,
}: DualLineChartProps) {
  return (
    <MultiLineChart
      datasets={[
        { data: data1, color: color1, fillOpacity: fillOpacity1 },
        { data: data2, color: color2, fillOpacity: fillOpacity2 },
      ]}
      height={height}
    />
  );
}

export function BarChart({
  data,
  color = '#3dd68c',
  height = 128,
  gap = 4,
}: BarChartProps) {
  return (
    <div className="flex h-full items-end" style={{ gap: `${gap}px`, height: `${height}px` }}>
      {data.map((value, index) => (
        <div
          key={index}
          className="flex-1 cursor-pointer rounded-[var(--radius-xs)] transition-all hover:opacity-80"
          style={{
            height: `${value}%`,
            background: color,
          }}
          title={`${value}%`}
        />
      ))}
    </div>
  );
}
