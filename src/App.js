import './App.css';
import { useState } from 'react';
import ClusterBarChart from './components/ClusterSegments';
import { ClusterProvider } from './components/ClusterContext';
import LineChart from './components/Line';

function App() {
  
  return (
    <ClusterProvider>
      <div style={{margin: '10px 80px'}}>
        <LineChart />
        {/* <ClusterBarChart /> */}
      </div>
    </ClusterProvider>
  );
}

export default App;
