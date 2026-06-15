import { useAppStore } from './store/app-store';
import { useI18n } from './i18n';
import { useCloudTheme } from './theme/useCloudTheme';
import { useURLSync } from './hooks/useURLSync';
import { Header } from './components/Header/Header';
import { CloudSelector } from './components/CloudSelector/CloudSelector';
import { CIDRInput } from './components/CIDRInput/CIDRInput';
import { TreeVisualizer } from './components/TreeVisualizer/TreeVisualizer';
import { GroupedView } from './components/GroupedView/GroupedView';
import { SummaryPanel } from './components/SummaryPanel/SummaryPanel';
import { FileControls } from './components/FileControls/FileControls';
import { CreateWorkload } from './components/CreateWorkload/CreateWorkload';
import { ToastContainer } from './components/Toast/Toast';
import { AnnouncerProvider } from './components/Announcer/Announcer';
import styles from './App.module.css';

function App() {
  const targetCloud = useAppStore((s) => s.targetCloud);
  const activeView = useAppStore((s) => s.activeView);
  const networkPlan = useAppStore((s) => s.networkPlan);

  // Apply cloud-specific accent colors on provider change (300ms transition)
  useCloudTheme();

  // Sync network plan state to/from URL hash
  useURLSync();

  return (
    <AnnouncerProvider>
      <div className={styles.app}>
        <ToastContainer />
        {targetCloud ? (
          <>
            <Header />
            <main className={styles.main}>
              <div className={styles.workspace}>
                <div className={styles.toolbar}>
                  <CIDRInput />
                  <CreateWorkload />
                  <FileControls />
                </div>
                {networkPlan && <ViewToggle activeView={activeView} />}
                {networkPlan && (
                  <div className={styles.content}>
                    <div className={styles.visualizer}>
                      {activeView === 'grouped' ? (
                        <GroupedView />
                      ) : (
                        <TreeVisualizer />
                      )}
                    </div>
                    <aside className={styles.sidebar}>
                      <SummaryPanel />
                    </aside>
                  </div>
                )}
              </div>
            </main>
          </>
        ) : (
          <main className={styles.main}>
            <CloudSelector />
          </main>
        )}
      </div>
    </AnnouncerProvider>
  );
}

/**
 * Toggle between Tree view and Grouped view.
 */
function ViewToggle({ activeView }: { activeView: 'tree' | 'grouped' }) {
  const store = useAppStore;
  const t = useI18n((s) => s.t);

  return (
    <div className={styles.viewToggle} role="tablist" aria-label="View mode">
      <button
        className={`${styles.viewToggleButton} ${activeView === 'tree' ? styles.viewToggleActive : ''}`}
        role="tab"
        aria-selected={activeView === 'tree'}
        onClick={() => store.setState({ activeView: 'tree' })}
      >
        {t.treeView}
      </button>
      <button
        className={`${styles.viewToggleButton} ${activeView === 'grouped' ? styles.viewToggleActive : ''}`}
        role="tab"
        aria-selected={activeView === 'grouped'}
        onClick={() => store.setState({ activeView: 'grouped' })}
      >
        {t.groupedView}
      </button>
    </div>
  );
}

export default App;
