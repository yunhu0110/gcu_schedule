import { Routes, Route, Navigate } from 'react-router-dom';
import StartScreen from './screens/StartScreen';
import HowToPlayScreen from './screens/HowToPlayScreen';
import CreateRoomScreen from './screens/CreateRoomScreen';
import JoinRoomScreen from './screens/JoinRoomScreen';
import LobbyScreen from './screens/LobbyScreen';
import EnvelopeScreen from './screens/EnvelopeScreen';
import HiddenWordScreen from './screens/HiddenWordScreen';
import GameScreen from './screens/GameScreen';

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/how-to-play" element={<HowToPlayScreen />} />
        <Route path="/create" element={<CreateRoomScreen />} />
        <Route path="/join" element={<JoinRoomScreen />} />
        <Route path="/join/:code" element={<JoinRoomScreen />} />
        <Route path="/room/:code" element={<LobbyScreen />} />
        <Route path="/room/:code/envelopes" element={<EnvelopeScreen />} />
        <Route path="/room/:code/hidden" element={<HiddenWordScreen />} />
        <Route path="/room/:code/play" element={<GameScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
