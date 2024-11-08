import React, { createContext, useContext, useState } from 'react';

// Create a Context
const ClusterContext = createContext();

// Create a Provider Component
export const ClusterProvider = ({ children }) => {
  const [selectedClusters, setSelectedClusters] = useState([]);

  const selectCluster = (cluster) => {
    setSelectedClusters((prev) => {
      if (prev.includes(cluster)) {
        return prev.filter((id) => id !== cluster);
      }
      return [...prev, cluster];
    });
  };

  const clearClusters = () => {
    setSelectedClusters([]);
  };

  return (
    <ClusterContext.Provider value={{ selectedClusters, selectCluster, clearClusters }}>
      {children}
    </ClusterContext.Provider>
  );
};

// Custom Hook to use Cluster Context
export const useClusterContext = () => useContext(ClusterContext);
