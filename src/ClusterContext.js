import React, { createContext, useContext, useState, useEffect } from "react";

// Create a Context for the cluster data
const ClusterContext = createContext();

// ClusterProvider component to wrap your application
export const ClusterProvider = ({ children }) => {
  const [selectedClusters, setSelectedClusters] = useState([]);
  const [clusterNames, setClusterNames] = useState(() => {
    // Load initial cluster names from local storage, or set defaults
    const savedClusterNames = JSON.parse(localStorage.getItem("clusterNames")) || {};
    return savedClusterNames;
  });

  // Save cluster names to local storage whenever they change
  useEffect(() => {
    localStorage.setItem("clusterNames", JSON.stringify(clusterNames));
  }, [clusterNames]);

  const selectCluster = (clusterId) => {
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

  const getClusterName = (clusterId) => {
    return clusterNames[clusterId] || `Cluster ${clusterId}`;
  };

  return (
    <ClusterContext.Provider
      value={{
        selectedClusters,
        selectCluster,
        clearClusters,
        clusterNames,
        renameCluster,
        getClusterName,
      }}
    >
      {children}
    </ClusterContext.Provider>
  );
};

// Custom hook to use the ClusterContext
export const useClusterContext = () => useContext(ClusterContext);
