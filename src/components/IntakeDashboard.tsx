import type { UiStrings } from '../lib/i18n';
import type { IntakeExtracted } from '../types';

interface Props {
  ui: UiStrings;
  data: IntakeExtracted;
  complete: boolean;
  onOpenFrist?: (datumDe: string) => void;
}

function Field({ label, value, fallback }: { label: string; value: string; fallback: string }) {
  const filled = value.trim().length > 0;
  return (
    <div className={`field ${filled ? 'filled' : ''}`}>
      <span className="field-label">{label}</span>
      <span className="field-value">{filled ? value : fallback}</span>
    </div>
  );
}

export function IntakeDashboard({ ui, data, complete, onOpenFrist }: Props) {
  return (
    <div className={`dashboard ${complete ? 'done' : ''}`}>
      <div className="card-head">
        <h3>{ui.caseRequest}</h3>
        {complete && <span className="done-tag">{ui.completeTitle}</span>}
      </div>

      <Field label={ui.fRechtsgebiet} value={data.rechtsgebiet} fallback={ui.notYet} />
      <Field label={ui.fParteien} value={data.parteien} fallback={ui.notYet} />
      <Field label={ui.fSachverhalt} value={data.sachverhalt} fallback={ui.notYet} />
      <Field label={ui.fDringlichkeit} value={data.dringlichkeit} fallback={ui.notYet} />
      <Field label={ui.fKontakt} value={data.kontakt} fallback={ui.notYet} />

      <div className={`field frist ${data.fristHinweis ? 'alert' : ''}`}>
        <span className="field-label">{ui.fFrist}</span>
        <span className="field-value">
          {data.fristHinweis
            ? `${data.fristHinweis.datum ? data.fristHinweis.datum + ' · ' : ''}${data.fristHinweis.hinweis}`
            : ui.notYet}
        </span>
        {data.fristHinweis?.datum && onOpenFrist && (
          <button className="link-btn" onClick={() => onOpenFrist(data.fristHinweis!.datum)}>
            {ui.openInFristen}
          </button>
        )}
      </div>

      <div className="meta-row">
        <div className="meta">
          <span className="field-label">{ui.conflictCheck}</span>
          <span className="pill pill-pending">{ui.conflictPending}</span>
        </div>
        <div className="meta">
          <span className="field-label">{ui.nextStep}</span>
          <span className={`pill ${complete ? 'pill-go' : 'pill-pending'}`}>{ui.nextStepValue}</span>
        </div>
      </div>
    </div>
  );
}
