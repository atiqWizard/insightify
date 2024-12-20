import React, { useEffect, useState } from "react";
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
  } = useClusterContext();
  const [clusterCounts, setClusterCounts] = useState({});
  const [avgTime, setAvgTime] = useState({});
  const [clusterNames, setClusterNames] = useState({});

  const [showDialog, setShowDialog] = useState(false);
  const [currentClusterId, setCurrentClusterId] = useState(null);
  const [newLabel, setNewLabel] = useState("");

  const handleRightClick = (e, clusterId) => {
    e.preventDefault();
    setCurrentClusterId(clusterId);
    setNewLabel(clusterNames[clusterId] || `Cluster ${clusterId}`);
    setShowDialog(true);
  };

  const handleSaveLabel = () => {
    renameCluster(currentClusterId, newLabel);
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
        // const [dataResponse, kmeansResponse] = await Promise.all([
        //   fetch(`${process.env.PUBLIC_URL}/data.json`),
        //   fetch(`${process.env.PUBLIC_URL}/kmeans.json`),
        // ]);
        // const data = await dataResponse.json();
        // const kmeans = await kmeansResponse.json();
        const data = graphData[0];
        const kmeans = graphData[1];

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

        const savedClusterNames = {};
        const initialClusterNames = Object.keys(counts).reduce(
          (acc, clusterId) => {
            acc[clusterId] =
              savedClusterNames[clusterId] || `Cluster ${clusterId}`;
            return acc;
          },
          {}
        );

        setClusterNames(initialClusterNames);
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
      (cluster) => clusterNames[cluster] || `Cluster ${cluster}`
    ),
    datasets: [
      {
        label: "Number of Segments",
        data: Object.values(clusterCounts),
        backgroundColor: Object.keys(clusterCounts).map((cluster) =>
          // getBackgroundColor(parseInt(cluster))
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
      (cluster) => clusterNames[cluster] || `Cluster ${cluster}`
    ),
    datasets: [
      {
        label: "Average Duration",
        data: Object.values(avgTime),
        backgroundColor: Object.keys(avgTime).map((cluster) =>
          // getBackgroundColor(parseInt(cluster))
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
      x: { title: { display: true, text: "Cluster" } },
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
      x: { title: { display: true, text: "Cluster" } },
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
        {Object.keys(clusterCounts).map((clusterId) => {
          const clusterIdNum = parseInt(clusterId);
          // const buttonColor = getBackgroundColor(clusterIdNum);
          const buttonColor =
            clusterColors[clusterIdNum % clusterColors.length];
          return (
            <button
              key={clusterId}
              onClick={() => selectCluster(clusterIdNum, true)}
              onContextMenu={(e) => handleRightClick(e, clusterIdNum)}
              style={{
                backgroundColor: buttonColor,
                borderColor: getBorderColor(clusterIdNum),
                borderWidth: "1px",
                borderRadius: "4px",
                padding: "8px 16px",
                margin: "0 5px",
                cursor: "pointer",
                color: "white",
              }}
            >
              {clusterNames[clusterId]}
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
    </div>
  );
};

export default ClusterBarChart;
