'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Coins, Calculator, Smartphone, ArrowRight, Upload, CheckCircle, Copy, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// Pricing: 1k tokens = 1000 UGX
const TOKEN_RATE = 1; // 1 UGX = 1 token

// Generate random 4-character reference code (letters + numbers)
const generateReferenceCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function TokensPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [amountUGX, setAmountUGX] = useState<string>('15000');
  const [calculatedTokens, setCalculatedTokens] = useState<number>(15000);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<'mtn' | 'airtel'>('mtn');
  const [paymentStep, setPaymentStep] = useState<'calculator' | 'instructions' | 'upload' | 'verifying' | 'success'>('calculator');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user?.id) {
      fetchTokenBalance();
    }
  }, [status, session, router]);

  // Calculate tokens whenever amount changes
  useEffect(() => {
    const amount = parseFloat(amountUGX) || 0;
    setCalculatedTokens(Math.floor(amount * TOKEN_RATE));
  }, [amountUGX]);

  const fetchTokenBalance = async () => {
    try {
      const res = await fetch('/api/tokens/balance');
      if (res.ok) {
        const data = await res.json();
        setTokenBalance(data.tokens);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setAmountUGX(value);
  };

  const handleQuickAmount = (amount: number) => {
    setAmountUGX(amount.toString());
  };

  const handleProceedToPayment = () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      alert('Please enter a valid phone number (10 digits)');
      return;
    }

    if (calculatedTokens < 15000) {
      alert('Minimum purchase is 15,000 tokens (15,000 UGX)');
      return;
    }

    // Generate reference code and move to instructions
    const code = generateReferenceCode();
    setReferenceCode(code);
    setPaymentStep('instructions');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('File size must be less than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      setScreenshot(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitScreenshot = async () => {
    if (!screenshot) {
      alert('Please upload a payment screenshot');
      return;
    }

    setLoading(true);
    setPaymentStep('verifying');
    setVerificationError(null);

    try {
      const formData = new FormData();
      formData.append('screenshot', screenshot);
      formData.append('referenceCode', referenceCode);
      formData.append('expectedAmount', amountUGX);
      formData.append('provider', selectedProvider);
      formData.append('phoneNumber', phoneNumber);

      const res = await fetch('/api/tokens/verify-payment', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPaymentStep('success');
        await fetchTokenBalance();
      } else {
        setVerificationError(data.error || 'Payment verification failed');
        setPaymentStep('upload');
      }
    } catch (error) {
      console.error('Screenshot verification error:', error);
      setVerificationError('Failed to verify payment. Please try again.');
      setPaymentStep('upload');
    } finally {
      setLoading(false);
    }
  };

  const resetPayment = () => {
    setPaymentStep('calculator');
    setReferenceCode('');
    setScreenshot(null);
    setScreenshotPreview(null);
    setVerificationError(null);
    setAmountUGX('15000');
    setPhoneNumber('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-4">
              Buy Tokens
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Purchase tokens using Mobile Money (MTN or Airtel)
            </p>
            
            {/* Current Balance */}
            <div className="inline-flex items-center gap-3 bg-white rounded-full px-6 py-3 shadow-lg border-2 border-orange-200">
              <Coins className="w-6 h-6 text-orange-500" />
              <span className="text-lg font-semibold text-gray-700">
                Current Balance:
              </span>
              <span className="text-2xl font-bold text-orange-600">
                {tokenBalance !== null ? tokenBalance.toLocaleString() : '...'}
              </span>
            </div>
          </motion.div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="bg-blue-500 rounded-full p-2 flex-shrink-0">
              <Coins className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">How It Works</h3>
              <ul className="space-y-1 text-gray-700">
                <li>• <strong>Buy tokens</strong> to clone websites and generate code</li>
                <li>• <strong>Token usage</strong> varies based on website complexity</li>
                <li>• <strong>Simple sites</strong> use fewer tokens, complex sites use more</li>
                <li>• <strong>Pay as you go</strong> - Only use tokens when you generate</li>
                <li>• New users get <strong>500 free tokens</strong> to try the service</li>
                <li>• <strong>Purchase rate:</strong> 1,000 tokens = 1,000 UGX</li>
                <li>• <strong>Minimum purchase:</strong> 15,000 UGX (15,000 tokens)</li>
              </ul>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Calculator */}
          {paymentStep === 'calculator' && (
            <motion.div
              key="calculator"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TokenCalculator
                amountUGX={amountUGX}
                calculatedTokens={calculatedTokens}
                selectedProvider={selectedProvider}
                phoneNumber={phoneNumber}
                onAmountChange={handleAmountChange}
                onQuickAmount={handleQuickAmount}
                onProviderChange={setSelectedProvider}
                onPhoneChange={setPhoneNumber}
                onProceed={handleProceedToPayment}
              />
            </motion.div>
          )}

          {/* Step 2: Payment Instructions */}
          {paymentStep === 'instructions' && (
            <motion.div
              key="instructions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PaymentInstructions
                referenceCode={referenceCode}
                amount={amountUGX}
                tokens={calculatedTokens}
                provider={selectedProvider}
                copiedCode={copiedCode}
                onCopyCode={copyToClipboard}
                onNext={() => setPaymentStep('upload')}
                onBack={() => setPaymentStep('calculator')}
              />
            </motion.div>
          )}

          {/* Step 3: Upload Screenshot */}
          {paymentStep === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ScreenshotUpload
                screenshotPreview={screenshotPreview}
                verificationError={verificationError}
                loading={loading}
                onFileChange={handleFileChange}
                onSubmit={handleSubmitScreenshot}
                onBack={() => setPaymentStep('instructions')}
              />
            </motion.div>
          )}

          {/* Step 4: Verifying */}
          {paymentStep === 'verifying' && (
            <motion.div
              key="verifying"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl p-12 text-center border-2 border-orange-200"
            >
              <div className="w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Verifying Payment...</h3>
              <p className="text-gray-600">
                Our AI is analyzing your payment screenshot. This may take a few moments.
              </p>
            </motion.div>
          )}

          {/* Step 5: Success */}
          {paymentStep === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl p-12 text-center border-2 border-green-500"
            >
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
              <h3 className="text-3xl font-bold text-gray-900 mb-3">Payment Verified!</h3>
              <p className="text-lg text-gray-600 mb-6">
                {calculatedTokens.toLocaleString()} tokens have been added to your account.
              </p>
              <div className="bg-green-50 rounded-lg p-4 mb-6 inline-block">
                <div className="flex items-center gap-3">
                  <Coins className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">New Balance</p>
                    <p className="text-2xl font-bold text-green-600">
                      {tokenBalance !== null ? tokenBalance.toLocaleString() : '...'} tokens
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={resetPayment}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg shadow-lg transition-all"
                >
                  Buy More Tokens
                </button>
                <button
                  onClick={() => router.push('/generation')}
                  className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg shadow-lg transition-all"
                >
                  Start Cloning
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Note */}
        <div className="mt-8 text-center text-gray-600">
          <p className="text-sm">
           
            All transactions are verified before tokens are credited.
          </p>
        </div>
      </div>
    </div>
  );
}

