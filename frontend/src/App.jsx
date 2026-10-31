import { useEffect, useState } from 'react';
import {
  Activity,
  Eye,
  EyeOff,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { authApi, clinicalApi } from '../api.js';
import { mountGiftSupport } from '../gift-support.js';

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
      </header>

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

  useEffect(() => mountGiftSupport(), []);

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
    return (
      <main className="loading-screen" role="status" aria-label="Loading sign-in">
        <img className="loading-brand-icon" src="/images/logo.png" alt="Polypharm ADE" />
        <span className="loading-spinner" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              style={{
                transform: `rotate(${index * 30}deg)`,
                opacity: (index + 1) / 12,
              }}
            />
          ))}
        </span>
        <span className="visually-hidden">Loading sign-in…</span>
      </main>
    );
  }

  if (user) {
    return (
      <>
        <a className="clinical-site-logo" href="/" aria-label="Polypharm ADE home">
          <img src="/images/logo.png" alt="Polypharm ADE" />
        </a>
        <Workspace user={user} />
        <ClinicalFooter />
      </>
    );
  }

  return (
    <>
      <a className="clinical-site-logo" href="/" aria-label="Polypharm ADE home">
        <img src="/images/logo.png" alt="Polypharm ADE" />
      </a>
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
      <ClinicalFooter />
    </>
  );
}

function ClinicalFooter() {
  return (
    <footer className="clinical-footer">
      <div className="clinical-footer-inner">
        <div className="clinical-footer-brand">
          <a className="clinical-footer-logo" href="/" aria-label="Polypharm ADE home">
            <img src="/images/logo.png" alt="" />
          </a>
          <span>Smart Clinical Support • Medication Safety</span>
          <div className="clinical-footer-socials" aria-label="Social media links">
            <a href="https://www.instagram.com/_the._michaels/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2.2A2.8 2.8 0 0 0 4.2 7v10A2.8 2.8 0 0 0 7 19.8h10a2.8 2.8 0 0 0 2.8-2.8V7A2.8 2.8 0 0 0 17 4.2H7Zm5 2.3a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 2.2a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Zm5.8-3.1a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z"/></svg></a>
            <a href="https://x.com/michael_ke97" target="_blank" rel="noopener noreferrer" aria-label="X"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.9-7.34L5.62 22H2.5l7.25-8.29L1.8 2h6.4l4.43 6.77L18.9 2Zm-1.1 18h1.73L7.28 3.89H5.42L17.8 20Z"/></svg></a>
            <a href="https://wa.me/254797746839" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.48 15.01L2.2 22l5.12-1.34A9.96 9.96 0 1 0 12.04 2Zm0 17.86a7.9 7.9 0 0 1-4.03-1.1l-.29-.17-3.04.8.81-2.96-.19-.3a7.9 7.9 0 1 1 6.74 3.73Zm4.34-5.92c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.42-1.33-1.66-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.24 1.02.39 1.37.5.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg></a>
            <a href="https://www.linkedin.com/in/michael-muriuki-6943442a8/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.34H4.96V9.18h2.97v9.16ZM6.45 7.93a1.72 1.72 0 1 1 0-3.44 1.72 1.72 0 0 1 0 3.44Zm12.6 10.41h-2.96v-4.46c0-1.06-.02-2.43-1.48-2.43-1.48 0-1.71 1.15-1.71 2.35v4.54H9.94V9.18h2.84v1.25h.04c.4-.72 1.36-1.48 2.8-1.48 3 0 3.55 1.97 3.55 4.53v4.86Z"/></svg></a>
            <a href="https://youtube.com/@michael.m.g" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.55 3.57 12 3.57 12 3.57s-7.55 0-9.4.51A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.12c1.85.51 9.4.51 9.4.51s7.55 0 9.4-.51a3 3 0 0 0 2.1-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z"/></svg></a>
          </div>
        </div>
        <nav className="clinical-footer-links" aria-label="Quicklinks">
          <h2>Quicklinks</h2>
          <a href="/">Home</a>
          <a href="/about" target="_blank" rel="noopener noreferrer">About</a>
          <a href="/objectives" target="_blank" rel="noopener noreferrer">Study Objectives</a>
          <a href="/methodology" target="_blank" rel="noopener noreferrer">Methodology</a>
          <a href="/evidence" target="_blank" rel="noopener noreferrer">Evidence, Privacy &amp; Limits</a>
          <a href="/#technology">Technology</a>
          <a href="/#safety-updates">Safety Updates</a>
          <a href="/#safety-statistics">Live Reports</a>
          <a href="/#safety-centre">Medication Safety Centre</a>
          <a href="/#my-medication-list">My Medication List</a>
          <a href="/#faq">FAQs</a>
          <a href="/contact" target="_blank" rel="noopener noreferrer">Contact the Team</a>
        </nav>
        <nav className="clinical-footer-links clinical-footer-legal" aria-label="Legal">
          <h2>Legal</h2>
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          <a href="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</a>
        </nav>
      </div>
      <p className="clinical-footer-copyright">© 2026 Polypharm ADE</p>
    </footer>
  );
}
