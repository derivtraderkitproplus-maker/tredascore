import React, { useEffect, useState } from 'react';

export const AppPreloader = ({ isAppReady }) => {
  const [progressPercentage, setProgressPercentage] = useState(1);
  const [currentStatusText, setCurrentStatusText] = useState('Initializing TredaScore...');

  useEffect(() => {
    // Simulated liquid loading sequence increments to drive premium responsiveness
    const bootTimer = setInterval(() => {
      setProgressPercentage((prevProgress) => {
        if (prevProgress >= 98) {
          clearInterval(bootTimer);
          return 98; // Hold safely at 98% until the main wrapper explicitly flags ready
        }
        
        // Dynamically alter layout subheaders based on loading progress metrics
        if (prevProgress === 20) setCurrentStatusText('Connecting to Deriv Production WebSocket...');
        if (prevProgress === 50) setCurrentStatusText('Hydrating Multi-Asset Strategy Matrix...');
        if (prevProgress === 78) setCurrentStatusText('Synchronizing Custom Parameter States...');
        
        const incrementalLeap = Math.floor(Math.random() * 5) + 1;
        return Math.min(prevProgress + incrementalLeap, 98);
      });
    }, 100);

    return () => clearInterval(bootTimer);
  }, []);

  // Force the layout bar to snap straight to 100% the instant your backend completes loading
  useEffect(() => {
    if (isAppReady) {
      setProgressPercentage(100);
      setCurrentStatusText('Boot sequence complete. Welcome.');
    }
  }, [isAppReady]);

  // Safely eliminate container layers from DOM tracking if loading hits 100%
  if (progressPercentage >= 100) {
    return null;
  }

  return (
    <div className="saas-boot-preloader-backdrop">
      <div className="saas-boot-card-window">
        <h2>TredaScore</h2>
        <p>TredaScore Trading Workspace</p>

        <div className="saas-boot-dots-row">
          <div className="saas-boot-dot"></div>
          <div className="saas-boot-dot"></div>
          <div className="saas-boot-dot"></div>
        </div>

        <div className="saas-boot-status-msg">{currentStatusText}</div>

        <div className="saas-boot-progress-wrapper">
          <div className="saas-boot-progress-track">
            <div 
              className="saas-boot-progress-bar-fill" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="saas-boot-progress-meta-row">
            <span>Boot sequence</span>
            <span>{progressPercentage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppPreloader;
