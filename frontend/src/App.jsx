import { useEffect, useState } from 'react';
import {
  Activity,
  Eye,
  EyeOff,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { authApi, clinicalApi } from '../api.js';

function PasswordField({
  label = 'Password',
  value,
  onChange,
  minLength = 1,
  autoComplete = 'current-password',
  required = true,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <span style={{ display: 'block', position: 'relative' }}>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          minLength={minLength}
          maxLength={128}
          autoComplete={autoComplete}
          required={required}
          style={{ width: '100%', paddingRight: '46px' }}
        />
        <button
          type="button"
          onClick={() => setVisible(current => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            border: 0,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

function AuthForm({ mode, onSuccess, onChangeMode, resetToken, onResetDone }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const signup = mode === 'signup';
  const forgot = mode === 'forgot';
  const resetting = mode === 'reset';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (forgot) {
        const result = await authApi.forgotPassword({
          email: email.trim().toLowerCase(),
        });
        setMessage(result.message);
        return;
      }

      if (resetting) {
        const result = await authApi.resetPassword({
          token: resetToken,
          password,
        });
        setMessage(result.message);
        setPassword('');
        onResetDone();
        return;
      }

      const result = signup
        ? await authApi.signup({
            full_name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
          })
        : await authApi.login({
            email: email.trim().toLowerCase(),
            password,
          });

      onSuccess(result.user || result);
    } catch (err) {
      setError(err.message || 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const title = signup
    ? 'Create your account'
    : forgot
      ? 'Forgot password'
      : resetting
        ? 'Choose a new password'
        : 'Log in';

  return (
    <section className="auth-card">
      <h1>{title}</h1>
      <p>
        {forgot
          ? 'Enter your account email. If it is registered, we will send a reset link.'
          : resetting
            ? 'Choose a new password for your account.'
            : 'Sign in to look up available FDA drug-label information.'}
      </p>

      <form onSubmit={submit}>
        {signup && (
          <label>
            Full name
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              minLength={2}
              maxLength={100}
              autoComplete="name"
              required
            />
          </label>
        )}

        {!resetting && (
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              maxLength={254}
              autoComplete="email"
              required
            />
          </label>
        )}

        {!forgot && (
          <PasswordField
            label={resetting ? 'New password' : 'Password'}
            value={password}
            onChange={event => setPassword(event.target.value)}
            minLength={signup || resetting ? 10 : 1}
            autoComplete={
              signup || resetting ? 'new-password' : 'current-password'
            }
          />
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}

        <button className="primary" type="submit" disabled={busy}>
          {busy
            ? 'Please wait…'
            : forgot
              ? 'Send reset link'
              : resetting
                ? 'Change password'
                : signup
                  ? 'Create account'
                  : 'Log in'}
        </button>
      </form>

      {!signup && !forgot && !resetting && (
        <p className="switch">
          <button
            type="button"
            onClick={() => {
              setError('');
              setMessage('');
              onChangeMode('forgot');
            }}
          >
            Forgot password?
          </button>
        </p>
      )}

      {!resetting && (
        <p className="switch">
          {signup ? 'Already registered?' : 'Need an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setError('');
              setMessage('');
              onChangeMode(signup ? 'login' : 'signup');
            }}
          >
            {signup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      )}

      {resetting && (
        <p className="switch">
          <button type="button" onClick={onResetDone}>
            Return to log in
          </button>
        </p>
      )}

      <p className="privacy">
        <ShieldCheck size={15} />
        Do not enter identifiable patient information.
      </p>
    </section>
  );
}

function buildAssistantEvidence(report) {
  const medications = (report?.labels || []).map(item => ({
    medicine: item.medicine,
    labels: (item.labels || []).slice(0, 1).map(label => ({
      brandName: label.brandName,
      genericName: label.genericName,
      sections: Object.fromEntries(
        ['drug_interactions', 'warnings', 'contraindications', 'precautions']
          .filter(name => label.sections?.[name])
          .map(name => [name, String(label.sections[name]).slice(0, 900)])
      ),
    })),
  }));

  const evidence = {
    lookupSummary: report?.summary,
    interactionSummary: report?.interactionSummary,
    medications,
  };

  while (JSON.stringify(evidence).length > 14000 && medications.length > 1) {
    medications.pop();
  }
  return JSON.stringify(evidence).slice(0, 14000);
}

function AIAssistantPanel({ report, medications, configured, onClose }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [consented, setConsented] = useState(false);

  async function submitQuestion(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setAnswer('');
    try {
      const result = await clinicalApi.askAssistant({
        question: question.trim(),
        medications,
        evidence: buildAssistantEvidence(report),
        share_with_google: consented,
      });
      setAnswer(result.answer);
    } catch (err) {
      setError(err.message || 'The AI assistant could not answer. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel ai-panel" aria-labelledby="ai-assistant-title">
      <div className="ai-panel-heading">
        <h2 id="ai-assistant-title"><Sparkles size={20} /> AI label assistant</h2>
        <button className="ai-close" type="button" onClick={onClose} aria-label="Close AI assistant">
          <X size={18} />
        </button>
      </div>
      <p>
        Ask for a plain-language explanation of the FDA label results above.
        The assistant cannot determine whether a combination is safe or replace
        advice from a pharmacist or prescriber.
      </p>

      {configured === false && (
        <p className="notice" role="status">
          Gemini is not connected yet. Add a <code>GEMINI_API_KEY</code> to the
          Render backend environment to enable answers.
        </p>
      )}
      {configured === null && <p className="muted">Checking AI availability…</p>}
      {!report && <p className="muted">Run an FDA label lookup before asking about results.</p>}

      <form onSubmit={submitQuestion}>
        <label className="ai-question-label" htmlFor="ai-question">Your question</label>
        <textarea
          id="ai-question"
          value={question}
          onChange={event => setQuestion(event.target.value)}
          maxLength={1200}
          placeholder="For example: What does the warning in this label mean?"
          required
          disabled={!report || configured !== true || busy}
        />
        <label className="ai-consent">
          <input
            type="checkbox"
            checked={consented}
            onChange={event => setConsented(event.target.checked)}
            disabled={!report || configured !== true || busy}
          />
          <span>
            I agree to send my question, the medicine names, and the FDA label
            excerpts shown here to Google Gemini to generate an explanation.
          </span>
        </label>
        <p className="ai-privacy-note">
          Do not include patient names or other identifying details. Google may
          use content sent on its free tier to improve its products. Free-tier
          access has model and rate limits; usage may incur charges if the
          project uses a paid tier.
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <button
          className="primary"
          type="submit"
          disabled={!report || configured !== true || !consented || !question.trim() || busy}
        >
          <Send size={16} /> {busy ? 'Asking AI…' : 'Ask AI'}
        </button>
      </form>

      {answer && (
        <article className="ai-response" aria-live="polite">
          <h3><Sparkles size={17} /> AI explanation</h3>
          <p>{answer}</p>
        </article>
      )}
    </section>
  );
}

function formatSectionName(name) {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function summarizeLabelText(text, limit = 420) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  const excerpt = normalized.slice(0, limit);
  const sentenceEnd = Math.max(
    excerpt.lastIndexOf('. '),
    excerpt.lastIndexOf('; '),
    excerpt.lastIndexOf('! '),
    excerpt.lastIndexOf('? ')
  );
  return `${excerpt.slice(0, sentenceEnd > limit * 0.55 ? sentenceEnd + 1 : limit).trim()}…`;
}

const labelWordingRank = { ungraded: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const labelWordingTitle = {
  ungraded: 'Ungraded',
  low: 'Low label wording',
  moderate: 'Moderate label wording',
  high: 'High label wording',
  critical: 'Critical label wording',
};

function Workspace({ user }) {
  const [input, setInput] = useState('');
  const [medications, setMedications] = useState([]);
  const [report, setReport] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    clinicalApi
      .health()
      .then(result => setAiConfigured(Boolean(result.aiConfigured)))
      .catch(() => setAiConfigured(false));
  }, []);

  const labelResults = report?.labels || [];
  const interactionMentions = report?.interactionSummary?.mentions || [];
  const possiblePairCount = (medications.length * (medications.length - 1)) / 2;

  const mentionedPairKeys = new Set(
    interactionMentions.map(mention =>
      [
        String(mention.labelMedicine || '').trim().toLowerCase(),
        String(mention.mentionedMedicine || '').trim().toLowerCase(),
      ]
        .sort()
        .join('::')
    )
  );

  const mentionedPairCount = Math.min(
    possiblePairCount,
    mentionedPairKeys.size
  );
  const highestLabelWording = interactionMentions.reduce(
    (highest, mention) =>
      (labelWordingRank[mention.labelWordingLevel] || 0) >
      (labelWordingRank[highest] || 0)
        ? mention.labelWordingLevel
        : highest,
    'ungraded'
  );
  const mentionPercentage =
    possiblePairCount > 0
      ? Math.round((mentionedPairCount / possiblePairCount) * 100)
      : null;

  function addMedicine(event) {
    event.preventDefault();
    const medicine = input.trim().replace(/\s+/g, ' ');

    if (!medicine) {
      setNotice('Enter a medicine name first.');
      return;
    }
    if (medications.length >= 20) {
      setNotice('You can look up to 20 medicines at a time.');
      return;
    }
    if (medications.some(item => item.toLowerCase() === medicine.toLowerCase())) {
      setNotice('That medicine is already on the list.');
      return;
    }

    setMedications(items => [...items, medicine]);
    setInput('');
    setReport(null);
    setNotice('');
  }

  function removeMedicine(medicineToRemove) {
    setMedications(items => items.filter(item => item !== medicineToRemove));
    setReport(null);
    setNotice('');
  }

  async function lookupLabels() {
    if (!medications.length) {
      setNotice('Add at least one medicine first.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      const result = await clinicalApi.analyze({
        medications,
        patient: {
          age: null,
          sex: null,
          renalStatus: 'unknown',
          hepaticStatus: 'unknown',
          conditions: [],
        },
      });
      setReport(result);

      const matches = (result.labels || []).reduce(
        (total, item) => total + (item.labels?.length || 0),
        0
      );
      setNotice(`FDA label lookup complete: ${matches} label match(es) found.`);
    } catch (err) {
      setReport(null);
      setNotice(err.message || 'FDA label lookup failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <span className="brand">
            <Activity /> Polypharm ADE
          </span>
          <h1>FDA Drug-Label Lookup</h1>
          <p>Signed in as {user.full_name || user.email}</p>
        </div>
        <button
          className="secondary ai-launch"
          type="button"
          onClick={() => setAiOpen(open => !open)}
          aria-expanded={aiOpen}
          aria-controls="ai-assistant-title"
        >
          <Sparkles size={17} /> AI assistant
        </button>
      </header>

      {aiOpen && (
        <AIAssistantPanel
          report={report}
          medications={medications}
          configured={aiConfigured}
          onClose={() => setAiOpen(false)}
        />
      )}

      <section className="panel">
        <h2>Medicine list</h2>
        <p>
          Look up an FDA label summary first, then open the full label details.
          The brief mention check
          looks for entered medicine names in retrieved Drug Interactions text.
        </p>

        <form className="add-form" onSubmit={addMedicine}>
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Enter a generic or brand medicine name"
            maxLength={160}
            aria-label="Medicine name"
          />
          <button className="primary" type="submit">
            <Plus size={16} />
            Add
          </button>
        </form>

        <ul className="medicines">
          {medications.map(medicine => (
            <li key={medicine}>
              <span>{medicine}</span>
              <button
                className="remove"
                type="button"
                aria-label={`Remove ${medicine}`}
                onClick={() => removeMedicine(medicine)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
          {!medications.length && (
            <li className="muted">No medicines added yet.</li>
          )}
        </ul>

        <button
          className="primary analyze"
          type="button"
          onClick={lookupLabels}
          disabled={busy || !medications.length}
        >
          {busy ? 'Looking up labels…' : 'Look up FDA labels'}
        </button>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </section>

      <section className="panel results">
        <h2>FDA label results</h2>
        {!report && (
          <p className="muted">
            Add medicines, then select “Look up FDA labels” to retrieve
            available label information.
          </p>
        )}

        {report && (
          <>
            <article className="finding">
              <h3>Lookup summary</h3>
              <p>{report.summary}</p>
              <p>
                <b>FDA label wording level:</b>{' '}
                <span className={`wording-level ${highestLabelWording}`}>
                  {interactionMentions.length
                    ? labelWordingTitle[highestLabelWording]
                    : 'Ungraded — no direct label mention detected'}
                </span>
                {interactionMentions.length > 0 && highestLabelWording !== 'ungraded' && (
                  <span> (highest explicit wording among the matches below)</span>
                )}
              </p>
              <p>
                <b>Medicine pairs with a label mention:</b>{' '}
                {possiblePairCount > 0
                  ? `${mentionedPairCount} of ${possiblePairCount} (${mentionPercentage}%). This is the share of entered pairs with an exact label-text mention, not a probability of harm.`
                  : 'Enter at least two medicines to compare pairs.'}
              </p>
              <p>
                <b>Possible interaction mentions:</b>{' '}
                {report.interactionSummary?.message ||
                  'No interaction summary was returned.'}
              </p>
              {interactionMentions.length > 0 && (
                <ul>
                  {interactionMentions.map((mention, index) => (
                    <li
                      key={`summary-${mention.labelMedicine}-${mention.mentionedMedicine}-${index}`}
                    >
                      The {mention.labelMedicine} label mentions{' '}
                      {mention.mentionedMedicine}.
                      {' '}FDA label wording level:{' '}
                      <span className={`wording-level ${mention.labelWordingLevel || 'ungraded'}`}>
                        {labelWordingTitle[mention.labelWordingLevel] || 'Ungraded'}
                      </span>
                      {mention.labelWordingEvidence && (
                        <> — wording: “{mention.labelWordingEvidence}”</>
                      )}
                      {mention.excerpt && <blockquote>{mention.excerpt}</blockquote>}
                    </li>
                  ))}
                </ul>
              )}
              <p>
                The wording level describes phrases found near a medicine name
                in the FDA label; it is not a clinical risk grade. The pair
                percentage is not a probability of harm. No detected mention
                does not mean the medicines are safe to take together. Ask a
                pharmacist or prescriber to verify the results.
              </p>
            </article>

            {labelResults.length === 0 && (
              <p>
                No FDA label results were returned. This does not mean the
                medicines or their combination are safe.
              </p>
            )}

            {labelResults.map(item => {
              const matches = item.labels || [];
              if (!matches.length) {
                return (
                  <article className="finding" key={`${item.medicine}-no-match`}>
                    <h3>No label match found for {item.medicine}</h3>
                    <p>
                      Check the spelling, or try the generic or brand name.
                      No match does not mean the medicine is safe.
                    </p>
                  </article>
                );
              }

              return matches.map((label, index) => {
                const sections = Object.entries(label.sections || {});
                const summarySection =
                  label.sections?.drug_interactions ||
                  label.sections?.warnings ||
                  label.sections?.contraindications ||
                  label.sections?.precautions;
                return (
                  <article
                    className="finding"
                    key={`${item.medicine}-${label.labelId || index}`}
                  >
                    <div className="finding-title">
                      <h3>
                        {label.brandName || label.genericName || item.medicine}
                      </h3>
                      <b>FDA LABEL</b>
                    </div>
                    <p>
                      <b>Medicine entered:</b> {item.medicine}
                    </p>
                    {label.genericName && (
                      <p>
                        <b>Generic name:</b> {label.genericName}
                      </p>
                    )}

                    {summarySection ? (
                      <div>
                        <h4>FDA label summary</h4>
                        <p className="label-text">
                          {summarizeLabelText(summarySection)}
                        </p>
                      </div>
                    ) : (
                      <p>
                        This label result did not contain the selected warning
                        or interaction sections.
                      </p>
                    )}

                    {sections.length > 0 && (
                      <details className="label-details">
                        <summary>More information (full FDA label details)</summary>
                        {sections.map(([sectionName, text]) => (
                          <div key={sectionName}>
                            <h4>{formatSectionName(sectionName)}</h4>
                            <p className="label-text">{text}</p>
                          </div>
                        ))}
                      </details>
                    )}

                    {label.sourceUrl && (
                      <p>
                        <a href={label.sourceUrl} target="_blank" rel="noreferrer">
                          View label search on DailyMed ↗
                        </a>
                      </p>
                    )}
                    {label.labelId && (
                      <p className="muted">FDA label record: {label.labelId}</p>
                    )}
                  </article>
                );
              });
            })}

            <p className="muted">
              Label text mention count: {possiblePairCount > 0
                ? `${mentionedPairCount} of ${possiblePairCount} medicine pairs (${mentionPercentage}%).`
                : 'A percentage cannot be calculated because fewer than two medicines were entered.'}
              {' '}This is not a measure of risk.
            </p>

            {report.limitations?.length > 0 && (
              <>
                <h3>Important limitations</h3>
                <ul>
                  {report.limitations.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            <button className="secondary" type="button" onClick={() => window.print()}>
              Print lookup
            </button>
          </>
        )}
      </section>

      <p className="safety">
        This is an FDA drug-label lookup, not an AI review or a complete
        interaction checker. Its percentage measures explicit medicine-name
        mentions in retrieved label text, not risk. Verify the information with
        a pharmacist or prescriber. Do not enter identifying patient information.
      </p>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [checking, setChecking] = useState(true);
  const [resetToken, setResetToken] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');

    if (token) {
      setResetToken(token);
      setMode('reset');
    }

    authApi
      .me()
      .then(result => setUser(result.user || null))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  function finishPasswordReset() {
    setResetToken('');
    setMode('login');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  if (checking) {
    return <main className="loading">Loading Polypharm ADE…</main>;
  }

  if (user) {
    return (
      <Workspace
        user={user}
      />
    );
  }

  return (
    <main className="login-page">
      <div className="intro">
        <span className="brand">
          <Activity /> Polypharm ADE
        </span>
        <h1>FDA drug-label lookup</h1>
        <p>
          Sign in to retrieve available FDA label information for medicines.
          The lookup is not an AI review or a complete interaction analysis.
        </p>
      </div>

      <AuthForm
        mode={mode}
        onChangeMode={setMode}
        onSuccess={setUser}
        resetToken={resetToken}
        onResetDone={finishPasswordReset}
      />
    </main>
  );
}
