import React, { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import Papa from "papaparse";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import "chart.js/auto";
import { useClusterContext } from "./ClusterContext";
import { Chart as ChartJS, registerables } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import "chartjs-plugin-dragdata";

ChartJS.register(...registerables, zoomPlugin);

const InteractiveLineChart = () => {
  const { selectedClusters } = useClusterContext();
  const [yAxisRange, setYAxisRange] = useState([-1.0, 1.0]);
  const [customYMin, setCustomYMin] = useState(yAxisRange[0]);
  const [customYMax, setCustomYMax] = useState(yAxisRange[1]);
  const [timeRange, setTimeRange] = useState([0, 499]);
  const [customTimeStart, setCustomTimeStart] = useState(timeRange[0]);
  const [customTimeEnd, setCustomTimeEnd] = useState(timeRange[1]);
  const [graphMode, setGraphMode] = useState("pan");
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  const [filteredData, setFilteredData] = useState({
    labels: [],
    datasets: [],
  });
  const [currentZoom, setCurrentZoom] = useState({
    x: { min: undefined, max: undefined },
    y: { min: undefined, max: undefined },
  });

  const [selectedSignal, setSelectedSignal] = useState(null);
  const [modifiedData, setModifiedData] = useState([]);
  const chartRef = useRef(null);

  const clusterColors = [
    "rgba(75, 192, 192, 1)",
    "rgba(54, 162, 235, 1)",
    "rgba(255, 206, 86, 1)",
    "rgba(255, 99, 132, 1)",
    "rgba(153, 102, 255, 1)",
    "rgba(255, 159, 64, 1)",
    "rgba(199, 199, 199, 1)",
    "rgba(255, 206, 86, 1)",
  ];

  useEffect(() => {
    const csvFilePath = `${process.env.PUBLIC_URL}/kmeans_output1.csv`;

    fetch(csvFilePath)
      .then((response) => response.text())
      .then((csvData) => {
        Papa.parse(csvData, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const labels = [];
            const dataPoints = [];

            results.data.forEach((row) => {
              const startTime = row.window_start_time;
              const peakToPeakValue = parseFloat(row.peak_to_peak);
              const clusterId = parseInt(row.cluster_id, 10);

              if (!labels.includes(startTime)) {
                labels.push(startTime);
              }

              dataPoints.push({
                x: startTime,
                y: peakToPeakValue,
                clusterId: clusterId,
                id: row.window_start_time,
                window_end_time: row.window_end_time,
              });
            });

            const newData = {
              labels: labels,
              datasets: [
                {
                  label: "Peak to Peak with Clusters",
                  data: dataPoints,
                  borderWidth: 2,
                  segment: {
                    borderColor: (ctx) => {
                      const clusterId = ctx.p0?.raw?.clusterId;
                      const baseColor =
                        clusterColors[clusterId % clusterColors.length];
                      if (
                        selectedClusters.length === 0 ||
                        selectedClusters.includes(clusterId)
                      ) {
                        return baseColor;
                      }
                      return baseColor.replace("1)", "0.2)");
                    },
                  },
                  pointRadius: 0,
                },
              ],
            };
            setChartData(newData);

            const filteredLabels = newData.labels.slice(
              timeRange[0],
              timeRange[1] + 1
            );
            const filteredDataPoints = newData.datasets[0].data.slice(
              timeRange[0],
              timeRange[1] + 1
            );

            setFilteredData({
              labels: filteredLabels,
              datasets: [
                {
                  ...newData.datasets[0],
                  data: filteredDataPoints,
                },
              ],
            });

            setModifiedData(results.data);
          },
        });
      });
  }, [selectedClusters, timeRange]);

  const handleZoomUpdate = () => {
    if (chartRef.current && chartRef.current.chart) {
      const chart = chartRef.current.chart;

      const minTime = chart.scales.x.min;
      const maxTime = chart.scales.x.max;
      const minAmplitude = chart.scales.y.min;
      const maxAmplitude = chart.scales.y.max;

      setCurrentZoom({
        x: { min: minTime, max: maxTime },
        y: { min: minAmplitude, max: maxAmplitude },
      });

      setTimeRange([
        chartData.labels.indexOf(minTime),
        chartData.labels.indexOf(maxTime),
      ]);
      setYAxisRange([minAmplitude, maxAmplitude]);

      setCustomTimeStart(chartData.labels.indexOf(minTime));
      setCustomTimeEnd(chartData.labels.indexOf(maxTime));
    }
  };

  const handleChartClick = (e) => {
    const chart = chartRef.current?.chart;
    if (!chart) return;

    const points = chart.getElementsAtEventForMode(
      e.native,
      "nearest",
      { intersect: true },
      false
    );

    if (points.length > 0) {
      const clickedDataPoint = points[0].element;
      const dataIndex = clickedDataPoint.index;
      const selectedPoint = chartData.datasets[0].data[dataIndex];

      setSelectedSignal(selectedPoint);
    }
  };

  const handleYAxisRangeChange = (value) => {
    setYAxisRange(value);
    setCustomYMin(value[0]);
    setCustomYMax(value[1]);
  };

  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
    setCustomTimeStart(value[0]);
    setCustomTimeEnd(value[1]);
  };

  const handleDurationChange = (startTime, endTime) => {
    if (selectedSignal) {
      const newData = [...modifiedData];
      const modifiedPoint = newData.find(
        (point) => point.window_start_time === selectedSignal.x
      );

      if (modifiedPoint) {
        modifiedPoint.window_start_time = startTime;
        modifiedPoint.window_end_time = endTime;
        modifiedPoint.peak_to_peak = calculatePeakToPeak(startTime, endTime);
      }

      // Check for overlaps with previous point
      const prevPoint = newData.find(
        (point, index) => index > 0 && point.window_start_time < startTime
      );
      if (prevPoint && prevPoint.window_end_time > startTime) {
        // Remove the overlapping previous point
        newData.splice(newData.indexOf(prevPoint), 1);
      }

      setModifiedData(newData);

      const updatedChartData = {
        labels: chartData.labels,
        datasets: [
          {
            label: "Modified Peak to Peak with Clusters",
            data: newData.map((row) => ({
              x: row.window_start_time,
              y: parseFloat(row.peak_to_peak),
              clusterId: row.cluster_id,
            })),
            borderWidth: 2,
            segment: {
              borderColor: (ctx) => {
                const clusterId = ctx.p0?.raw?.clusterId;
                const baseColor =
                  clusterColors[clusterId % clusterColors.length];
                return baseColor;
              },
            },
            pointRadius: 0,
          },
        ],
      };
      setChartData(updatedChartData);
    }
  };

  const calculatePeakToPeak = (startTime, endTime) => {
    return Math.random() * 0.5 + 0.5;
  };

  const handleResetZoom = () => {
    if (chartRef.current?.chart) {
      chartRef.current.chart.resetZoom();
    }
  };

  const chartOptions = {
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: "Window Start Time",
        },
        min: currentZoom.x.min !== undefined ? currentZoom.x.min : timeRange[0],
        max: currentZoom.x.max !== undefined ? currentZoom.x.max : timeRange[1],
      },
      y: {
        title: {
          display: true,
          text: "Peak to Peak",
        },
        min: currentZoom.y.min !== undefined ? currentZoom.y.min : customYMin,
        max: currentZoom.y.max !== undefined ? currentZoom.y.max : customYMax,
      },
    },
    plugins: {
      zoom: {
        // pan:
        //   graphMode === "pan"
        //     ? {
        //         enabled: true,
        //         mode: "xy",
        //         onPan: handleZoomUpdate,
        //       }
        //     : "",
        zoom: {
          wheel: {
            enabled: true,
            mode: "xy",
            onZoom: handleZoomUpdate,
          },
          pinch: {
            enabled: true,
            mode: "xy",
          },
          drag:
            graphMode === "zoom"
              ? {
                  enabled: true,
                  mode: "xy",
                }
              : "",
        },
      },
      dragData: {
        round: 2,
        onDragStart: (e, datasetIndex, index, value) => {
          console.log("Drag started", datasetIndex, index, value);
        },
        onDrag: (e, datasetIndex, index, value) => {
          const updatedValue = value;
          console.log("Dragging point:", datasetIndex, index, updatedValue);

          chartData.datasets[datasetIndex].data[index].y = updatedValue;
        },
        onDragEnd: (e, datasetIndex, index, value) => {
          console.log("Drag ended", datasetIndex, index, value);

          const draggedPoint = chartData.datasets[datasetIndex].data[index];
          setChartData({
            ...chartData,
            datasets: [
              ...chartData.datasets.map((dataset, idx) =>
                idx === datasetIndex
                  ? {
                      ...dataset,
                      data: dataset.data.map((data, i) =>
                        i === index ? draggedPoint : data
                      ),
                    }
                  : dataset
              ),
            ],
          });
        },
      },
    },
  };

  return (
    <div>
      <h2>Interactive Peak to Peak Line Chart by Cluster</h2>
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <label>
          Y-axis Amplitude:
          <Slider
            range
            min={-2}
            max={2}
            step={0.01}
            value={yAxisRange}
            onChange={handleYAxisRangeChange}
            style={{ width: 300, marginLeft: "1rem", marginRight: "1rem" }}
          />
          <input
            type="number"
            value={customYMin}
            onChange={(e) => setCustomYMin(parseFloat(e.target.value))}
            style={{ width: "70px" }}
            step="0.01"
          />
          <input
            type="number"
            value={customYMax}
            onChange={(e) => setCustomYMax(parseFloat(e.target.value))}
            style={{ width: "70px", marginLeft: "0.5rem" }}
            step="0.01"
          />
        </label>
        <button onClick={handleResetZoom}>Reset Zoom</button>
        <button onClick={() => setGraphMode("pan")}>Pan View</button>
        <button onClick={() => setGraphMode("zoom")}>Box Zoom</button>
      </div>
      <div style={{ height: "300px" }}>
        <Line
          ref={chartRef}
          data={filteredData}
          options={chartOptions}
          onClick={handleChartClick}
        />
      </div>
      <div style={{ marginTop: "1rem" }}>
        {selectedSignal && (
          <>
            <h3>Selected Signal Info:</h3>
            <p>Start Time: {selectedSignal.x}</p>
            <p>Peak to Peak: {selectedSignal.y}</p>
            <label>
              Start Time:
              <input
                type="number"
                value={selectedSignal.x}
                onChange={(e) => {
                  const newStartTime = parseFloat(e.target.value);
                  handleDurationChange(newStartTime, selectedSignal.x + 10);
                }}
              />
            </label>
            <label>
              Duration:
              <input
                type="number"
                value={selectedSignal.x + 10 - selectedSignal.x}
                onChange={(e) => {
                  const newDuration = parseFloat(e.target.value);
                  handleDurationChange(selectedSignal.x, selectedSignal.x + newDuration);
                }}
              />
            </label>
          </>
        )}
      </div>
      <div style={{ marginTop: "2rem" }}>
        <label>
          Time Range:
          <Slider
            range
            min={0}
            max={chartData.labels.length - 1}
            value={timeRange}
            onChange={handleTimeRangeChange}
            style={{ width: "100%", marginTop: "1rem" }}
          />
          <input
            type="number"
            value={customTimeStart}
            onChange={(e) => setCustomTimeStart(parseInt(e.target.value))}
            style={{ width: "70px" }}
          />
          <input
            type="number"
            value={customTimeEnd}
            onChange={(e) => setCustomTimeEnd(parseInt(e.target.value))}
            style={{ width: "70px", marginLeft: "0.5rem" }}
          />
        </label>
      </div>
    </div>
  );
};

export default InteractiveLineChart;