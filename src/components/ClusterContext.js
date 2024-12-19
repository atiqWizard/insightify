import React, { createContext, useContext, useState, useEffect } from "react";

const ClusterContext = createContext();

export const ClusterProvider = ({ children }) => {
  const [graphData, setGraphData] = useState([]);
  const [selectedClusters, setSelectedClusters] = useState([]);
  const [clusterNames, setClusterNames] = useState(() => {
    const savedNames = JSON.parse(localStorage.getItem("clusterNames")) || {};
    return savedNames;
  });

  useEffect(() => {
    localStorage.setItem("clusterNames", JSON.stringify(clusterNames));
  }, [clusterNames]);

  const selectCluster = (clusterId, resetOthers=false) => {
    if(resetOthers) {
      setSelectedClusters([clusterId]);
      return;
    }
    setSelectedClusters((prev) =>
      prev.includes(clusterId) ? prev.filter((id) => id !== clusterId) : [...prev, clusterId]
    );
  };

  const clearClusters = () => {
    setSelectedClusters([]);
  };

  const renameCluster = (clusterId, newName) => {
    setClusterNames((prev) => ({
      ...prev,
      [clusterId]: newName,
    }));
  };

  const setVisualizationData = (data, kmeans) => {
    setGraphData([data, kmeans])
  }

  return (
    <ClusterContext.Provider
      value={{
        selectedClusters,
        clusterNames,
        graphData,
        setGraphData,
        selectCluster,
        clearClusters,
        renameCluster,
      }}
    >
      {children}
    </ClusterContext.Provider>
  );
};

export const useClusterContext = () => {
  return useContext(ClusterContext);
};
