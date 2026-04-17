import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, disasterType } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, message: 'No image URL provided.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'Server configuration error.' },
        { status: 500 }
      );
    }

    // Download image from the public URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { success: false, message: 'Could not fetch the uploaded image.' },
        { status: 400 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Initialize Gemini
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    const prompt = `Analyze this image. Is there a car accident, a fire, or a collapsed building? Reply ONLY with a JSON object in this exact format: {"emergency_type": "fire" | "accident" | "collapse" | "none", "confidence": "high" | "medium" | "low"}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const rawText = response.text ?? '';
    console.log('Gemini raw response:', rawText);

    // Parse JSON from response (handle markdown code blocks)
    let analysis: { emergency_type: string; confidence: string };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('Failed to parse Gemini response:', rawText);
      return NextResponse.json(
        { success: false, message: 'AI could not analyze the image. Please try again.' },
        { status: 500 }
      );
    }

    // If Gemini says "none", reject the report
    if (analysis.emergency_type === 'none') {
      return NextResponse.json({
        success: false,
        message: 'Not a valid disaster. Please click the image properly.',
        analysis,
      });
    }

    // Return success with the analysis
    return NextResponse.json({
      success: true,
      message: 'Disaster verified successfully.',
      analysis,
      userSelectedType: disasterType,
    });
  } catch (error: unknown) {
    console.error('Verify disaster error:', error);
    let errorMsg = 'An unexpected error occurred.';
    
    if (error && typeof error === 'object' && 'message' in error) {
      const errMessage = String(error.message);
      if (errMessage.includes('429') || errMessage.includes('quota') || errMessage.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'AI Verification Limit Reached. Please try again later or use a different key.';
      }
    }

    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
