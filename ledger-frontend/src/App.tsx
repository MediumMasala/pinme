import { useState, useEffect } from 'react';
import type { AuthState, LedgerData } from './types';
import { checkAuth, getLedgerData, logout } from './api';
import PhoneStep from './components/PhoneStep';
import OtpStep from './components/OtpStep';
import LedgerView from './components/LedgerView';

function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth()
      .then((result) => {
        if (result.authenticated) {
          setAuthState('authenticated');
          loadLedgerData();
        } else {
          setAuthState('phone');
        }
      })
      .catch(() => {
        setAuthState('phone');
      });
  }, []);

  const loadLedgerData = async () => {
    try {
      const data = await getLedgerData();
      setLedgerData(data);
    } catch (err) {
      setError('Failed to load your expense data. Please try again.');
    }
  };

  const handlePhoneSubmit = (phone: string) => {
    setPhoneNumber(phone);
    setAuthState('otp');
  };

  const handleOtpSuccess = () => {
    setAuthState('authenticated');
    loadLedgerData();
  };

  const handleBack = () => {
    setAuthState('phone');
    setPhoneNumber('');
  };

  const handleLogout = async () => {
    await logout();
    setAuthState('phone');
    setPhoneNumber('');
    setLedgerData(null);
  };

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-600 text-white shadow-md">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">&#128176;</span> PinMe
          </h1>
          {authState === 'authenticated' && (
            <button
              onClick={handleLogout}
              className="text-sm bg-primary-700 hover:bg-primary-800 px-3 py-1.5 rounded-md transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {authState === 'phone' && (
          <PhoneStep onSubmit={handlePhoneSubmit} />
        )}

        {authState === 'otp' && (
          <OtpStep
            phoneNumber={phoneNumber}
            onSuccess={handleOtpSuccess}
            onBack={handleBack}
          />
        )}

        {authState === 'authenticated' && ledgerData && (
          <LedgerView data={ledgerData} onRefresh={loadLedgerData} />
        )}

        {authState === 'authenticated' && !ledgerData && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your expenses...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
