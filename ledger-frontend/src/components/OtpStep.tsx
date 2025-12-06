import { useState, useRef, useEffect } from 'react';
import { verifyOtp, requestOtp } from '../api';

interface OtpStepProps {
  phoneNumber: string;
  onSuccess: () => void;
  onBack: () => void;
}

export default function OtpStep({ phoneNumber, onSuccess, onBack }: OtpStepProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setResendDisabled(false);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (newCode.every((d) => d !== '')) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setCode(newCode);
    if (pasted.length === 6) {
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (otp: string) => {
    setError(null);
    setLoading(true);

    try {
      const result = await verifyOtp(phoneNumber, otp);
      if (result.error) {
        setError(result.error);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendDisabled(true);
    setCountdown(30);
    setError(null);
    try {
      await requestOtp(phoneNumber);
    } catch (err) {
      setError('Failed to resend OTP');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">&#128172;</div>
        <h2 className="text-xl font-semibold text-gray-900">Enter OTP</h2>
        <p className="text-gray-600 mt-2 text-sm">
          We sent a 6-digit code to<br />
          <span className="font-medium text-gray-900">{phoneNumber}</span>
        </p>
      </div>

      <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={loading}
            className="w-11 h-14 text-center text-xl font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all disabled:bg-gray-50"
          />
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center mb-4">
          <span className="flex items-center gap-2 text-gray-600">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></span>
            Verifying...
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-6">
        <button
          onClick={handleResend}
          disabled={resendDisabled}
          className="text-sm text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {resendDisabled ? `Resend code in ${countdown}s` : 'Resend code'}
        </button>

        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Use a different number
        </button>
      </div>
    </div>
  );
}
