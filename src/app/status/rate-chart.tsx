"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import type { RateSnapshot } from "@/lib/db/schema";

interface RateChartProps {
  data: RateSnapshot[];
  threshold?: number;
}

export function RateChart({ data, threshold }: RateChartProps) {
  const chartData = useMemo(() => {
    return data
      .map((snapshot) => ({
        date: new Date(snapshot.snapshotDate).getTime(),
        rate: parseFloat(snapshot.value),
        formattedDate: format(new Date(snapshot.snapshotDate), "MMM d"),
      }))
      .sort((a, b) => a.date - b.date);
  }, [data]);

  const domain = useMemo(() => {
    if (chartData.length === 0) return [0, 10];
    const rates = chartData.map((d) => d.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const padding = (max - min) * 0.1 || 0.5;
    return [Math.floor((min - padding) * 10) / 10, Math.ceil((max + padding) * 10) / 10];
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No data to display
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const data = payload[0].payload;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                  <p className="text-sm text-gray-500">{data.formattedDate}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {data.rate.toFixed(3)}%
                  </p>
                </div>
              );
            }}
          />
          {threshold && (
            <ReferenceLine
              y={threshold}
              stroke="#4f46e5"
              strokeDasharray="5 5"
              label={{
                value: `Threshold: ${threshold}%`,
                position: "insideTopRight",
                fill: "#4f46e5",
                fontSize: 12,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={chartData.length < 20}
            activeDot={{ r: 6, strokeWidth: 2, fill: "#fff" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
