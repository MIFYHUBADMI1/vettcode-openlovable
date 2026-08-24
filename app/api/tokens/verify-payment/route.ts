import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import Anthropic from '@anthropic-ai/sdk';
import ImageKit from 'imagekit';

// Initialize Anthropic client for vision analysis
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

    // Use Claude's vision API to analyze the payment screenshot
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Image,
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
    });

    // Parse the AI response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
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
        }
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
