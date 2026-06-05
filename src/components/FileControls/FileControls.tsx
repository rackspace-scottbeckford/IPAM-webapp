import { useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../store/app-store';
import type { SerializationError } from '../../core/types';
import styles from './FileControls.module.css';

/** Maximum import file size: 5 MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function FileControls() {
  const exportJSON = useAppStore((s) => s.exportJSON);
  const importJSON = useAppStore((s) => s.importJSON);
  const networkPlan = useAppStore((s) => s.networkPlan);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<SerializationError | null>(null);

  const handleExport = useCallback(() => {
    const json = exportJSON();
    if (!json) return;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'network-plan.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [exportJSON]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset the input so the same file can be re-selected
      event.target.value = '';

      // Validate file size (Requirement 8.7)
      if (file.size > MAX_FILE_SIZE) {
        setError({
          type: 'size_exceeded',
          message: 'File exceeds 5 MB size limit',
          details: `Selected file is ${(file.size / (1024 * 1024)).toFixed(2)} MB.`,
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const json = reader.result as string;
        const result = importJSON(json);
        if (result) {
          // importJSON returned a SerializationError
          setError(result);
        }
      };
      reader.onerror = () => {
        setError({
          type: 'invalid_format',
          message: 'Failed to read file',
          details: 'The file could not be read. Please try again.',
        });
      };
      reader.readAsText(file);
    },
    [importJSON]
  );

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className={styles.container}>
      <button
        className={styles.button}
        onClick={handleExport}
        disabled={!networkPlan}
        aria-label="Export network plan as JSON file"
        title="Export network plan as JSON file"
      >
        <ExportIcon />
        Export
      </button>

      <button
        className={styles.button}
        onClick={handleImportClick}
        aria-label="Import network plan from JSON file"
        title="Import network plan from JSON file"
      >
        <ImportIcon />
        Import
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className={styles.hiddenInput}
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {error && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-error-title"
          onClick={dismissError}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 id="file-error-title" className={styles.modalTitle}>
              Import Failed
            </h2>
            <p className={styles.modalMessage}>
              {error.message}
              {error.details && (
                <>
                  <br />
                  {error.details}
                </>
              )}
            </p>
            <button
              className={styles.modalDismiss}
              onClick={dismissError}
              autoFocus
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 1v9M8 10L5 7M8 10l3-3M3 13h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 10V1M8 1L5 4M8 1l3 3M3 13h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
