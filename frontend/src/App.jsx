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
          Look up available FDA drug-label sections. The brief mention check
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
            <h3>{report.summary}</h3>
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

                    {sections.length ? (
                      sections.map(([sectionName, text]) => (
                        <div key={sectionName}>
                          <h4>{formatSectionName(sectionName)}</h4>
                          <p className="label-text">{text}</p>
                        </div>
                      ))
                    ) : (
                      <p>
                        This label result did not contain the selected warning
                        or interaction sections.
                      </p>
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

            <article className="finding">
              <h3>SUMMARY</h3>
              <p>
                <b>Label mentions found:</b>{' '}
                {possiblePairCount > 0
                  ? `${mentionedPairCount} of ${possiblePairCount} medicine pairs (${mentionPercentage}%).`
                  : 'A percentage cannot be calculated because fewer than two medicines were entered.'}
              </p>
              <p>
                <b>Possible interaction mentions:</b>{' '}
                {interactionMentions.length
                  ? 'Retrieved FDA label text explicitly mentions another medicine in your list.'
                  : 'No exact mention between your entered medicines was detected in the retrieved FDA Drug Interactions text.'}
              </p>
              <div>
                <b>Reasons:</b>
                {interactionMentions.length ? (
                  <ul>
                    {interactionMentions.map((mention, index) => (
                      <li
                        key={`${mention.labelMedicine}-${mention.mentionedMedicine}-${index}`}
                      >
                        The {mention.labelMedicine} label mentions{' '}
                        {mention.mentionedMedicine}.
                        {mention.excerpt && (
                          <blockquote>{mention.excerpt}</blockquote>
                        )}
                        {mention.sourceUrl && (
                          <a href={mention.sourceUrl} target="_blank" rel="noreferrer">
                            View label source ↗
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No exact medicine-name match was found in retrieved Drug
                    Interactions sections. The lookup may miss different wording
                    or information not present in those labels.
                  </p>
                )}
              </div>
              <p>
                <b>Is the combination safe?</b> This lookup cannot determine
                that. The percentage measures label text mentions, not the
                chance or severity of harm. No detected mention does not mean
                the combination is safe. Ask a pharmacist or prescriber to
                verify it.
              </p>
            </article>

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
