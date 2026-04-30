import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AppFailureScreen } from './components/app/AppFailureScreen.tsx'
import { getRuntimeHealthReport } from './config/runtimeHealth.ts'
import { loadRuntimeConfig } from './config/runtimeConfig.ts'
import './index.css'

interface AppBootstrapErrorState {
  title: string;
  message: string;
  details?: string | null;
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[app] Unhandled render error.', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const runtimeHealth = getRuntimeHealthReport();
      return (
        <AppFailureScreen
          title="App failed to load"
          message="The app hit an unexpected error while rendering. Reload the page first. If this keeps happening, check the runtime config and recent changes."
          details={this.state.error.message}
          diagnostics={runtimeHealth.entries
            .filter((entry) => entry.status !== 'ok')
            .map((entry) => ({
              label: entry.label,
              status: entry.status,
              detail: `${entry.requirement.toUpperCase()}: ${entry.detail}`,
            }))}
          actionLabel="Reload app"
          onAction={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

function renderBootstrapFailure(errorState: AppBootstrapErrorState) {
  const runtimeHealth = getRuntimeHealthReport();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppFailureScreen
        title={errorState.title}
        message={errorState.message}
        details={errorState.details}
        diagnostics={runtimeHealth.entries
          .filter((entry) => entry.requirement !== 'optional' || entry.status === 'missing')
          .map((entry) => ({
            label: entry.label,
            status: entry.status,
            detail: `${entry.requirement.toUpperCase()}: ${entry.detail}`,
          }))}
        actionLabel="Reload app"
        onAction={() => window.location.reload()}
      />
    </React.StrictMode>,
  )
}

async function bootstrap() {
  try {
    await loadRuntimeConfig()

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <AppErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AppErrorBoundary>
      </React.StrictMode>,
    )
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    renderBootstrapFailure({
      title: 'Runtime configuration failed',
      message: 'The app could not finish booting. Verify public runtime config values and required environment settings, then reload.',
      details,
    })
  }
}

void bootstrap()
