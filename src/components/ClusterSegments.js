import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import Papa from "papaparse";
import { useClusterContext } from "./ClusterContext";
import "./ClusterBarChart.css"; // Importing CSS for responsive styles

const ClusterBarChart = () => {
  const { selectCluster, clearClusters, selectedClusters } = useClusterContext();
  const [clusterCounts, setClusterCounts] = useState({});
  const [avgTime, setAvgTime] = useState({});
  const [clusterNames, setClusterNames] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingCluster, setEditingCluster] = useState(null);

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
    const csvFilePath = `${process.env.PUBLIC_URL}/kmeans_output.csv`;

    fetch(csvFilePath)
      .then((response) => response.text())
      .then((csvData) => {
        Papa.parse(csvData, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const counts = {};
            const times = {};

            results.data.forEach((row) => {
              const clusterId = parseInt(row.cluster_id, 10);
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

            const savedClusterNames = JSON.parse(localStorage.getItem("clusterNames")) || {};
            const initialClusterNames = Object.keys(counts).reduce((acc, clusterId) => {
              acc[clusterId] = savedClusterNames[clusterId] || `Cluster ${clusterId}`;
              return acc;
            }, {});
            if(Object.keys(savedClusterNames).length > 0) {
              setClusterNames(savedClusterNames);
            } else {
              setClusterNames(initialClusterNames);
            }
          },
        });
      });
  }, []);

  useEffect(() => {
    if(Object.keys(clusterNames).length > 0) {
      localStorage.setItem("clusterNames", JSON.stringify(clusterNames));
    }
  }, [clusterNames]);

  const handleBarClick = (event, elements) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const clusterId = parseInt(Object.keys(clusterCounts)[index], 10);
      selectCluster(clusterId);
    }
  };

  const getBackgroundColor = (clusterId) => {
    const baseColor = clusterColors[clusterId % clusterColors.length];
    if (selectedClusters.length === 0 || selectedClusters.includes(clusterId)) {
      return baseColor.replace('1)', '0.8)');
    }
    return baseColor.replace('1)', '0.2)');
  };

  const getBorderColor = (clusterId) => {
    const baseColor = clusterColors[clusterId % clusterColors.length];
    if (selectedClusters.length === 0 || selectedClusters.includes(clusterId)) {
      return baseColor;
    }
    return baseColor.replace('1)', '0.4)');
  };

  const handleButtonClick = (clusterId) => {
    if (selectedClusters.includes(clusterId)) {
      selectCluster(clusterId);
    } else {
      selectCluster(clusterId);
    }
  };

  const handleRightClick = (e, clusterId) => {
    e.preventDefault();
    const newName = prompt("Enter new name for the cluster", clusterNames[clusterId]);
    if (newName) {
      setClusterNames((prevNames) => ({
        ...prevNames,
        [clusterId]: newName,
      }));
    }
  };

  const segmentChartData = {
    labels: Object.keys(clusterCounts).map((cluster) => clusterNames[cluster] || `Cluster ${cluster}`),
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
    labels: Object.keys(avgTime).map((cluster) => clusterNames[cluster] || `Cluster ${cluster}`),
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
      datalabels: {
        display: true,
        color: 'black',
        anchor: 'end',
        align: 'top',
        formatter: (value) => value.toLocaleString(),
      },
    },
    scales: {
      x: { title: { display: true, text: "Cluster ID" } },
      y: { title: { display: true, text: "Number of Segments" }, beginAtZero: true },
    },
    onClick: handleBarClick,
  };

  const avgTimeOptions = {
    ...options,
    scales: {
      x: { title: { display: true, text: "Cluster ID" } },
      y: { title: { display: true, text: "Average Duration" }, beginAtZero: true },
    },
  };

  return (
    <div>
      <h2>Cluster Distribution</h2>
      <div className="chart-container">
        <div className="chart"  style={{ height: "350px" }}>
          <Bar data={segmentChartData} options={options} />
        </div>
        <div className="chart"  style={{ height: "350px" }}>
          <Bar data={avgTimeChartData} options={avgTimeOptions} />
        </div>
      </div>

      <div className="button-container">
        {Object.keys(clusterCounts).map((clusterId) => {
          const clusterIdNum = parseInt(clusterId, 10);
          const buttonColor = getBackgroundColor(clusterIdNum);
          return (
            <button
              key={clusterId}
              onClick={() => handleButtonClick(clusterIdNum)}
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
