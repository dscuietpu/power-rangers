import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

export async function POST(request: Request) {
  // Validate Twilio config
  if (!accountSid || !authToken || !fromNumber) {
    console.error('Twilio credentials not configured');
    return NextResponse.json(
      { error: 'SMS service not configured. Please contact admin.' },
      { status: 500 }
    );
  }

  let body: { volunteerId: string; disasterType?: string; senderName?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { volunteerId, disasterType, senderName } = body;

  if (!volunteerId) {
    return NextResponse.json({ error: 'volunteerId is required' }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Fetch the volunteer's phone from their profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name, phone')
    .eq('id', volunteerId)
    .single();

  if (profileError || !profile) {
    console.error('Profile fetch error:', profileError);
    return NextResponse.json(
      { error: 'Volunteer profile not found.' },
      { status: 404 }
    );
  }

  if (!profile.phone) {
    return NextResponse.json(
      { error: 'Volunteer does not have a phone number on file.' },
      { status: 400 }
    );
  }

  // 2. Build the SMS message
  const disaster = disasterType || 'an emergency';
  const sender = senderName || 'Someone nearby';
  const message = `${sender} needs your help!\n\nType: ${disaster}\n Please respond ASAP if you are available.\n\n— Power Rangers Disaster Response`;

  // 3. Send SMS via Twilio
  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: profile.phone,
    });

    // 4. Optionally log the ping in the database
    await supabase.from('volunteer_pings').insert({
      volunteer_id: volunteerId,
      disaster_type: disasterType || null,
      sender_name: senderName || null,
    }).then(({ error }) => {
      if (error) console.warn('Failed to log ping (non-critical):', error.message);
    });

    return NextResponse.json({ success: true, volunteerId });
  } catch (twilioErr: any) {
    console.error('Twilio SMS error:', twilioErr);
    return NextResponse.json(
      { error: `Failed to send SMS: ${twilioErr.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
