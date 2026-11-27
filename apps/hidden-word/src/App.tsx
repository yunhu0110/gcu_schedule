import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Page } from './components/Page';
import StartScreen from './screens/StartScreen';
import HowToPlayScreen from './screens/HowToPlayScreen';
import CreateRoomScreen from './screens/CreateRoomScreen';
import JoinRoomScreen from './screens/JoinRoomScreen';
import LobbyScreen from './screens/LobbyScreen';
import EnvelopeScreen from './screens/EnvelopeScreen';
import HiddenWordScreen from './screens/HiddenWordScreen';
import GameScreen from './screens/GameScreen';
import DashboardScreen from './screens/DashboardScreen';

export default function App() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Page><StartScreen /></Page>} />
          <Route path="/how-to-play" element={<Page><HowToPlayScreen /></Page>} />
          <Route path="/create" element={<Page><CreateRoomScreen /></Page>} />
          <Route path="/join" element={<Page><JoinRoomScreen /></Page>} />
          <Route path="/join/:code" element={<Page><JoinRoomScreen /></Page>} />
          <Route path="/room/:code" element={<Page><LobbyScreen /></Page>} />
          <Route path="/room/:code/envelopes" element={<Page><EnvelopeScreen /></Page>} />
          <Route path="/room/:code/hidden" element={<Page><HiddenWordScreen /></Page>} />
          <Route path="/room/:code/play" element={<Page><GameScreen /></Page>} />
          <Route path="/room/:code/dashboard" element={<DashboardScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
