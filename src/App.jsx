import { Routes, Route, Navigate } from 'react-router-dom';
import { SnackbarProvider } from './context/SnackbarContext';
import { PlanProvider } from './context/PlanContext';
import PlannerLayout from './components/PlannerLayout';
import LiveStationPicker from './components/LiveStationPicker';
import LiveStationView from './components/LiveStationView';
import ProcessLiveView from './components/ProcessLiveView';

export default function App() {
  return (
    <SnackbarProvider>
    <PlanProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<PlannerLayout />} />
        <Route path="/scheduling" element={<PlannerLayout />} />
        <Route path="/production" element={<PlannerLayout />} />
        <Route path="/recipes" element={<PlannerLayout />} />
        <Route path="/settings" element={<PlannerLayout />} />
        <Route path="/help" element={<PlannerLayout />} />
        <Route path="/live/line/:lineId/process/:processId" element={<ProcessLiveView />} />
        <Route path="/live" element={<LiveStationPicker />} />
        <Route path="/live/:stationId" element={<LiveStationView />} />
      </Routes>
    </PlanProvider>
    </SnackbarProvider>
  );
}
