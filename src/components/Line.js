import React, { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import "chart.js/auto";
import { useClusterContext } from "./ClusterContext";
import { Chart as ChartJS, registerables } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import annotationPlugin from "chartjs-plugin-annotation";
ChartJS.register(annotationPlugin);

// import "chartjs-plugin-dragdata";
// import dragDataPlugin from "chartjs-plugin-dragdata";

// ChartJS.register(...registerables, zoomPlugin, dragDataPlugin);
ChartJS.register(...registerables, zoomPlugin);
// ChartJS.register(zoomPlugin);

const LineChart = () => {
  const { selectedClusters } = useClusterContext();
  // const [yAxisRange, setYAxisRange] = useState([-0.5, 1.0]);
  const [customYMin, setCustomYMin] = useState(-0.5);
  const [customYMax, setCustomYMax] = useState(1.0);
  const [timeRange, setTimeRange] = useState([0, 499]);
  const [customTimeStart, setCustomTimeStart] = useState(0);
  const [customTimeEnd, setCustomTimeEnd] = useState(0);
  const [graphMode, setGraphMode] = useState("pan");
  // const [selectedMode, setSelectedMode] = useState("Pan View");
  // const [xSliderRange, setXSliderRange] = useState([0, 0]);
  const [YSliderRange, setYSliderRange] = useState([0, 0]);
  const [initialized, setInitialized] = useState(false);
  const [startPoint, setStartPoint] = useState(-1);
  const [endPoint, setEndPoint] = useState(-1);
  const [selectedValue, setSelectedValue] = useState("5");
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

  const { clusterNames } = useClusterContext();

  const [selectedSignal, setSelectedSignal] = useState(null);
  const chartRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fetchJsonData = async () => {
      try {
        const [dataResponse, kmeansResponse] = await Promise.all([
          fetch(`${process.env.PUBLIC_URL}/data.json`),
          fetch(`${process.env.PUBLIC_URL}/kmeans.json`),
        ]);

        const [jsonData, kmeansData] = await Promise.all([
          dataResponse.json(),
          kmeansResponse.json(),
        ]);

        const newChartData = processChartData(
          { data: jsonData, kmeans: kmeansData },
          // timeRange,
          [customTimeStart, customTimeEnd],
          selectedClusters
        );

        setChartData(newChartData);
        setFilteredData(newChartData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchJsonData();
  }, [selectedClusters, customTimeStart, customTimeEnd]);

  const processChartData = (
    { data, kmeans },
    // timeRange = null,
    selectedClusters = []
  ) => {
    const SAMPLING_RATE = 64;
    const TIME_START = 0;

    const signalSegment = data;
    const signalDuration = signalSegment.length / SAMPLING_RATE;
    const times = signalSegment.map(
      (_, index) =>
        TIME_START + (index * signalDuration) / (signalSegment.length - 1)
    );

    // Extract cluster range data
    const clusterRanges = Object.keys(kmeans.cluster_id).map((key) => ({
      clusterId: kmeans.cluster_id[key],
      startTime: kmeans.window_start_time[key],
      endTime: kmeans.window_end_time[key],
    }));

    // Map data points to cluster ranges
    const dataPoints = signalSegment.map((y, index) => {
      const cluster = clusterRanges.find(
        (range) => index >= range.startTime && index < range.endTime
      );

      return {
        x: index,
        y: y,
        id: index.toFixed(4),
        originalIndex: index,
        clusterId: cluster ? cluster.clusterId : null, // Assign cluster ID if found
      };
    });

    // Create labels with intervals based on sampling rate
    const labels = times.map(
      (time, index) =>
        // index % SAMPLING_RATE === 0 ? index : null
        index
    );

    const clusterColors = [
      "rgba(75, 192, 192, 1)", // Teal
      "rgba(54, 162, 235, 1)", // Blue
      "rgba(255, 99, 132, 1)", // Red
      "rgba(255, 206, 86, 1)", // Yellow
      "rgba(153, 102, 255, 1)", // Purple
      "rgba(255, 159, 64, 1)", // Orange
      "rgba(99, 255, 132, 1)", // Light Green
      "rgba(102, 153, 255, 1)", // Light Blue
      "rgba(255, 102, 178, 1)", // Pink
      "rgba(204, 255, 102, 1)", // Lime
      "rgba(102, 255, 255, 1)", // Cyan
      "rgba(255, 153, 102, 1)", // Peach
    ];

    const newData = {
      labels: labels,
      datasets: [
        {
          label: "Peak to Peak with Clusters",
          data: dataPoints,
          borderWidth: 2,
          tension: 0.4,
          segment: {
            borderColor: (ctx) => {
              // Get cluster ID for the starting point of the segment
              const clusterId = ctx.p0?.raw?.clusterId;
              return clusterId !== null
                ? clusterColors[clusterId % clusterColors.length]
                : "#CCCCCC"; // Default color if no cluster ID
            },
          },
          pointRadius: 0,
        },
      ],
    };

    let yMin = Infinity;
    let yMax = -Infinity;
    const batchSize = 1000;

    for (let i = 0; i < signalSegment.length; i += batchSize) {
      const batch = signalSegment.slice(i, i + batchSize);
      yMin = Math.min(yMin, Math.min(...batch));
      yMax = Math.max(yMax, Math.max(...batch));
    }

    if (!initialized) {
      // setYAxisRange([yMin, yMax]);
      setCustomYMin(yMin);
      setCustomYMax(yMax);
      setCustomTimeStart(0);
      setCustomTimeEnd(signalSegment.length);
      // setXSliderRange([0, signalSegment.length]);
      setYSliderRange([yMin, yMax]);
      setTimeRange([0, signalSegment.length]);
      setInitialized(true);
    }

    // if (timeRange) {
    //   const filteredLabels = newData.labels.slice(
    //     timeRange[0],
    //     timeRange[1] + 1
    //   );
    //   const filteredDataPoints = newData.datasets[0].data.slice(
    //     timeRange[0],
    //     timeRange[1] + 1
    //   );

    //   return {
    //     labels: filteredLabels,
    //     datasets: [
    //       {
    //         ...newData.datasets[0],
    //         data: filteredDataPoints,
    //       },
    //     ],
    //   };
    // }

    return newData;
  };

  const handleZoomUpdate = () => {
    if (chartRef.current) {
      const chart = chartRef.current;

      const minTime = chart.scales.x.min;
      const maxTime = chart.scales.x.max;
      const minAmplitude = chart.scales.y.min;
      const maxAmplitude = chart.scales.y.max;

      setCurrentZoom({
        x: { min: minTime, max: maxTime },
        y: { min: minAmplitude, max: maxAmplitude },
      });

      // setTimeRange([
      //   chartData.labels.indexOf(minTime),
      //   chartData.labels.indexOf(maxTime),
      // ]);
      // setYAxisRange([minAmplitude, maxAmplitude]);
      setCustomYMin(minAmplitude);
      setCustomYMax(maxAmplitude);

      setCustomTimeStart(chartData.labels.indexOf(minTime));
      setCustomTimeEnd(chartData.labels.indexOf(maxTime));
    }
  };

  const findClusterRange = (index) => {
    const data = chartData.datasets[0].data;
    const currentClusterID = data[index].clusterId;

    // Find start of the cluster
    let startPoint = index;
    while (
      startPoint > 0 &&
      data[startPoint - 1].clusterId === currentClusterID
    ) {
      startPoint--;
    }

    // Find end of the cluster
    let endPoint = index;
    while (
      endPoint < data.length - 1 &&
      data[endPoint + 1].clusterId === currentClusterID
    ) {
      endPoint++;
    }
    return { startPoint, endPoint };
  };

  const handleChartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const chart = chartRef.current;
    if (chart) {
      const points = chart.getElementsAtEventForMode(
        e.nativeEvent, // Use nativeEvent for the actual DOM event
        "nearest",
        { intersect: false, distance: 30 }, // Adjust distance to detect nearby points
        false
      );

      if (e.nativeEvent.which === 1 && points && points.length > 0) {
        const dataIndex = points[0].index;
        const selectedPoint = chartData.datasets[0].data[dataIndex];
        const { startPoint, endPoint } = findClusterRange(dataIndex);
        setSelectedSignal(selectedPoint);

        setStartPoint(startPoint);
        setEndPoint(endPoint);
      }

      if (e.nativeEvent.which === 2 && points && points.length > 0) {
        // Check for right-click and points length
        const dataIndex = points[0].index;
        const selectedPoint = chartData.datasets[0].data[dataIndex];

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

      setFilteredData((prevChartData) => ({
        ...prevChartData,
        datasets: [
          {
            ...prevChartData.datasets[0],
            data: updatedData,
          },
        ],
      }));

      // Close the dropdown
      setShowDropdown(false);
    }
  };

  const handleYAxisRangeChange = (value) => {
    // setYAxisRange(value);
    setCustomYMin(value[0]);
    setCustomYMax(value[1]);
  };

  const handleTimeRangeChange = (value) => {
    // setTimeRange(value);
    setCustomTimeStart(value[0]);
    setCustomTimeEnd(value[1]);

    // const validatedValue = value.map((v) =>
    //   Math.min(Math.max(v, 0), chartData.labels.length - 1)
    // );

    // // Only update if the range actually changes
    // if (validatedValue[0] !== timeRange[0] || validatedValue[1] !== timeRange[1]) {
    //   setTimeRange(validatedValue);
    //   setCustomTimeStart(validatedValue[0]);
    //   setCustomTimeEnd(validatedValue[1]);
    // }
  };

  // Update the start time independently
  const handleCustomTimeStartChange = (e) => {
    const newStart = parseInt(e.target.value) || 0;
    const validatedStart = Math.min(
      Math.max(newStart, 0),
      chartData.labels.length - 1
    );
    setCustomTimeStart(validatedStart);
  };

  // Update the end time independently
  const handleCustomTimeEndChange = (e) => {
    const newEnd = parseInt(e.target.value) || 0;
    const validatedEnd = Math.min(
      Math.max(newEnd, 0),
      chartData.labels.length - 1
    );
    setCustomTimeEnd(validatedEnd);
  };

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
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
        min:
          currentZoom.x.min !== undefined ? currentZoom.x.min : customTimeStart,
        max:
          currentZoom.x.max !== undefined ? currentZoom.x.max : customTimeEnd,
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
      annotation: {
        annotations: {
          startPoint: {
            type: "line",
            mode: "vertical",
            scaleID: "x",
            value: startPoint, // X-axis value of the start point
            borderColor: "gray",
            borderWidth: 2,
            draggable: true,
            label: {
              content: "Cluster Start",
              enabled: true,
              position: "start",
            },
            // borderWidth: 10,
            onDragStart: function (ev) {
              console.log("start: ", ev);
            },
            onDrag: function (ev) {
              console.log("drag: ", ev);
            },
            onDragEnd: function (ev) {
              console.log("dragend: ", ev);
              ev.sourceEvent.preventDefault();
            },
          },
          endPoint: {
            type: "line",
            mode: "vertical",
            scaleID: "x",
            value: endPoint, // X-axis value of the end point
            borderColor: "gray",
            borderWidth: 2,
            draggable: true,
            label: {
              content: "Cluster End",
              enabled: true,
              position: "end",
            },
          },
        },
      },
    },
  };

  // Update mode and selected mode
  const handleSetMode = (mode, modeLabel) => {
    // Save current zoom level before switching modes
    handleZoomUpdate();

    setGraphMode(mode);
    // setSelectedMode(modeLabel);
  };

  const handleDownloadJSON = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredData.datasets[0])
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "data.json";
    // link.click();
  };

  const handleUploadJSON = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        const processedData = processChartData(
          jsonData,
          [customTimeStart, customTimeEnd],
          selectedClusters
        );

        setFilteredData(processedData);
      } catch (error) {
        console.error("Error parsing JSON: ", error);
      }
    };
  };

  const handleChange = (e) => {
    setSelectedValue(e.target.value);
  };

  const handleExpandLeft = () => {
    setStartPoint((prev) => prev - parseInt(selectedValue, 10));
  };

  const handleExpandRight = () => {
    setEndPoint((prev) => prev + parseInt(selectedValue, 10));
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
            min={YSliderRange[0]}
            max={YSliderRange[1]}
            step={0.1}
            value={[customYMin, customYMax]}
            onChange={handleYAxisRangeChange}
            style={{ width: 300, marginLeft: "1rem", marginRight: "1rem" }}
          />
          <input
            type="number"
            value={customYMin}
            onChange={(e) => setCustomYMin(parseFloat(e.target.value))}
            style={{ width: "70px" }}
            step="0.1"
          />
          <input
            type="number"
            value={customYMax}
            onChange={(e) => setCustomYMax(parseFloat(e.target.value))}
            style={{ width: "70px", marginLeft: "0.5rem" }}
            step="0.1"
          />
        </label>
        <button onClick={handleResetZoom}>Reset Zoom</button>
        <button
          onClick={() => handleSetMode("pan", "Pan View")}
          style={{
            fontWeight: graphMode === "pan" ? "bold" : "normal",
          }}
        >
          Pan View
        </button>
        <button
          onClick={() => handleSetMode("zoom", "Box Zoom")}
          style={{
            fontWeight: graphMode === "zoom" ? "bold" : "normal",
          }}
        >
          Box Zoom
        </button>
        <input type="file" id="input_json" onChange={handleUploadJSON} />
        <button onClick={handleDownloadJSON}>Download JSON</button>
      </div>
      <div style={{ height: "300px" }}>
        <Line
          ref={chartRef}
          data={filteredData}
          options={chartOptions}
          onClick={handleChartClick}
          // onContextMenu={handleChartClick}
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
            {Object.entries(clusterNames).map(([clusterId, clusterName]) => (
              <option key={clusterId}>{clusterName}</option>
            ))}
            {/* {Array.from(
              new Set(
                chartData.datasets[0].data.map((point) => point.clusterId)
              )
            ).map((clusterId) => (
              <option key={clusterId} value={clusterId}>
                Cluster {clusterId}
              </option>
            ))} */}
          </select>
        </div>
      )}

      <div
        style={{
          marginTop: "2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10rem",
        }}
      >
        {/* Dropdown with label on the left */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <label htmlFor="dropdown-left" style={{ marginRight: "0.5rem" }}>
            Change Cluster:
          </label>
          {/* {Object.entries(clusterNames).map(([clusterId, clusterName]) => (
              <option key={clusterId}>{clusterName}</option>
            ))} */}
          {chartData.datasets.length > 0 ? (
            <select
              onChange={(e) =>
                handleClusterChange(parseInt(e.target.value, 10))
              }
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
          ) : (
            <select disabled>
              <option>Loading...</option>
            </select>
          )}
        </div>

        {/* Dropdown with buttons (Decrease & Increase) on the right */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="dropdown-left" style={{ marginRight: "0.5rem" }}>
            Expand Segment:
          </label>
          <button onClick={handleExpandLeft}>&#8592;</button>
          <select id="dropdown-right" value={selectedValue} onChange={handleChange}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
            <option value="10">10</option>
          </select>
          <button onClick={handleExpandRight}>&#8594;</button>
        </div>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <label>
          Time Range:
          <Slider
            range
            min={timeRange[0]}
            max={timeRange[1]}
            value={[customTimeStart, customTimeEnd]}
            onChange={handleTimeRangeChange}
            style={{ width: "100%", marginTop: "1rem" }}
          />
          <input
            type="number"
            value={customTimeStart}
            onChange={handleCustomTimeStartChange}
            style={{ width: "70px" }}
          />
          <input
            type="number"
            value={customTimeEnd}
            onChange={handleCustomTimeEndChange}
            style={{ width: "70px", marginLeft: "0.5rem" }}
          />
        </label>
      </div>
    </div>
  );
};

export default LineChart;
