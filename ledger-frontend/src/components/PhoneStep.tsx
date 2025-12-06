import { useState } from 'react';
import { requestOtp } from '../api';

interface PhoneStepProps {
  onSubmit: (phone: string) => void;
}

export default function PhoneStep({ onSubmit }: PhoneStepProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const result = await requestOtp(phone);
      if (result.error) {
        setError(result.error);
      } else {
        onSubmit(phone);
      }
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">&#128274;</div>
        <h2 className="text-xl font-semibold text-gray-900">View Your Ledger</h2>
        <p className="text-gray-600 mt-2 text-sm">
          Enter your WhatsApp number to receive a one-time code
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-lg"
            autoComplete="tel"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !phone}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Sending OTP...
            </span>
          ) : (
            'Send OTP'
          )}
        </button>
      </form>

      <p className="text-center text-xs text-gray-500 mt-4">
        You'll receive a 6-digit code on WhatsApp
      </p>
    </div>
  );
}
