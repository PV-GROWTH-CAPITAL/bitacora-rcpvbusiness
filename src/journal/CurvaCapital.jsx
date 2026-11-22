// Panel «Curva de capital».
import React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { enmascarar } from "../utils/importes";
import { fmtMoney, fmtDate } from "./formato";

export default function CurvaCapital({ equityData }) {
  return (
    <div className="jt-panel">
      <div className="jt-panel-title jt-mono">CURVA DE CAPITAL</div>
      <div style={{ height: 220 }}>
        {equityData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="jtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C6A15A" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#C6A15A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#262C39" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="idx" stroke="#8891A1" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} />
              <YAxis stroke="#8891A1" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} width={70}
                tickFormatter={(v) => enmascarar(`${v.toLocaleString("es-ES")} $`)} />
              <ReferenceLine y={0} stroke="#262C39" />
              <Tooltip
                contentStyle={{ background: "#171D28", border: "1px solid #262C39", borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }}
                    itemStyle={{ color: "#ECEFF3" }}
                    labelStyle={{ color: "#8891A1", marginBottom: 4 }}
                labelFormatter={(v, p) => (p && p[0] ? fmtDate(p[0].payload.fecha) : v)}
                formatter={(v) => [fmtMoney(v), "Capital acumulado"]}
              />
              <Area type="monotone" dataKey="capital" stroke="#C6A15A" strokeWidth={2.5} fill="url(#jtGrad)" animationDuration={1100} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="jt-empty">Registra al menos 2 operaciones para ver tu curva de capital.</div>
        )}
      </div>
    </div>
  );
}
