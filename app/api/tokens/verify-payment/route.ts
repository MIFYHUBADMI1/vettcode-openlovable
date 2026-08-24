import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import ImageKit from 'imagekit';

// Initialize ImageKit for screenshot storage
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if OpenRouter API key is configured
    if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key') {
      console.error('[Payment Verification] OpenRouter API key not configured');
      return NextResponse.json(
        { error: 'Payment verification service is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const screenshot = formData.get('screenshot') as File;
    const referenceCode = formData.get('referenceCode') as string;
    const expectedAmount = formData.get('expectedAmount') as string;
    const provider = formData.get('provider') as string;
    const phoneNumber = formData.get('phoneNumber') as string;

    if (!screenshot || !referenceCode || !expectedAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const arrayBuffer = await screenshot.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = screenshot.type;

    // Upload screenshot to ImageKit first
    let screenshotUrl = '';
    let imagekitFileId = '';
    
    try {
      const uploadResult = await imagekit.upload({
        file: base64Image,
        fileName: `payment_${session.user.id}_${referenceCode}_${Date.now()}.${screenshot.name.split('.').pop()}`,
        folder: '/payment-screenshots',
        tags: ['payment', 'verification', referenceCode, session.user.id],
      });
      
      screenshotUrl = uploadResult.url;
      imagekitFileId = uploadResult.fileId;
      console.log('[Payment Verification] Screenshot uploaded to ImageKit:', screenshotUrl);
    } catch (uploadError) {
      console.error('[Payment Verification] ImageKit upload failed:', uploadError);
      // Continue with verification even if upload fails
    }

    // Use OpenRouter's vision model to analyze the payment screenshot
    // Using Google's Gemini Flash which supports vision and is free/low-cost
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'MirrorSite AI - Payment Verification',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5-8b',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
              {
                type: 'text',
                text: `You are a payment verification AI. Analyze this mobile money payment screenshot and extract the following information. Return ONLY a JSON object with these exact fields:

{
  "isValid": boolean (true if this is a genuine payment confirmation screenshot),
  "amount": number (the amount sent in UGX, extract only the number),
  "recipient": string (recipient name),
  "recipientNumber": string (recipient phone number),
  "referenceCode": string (the reference/reason/comment code used, usually 4 characters),
  "transactionId": string (transaction ID if visible),
  "provider": string (MTN or Airtel),
  "status": string (success/failed/pending),
  "timestamp": string (transaction date/time if visible),
  "isFraudulent": boolean (true if screenshot appears fake, edited, or suspicious)
}

Expected values to verify against:
- Reference Code: ${referenceCode}
- Expected Amount: ${expectedAmount} UGX
- Recipient: Biira Keziah
- Recipient Number: +256761819885 or 0761819885
- Provider: ${provider.toUpperCase()}

Check for these fraud indicators:
- Screenshot editing artifacts
- Mismatched fonts or inconsistent UI elements
- Incorrect provider branding
- Reference code doesn't match
- Amount doesn't match
- Recipient name or number doesn't match
- Transaction status is not "success" or "completed"

Return the JSON object ONLY, no additional text.`,
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Payment Verification] OpenRouter API error:', errorData);
      throw new Error(`OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const completion = await response.json();
    
    // Parse the AI response
    const responseText = completion.choices?.[0]?.message?.content || '';
    
    let analysisResult;
    try {
      // Extract JSON from the response (in case AI adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json(
        { error: 'Failed to analyze screenshot. Please ensure the image is clear and try again.' },
        { status: 400 }
      );
    }

    // Verify the payment details
    const verificationErrors: string[] = [];

    if (!analysisResult.isValid) {
      verificationErrors.push('Screenshot does not appear to be a valid payment confirmation');
    }

    if (analysisResult.isFraudulent) {
      verificationErrors.push('Screenshot appears to be fraudulent or edited');
    }

    if (analysisResult.status?.toLowerCase() !== 'success' && 
        analysisResult.status?.toLowerCase() !== 'completed' &&
        analysisResult.status?.toLowerCase() !== 'successful') {
      verificationErrors.push('Transaction status is not successful');
    }

    // Check reference code (case insensitive)
    if (analysisResult.referenceCode?.toUpperCase() !== referenceCode.toUpperCase()) {
      verificationErrors.push(`Reference code mismatch. Expected: ${referenceCode}, Found: ${analysisResult.referenceCode || 'none'}`);
    }

    // Check amount (allow 1% tolerance for transaction fees)
    const expectedAmountNum = parseInt(expectedAmount);
    const actualAmount = parseInt(analysisResult.amount?.toString() || '0');
    const amountDifference = Math.abs(expectedAmountNum - actualAmount);
    const amountTolerance = expectedAmountNum * 0.01; // 1% tolerance

    if (amountDifference > amountTolerance) {
      verificationErrors.push(`Amount mismatch. Expected: ${expectedAmountNum} UGX, Found: ${actualAmount} UGX`);
    }

    // Check recipient name (flexible matching)
    const recipientLower = analysisResult.recipient?.toLowerCase() || '';
    if (!recipientLower.includes('biira') && !recipientLower.includes('keziah')) {
      verificationErrors.push(`Recipient name mismatch. Expected: Biira Keziah, Found: ${analysisResult.recipient || 'unknown'}`);
    }

    // Check recipient number (flexible matching, remove country code and spaces)
    const normalizePhone = (phone: string) => phone.replace(/[\s\-\+]/g, '').slice(-9); // Last 9 digits
    const expectedPhone = normalizePhone('256761819885');
    const actualPhone = normalizePhone(analysisResult.recipientNumber || '');
    
    if (actualPhone && actualPhone !== expectedPhone) {
      verificationErrors.push(`Recipient number mismatch. Expected: +256761819885, Found: ${analysisResult.recipientNumber}`);
    }

    // Check provider (if detected)
    if (analysisResult.provider && 
        analysisResult.provider.toLowerCase() !== provider.toLowerCase() &&
        !analysisResult.provider.toLowerCase().includes(provider.toLowerCase())) {
      verificationErrors.push(`Provider mismatch. Expected: ${provider}, Found: ${analysisResult.provider}`);
    }

    // If there are verification errors, reject the payment
    if (verificationErrors.length > 0) {
      // Log failed attempt to database with screenshot URL
      const db = await getDatabase();
      await db.collection('paymentVerifications').insertOne({
        userId: session.user.id,
        userEmail: session.user.email,
        referenceCode,
        expectedAmount: expectedAmountNum,
        actualAmount,
        provider,
        phoneNumber,
        screenshotUrl,
        imagekitFileId,
        analysisResult,
        verificationErrors,
        status: 'rejected',
        timestamp: new Date(),
      });

      return NextResponse.json(
        { 
          success: false,
          error: 'Payment verification failed:\n' + verificationErrors.join('\n'),
          details: analysisResult
        },
        { status: 400 }
      );
    }

    // Payment verified successfully - add tokens
    const db = await getDatabase();
    const tokensToAdd = actualAmount * 1; // 1 UGX = 1 token

    const user = await db.collection('users').findOne({ 
      _id: ObjectId.createFromHexString(session.user.id) 
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentTokens = user.tokens || 0;

    // Update user tokens
    await db.collection('users').updateOne(
      { _id: ObjectId.createFromHexString(session.user.id) },
      { 
        $set: { tokens: currentTokens + tokensToAdd },
        $push: {
          tokenHistory: {
            type: 'purchase',
            amount: tokensToAdd,
            timestamp: new Date(),
            paymentMethod: 'mobile_money',
            provider: provider,
            referenceCode: referenceCode,
            transactionId: analysisResult.transactionId || 'N/A',
            verifiedBy: 'AI_OCR',
            screenshotUrl: screenshotUrl,
            imagekitFileId: imagekitFileId,
            reason: 'Mobile money payment verified'
          },
          paymentScreenshots: {
            url: screenshotUrl,
            fileId: imagekitFileId,
            referenceCode: referenceCode,
            amount: actualAmount,
            tokensAdded: tokensToAdd,
            provider: provider,
            transactionId: analysisResult.transactionId || 'N/A',
            timestamp: new Date(),
            status: 'verified'
          }
        } as any
      }
    );

    // Log successful verification with screenshot
    await db.collection('paymentVerifications').insertOne({
      userId: session.user.id,
      userEmail: session.user.email,
      referenceCode,
      expectedAmount: expectedAmountNum,
      actualAmount,
      tokensAdded: tokensToAdd,
      provider,
      phoneNumber,
      screenshotUrl,
      imagekitFileId,
      analysisResult,
      verificationErrors: [],
      status: 'approved',
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      tokensAdded: tokensToAdd,
      newBalance: currentTokens + tokensToAdd,
      transactionId: analysisResult.transactionId,
      message: 'Payment verified successfully!'
    });

  } catch (error: any) {
    console.error('Payment verification error:', error);
    
    // Log the error
    if (error.message?.includes('image')) {
      return NextResponse.json(
        { error: 'Failed to process image. Please ensure the screenshot is clear and in a supported format (JPG, PNG).' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error during verification. Please try again.' },
      { status: 500 }
    );
  }
}
