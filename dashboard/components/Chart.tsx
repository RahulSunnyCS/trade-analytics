"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts";

type Props = {
  option: any;
  height?: number;
  className?: string;
};

export function Chart({ option, height = 300, className = "" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const instRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const inst = echarts.init(ref.current);
    instRef.current = inst;
    const ro = new ResizeObserver(() => inst.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      inst.dispose();
      instRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (instRef.current) instRef.current.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={`chart ${className}`.trim()} style={{ height }} />;
}