// Calculator Component
function TokenCalculator({ 
  amountUGX, 
  calculatedTokens, 
  selectedProvider, 
  phoneNumber,
  onAmountChange,
  onQuickAmount,
  onProviderChange,
  onPhoneChange,
  onProceed
}: any) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-orange-200 mb-8">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6">
        <div className="flex items-center gap-3 text-white">
          <Calculator className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Token Calculator</h2>
        </div>
      </div>

      <div className="p-8">
        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Enter Amount (UGX)
          </label>
          <div className="relative">
            <input
              type="text"
              value={amountUGX}
              onChange={onAmountChange}
              placeholder="10000"
              className="w-full px-4 py-4 text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
              UGX
            </span>
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[15000, 30000, 50000, 100000].map((amount) => (
            <button
              key={amount}
              onClick={() => onQuickAmount(amount)}
              className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 font-semibold rounded-lg transition-colors"
            >
              {(amount / 1000).toFixed(0)}k
            </button>
          ))}
        </div>

        {/* Calculation Result */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 mb-6 border-2 border-orange-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold text-gray-700">Amount to Pay:</span>
            <span className="text-3xl font-bold text-gray-900">
              {parseInt(amountUGX || '0').toLocaleString()} UGX
            </span>
          </div>
          <div className="flex items-center justify-center my-3">
            <ArrowRight className="w-6 h-6 text-orange-500" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-gray-700">Tokens You'll Get:</span>
            <div className="flex items-center gap-2">
              <Coins className="w-6 h-6 text-orange-500" />
              <span className="text-3xl font-bold text-orange-600">
                {calculatedTokens.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-3 text-center text-sm text-gray-600">
            = {Math.floor(calculatedTokens / 10000)} website clone{Math.floor(calculatedTokens / 10000) !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Mobile Money Payment */}
        <div className="border-t-2 border-gray-200 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Smartphone className="w-6 h-6 text-gray-700" />
            <h3 className="text-xl font-bold text-gray-900">Payment Method</h3>
          </div>

          {/* Provider Selection */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => onProviderChange('mtn')}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedProvider === 'mtn'
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-yellow-400 rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-black">MTN</span>
                </div>
                <span className="font-semibold text-gray-900">MTN Mobile Money</span>
              </div>
            </button>

            <button
              onClick={() => onProviderChange('airtel')}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedProvider === 'airtel'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-xl font-bold text-white">Airtel</span>
                </div>
                <span className="font-semibold text-gray-900">Airtel Money</span>
              </div>
            </button>
          </div>

          {/* Phone Number Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your {selectedProvider === 'mtn' ? 'MTN' : 'Airtel'} Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => onPhoneChange(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0777123456"
              maxLength={10}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
            />
            <p className="mt-2 text-sm text-gray-600">
              Enter your phone number that you'll use to send money
            </p>
          </div>

          {/* Proceed Button */}
          <button
            onClick={onProceed}
            disabled={!phoneNumber || calculatedTokens < 1000}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-lg font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Proceed to Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// Payment Instructions Component
function PaymentInstructions({ referenceCode, amount, tokens, provider, copiedCode, onCopyCode, onNext, onBack }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-orange-200">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6">
        <div className="flex items-center gap-3 text-white">
          <Smartphone className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Payment Instructions</h2>
        </div>
      </div>

      <div className="p-8">
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-yellow-900 mb-2">Important: Follow These Steps Carefully</h4>
              <p className="text-yellow-800 text-sm">
                Use the reference code below as your sending reason. This helps us verify your payment automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Reference Code */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 mb-6 border-2 border-orange-300">
          <p className="text-sm font-semibold text-gray-700 mb-2 text-center">Your Payment Reference Code</p>
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-5xl font-bold text-orange-600 tracking-wider">{referenceCode}</span>
            <button
              onClick={() => onCopyCode(referenceCode)}
              className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
              title="Copy code"
            >
              <Copy className="w-6 h-6 text-orange-600" />
            </button>
          </div>
          {copiedCode && (
            <p className="text-sm text-green-600 text-center font-semibold">✓ Copied to clipboard!</p>
          )}
        </div>

        {/* Step-by-step Instructions */}
        <div className="space-y-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">Open {provider === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'} App</h4>
              <p className="text-gray-600 text-sm">Dial *165# (MTN) or *185# (Airtel) to access mobile money</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">Select "Send Money"</h4>
              <p className="text-gray-600 text-sm">Choose the option to send money to another number</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">Enter Recipient Details</h4>
              <div className="bg-gray-50 rounded-lg p-3 mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Phone Number:</span>
                  <span className="font-bold text-gray-900">+256761819885</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Name:</span>
                  <span className="font-bold text-gray-900">Biira Keziah</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Amount:</span>
                  <span className="font-bold text-gray-900">{parseInt(amount).toLocaleString()} UGX</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
              4
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">Enter Reference Code as Sending Reason</h4>
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-3 mt-2">
                <p className="text-sm text-gray-700 mb-2">When asked for "Reason" or "Comment", enter:</p>
                <p className="text-2xl font-bold text-orange-600 text-center tracking-wider">{referenceCode}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
              5
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">Confirm and Send</h4>
              <p className="text-gray-600 text-sm">Enter your PIN to complete the transaction</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
              6
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">Take Screenshot of Confirmation</h4>
              <p className="text-gray-600 text-sm">Capture the success message showing the transaction details</p>
            </div>
          </div>
        </div>

        {/* Summary Box */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-gray-900 mb-2">Payment Summary</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount to Send:</span>
              <span className="font-bold text-gray-900">{parseInt(amount).toLocaleString()} UGX</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tokens You'll Receive:</span>
              <span className="font-bold text-orange-600">{tokens.toLocaleString()} tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reference Code:</span>
              <span className="font-bold text-orange-600">{referenceCode}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-all"
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg shadow-lg transition-all"
          >
            I've Sent the Money
          </button>
        </div>
      </div>
    </div>
  );
}

// Screenshot Upload Component
function ScreenshotUpload({ screenshotPreview, verificationError, loading, onFileChange, onSubmit, onBack }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-orange-200">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6">
        <div className="flex items-center gap-3 text-white">
          <Upload className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Upload Payment Screenshot</h2>
        </div>
      </div>

      <div className="p-8">
        <p className="text-gray-600 mb-6">
          Upload a screenshot of your payment confirmation message. Our AI will automatically verify the payment details.
        </p>

        {verificationError && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-900 mb-1">Verification Failed</h4>
                <p className="text-red-700 text-sm">{verificationError}</p>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 mb-6 text-center hover:border-orange-400 transition-colors">
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
            id="screenshot-upload"
          />
          <label htmlFor="screenshot-upload" className="cursor-pointer">
            {screenshotPreview ? (
              <div>
                <img 
                  src={screenshotPreview} 
                  alt="Payment screenshot" 
                  className="max-h-96 mx-auto rounded-lg shadow-lg mb-4"
                />
                <p className="text-sm text-gray-600">Click to change screenshot</p>
              </div>
            ) : (
              <div>
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-700 mb-2">
                  Click to upload screenshot
                </p>
                <p className="text-sm text-gray-500">
                  Supports JPG, PNG (Max 5MB)
                </p>
              </div>
            )}
          </label>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-blue-900 mb-2">Screenshot Tips:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Make sure the screenshot is clear and readable</li>
            <li>• Include the transaction reference code ({screenshotPreview ? 'visible' : 'shown in your message'})</li>
            <li>• Show the amount sent and recipient name (Biira Keziah)</li>
            <li>• Ensure the success confirmation is visible</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onBack}
            disabled={loading}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={onSubmit}
            disabled={!screenshotPreview || loading}
            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
