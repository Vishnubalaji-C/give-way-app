import { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';

export default function AppTutorial() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('giveway_tutorial_completed');
    if (!hasSeenTutorial) {
      setRun(true);
    }
  }, []);

  const steps = [
    {
      target: 'body',
      placement: 'center',
      content: 'Welcome to GiveWay! Let us take a quick tour of your sophisticated traffic management system.',
      disableBeacon: true,
    },
    {
      target: '.nav-dashboard',
      content: 'The Dashboard gives you an overview of all junctions, live metrics, and real-time alerts.',
    },
    {
      target: '.nav-map',
      content: 'View your traffic junctions visually on the interactive Map. Select a junction to see live status.',
    },
    {
      target: '.nav-camera',
      content: 'Access live CCTV feeds here to monitor intersections and ghost lanes in real-time.',
    },
    {
      target: '.nav-control',
      content: 'The Control Room allows manual override of signals in case of emergencies or priority vehicles.',
    },
    {
      target: '.nav-analytics',
      content: 'Dive deep into system metrics, wait times, and equity scores in Analytics.',
    }
  ];

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('giveway_tutorial_completed', 'true');
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          arrowColor: '#1f2937',
          backgroundColor: '#111827',
          overlayColor: 'rgba(0, 0, 0, 0.75)',
          primaryColor: '#06b6d4',
          textColor: '#e5e7eb',
          zIndex: 10000,
        },
        tooltipContainer: {
          textAlign: 'left',
          borderRadius: '12px',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(6, 182, 212, 0.2)',
        },
        buttonNext: {
          backgroundColor: '#06b6d4',
          borderRadius: '8px',
          color: '#000',
          fontWeight: 'bold',
        },
        buttonBack: {
          color: '#9ca3af',
        },
        buttonSkip: {
          color: '#ef4444',
        }
      }}
    />
  );
}
