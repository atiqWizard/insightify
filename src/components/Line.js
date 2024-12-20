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
  const { selectedClusters, graphData, setGraphData } = useClusterContext();
  // const [yAxisRange, setYAxisRange] = useState([-0.5, 1.0]);
  const [initializedValues, setInitializedValues] = useState([0, 0, 0, 0]);
  const [YSliderRange, setYSliderRange] = useState([0, 0]);
  const [customYMin, setCustomYMin] = useState(0);
  const [customYMax, setCustomYMax] = useState(0);
  const [timeRange, setTimeRange] = useState([0, 0]);
  const [customTimeStart, setCustomTimeStart] = useState(0);
  const [customTimeEnd, setCustomTimeEnd] = useState(0);
  const [graphMode, setGraphMode] = useState("pan");
  // const [selectedMode, setSelectedMode] = useState("Pan View");
  // const [xSliderRange, setXSliderRange] = useState([0, 0]);
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
  const [dataFile, setDataFile] = useState(null);
  const [kmeansFile, setKmeansFile] = useState(null);
  const [chartReady, setChartReady] = useState(false);

  const { clusterNames } = useClusterContext();

  const [selectedSignal, setSelectedSignal] = useState(null);
  const chartRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // const fetchJsonData = async () => {
    //   try {
    //     const [dataResponse, kmeansResponse] = await Promise.all([
    //       fetch(`${process.env.PUBLIC_URL}/data.json`),
    //       fetch(`${process.env.PUBLIC_URL}/kmeans.json`),
    //     ]);
    //     const [jsonData, kmeansData] = await Promise.all([
    //       dataResponse.json(),
    //       kmeansResponse.json(),
    //     ]);
    //     const mergedKMeans = mergeKMeansData(kmeansData);
    //     const newChartData = processChartData(
    //       // { data: jsonData, kmeans: kmeansData },
    //       { data: jsonData, kmeans: mergedKMeans },
    //       // timeRange,
    //       [customTimeStart, customTimeEnd],
    //       selectedClusters
    //     );
    //     setChartData(newChartData);
    //     setFilteredData(newChartData);
    //   } catch (error) {
    //     console.error("Error fetching data:", error);
    //   }
    // };
    // fetchJsonData();
    if (kmeansFile && dataFile) {
      prepareChartData(dataFile, kmeansFile);
    }
  }, [selectedClusters]);

  const mergeKMeansData = (kmeans) => {
    const mergedData = {
      window_start_time: {},
      window_end_time: {},
      cluster_id: {},
      cluster_label: {},
      duration: {},
      idToLabel: {}, // Add idToLabel to store mapping
      // Keep other attributes unchanged
      ...Object.fromEntries(
        Object.entries(kmeans).filter(
          ([key]) =>
            ![
              "window_start_time",
              "window_end_time",
              "cluster_id",
              "cluster_label",
              "duration",
            ].includes(key)
        )
      ),
    };

    let currentClusterId = null;
    let currentStartTime = null;
    let currentClusterLabel = null;
    let currentIndex = 0;

    for (let i = 0; i < Object.keys(kmeans.cluster_id).length; i++) {
      const clusterId = kmeans.cluster_id[i];
      const clusterLabel = kmeans.cluster_label[i];
      const startTime = kmeans.window_start_time[i];
      const endTime = kmeans.window_end_time[i];

      if (clusterId !== currentClusterId) {
        // Finalize the previous segment
        if (currentClusterId !== null) {
          mergedData.cluster_id[currentIndex] = currentClusterId;
          mergedData.cluster_label[currentIndex] = currentClusterLabel;
          mergedData.window_start_time[currentIndex] = currentStartTime;
          mergedData.window_end_time[currentIndex] =
            kmeans.window_end_time[i - 1];
          mergedData.duration[currentIndex] =
            mergedData.window_end_time[currentIndex] - currentStartTime;
          mergedData.idToLabel[currentClusterId] = currentClusterLabel; // Save currentClusterId to label mapping
          currentIndex++;
        }

        // Start a new segment
        currentClusterId = clusterId;
        currentClusterLabel = clusterLabel;
        currentStartTime = startTime;
      }
    }

    // Finalize the last segment
    if (currentClusterId !== null) {
      mergedData.cluster_id[currentIndex] = currentClusterId;
      mergedData.cluster_label[currentIndex] = currentClusterLabel;
      mergedData.window_start_time[currentIndex] = currentStartTime;
      mergedData.window_end_time[currentIndex] =
        kmeans.window_end_time[Object.keys(kmeans.cluster_id).length - 1];
      mergedData.duration[currentIndex] =
        mergedData.window_end_time[currentIndex] - currentStartTime;
      mergedData.idToLabel[currentClusterId] = currentClusterLabel; // Save final mapping
    }

    return mergedData;
  };

  const processChartData = ({ data, kmeans }) =>
    // timeRange = null,
    // selectedClusters = []
    {
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
            tension: 0.4, // Ensure tension is defined here
            segment: {
              borderColor: (ctx) => {
                const clusterId = ctx.p0?.raw?.clusterId; // Get clusterId for the segment
                const baseColor =
                  clusterColors[clusterId % clusterColors.length];

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
        setInitializedValues([yMin, yMax, 0, signalSegment.length]);
        setCustomYMin(yMin);
        setCustomYMax(yMax);
        setCustomTimeStart(0);
        setCustomTimeEnd(signalSegment.length);
        // setXSliderRange([0, signalSegment.length]);
        setYSliderRange([yMin, yMax]);
        setTimeRange([0, signalSegment.length]);
        setInitialized(true);
      }

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
      // Update the dataset with the new clusterId for the selected range
      const updatedData = chartData.datasets[0].data.map((point, index) => {
        if (index >= startPoint && index <= endPoint) {
          return { ...point, clusterId: newClusterId }; // Update clusterId for the range
        }
        return point;
      });

      // Update the chart data state to trigger a re-render
      setChartData((prevChartData) => ({
        ...prevChartData,
        datasets: [
          {
            ...prevChartData.datasets[0],
            data: updatedData,
          },
        ],
      }));

      // Update the filtered data state to ensure consistent data handling
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

      // Update the selectedSignal state to reflect the new clusterId
      setSelectedSignal((prev) => ({
        ...prev,
        clusterId: newClusterId,
      }));
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
      setCustomYMin(initializedValues[0]);
      setCustomYMax(initializedValues[1]);
      setCustomTimeStart(initializedValues[2]);
      setCustomTimeEnd(initializedValues[3]);
    }
  };

  const chartOptions = {
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: false,
          text: "Window Start Time",
        },
        min:
          currentZoom.x.min !== undefined ? currentZoom.x.min : customTimeStart,
        max:
          currentZoom.x.max !== undefined ? currentZoom.x.max : customTimeEnd,
      },
      y: {
        title: {
          display: false,
          text: "Peak to Peak",
        },
        min: currentZoom.y.min !== undefined ? currentZoom.y.min : customYMin,
        max: currentZoom.y.max !== undefined ? currentZoom.y.max : customYMax,
      },
    },
    plugins: {
      legend: {
        display: false, // Disable the legend
      },

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
            value: endPoint + 1, // X-axis value of the end point
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
    link.click();
  };

  const resetSignalSelection = () => {
    setSelectedSignal(null);
    setStartPoint(-1);
    setEndPoint(-1);
  };
  const handleUploadDataJSON = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        setDataFile(jsonData);

        if (kmeansFile) {
          // Process chart data if both files are ready
          prepareChartData(jsonData, kmeansFile);
          setChartReady(true);
        }
      } catch (error) {
        console.error("Error parsing data.json:", error);
      }
    };
  };

  const handleUploadKmeansJSON = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        setKmeansFile(jsonData);

        if (dataFile) {
          // Process chart data if both files are ready
          prepareChartData(dataFile, jsonData);
          setChartReady(true);
        }
      } catch (error) {
        console.error("Error parsing kmeans.json:", error);
      }
    };
  };

  const prepareChartData = (data, kmeans) => {
    // Merge kmeans data for continuity
    const mergedKMeans = mergeKMeansData(kmeans);

    // Process the chart data
    const processedData = processChartData(
      { data, kmeans: mergedKMeans },
      [customTimeStart, customTimeEnd],
      selectedClusters
    );

    // Update chart data state
    setChartData(processedData);
    setFilteredData(processedData);
    setGraphData([data, mergedKMeans]);
  };

  const handleChange = (e) => {
    setSelectedValue(e.target.value);
  };
  const handleExpandLeft = () => {
    // Find the next cluster on the left
    const data = chartData.datasets[0].data;
    let nextClusterIndex = startPoint - 1;

    while (
      nextClusterIndex >= 0 &&
      data[nextClusterIndex].clusterId === selectedSignal.clusterId
    ) {
      nextClusterIndex--;
    }

    if (nextClusterIndex >= 0) {
      const nextClusterStart = nextClusterIndex;
      let nextClusterEnd = nextClusterIndex;

      // Determine the duration of the next cluster
      while (
        nextClusterEnd > 0 &&
        data[nextClusterEnd - 1].clusterId === data[nextClusterStart].clusterId
      ) {
        nextClusterEnd--;
      }

      const nextClusterDuration = nextClusterStart - nextClusterEnd + 1;

      // Check if expanding would reduce the next cluster's duration below 10
      if (nextClusterDuration - parseInt(selectedValue, 10) >= 10) {
        const newStartPoint = Math.max(
          0,
          startPoint - parseInt(selectedValue, 10)
        ); // Ensure it doesn't go below 0

        // Update the dataset
        const updatedData = data.map((point, index) => {
          if (index >= newStartPoint && index < startPoint) {
            return { ...point, clusterId: selectedSignal.clusterId }; // Update clusterId
          }
          return point;
        });

        // Update state
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

        setStartPoint(newStartPoint);
      }
    }
  };

  const handleExpandRight = () => {
    // Find the next cluster on the right
    const data = chartData.datasets[0].data;
    let nextClusterIndex = endPoint + 1;

    while (
      nextClusterIndex < data.length &&
      data[nextClusterIndex].clusterId === selectedSignal.clusterId
    ) {
      nextClusterIndex++;
    }

    if (nextClusterIndex < data.length) {
      const nextClusterStart = nextClusterIndex;
      let nextClusterEnd = nextClusterIndex;

      // Determine the duration of the next cluster
      while (
        nextClusterEnd < data.length - 1 &&
        data[nextClusterEnd + 1].clusterId === data[nextClusterStart].clusterId
      ) {
        nextClusterEnd++;
      }

      const nextClusterDuration = nextClusterEnd - nextClusterStart + 1;

      // Check if expanding would reduce the next cluster's duration below 10
      if (nextClusterDuration - parseInt(selectedValue, 10) >= 10) {
        const newEndPoint = Math.min(
          data.length - 1,
          endPoint + parseInt(selectedValue, 10)
        ); // Ensure it doesn't exceed the dataset length

        // Update the dataset
        const updatedData = data.map((point, index) => {
          if (index > endPoint && index <= newEndPoint) {
            return { ...point, clusterId: selectedSignal.clusterId }; // Update clusterId
          }
          return point;
        });

        // Update state
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

        setEndPoint(newEndPoint);
      }
    }
  };

  return (
    <div>
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
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
        {!dataFile && (
          <>
            <label>Data Json</label>
            <input
              type="file"
              id="input_json"
              onChange={handleUploadDataJSON}
            />
          </>
        )}
        {!kmeansFile && (
          <>
            <label>Kmeans Json</label>
            <input
              type="file"
              id="kmeans_json"
              onChange={handleUploadKmeansJSON}
            />
          </>
        )}
        <button onClick={handleDownloadJSON}>Download JSON</button>
      </div>

      <label>Y-axis Amplitude:</label>
      <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
        {/* Y-Axis Slider */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginRight: "1rem",
          }}
        >
          <input
            type="number"
            value={customYMax}
            onChange={(e) => setCustomYMax(parseFloat(e.target.value))}
            style={{ width: "70px", marginBottom: "0.5rem" }}
            step="0.1"
          />
          <Slider
            range
            vertical
            min={YSliderRange[0]}
            max={YSliderRange[1]}
            step={0.1}
            value={[customYMin, customYMax]}
            onChange={handleYAxisRangeChange}
            style={{ height: "200px" }}
          />
          <input
            type="number"
            value={customYMin}
            onChange={(e) => setCustomYMin(parseFloat(e.target.value))}
            style={{ width: "70px", marginTop: "0.5rem" }}
            step="0.1"
          />
        </div>

        {/* Line Chart */}
        <div style={{ flex: 1, height: "300px" }}>
          {chartReady && (
            <Line
              ref={chartRef}
              data={filteredData}
              options={chartOptions}
              onClick={handleChartClick}
            />
          )}
        </div>
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
          </select>
        </div>
      )}
      {selectedSignal && (
        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5rem",
          }}
        >
          {/* Dropdown with label on the left */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={resetSignalSelection}
              disabled={!selectedSignal} // Disable if no signal is selected
            >
              Remove Signal Selection
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <label htmlFor="dropdown-left" style={{ marginRight: "0.5rem" }}>
              Change Cluster:
            </label>
            {chartData.datasets.length > 0 ? (
              <select
                onChange={(e) =>
                  handleClusterChange(parseInt(e.target.value, 10))
                }
                value={selectedSignal?.clusterId || ""}
                disabled={!selectedSignal} // Disable if no signal is selected
              >
                {Array.from(
                  new Set(
                    chartData.datasets[0].data.map((point) => point.clusterId)
                  )
                ).map((clusterId) => (
                  <option key={clusterId} value={clusterId}>
                    {graphData[1].idToLabel[clusterId] ||
                      `Cluster ${clusterId}`}{" "}
                    {/* Display cluster label if exists, otherwise fallback to numeric id */}
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
            <button onClick={handleExpandLeft} disabled={!selectedSignal}>
              &#8592;
            </button>
            <select
              id="dropdown-right"
              value={selectedValue}
              onChange={handleChange}
              disabled={!selectedSignal} // Disable if no signal is selected
            >
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
            <button onClick={handleExpandRight} disabled={!selectedSignal}>
              &#8594;
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <input
          type="number"
          value={customTimeStart}
          onChange={handleCustomTimeStartChange}
          style={{ width: "70px", marginRight: "0.5rem" }}
        />
        <Slider
          range
          min={timeRange[0]}
          max={timeRange[1]}
          value={[customTimeStart, customTimeEnd]}
          onChange={handleTimeRangeChange}
          style={{ flex: 1, margin: "0 1rem" }}
        />
        <input
          type="number"
          value={customTimeEnd}
          onChange={handleCustomTimeEndChange}
          style={{ width: "70px", marginLeft: "0.5rem" }}
        />
      </div>
    </div>
  );
};

export default LineChart;
