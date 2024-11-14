import React, { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import Papa from "papaparse";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import "chart.js/auto";
import { useClusterContext } from "./ClusterContext";
import { Chart as ChartJS, registerables } from "chart.js";
import zoomPlugin, { zoom } from "chartjs-plugin-zoom";
// import "chartjs-plugin-dragdata";
// import dragDataPlugin from "chartjs-plugin-dragdata";

// ChartJS.register(...registerables, zoomPlugin, dragDataPlugin);
ChartJS.register(...registerables, zoomPlugin);
// ChartJS.register(zoomPlugin);

const LineChart = () => {
  const { selectedClusters } = useClusterContext();
  const [yAxisRange, setYAxisRange] = useState([-0.5, 1.0]);
  const [customYMin, setCustomYMin] = useState(yAxisRange[0]);
  const [customYMax, setCustomYMax] = useState(yAxisRange[1]);
  const [timeRange, setTimeRange] = useState([0, 499]);
  const [customTimeStart, setCustomTimeStart] = useState(timeRange[0]);
  const [customTimeEnd, setCustomTimeEnd] = useState(timeRange[1]);
  const [graphMode, setGraphMode] = useState("Pan");
  const [selectedMode, setSelectedMode] = useState("Pan View");
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  const [filteredData, setFilteredData] = useState({
    labels: [],
    datasets: [],
  });
  // Add state to store current zoom level
  const [currentZoom, setCurrentZoom] = useState({
    x: { min: undefined, max: undefined },
    y: { min: undefined, max: undefined },
  });

  const [selectedSignal, setSelectedSignal] = useState(null);
  const [modifiedData, setModifiedData] = useState([]);
  const chartRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  const clusterColors = [
    "rgba(75, 192, 192, 1)",    // Teal
    "rgba(54, 162, 235, 1)",    // Blue
    "rgba(255, 99, 132, 1)",    // Red
    "rgba(255, 206, 86, 1)",    // Yellow
    "rgba(153, 102, 255, 1)",   // Purple
    "rgba(255, 159, 64, 1)",    // Orange
    "rgba(99, 255, 132, 1)",    // Light Green
    "rgba(102, 153, 255, 1)",   // Light Blue
    "rgba(255, 102, 178, 1)",   // Pink
    "rgba(204, 255, 102, 1)",   // Lime
    "rgba(102, 255, 255, 1)",   // Cyan
    "rgba(255, 153, 102, 1)"    // Peach
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
                  tension: 0.4, // Ensure tension is defined here
                  segment: {
                    borderColor: (ctx) => {
                      const clusterId = ctx.p0?.raw?.clusterId; // Get clusterId for the segment
                      const baseColor = clusterColors[clusterId % clusterColors.length];
                  
                      // Apply transparency for non-selected clusters
                      if (
                        selectedClusters.length === 0 || 
                        selectedClusters.includes(clusterId)
                      ) {
                        return baseColor;
                      }
                      return baseColor.replace("1)", "0.2)"); // Fade for non-selected clusters
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
    e.preventDefault(); // Prevents default context menu on right-click
    e.stopPropagation(); // Stops the event from propagating to parent elements

    const chart = chartRef.current;
    if (chart) {
      const points = chart.getElementsAtEventForMode(
        e.nativeEvent, // Use nativeEvent for the actual DOM event
        "nearest",
        { intersect: false, distance: 30 }, // Adjust distance to detect nearby points
        false
      );

      if (e.nativeEvent.which === 1 && points && points.length > 0) {
        // Check for right-click and points length
        const dataIndex = points[0].index;
        const selectedPoint = chartData.datasets[0].data[dataIndex];

        // Calculate the nearest interval points
        const interval = 10; // In seconds
        const lowerBound = Math.floor(selectedPoint.x / interval) * interval;
        const upperBound = lowerBound + interval;

        setSelectedSignal(selectedPoint);
        setDropdownPosition({ x: e.clientX, y: e.clientY });
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    }
  };

  const handleClusterChange = (newClusterId) => {
    if (selectedSignal) {
      // Update the selected signal's clusterId
      const updatedSignal = { ...selectedSignal, clusterId: newClusterId };
  
      setSelectedSignal(updatedSignal); // Update local state
  
      // Update the dataset with the new clusterId
      const updatedData = chartData.datasets[0].data.map((point) =>
        point.x === selectedSignal.x
          ? { ...point, clusterId: newClusterId } // Update the clusterId
          : point
      );
      
      
  
      setChartData((prevChartData) => ({
        ...prevChartData,
        datasets: [
          {
            ...prevChartData.datasets[0],
            data: updatedData,
          },
        ],
      }));
  
      // Trigger chart redraw to apply the color changes
      // console.log("chartRef: ", chartRef)
      if (chartRef.current?.chart) {
        chartRef.current.chart.update(); // Explicitly update the chart
      }
  
      // Close the dropdown
      setShowDropdown(false);
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
            tension: 0.5,
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
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  const chartOptions = {
    maintainAspectRatio: false,
    // onclick: handleChartClick,
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
        pan:
          graphMode === "pan"
            ? {
                enabled: true,
                mode: "xy",
                onPan: handleZoomUpdate,
              }
            : false,
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
              : false,
        },
      },
    },
    dragData: {
      round: 2,
      onDrag: (e, datasetIndex, index, value) => {
        // Access the dragged point
        const draggedPoint = chartData.datasets[datasetIndex].data[index];

        console.log("Dragging point:", draggedPoint);
        console.log("New X value:", e.xValue, "New Y value:", e.yValue);

        // Update both X and Y values based on the dragged position
        draggedPoint.x = e.xValue; // New X value (start time)
        draggedPoint.y = e.yValue; // New Y value (peak-to-peak value)

        // Check and adjust for potential overlaps with adjacent points
        const prevPoint = chartData.datasets[datasetIndex].data[index - 1];
        const nextPoint = chartData.datasets[datasetIndex].data[index + 1];

        // If the new X position of the dragged point overlaps with the previous point, adjust or remove
        if (prevPoint && draggedPoint.x <= prevPoint.x) {
          chartData.datasets[datasetIndex].data.splice(index - 1, 1);
        }

        // If the new X position of the dragged point overlaps with the next point, adjust or remove
        if (nextPoint && draggedPoint.x >= nextPoint.x) {
          chartData.datasets[datasetIndex].data.splice(index + 1, 1);
        }

        // Update chart data
        setChartData({
          ...chartData,
          datasets: [...chartData.datasets],
          tension: 0.5,
        });
      },
      onDragEnd: (e, datasetIndex, index, value) => {
        // Adjust the position in the dataset after drag ends
        const draggedPoint = chartData.datasets[datasetIndex].data[index];

        // Adjust for any overlap logic again if needed
        const prevPoint = chartData.datasets[datasetIndex].data[index - 1];
        const nextPoint = chartData.datasets[datasetIndex].data[index + 1];

        if (prevPoint && draggedPoint.x <= prevPoint.x) {
          chartData.datasets[datasetIndex].data.splice(index - 1, 1); // Remove previous point
        }
        if (nextPoint && draggedPoint.x >= nextPoint.x) {
          chartData.datasets[datasetIndex].data.splice(index + 1, 1); // Remove next point
        }

        // Save changes to chart data
        setChartData({
          ...chartData,
          datasets: [
            ...chartData.datasets.map((dataset, idx) =>
              idx === datasetIndex
                ? {
                    ...dataset,
                    data: dataset.data,
                  }
                : dataset
            ),
          ],
          tension: 0.5,
        });
      },
    },
  };

  // Update mode and selected mode
  const handleSetMode = (mode, modeLabel) => {
    // Save current zoom level before switching modes
    handleZoomUpdate();

    setGraphMode(mode);
    setSelectedMode(modeLabel);
  };

  return (
    <div>
      <h2>Peak to Peak Line Chart by Cluster</h2>
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
        <button
          onClick={() => handleSetMode("pan", "Pan View")}
          style={{
            fontWeight: selectedMode === "Pan View" ? "bold" : "normal",
          }}
        >
          Pan View
        </button>
        <button
          onClick={() => handleSetMode("zoom", "Box Zoom")}
          style={{
            fontWeight: selectedMode === "Box Zoom" ? "bold" : "normal",
          }}
        >
          Box Zoom
        </button>
        <button
          onClick={() => handleSetMode("modify", "Modify")}
          style={{
            fontWeight: selectedMode === "Modify" ? "bold" : "normal",
          }}
        >
          Modify
        </button>
      </div>
      <div style={{ height: "300px" }}>
        <Line
          ref={chartRef}
          data={filteredData}
          options={chartOptions}
          onClick={handleChartClick}
        />
      </div>
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: dropdownPosition.y,
            left: dropdownPosition.x,
            backgroundColor: "white",
            border: "1px solid gray",
            borderRadius: "4px",
            padding: "8px",
            zIndex: 10,
          }}
        >
          <label>Change Cluster ID:</label>
          <select
            onChange={(e) => handleClusterChange(parseInt(e.target.value, 10))}
            value={selectedSignal?.clusterId || ""}
          >
            {Array.from(
              new Set(
                chartData.datasets[0].data.map((point) => point.clusterId)
              )
            ).map((clusterId) => (
              <option key={clusterId} value={clusterId}>
                Cluster {clusterId}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        {selectedSignal && (
          <>
            <h3>Selected Signal Info:</h3>
            <p>Start Time: {selectedSignal.x}</p>
            <p>Peak to Peak: {selectedSignal.y}</p>
            <p>Cluster ID: {selectedSignal.clusterId}</p>{" "}
            {/* Display updated clusterId */}
            <button
              onClick={() =>
                handleDurationChange(
                  selectedSignal.x - 10,
                  selectedSignal.x + 10
                )
              }
            >
              Modify Duration
            </button>
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

export default LineChart;
