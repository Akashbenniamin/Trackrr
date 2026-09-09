import { useState, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress, Fab, useMediaQuery, useTheme } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { getAppTheme } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider, useApp } from './contexts/AppContext';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import TaskBoard from './views/TaskBoard';
import AnalyticsView from './views/AnalyticsView';
import ClientsView from './views/ClientsView';
import BillsView from './views/BillsView';
import SettingsView from './views/SettingsView';
import BatchflowDashboard from './views/batchflow/BatchflowDashboard';
import BatchflowBatches from './views/batchflow/BatchflowBatches';
import BatchflowClients from './views/batchflow/BatchflowClients';
import BatchflowSearch from './views/batchflow/BatchflowSearch';
import BatchflowArchive from './views/batchflow/BatchflowArchive';
import TaskDialog from './components/TaskDialog';

function AppContent() {
  const { currentView, setCurrentView, loading, canEdit, activeWorkspace } = useApp();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="primary" />
        <Box sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>Loading your workspace…</Box>
      </Box>
    );
  }

  const isBatchflow = activeWorkspace?.type === 'batchflow';

  const renderView = () => {
    if (isBatchflow) {
      switch (currentView) {
        case 'dashboard':
          return <BatchflowDashboard onNavigate={setCurrentView} />;
        case 'batches':
          return <BatchflowBatches />;
        case 'clients':
          return <BatchflowClients />;
        case 'search':
          return <BatchflowSearch onNavigate={setCurrentView} />;
        case 'archive':
          return <BatchflowArchive />;
        case 'settings':
          return <SettingsView />;
        default:
          return <BatchflowDashboard onNavigate={setCurrentView} />;
      }
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentView} />;
      case 'tasks': return <TaskBoard />;
      case 'analytics': return <AnalyticsView />;
      case 'clients': return <ClientsView />;
      case 'bills': return <BillsView />;
      case 'settings': return <SettingsView />;
      default: return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <Layout onAddTask={() => setTaskDialogOpen(true)}>
      {/* Desktop sidebar offset */}
      <Box sx={{ ml: { md: '64px' } }}>
        {renderView()}
      </Box>

      {/* Mobile FAB for adding tasks (only on tasks view in freelance mode) */}
      {isMobile && !isBatchflow && currentView === 'tasks' && canEdit && (
        <Fab
          color="primary"
          onClick={() => setTaskDialogOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: 1200,
          }}
        >
          <AddRoundedIcon />
        </Fab>
      )}

      <TaskDialog
        open={taskDialogOpen}
        task={null}
        onClose={() => setTaskDialogOpen(false)}
        onSave={() => setTaskDialogOpen(false)}
      />
    </Layout>
  );
}

function ThemedApp() {
  const { settings } = useApp();
  const currentMuiTheme = useMemo(() => {
    return getAppTheme(settings.theme_style || 'default', settings.theme_color || '#818CF8');
  }, [settings.theme_style, settings.theme_color]);

  return (
    <ThemeProvider theme={currentMuiTheme}>
      <CssBaseline />
      <AppContent />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <ThemedApp />
      </AppProvider>
    </AuthProvider>
  );
}
