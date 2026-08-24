'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Coins, 
  Calculator, 
  Smartphone, 
  ArrowRight, 
  Upload, 
  CheckCircle, 
  Copy, 
  AlertCircle, 
  Shield, 
  Lock, 
  Zap, 
  TrendingUp,
  Gift,
  Clock,
  Phone,
  Info,
  DollarSign,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Pricing: 1 token = 1 UGX
const TOKEN_RATE = 1;

// Generate random 4-character reference code
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

  // SEO
  useEffect(() => {
    document.title = 'Buy Tokens - Secure Payment | MirrorSite AI';
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user?.id) {
      fetchTokenBalance();
    }
  }, [status, session, router]);

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
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      setScreenshot(file);
      
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

  if (paymentStep !== 'calculator') {
    return (
      <div className="min-h-screen bg-[#0A0F1E]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {paymentStep === 'instructions' && (
              <PaymentInstructions
                key="instructions"
                referenceCode={referenceCode}
                amount={amountUGX}
                tokens={calculatedTokens}
                provider={selectedProvider}
                copiedCode={copiedCode}
                onCopyCode={copyToClipboard}
                onNext={() => setPaymentStep('upload')}
                onBack={() => setPaymentStep('calculator')}
              />
            )}

            {paymentStep === 'upload' && (
              <ScreenshotUpload
                key="upload"
                screenshotPreview={screenshotPreview}
                verificationError={verificationError}
                loading={loading}
                onFileChange={handleFileChange}
                onSubmit={handleSubmitScreenshot}
                onBack={() => setPaymentStep('instructions')}
              />
            )}

            {paymentStep === 'verifying' && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#151B2E] rounded-3xl shadow-2xl p-16 text-center border border-gray-800"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="w-24 h-24 border-8 border-orange-500 border-t-transparent rounded-full mx-auto mb-8"
                />
                <h3 className="text-3xl font-bold text-white mb-4">Verifying Payment...</h3>
                <p className="text-lg text-gray-400">
                  Our AI system is analyzing your payment screenshot.
                </p>
              </motion.div>
            )}

            {paymentStep === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#151B2E] rounded-3xl shadow-2xl p-16 text-center border-2 border-green-500"
              >
                <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  <CheckCircle className="w-32 h-32 text-white" />
                </div>
                <h3 className="text-4xl font-bold text-white mb-4">Payment Verified!</h3>
                <p className="text-xl text-gray-300 mb-8">
                  {calculatedTokens.toLocaleString()} tokens added to your account.
                </p>
                <div className="bg-green-500/10 border border-green-500 rounded-2xl p-6 mb-8 inline-block">
                  <div className="flex items-center gap-4">
                    <Coins className="w-24 h-24 text-green-400" />
                    <div className="text-left">
                      <p className="text-sm text-gray-400">New Balance</p>
                      <p className="text-3xl font-bold text-white">
                        {tokenBalance !== null ? tokenBalance.toLocaleString() : '...'} tokens
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={resetPayment}
                    className="px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold rounded-xl shadow-lg transition-all"
                  >
                    Buy More Tokens
                  </button>
                  <button
                    onClick={() => router.push('/generation')}
                    className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl shadow-lg transition-all"
                  >
                    Start Cloning
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-orange-50/30">
      <div className="max-w-[1120px] mx-auto px-6 py-12">
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          {/* Security Badge */}
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 px-4 py-2 rounded-full mb-6">
            <Shield className="w-16 h-16 text-green-600" />
            <span className="text-sm font-medium text-green-700">Secure Payment Processing</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="text-gray-900">Token </span>
            <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 bg-clip-text text-transparent">Purchase</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Get tokens to unlock premium AI features and clone unlimited websites.
          </p>

          {/* Current Balance */}
          <div className="inline-flex items-center gap-3 bg-white border-2 border-gray-200 rounded-2xl px-6 py-4 shadow-lg">
            <div className="text-sm text-gray-600 uppercase tracking-wider font-medium">Current Balance</div>
            <div className="flex items-center gap-2">
              <Coins className="w-16 h-16 text-orange-500" />
              <span className="text-xl font-bold text-gray-900">
                {tokenBalance !== null ? tokenBalance.toLocaleString() : '...'} <span className="text-sm text-gray-500 font-normal">tokens</span>
              </span>
            </div>
          </div>
        </motion.div>

        {/* Information Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* How It Works */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border-2 border-gray-200 rounded-2xl p-6 shadow-md"
          >
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-16 h-16 text-blue-500" />
              <h3 className="text-lg font-bold text-gray-900">How It Works</h3>
            </div>
            <ul className="space-y-3 text-gray-700 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-12 h-12 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Purchase tokens for website cloning and AI features</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-12 h-12 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Usage varies based on website complexity</span>
              </li>
              <li className="flex items-start gap-2">
                <DollarSign className="w-12 h-12 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Pay-as-you-go — No subscriptions required</span>
              </li>
              <li className="flex items-start gap-2">
                <Gift className="w-12 h-12 text-green-500 flex-shrink-0 mt-0.5" />
                <span>New users get 500 free tokens</span>
              </li>
            </ul>

            {/* Bonus Banner */}
            <div className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl p-4 flex items-center gap-3">
              <Gift className="w-20 h-20 text-purple-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">New User Bonus</p>
                <p className="text-lg font-bold text-purple-600">500 FREE TOKENS</p>
              </div>
            </div>
          </motion.div>

          {/* Pricing Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border-2 border-gray-200 rounded-2xl p-6 shadow-md"
          >
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-16 h-16 text-orange-500" />
              <h3 className="text-lg font-bold text-gray-900">Pricing Details</h3>
            </div>
            
            <div className="space-y-4">
              {/* Exchange Rate */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Exchange Rate</span>
                <span className="text-base font-bold text-gray-900">1 Token = 1 UGX</span>
              </div>

              {/* Minimum Purchase */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Minimum Purchase</span>
                <div className="text-right">
                  <p className="text-base font-bold text-gray-900">15,000 UGX</p>
                  <p className="text-xs text-gray-500">(15,000 tokens)</p>
                </div>
              </div>

              {/* Token Validity */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Token Validity</span>
                <span className="text-base font-bold text-green-600">Never Expires</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          {/* Token Calculator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border-2 border-gray-200 rounded-2xl p-6 shadow-lg"
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
              <Calculator className="w-16 h-16 text-purple-500" />
              <h2 className="text-lg font-bold text-gray-900">Token Calculator</h2>
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Amount (UGX)
              </label>
              
              <div className="relative">
                <input
                  type="text"
                  value={amountUGX}
                  onChange={handleAmountChange}
                  placeholder="15000"
                  className="w-full px-4 py-4 text-2xl font-bold bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">
                  UGX
                </span>
              </div>

              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <AlertCircle className="w-10 h-10" />
                Minimum purchase: 15,000 UGX
              </p>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-5 gap-2 mb-8">
              {[15000, 30000, 50000, 100000, 200000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleQuickAmount(amount)}
                  className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                    amountUGX === amount.toString()
                      ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-200'
                  }`}
                >
                  {amount / 1000}K
                </button>
              ))}
            </div>

            {/* Payment Method */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-22 h-22 text-gray-700" />
                <h3 className="text-base font-bold text-gray-900">Payment Method</h3>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {/* MTN Mobile Money */}
                <button
                  onClick={() => setSelectedProvider('mtn')}
                  type="button"
                  className={`group relative overflow-hidden rounded-2xl transition-all duration-300 ${
                    selectedProvider === 'mtn'
                      ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-2xl shadow-yellow-500/50 scale-[1.02]'
                      : 'bg-white border-2 border-gray-200 hover:border-yellow-400 hover:shadow-xl'
                  }`}
                >
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12" />
                  </div>

                  <div className="relative p-6">
                    <div className="flex items-center gap-4">
                      {/* MTN Logo */}
                     
                      {/* Text */}
                      <div className="flex-1 text-left">
                        <p className={`font-bold text-base mb-1 ${
                          selectedProvider === 'mtn' ? 'text-white' : 'text-gray-900'
                        }`}>
                          MTN Mobile Money
                        </p>
                        <p className={`text-sm ${
                          selectedProvider === 'mtn' ? 'text-yellow-100' : 'text-gray-500'
                        }`}>
                          Pay with MTN
                        </p>
                      </div>
                      
                      {/* Radio */}
                      <div className={`w-7 h-7 rounded-full border-3 flex items-center justify-center transition-all ${
                        selectedProvider === 'mtn' 
                          ? 'border-white bg-white' 
                          : 'border-gray-300 bg-white'
                      }`}>
                        {selectedProvider === 'mtn' && (
                          <div className="w-4 h-4 bg-yellow-500 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Airtel Money */}
                <button
                  onClick={() => setSelectedProvider('airtel')}
                  type="button"
                  className={`group relative overflow-hidden rounded-2xl transition-all duration-300 ${
                    selectedProvider === 'airtel'
                      ? 'bg-gradient-to-br from-red-600 to-red-700 shadow-2xl shadow-red-500/50 scale-[1.02]'
                      : 'bg-white border-2 border-gray-200 hover:border-red-400 hover:shadow-xl'
                  }`}
                >
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12" />
                  </div>

                  <div className="relative p-6">
                    <div className="flex items-center gap-4">
                      {/* Airtel Logo */}
                      
                      {/* Text */}
                      <div className="flex-1 text-left">
                        <p className={`font-bold text-base mb-1 ${
                          selectedProvider === 'airtel' ? 'text-white' : 'text-gray-900'
                        }`}>
                          Airtel Money
                        </p>
                        <p className={`text-sm ${
                          selectedProvider === 'airtel' ? 'text-red-100' : 'text-gray-500'
                        }`}>
                          Pay with Airtel
                        </p>
                      </div>
                      
                      {/* Radio */}
                      <div className={`w-7 h-7 rounded-full border-3 flex items-center justify-center transition-all ${
                        selectedProvider === 'airtel' 
                          ? 'border-white bg-white' 
                          : 'border-gray-300 bg-white'
                      }`}>
                        {selectedProvider === 'airtel' && (
                          <div className="w-4 h-4 bg-red-600 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Phone Number */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedProvider === 'mtn' ? 'MTN' : 'Airtel'} Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-16 h-16 text-gray-400" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 0777123456"
                  maxLength={10}
                  className="w-full pl-24 pr-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                />
              </div>
            </div>

            {/* Purchase Button */}
            <button
              onClick={handleProceedToPayment}
              disabled={!phoneNumber || calculatedTokens < 15000}
              className="w-full py-4 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CreditCard className="w-16 h-16" />
              Purchase Tokens
            </button>

            {/* Security Footer */}
            <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1">
              <Shield className="w-10 h-10 text-green-600" />
              Your payment is secure and encrypted
            </p>
          </motion.div>

          {/* Purchase Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 border-2 border-orange-200 rounded-2xl p-6 relative overflow-hidden shadow-lg"
          >
            {/* Decorative coins illustration */}
            <div className="absolute top-4 right-4 opacity-20">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 absolute -top-2 -right-2" />
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500" />
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 absolute top-6 left-8" />
              </div>
            </div>

            <div className="relative z-10">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">You Will Receive</p>
              <div className="mb-6">
                <div className="text-4xl font-black text-orange-600">
                  {calculatedTokens.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 mt-1">Tokens</div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent mb-6" />

              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Amount to Pay</p>
              <div>
                <div className="text-3xl font-black bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  {parseInt(amountUGX || '0').toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 mt-1">UGX</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Payment Instructions Component (keeping same as before with dark theme)
function PaymentInstructions({ referenceCode, amount, tokens, provider, copiedCode, onCopyCode, onNext, onBack }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#151B2E] border border-gray-800 rounded-3xl overflow-hidden"
    >
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-8 py-6">
        <h2 className="text-2xl font-bold text-white">Payment Instructions</h2>
      </div>

      <div className="p-8">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-12 h-12 text-yellow-400 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-yellow-300 mb-1">Important: Use Reference Code</h4>
              <p className="text-yellow-200/80 text-sm">
                Include the reference code below as your payment reason for automatic verification.
              </p>
            </div>
          </div>
        </div>

        {/* Reference Code */}
        <div className="bg-gradient-to-br from-orange-500/10 to-pink-500/10 border border-orange-500/30 rounded-xl p-6 mb-6">
          <p className="text-sm font-semibold text-gray-400 mb-2 text-center">Your Payment Reference Code</p>
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-4xl font-black text-orange-400 tracking-widest">{referenceCode}</span>
            <button
              onClick={() => onCopyCode(referenceCode)}
              className="p-2 hover:bg-orange-500/10 rounded-lg transition-colors"
            >
              <Copy className="w-12 h-12 text-orange-400" />
            </button>
          </div>
          {copiedCode && (
            <p className="text-sm text-green-400 text-center font-semibold">✓ Copied!</p>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-6">
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 text-sm">1</div>
            <div>
              <h4 className="font-bold text-white">Open {provider === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'}</h4>
              <p className="text-sm text-gray-400">Dial *165# (MTN) or *185# (Airtel)</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 text-sm">2</div>
            <div>
              <h4 className="font-bold text-white">Select "Send Money"</h4>
              <p className="text-sm text-gray-400">Choose option to send to another number</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 text-sm">3</div>
            <div>
              <h4 className="font-bold text-white">Enter Recipient Details</h4>
              <div className="bg-[#0A0F1E] border border-gray-800 rounded-lg p-3 mt-2 text-sm space-y-1">
                <p className="text-gray-400"><span className="text-gray-500">Phone:</span> <span className="font-bold text-white">+256761819885</span></p>
                <p className="text-gray-400"><span className="text-gray-500">Name:</span> <span className="font-bold text-white">Biira Keziah</span></p>
                <p className="text-gray-400"><span className="text-gray-500">Amount:</span> <span className="font-bold text-orange-400">{parseInt(amount).toLocaleString()} UGX</span></p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 text-sm">4</div>
            <div>
              <h4 className="font-bold text-white">Enter Reference Code as Reason</h4>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mt-2">
                <p className="text-sm text-gray-400 mb-1">When asked for "Reason", enter:</p>
                <p className="text-2xl font-bold text-orange-400 text-center">{referenceCode}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div>
              <h4 className="font-bold text-white">Take Screenshot</h4>
              <p className="text-sm text-gray-400">Capture the success message</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-white mb-2 text-sm">Payment Summary</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Amount:</span>
              <span className="font-bold text-white">{parseInt(amount).toLocaleString()} UGX</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Tokens:</span>
              <span className="font-bold text-orange-400">{tokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Reference:</span>
              <span className="font-bold text-orange-400">{referenceCode}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl transition-all"
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg transition-all"
          >
            I've Sent the Money
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Screenshot Upload Component (keeping same as before with dark theme)
function ScreenshotUpload({ screenshotPreview, verificationError, loading, onFileChange, onSubmit, onBack }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#151B2E] border border-gray-800 rounded-3xl overflow-hidden"
    >
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-8 py-6">
        <h2 className="text-2xl font-bold text-white">Upload Payment Proof</h2>
      </div>

      <div className="p-8">
        {verificationError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-10 h-10 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-300 text-sm">Verification Failed</h4>
                <p className="text-red-200/80 text-sm">{verificationError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="border-2 border-dashed border-gray-700 rounded-2xl p-8 mb-6 text-center hover:border-orange-500/50 transition-colors bg-[#0A0F1E]">
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
            id="screenshot-upload"
          />
          <label htmlFor="screenshot-upload" className="cursor-pointer block">
            {screenshotPreview ? (
              <div>
                <img 
                  src={screenshotPreview} 
                  alt="Payment screenshot" 
                  className="max-h-80 mx-auto rounded-lg shadow-lg mb-4"
                />
                <p className="text-sm text-gray-400">Click to change</p>
              </div>
            ) : (
              <div>
                <Upload className="w-32 h-32 text-gray-600 mx-auto mb-4" />
                <p className="font-semibold text-white mb-2">Click to Upload Screenshot</p>
                <p className="text-sm text-gray-500">PNG, JPG (Max 5MB)</p>
              </div>
            )}
          </label>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl transition-all"
          >
            Back
          </button>
          <button
            onClick={onSubmit}
            disabled={!screenshotPreview || loading}
            className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify Payment'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
