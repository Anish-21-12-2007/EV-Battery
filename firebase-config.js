let authApi = null;
let databaseApi = null;
let auth = null;
let database = null;
let readingUnsubscribe = null;
let connectionUnsubscribe = null;
let freshnessTimer = null;
let currentUserId = null;
let listenerGeneration = 0;
let latestTimestamp = null;
let latestRecord = null;
let databaseConnected = false;
let recordState = 'connecting';
const READINGS_PATH = 'readings/latest';
const FRESHNESS_MS = 5 * 60 * 1000;
const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_FIREBASE_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_FIREBASE_PROJECT_ID",
  storageBucket: "REPLACE_WITH_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID",
  databaseURL: "https://REPLACE_WITH_PROJECT_ID-default-rtdb.firebaseio.com",
  measurementId: "REPLACE_WITH_FIREBASE_MEASUREMENT_ID",
};
function setDataStatus(state, message) {
  const descriptions = {
    'signed-out': 'Sign in to read telemetry.',
    connecting: 'Waiting for the Firebase database connection.',
    waiting: 'Connected to Firebase; waiting for a valid sensor record.',
    fresh: 'ESP32-tagged record received; publisher provenance and measurement accuracy are unverified.',
    stale: 'Latest valid record is stale; current device state is unknown.',
    invalid: 'Latest database record failed validation.',
    'permission-denied': 'Firebase denied access to readings/latest. Check database rules.',
    error: 'Firebase connection error. Check the browser console.',
    'not-configured': 'Firebase configuration or SDK is unavailable.',
  };
  const text = message || descriptions[state] || 'Telemetry state unavailable.';
  window.ECSBatteryData?.setTelemetryStatus?.(state, text);
  const connection = document.getElementById('firebase-connection-state');
  if (connection) connection.textContent = currentUserId ? (databaseConnected ? 'Connected' : 'Disconnected') : 'Not connected';
}

function setAuthUi(state, message = '') {
  window.ECSBatteryData?.setAuthUi?.(state, message);
  const userLabel = document.getElementById('auth-user-email');
  if (userLabel && !currentUserId) userLabel.textContent = '';
}

function refreshDataStatus() {
  if (!currentUserId) return;
  let state = recordState;
  if (!['permission-denied', 'error', 'invalid'].includes(state)) {
    if (!databaseConnected) state = 'connecting';
    else if (state === 'fresh' && latestTimestamp !== null && Date.now() - latestTimestamp > FRESHNESS_MS) state = 'stale';
    else if (state === 'connecting') state = 'waiting';
  }
  setDataStatus(state);
}

function detachReadingListener() {
  listenerGeneration += 1;
  if (readingUnsubscribe) readingUnsubscribe();
  if (connectionUnsubscribe) connectionUnsubscribe();
  readingUnsubscribe = null;
  connectionUnsubscribe = null;
  clearInterval(freshnessTimer);
  freshnessTimer = null;
  latestTimestamp = null;
  latestRecord = null;
  databaseConnected = false;
  recordState = 'connecting';
}

function attachReadingListener() {
  if (!database || !databaseApi || readingUnsubscribe) return;
  const generation = ++listenerGeneration;
  recordState = 'connecting';
  setDataStatus('connecting');
  try {
    connectionUnsubscribe = databaseApi.onValue(databaseApi.ref(database, '.info/connected'), (snapshot) => {
      if (generation !== listenerGeneration || !currentUserId) return;
      databaseConnected = snapshot.val() === true;
      window.ECSBatteryData?.setFirebaseConnectivity?.(databaseConnected);
      // Disconnection clears current measurements in the UI. Restore the last accepted
      // record on reconnect even if Firebase does not emit an unchanged value again.
      if (databaseConnected && latestRecord && recordState === 'fresh') window.ECSBatteryData?.ingestReading?.(latestRecord);
      if (databaseConnected && recordState === 'connecting') recordState = 'waiting';
      refreshDataStatus();
    }, (error) => {
      if (generation !== listenerGeneration) return;
      console.error('Firebase connectivity listener error:', { code: error.code || 'unknown', message: error.message || String(error) });
      recordState = 'error'; setDataStatus('error');
    });
    freshnessTimer = setInterval(refreshDataStatus, 15000);
    readingUnsubscribe = databaseApi.onValue(databaseApi.ref(database, READINGS_PATH), (snapshot) => {
      if (generation !== listenerGeneration || !currentUserId) return;
      if (!snapshot.exists()) {
        window.ECSBatteryData?.resetTelemetry?.();
        latestTimestamp = null; latestRecord = null; recordState = 'waiting'; refreshDataStatus(); return;
      }
      const record = snapshot.val();
      const accepted = window.ECSBatteryData?.ingestReading?.(record) === true;
      if (!accepted) {
        window.ECSBatteryData?.resetTelemetry?.();
        latestTimestamp = null; latestRecord = null; recordState = 'invalid'; setDataStatus('invalid'); return;
      }
      latestTimestamp = record.timestamp;
      latestRecord = record;
      recordState = 'fresh'; refreshDataStatus();
    }, (error) => {
      if (generation !== listenerGeneration) return;
      console.error('Firebase Realtime Database listener error:', { code: error.code || 'unknown', message: error.message || String(error) });
      window.ECSBatteryData?.resetTelemetry?.();
      latestTimestamp = null; latestRecord = null;
      const denied = error.code === 'PERMISSION_DENIED' || String(error.code || '').endsWith('/permission-denied');
      recordState = denied ? 'permission-denied' : 'error'; setDataStatus(recordState);
    });
  } catch (error) {
    console.error('Firebase listener setup error:', { code: error.code || 'unknown', message: error.message || String(error) });
    recordState = 'error'; setDataStatus('error');
  }
}

