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
ChartJS.register(...registerables, zoomPlugin);

const LineChart = () => {
  const { selectedClusters, graphData, setGraphData } = useClusterContext();
  const [initializedValues, setInitializedValues] = useState([0, 0, 0, 0]);
  const [YSliderRange, setYSliderRange] = useState([0, 0]);
  const [customYMin, setCustomYMin] = useState(0);
  const [customYMax, setCustomYMax] = useState(0);
  const [timeRange, setTimeRange] = useState([0, 0]);
  const [customTimeStart, setCustomTimeStart] = useState(0);
  const [customTimeEnd, setCustomTimeEnd] = useState(0);
  const [graphMode, setGraphMode] = useState("pan");
  const [initialized, setInitialized] = useState(false);
  const [startPoint, setStartPoint] = useState(-1);
  const [endPoint, setEndPoint] = useState(-1);
  const [selectedValue, setSelectedValue] = useState("10");
  // const [chartData, setChartData] = useState({
  //   labels: [],
  //   datasets: [],
  // });
  const [currentZoom, setCurrentZoom] = useState({
    x: { min: undefined, max: undefined },
    y: { min: undefined, max: undefined },
  });
  const [dataFile, setDataFile] = useState(null);
  const [kmeansFile, setKmeansFile] = useState(null);
  const [chartReady, setChartReady] = useState(false);

  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [selectedClustersId, setSelectedClusterId] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (kmeansFile && dataFile) {
      prepareChartData(dataFile, kmeansFile);
    }
  }, [selectedClusters]);

  const processChartData = ({ data, kmeans }) =>
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
            tension: 0.4,
            segment: {
              borderColor: (ctx) => {
                const clusterId = ctx.p0?.raw?.clusterId; 
                const baseColor =
                  clusterId >= 0
                    ? clusterColors[clusterId % clusterColors.length] 
                    : "gray"; 

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
    const chart = chartRef.current;

    const minTime = chart.scales.x.min;
    const maxTime = chart.scales.x.max;
    const minAmplitude = chart.scales.y.min;
    const maxAmplitude = chart.scales.y.max;

    setCurrentZoom({
      x: { min: minTime, max: maxTime },
      y: { min: minAmplitude, max: maxAmplitude },
    });

    setCustomYMin(minAmplitude);
    setCustomYMax(maxAmplitude);
    setCustomTimeStart(graphData[0].labels.indexOf(minTime));
    setCustomTimeEnd(graphData[0].labels.indexOf(maxTime));
  };

  const handleChartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const chart = chartRef.current;
    if (chart) {
      const points = chart.getElementsAtEventForMode(
        e.nativeEvent,
        "nearest",
        { intersect: false, distance: 3 }, // Adjust distance to detect nearby points
        false
      );
      setStartAndEndStates(points[0].index);
    }
  };

  const handleClusterChange = (newClusterId) => {
    const updatedData = graphData[0].datasets[0].data.map((point, index) => {
      if (index >= startPoint && index <= endPoint) {
        return { ...point, clusterId: newClusterId }; // Update clusterId for the range
      }
      return point;
    });

    const graphData1 = { ...graphData[1] }; // Clone graphData[1] for immutability

    // Find all indexes where the range overlaps with startPoint and endPoint
    const selectedIndexes = Object.keys(graphData1.window_start_time)
      .filter((key) => {
        const startTime = graphData1.window_start_time[key];
        const endTime = graphData1.window_end_time[key];
        return !(endTime <= startPoint || startTime >= endPoint); // Check overlap
      })
      .map(Number); // Convert keys to numbers

    // Update the cluster_id for all selected indexes
    selectedIndexes.forEach((index) => {
      graphData1.cluster_id[index] = newClusterId;
    });

    setGraphData([graphData[0], graphData1]); // Update state with modified graphData

    // Update the chart data state to trigger a re-render
    // setChartData((prevChartData) => ({
    //   ...prevChartData,
    //   datasets: [
    //     {
    //       ...prevChartData.datasets[0],
    //       data: updatedData,
    //     },
    //   ],
    // }));

    setGraphData([(prevChartData) => ({
      ...prevChartData,
      datasets: [
        {
          ...prevChartData.datasets[0],
          data: updatedData,
        },
      ],
    }), graphData[1]]);

  };

  const handleYAxisRangeChange = (value) => {
    setCustomYMin(value[0]);
    setCustomYMax(value[1]);
  };

  const handleTimeRangeChange = (value) => {
    setCustomTimeStart(value[0]);
    setCustomTimeEnd(value[1]);
  };

  // Update the start time independently
  const handleCustomTimeStartChange = (e) => {
    const newStart = parseInt(e.target.value) || 0;
    const validatedStart = Math.min(
      Math.max(newStart, 0),
      graphData[0].labels.length - 1
    );
    setCustomTimeStart(validatedStart);
  };

  // Update the end time independently
  const handleCustomTimeEndChange = (e) => {
    const newEnd = parseInt(e.target.value) || 0;
    const validatedEnd = Math.min(
      Math.max(newEnd, 0),
      graphData[0].labels.length - 1
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
    handleZoomUpdate();
    setGraphMode(mode);
  };

  const handleDownloadJSON = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
      JSON.stringify(graphData[1])
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "data.json";
    link.click();
  };

  const resetSignalSelection = () => {
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

  // Function to create idToLabel mapping
  const generateIdToLabelMapping = (kmeans) => {
    const clusterIds = kmeans.cluster_id;
    const clusterLabels = kmeans.cluster_label;

    const idToLabel = {};

    // Iterate through the cluster IDs and assign corresponding labels
    for (const key in clusterIds) {
      const id = clusterIds[key];
      const label = clusterLabels[key];

      // Ensure each cluster_id is mapped to only one unique cluster_label
      if (!idToLabel[id]) {
        idToLabel[id] = label;
      }
    }

    return idToLabel;
  };

  const prepareChartData = (data, kmeans) => {
    kmeans = {
      ...kmeans, // Spread existing values in kmeans
      idToLabel: generateIdToLabelMapping(kmeans), // Add idToLabel as a new property
    };

    // Process the chart data
    const processedData = processChartData(
      { data, kmeans: kmeans },
      [customTimeStart, customTimeEnd],
      selectedClusters
    );

    // Update chart data state
    // setChartData(processedData);
    setGraphData([processedData, kmeans]);
  };

  const handleChange = (e) => {
    setSelectedValue(e.target.value);
  };

  const findIndexAgainstX = (x, d) => {
    const index = Object.keys(d)
      .filter((key) => d[key] <= x)
      .pop(); // Gets the last matching key
    return index;
  };

  // function return startPoint and endPoint on basis of x
  const setStartAndEndStates = (x) => {
    const data = graphData[1];
    const index = parseInt(findIndexAgainstX(x, data.window_start_time));
    if (index === undefined) return null; // No valid index found

    const clusterId = data.cluster_id[index];
    let startIndex = index;
    let endIndex = index;

    // Expand to the left to find the start of the same cluster_id
    while (startIndex > 0 && data.cluster_id[startIndex - 1] === clusterId) {
      startIndex--;
    }

    // Expand to the right to find the end of the same cluster_id
    while (
      endIndex < Object.keys(data.cluster_id).length - 1 &&
      data.cluster_id[endIndex + 1] === clusterId
    ) {
      endIndex++;
    }
    setSelectedClusterId(clusterId);
    setSelectedIndexes([startIndex, endIndex]);
    setStartPoint(data.window_start_time[startIndex]);
    setEndPoint(data.window_end_time[endIndex]);
  };

  // function startIndex, endIndex, right/left
  const expandSignal = async (direction) => {
    const graphData1 = graphData[1]; // Clone graphData[1] for immutability
    let tempStartIndex = selectedIndexes[0];
    let tempEndIndex = selectedIndexes[1];
    let tempStartPoint = startPoint;
    let tempEndPoint = endPoint;

    if (direction < 0) {
      if (tempStartIndex > 0) {
        tempStartIndex -= 1;
        graphData1.cluster_id[tempStartIndex] = selectedClustersId;
        graphData1.cluster_label[tempStartIndex] = graphData1.idToLabel[tempStartIndex + 1];
        tempStartPoint = graphData1.window_start_time[tempStartIndex];
      }
    } else {
      if (tempEndIndex < Object.keys(graphData1.cluster_id).length - 1) {
        tempEndIndex += 1;
        graphData1.cluster_id[tempEndIndex] = selectedClustersId;
        graphData1.cluster_label[tempEndIndex] = graphData1.idToLabel[tempEndIndex -1];
        tempEndPoint = graphData1.window_end_time[tempEndIndex];
      }
    }

    const updatedData = await graphData[0].datasets[0].data.map((point, index) => {
      if (index >= tempStartPoint && index < tempEndPoint) {
        return { ...point, clusterId: selectedClustersId }; // Update clusterId for the range
      }
      return point;
    });

    const tempGraphData = {
      ...graphData[0],
      datasets: [
        {
          ...graphData[0].datasets[0],
          data: updatedData, // Updated data
        },
      ],
    };
    
    setGraphData([tempGraphData, graphData[1]]);

    setStartPoint(tempStartPoint);
    setEndPoint(tempEndPoint);
    setSelectedIndexes([tempStartIndex, tempEndIndex]);
    setStartAndEndStates(tempStartPoint);
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
              data={graphData[0]}
              options={chartOptions}
              onClick={handleChartClick}
            />
          )}
        </div>
      </div>

      {startPoint != -1 && (
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
            <button onClick={resetSignalSelection}>
              Remove Signal Selection
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <label htmlFor="dropdown-left" style={{ marginRight: "0.5rem" }}>
              Change Cluster:
            </label>
            {graphData && graphData[0].datasets.length > 0 ? (
              <select
                onChange={(e) => handleClusterChange(parseInt(e.target.value))}
                value={selectedClustersId || ""}
              >
                {Array.from(
                  new Set(
                    graphData[0].datasets[0].data.map((point) => point.clusterId)
                  )
                ).map((clusterId) => (
                  <option key={clusterId} value={clusterId}>
                    {graphData[1].idToLabel[clusterId] ||
                      `Cluster ${clusterId}`}{" "}
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
            <button
              onClick={(e) => expandSignal(-1)}
            >
              &#8592;
            </button>
            <select
              id="dropdown-right"
              value={selectedValue}
              onChange={handleChange}
              disabled={true}
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
            <button
              onClick={(e) => expandSignal(1)}
            >
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
