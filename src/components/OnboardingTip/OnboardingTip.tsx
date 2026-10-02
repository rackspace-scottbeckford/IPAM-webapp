import { useState } from 'react';
import { useI18n } from '../../i18n';
import styles from './OnboardingTip.module.css';

/**
 * A dismissable onboarding tooltip shown after the network plan is first created.
 * Guides new users toward either splitting subnets or creating a workload.
 */
export function OnboardingTip() {
  const [dismissed, setDismissed] = useState(false);
  const t = useI18n((s) => s.t);
  const language = useI18n((s) => s.language);

  if (dismissed) return null;

  return (
    <div className={styles.tip} role="status" aria-live="polite">
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">💡</span>
        <div className={styles.text}>
          <strong className={styles.heading}>
            {language === 'de' ? 'Wie möchten Sie fortfahren?' : 'What would you like to do next?'}
          </strong>
          <p className={styles.description}>
            {language === 'de'
              ? 'Teilen Sie das Netzwerk in kleinere Subnetze, erstellen Sie einen Workload mit einer bestimmten IP-Kapazität oder ordnen Sie ein bereits vergebenes Subnetz zu.'
              : 'Split the network into smaller subnets, create a workload with a specific IP capacity, or map an existing subnet you have already allocated.'}
          </p>
        </div>
        <p className={styles.actions} aria-hidden="true">
          {language === 'de' ? 'Suchen Sie in der Symbolleiste nach:' : 'Look for these in the toolbar:'}
          <span className={styles.actionName}>{t.split}</span>
          <span className={styles.separator}>·</span>
          <span className={styles.actionName}>{t.createWorkload}</span>
          <span className={styles.separator}>·</span>
          <span className={styles.actionName}>{t.mapExisting}</span>
        </p>
      </div>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => setDismissed(true)}
        aria-label={language === 'de' ? 'Hinweis schließen' : 'Dismiss tip'}
      >
        ✕
      </button>
    </div>
  );
}