function handleAuthState(user) {
  const previousUserId = currentUserId;
  currentUserId = user?.uid || null;
  if (previousUserId !== currentUserId) {
    detachReadingListener();
    window.ECSBatteryData?.resetTelemetry?.();
  }
  if (!user) {
    const email = document.getElementById('auth-email');
    const password = document.getElementById('auth-password');
    if (email) email.value = '';
    if (password) password.value = '';
    setAuthUi('signed-out');
    setDataStatus('signed-out');
    window.ECSBatteryData?.setFirebaseConnectivity?.(false);
    return;
  }
  const userLabel = document.getElementById('auth-user-email');
  if (userLabel) userLabel.textContent = user.email || 'Authorized Firebase account';
  setAuthUi('authenticated');
  attachReadingListener();
}

function messageForAuthError(code) {
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Email or password is incorrect.';
  if (code === 'auth/too-many-requests') return 'Too many sign-in attempts. Try again later.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  return 'Sign-in failed. Check your details or Firebase Authentication configuration.';
}

async function initializeFirebase() {
  const form = document.getElementById('auth-form');
  const signOutButton = document.getElementById('auth-signout');
  if (form) form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!auth || !authApi) return;
    const email = document.getElementById('auth-email')?.value.trim();
    const passwordInput = document.getElementById('auth-password');
    const password = passwordInput?.value;
    if (!email || !password) return;
    setAuthUi('signing-in');
    try {
      await authApi.signInWithEmailAndPassword(auth, email, password);
      if (passwordInput) passwordInput.value = '';
      window.ECSBatteryData?.setView?.('monitor');
    } catch (error) {
      console.error('Firebase sign-in error:', { code: error.code || 'unknown', message: error.message || String(error) });
      setAuthUi('signed-out', messageForAuthError(error.code));
    }
  });
  if (signOutButton) signOutButton.addEventListener('click', async () => {
    if (!auth || !authApi) return;
    signOutButton.disabled = true;
    try { await authApi.signOut(auth); }
    catch (error) {
      console.error('Firebase sign-out error:', { code: error.code || 'unknown', message: error.message || String(error) });
      const feedback = document.getElementById('auth-feedback');
      if (feedback) { feedback.textContent = 'Sign-out failed. Try again.'; feedback.hidden = false; }
    } finally { signOutButton.disabled = false; }
  });

  setAuthUi('checking');
  try {
    const [appApi, authModule, dbModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js'),
    ]);
    authApi = authModule; databaseApi = dbModule;
    const configured = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.databaseURL && !firebaseConfig.apiKey.includes('REPLACE');
    if (!configured) { setAuthUi('error', 'Complete Firebase Web App configuration before signing in.'); setDataStatus('not-configured'); return; }
    const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(firebaseConfig);
    auth = authModule.getAuth(app);
    database = dbModule.getDatabase(app);
    await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    authModule.onAuthStateChanged(auth, handleAuthState, (error) => {
      console.error('Firebase authentication state error:', { code: error.code || 'unknown', message: error.message || String(error) });
      detachReadingListener(); window.ECSBatteryData?.resetTelemetry?.(); currentUserId = null;
      setAuthUi('error', 'Authentication state could not be restored. Reload the page or check the browser console.');
      setDataStatus('error');
    });
  } catch (error) {
    const unavailable = error instanceof TypeError || String(error.message || '').includes('Failed to fetch');
    if (unavailable) console.warn('Firebase CDN unavailable (offline mode):', error.message || String(error));
    else console.error('Firebase initialization error:', { code: error.code || 'unknown', message: error.message || String(error) });
    setAuthUi('error', unavailable ? 'Firebase SDK or network is unavailable. Check internet access and the browser console.' : 'Firebase Authentication could not be initialized. Check the configuration and browser console.');
    setDataStatus(unavailable ? 'error' : 'not-configured');
  }
}

function startFirebase() {
  if (document.readyState === 'complete') initializeFirebase();
  else window.addEventListener('load', initializeFirebase, { once: true });
}
if (window.ECSBatteryData) startFirebase();
else window.addEventListener('ecs-app-ready', startFirebase, { once: true });
