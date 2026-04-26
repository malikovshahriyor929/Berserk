import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ReportCategory, ReportMetric } from "../report-formatters.js";

const WIDTH = 960;
const HEIGHT = 420;

const chartCanvas = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: "white",
});

function toDataUrl(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

class ChartService {
  async generateCategoryChart(categories: ReportCategory[]) {
    if (categories.length === 0) {
      return null;
    }

    const values = categories
      .map((item) => Number(String(item.total).replace(/[^0-9.-]/g, "")))
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) {
      return null;
    }

    const buffer = await chartCanvas.renderToBuffer({
      type: "bar",
      data: {
        labels: categories.map((item) => item.name),
        datasets: [
          {
            label: "Total",
            data: categories.map((item) => Number(String(item.total).replace(/[^0-9.-]/g, "")) || 0),
            backgroundColor: "#112855",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#334155",
            },
            grid: {
              display: false,
            },
          },
          y: {
            ticks: {
              color: "#334155",
            },
            grid: {
              color: "#E5E7EB",
            },
          },
        },
      },
    });

    return toDataUrl(buffer);
  }

  async generateMetricsChart(metrics: ReportMetric[]) {
    const selected = metrics
      .filter((item) => ["Jami daromad", "Jami xarajat", "Sof foyda"].includes(item.label))
      .map((item) => ({
        label: item.label,
        value: Number(String(item.value).replace(/[^0-9.-]/g, "")) || 0,
      }));

    if (selected.every((item) => item.value === 0)) {
      return null;
    }

    const buffer = await chartCanvas.renderToBuffer({
      type: "bar",
      data: {
        labels: selected.map((item) => item.label),
        datasets: [
          {
            label: "Amount",
            data: selected.map((item) => item.value),
            backgroundColor: ["#112855", "#D97706", "#16A34A"],
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#334155",
            },
            grid: {
              display: false,
            },
          },
          y: {
            ticks: {
              color: "#334155",
            },
            grid: {
              color: "#E5E7EB",
            },
          },
        },
      },
    });

    return toDataUrl(buffer);
  }
}

export default new ChartService();
