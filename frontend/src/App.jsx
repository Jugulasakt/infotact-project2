import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import GeneratePage from './pages/GeneratePage';
import HistoryPage from './pages/HistoryPage';

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <header className="navbar">
        <div className="navbar-inner">
          <NavLink className="navbar-logo" to="/">
            Ad<span className="accent">V</span>antage Gen
          </NavLink>

          <nav className="nav-links">
            <NavLink
              to="/"
              className={({ isActive }) => `nav-btn ${isActive ? 'nav-btn-primary' : 'nav-btn-ghost'}`}
            >
              Generate
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) => `nav-btn ${isActive ? 'nav-btn-primary' : 'nav-btn-ghost'}`}
            >
              History
            </NavLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<GeneratePage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#ffffff',
            color: '#1f2937',
            border: '1px solid #d9e1ff'
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#ffffff'
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff'
            }
          }
        }}
      />
    </BrowserRouter>
  );
}

export default App;
