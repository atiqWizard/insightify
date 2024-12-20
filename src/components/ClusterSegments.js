import React, { useEffect, useState, useRef } from "react";
import { Bar } from "react-chartjs-2";
import { useClusterContext } from "./ClusterContext";
import "./ClusterBarChart.css"; // Importing CSS for responsive styles

const ClusterBarChart = () => {
  const {
    selectCluster,
    clearClusters,
    selectedClusters,
    renameCluster,
    graphData,
    setGraphData,
  } = useClusterContext();
  const [clusterCounts, setClusterCounts] = useState({});
  const [avgTime, setAvgTime] = useState({});
  const [clusterLabels, setClusterLabels] = useState({});
  const [uniqueClusterLabels, setUniqueClusterLabels] = useState([]);

  const [showDialog, setShowDialog] = useState(false);
  const [currentClusterId, setCurrentClusterId] = useState(null);
  const [newLabel, setNewLabel] = useState("");
  const prevLabel = useRef();

  const handleRightClick = (e, clusterId) => {
    e.preventDefault();
    setCurrentClusterId(clusterId);
    // prevLabel.current = e.target.textContent;
    prevLabel.current = e.target.textContent;
    setNewLabel(e.target.textContent); // Prepopulate with the current label
    setShowDialog(true);
  };

  const handleSaveLabel = () => {
    if (newLabel.trim()) {
      // Update the cluster_label for the currentClusterId
      const updatedClusterLabels = { ...graphData[1].cluster_label };
      const updatedIdToLabel = { ...graphData[1].idToLabel };

      for (let i = 0; i < Object.keys(updatedClusterLabels).length; i++) {
        if (updatedClusterLabels[i] === prevLabel.current) {
          updatedClusterLabels[i] = newLabel; // Update cluster_label
        }
      }

      for (let i = 0; i < Object.keys(updatedIdToLabel).length; i++) {
        if (updatedIdToLabel[i] === prevLabel.current) {
          updatedIdToLabel[i] = newLabel; // Update idToLabel
        }
      }

      // Update the graphData with the modified cluster_label and idToLabel
      const updatedGraphData = [...graphData];
      updatedGraphData[1] = {
        ...graphData[1],
        cluster_label: updatedClusterLabels,
        idToLabel: updatedIdToLabel, // Update idToLabel
      };

      // Set the updated graphData
      setGraphData(updatedGraphData);
    }

    setShowDialog(false);
    setCurrentClusterId(null);
    setNewLabel("");
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setCurrentClusterId(null);
    setNewLabel("");
  };

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

  useEffect(() => {
    const fetchData = async () => {
      if (graphData.length == 0) {
        return;
      }
      try {
        const data = graphData[0];
        const kmeans = graphData[1];
        const clusterLabelsData = kmeans.cluster_label;

        // Extract unique cluster labels
        const uniqueLabels = [...new Set(Object.values(clusterLabelsData))];
        setUniqueClusterLabels(uniqueLabels);

        const counts = {};
        const times = {};

        const rowKeys = Object.keys(kmeans.cluster_id); // Get the indices of rows
        const rows = rowKeys.map((key) => {
          return {
            cluster_id: kmeans.cluster_id[key],
            window_start_time: kmeans.window_start_time[key],
            window_end_time: kmeans.window_end_time[key],
            // Add other properties as needed
          };
        });

        // Now `rows` is an array of objects, and you can use `forEach`:
        rows.forEach((row) => {
          const clusterId = row.cluster_id;
          const startTime = row.window_start_time;

          counts[clusterId] = (counts[clusterId] || 0) + 1;

          if (!times[clusterId]) {
            times[clusterId] = { total: 0, count: 0 };
          }
          times[clusterId].total += parseFloat(startTime);
          times[clusterId].count += 1;
        });
        const avgTimeData = {};
        for (const clusterId in times) {
          avgTimeData[clusterId] =
            times[clusterId].total / times[clusterId].count;
        }

        setClusterCounts(counts);
        setAvgTime(avgTimeData);
      } catch (error) {
        console.error("Error loading JSON data:", error);
      }
    };

    fetchData();
  }, [graphData]);

  // Helper functions and chart options remain unchanged
  const handleBarClick = (event, elements) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const clusterId = parseInt(Object.keys(clusterCounts)[index], 10);
      selectCluster(clusterId);
    }
  };

  function getBackgroundColor(clusterId) {
    if (typeof clusterId !== "number" || isNaN(clusterId)) {
      console.error("Invalid clusterId:", clusterId);
      return "transparent"; // Fallback color for invalid input
    }
    // Example logic: Return a color based on clusterId
    return `rgb(${clusterId * 50}, ${clusterId * 30}, ${clusterId * 20})`;
  }

  const getBorderColor = (clusterId) => {
    const baseColor = clusterColors[clusterId % clusterColors.length];
    if (selectedClusters.length === 0 || selectedClusters.includes(clusterId)) {
      return baseColor;
    }
    return baseColor.replace("1)", "0.4)");
  };

  const segmentChartData = {
    labels: Object.keys(clusterCounts).map(
      (cluster) => graphData[1]?.idToLabel[cluster] || `Cluster ${cluster}`
    ),
    datasets: [
      {
        label: "Number of Segments",
        data: Object.values(clusterCounts),
        backgroundColor: Object.keys(clusterCounts).map((cluster) =>
          getBorderColor(parseInt(cluster))
        ),
        borderColor: Object.keys(clusterCounts).map((cluster) =>
          getBorderColor(parseInt(cluster))
        ),
        borderWidth: 1,
      },
    ],
  };

  const avgTimeChartData = {
    labels: Object.keys(avgTime).map(
      (cluster) => graphData[1]?.idToLabel[cluster] || `Cluster ${cluster}`
    ),
    datasets: [
      {
        label: "Average Duration",
        data: Object.values(avgTime),
        backgroundColor: Object.keys(avgTime).map((cluster) =>
          getBorderColor(parseInt(cluster))
        ),
        borderColor: Object.keys(avgTime).map((cluster) =>
          getBorderColor(parseInt(cluster))
        ),
        borderWidth: 1,
      },
    ],
  };

  const avgTimeOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: { title: { display: false, text: "Cluster" } },
      y: {
        title: { display: true, text: "Avg Time" },
        beginAtZero: true,
      },
    },
    onClick: handleBarClick,
  };

  const segmentOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: { title: { display: false, text: "Cluster" } },
      y: {
        title: { display: true, text: "Total Segments" },
        beginAtZero: true,
      },
    },
    onClick: handleBarClick,
  };

  return (
    <div>
      <div className="chart-container">
        <div className="chart" style={{ height: "350px" }}>
          <Bar data={segmentChartData} options={segmentOptions} />
        </div>
        <div className="chart" style={{ height: "350px" }}>
          <Bar data={avgTimeChartData} options={avgTimeOptions} />
        </div>
      </div>

      <div className="button-container">
        {graphData &&
          graphData[1] &&
          graphData[1].idToLabel &&
          Object.keys(graphData[1].idToLabel).map((clusterId) => {
            const label = graphData[1].idToLabel[clusterId];
            const color = clusterColors[clusterId % clusterColors.length]; // Use clusterId for correct color assignment
            return (
              <button
                key={label}
                onClick={() => selectCluster(parseInt(clusterId, 10), true)} // Pass clusterId as an integer
                onContextMenu={(e) =>
                  handleRightClick(e, parseInt(clusterId, 10))
                }
                style={{
                  backgroundColor: color,
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "8px 16px",
                  margin: "0 5px",
                  cursor: "pointer",
                  color: "white",
                }}
              >
                {label}
              </button>
            );
          })}
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          onClick={clearClusters}
          style={{
            padding: "8px 16px",
            backgroundColor: "#ff6b6b",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Clear Selection
        </button>
      </div>
      {showDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Rename Cluster</h3>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Enter new cluster label"
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "10px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
            <div>
              <button onClick={handleSaveLabel} style={buttonStyle}>
                Save
              </button>
              <button onClick={handleCloseDialog} style={buttonStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const buttonStyle = {
  padding: "8px 16px",
  margin: "0 5px",
  borderRadius: "4px",
  cursor: "pointer",
};

export default ClusterBarChart;
