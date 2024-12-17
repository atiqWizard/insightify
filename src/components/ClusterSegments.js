import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { useClusterContext } from "./ClusterContext";
import "./ClusterBarChart.css"; // Importing CSS for responsive styles

const ClusterBarChart = () => {
  const { selectCluster, clearClusters, selectedClusters, renameCluster } =
    useClusterContext();
  const [clusterCounts, setClusterCounts] = useState({});
  const [avgTime, setAvgTime] = useState({});
  const [clusterNames, setClusterNames] = useState({});

  const clusterColors = [
    // Define cluster colors here
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dataResponse, kmeansResponse] = await Promise.all([
          fetch(`${process.env.PUBLIC_URL}/data.json`),
          fetch(`${process.env.PUBLIC_URL}/kmeans.json`),
        ]);
        const data = await dataResponse.json();
        const kmeans = await kmeansResponse.json();

        const counts = {};
        const times = {};
        console.log("kmeans: ", kmeans);

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
          console.log("--: ", row);
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

        const savedClusterNames =
          JSON.parse(localStorage.getItem("clusterNames")) || {};
        const initialClusterNames = Object.keys(counts).reduce(
          (acc, clusterId) => {
            acc[clusterId] =
              savedClusterNames[clusterId] || `Cluster ${clusterId}`;
            return acc;
          },
          {}
        );
        if (Object.keys(savedClusterNames).length > 0) {
          setClusterNames(savedClusterNames);
        } else {
          setClusterNames(initialClusterNames);
        }
      } catch (error) {
        console.error("Error loading JSON data:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (Object.keys(clusterNames).length > 0) {
      localStorage.setItem("clusterNames", JSON.stringify(clusterNames));
    }
  }, [clusterNames]);

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
          getBackgroundColor(parseInt(cluster, 10))
        ),
        borderColor: Object.keys(clusterCounts).map((cluster) =>
          getBorderColor(parseInt(cluster, 10))
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
          getBackgroundColor(parseInt(cluster, 10))
        ),
        borderColor: Object.keys(avgTime).map((cluster) =>
          getBorderColor(parseInt(cluster, 10))
        ),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: { title: { display: true, text: "Cluster ID" } },
      y: {
        title: { display: true, text: "Number of Segments" },
        beginAtZero: true,
      },
    },
    onClick: handleBarClick,
  };

  return (
    <div>
      <h2>Cluster Distribution</h2>
      <div className="chart-container">
        <div className="chart" style={{ height: "350px" }}>
          <Bar data={segmentChartData} options={options} />
        </div>
        <div className="chart" style={{ height: "350px" }}>
          <Bar data={avgTimeChartData} options={options} />
        </div>
      </div>

      <div className="button-container">
        {Object.keys(clusterCounts).map((clusterId) => {
          const clusterIdNum = parseInt(clusterId, 10);
          const buttonColor = getBackgroundColor(clusterIdNum);
          return (
            <button
              key={clusterId}
              // onClick={() => handleButtonClick(clusterIdNum)}
              // onContextMenu={(e) => handleRightClick(e, clusterIdNum)}
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

      <div style={{ textAlign: "center", marginTop: "1rem" }}>
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
