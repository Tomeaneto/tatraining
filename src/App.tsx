import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Composicao } from './pages/Composicao';
import { Conectar } from './pages/Conectar';
import { Dashboard } from './pages/Dashboard';
import { Plano } from './pages/Plano';
import { Treinos } from './pages/Treinos';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="plano" element={<Plano />} />
        <Route path="treinos" element={<Treinos />} />
        <Route path="composicao" element={<Composicao />} />
        <Route path="conectar" element={<Conectar />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
