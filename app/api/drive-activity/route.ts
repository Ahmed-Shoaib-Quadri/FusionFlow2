import { db } from '@/lib/db';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
export async function GET() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.OAUTH2_REDIRECT_URI
    );

    const authUser = await currentUser();
    if ( !authUser ) {
        return NextResponse.json({ message: 'User not found' }, { status: 401 })
    }

    const client = await clerkClient();
    const tokenResponse = await client.users.getUserOauthAccessToken(
        authUser.id,
        'google'
    );
    
    const accessToken = tokenResponse.data[0]?.token;

    if(!accessToken) {
        return NextResponse.json({ message: 'Google OAuth token not found '},{ status: 400 });
    }

    oauth2Client.setCredentials({
        access_token: accessToken,
    })

    const drive = google.drive({
        version: 'v3',
        auth: oauth2Client,
    })

    const channelId = uuidv4();

    const startPageTokenRes = await drive.changes.getStartPageToken({});
    const startPageToken = startPageTokenRes.data.startPageToken
    if(startPageToken == null){
        throw new Error('startPageToken is unexpectedly null')
    }

    const listener = await drive.changes.watch({
        pageToken: startPageToken,
        supportsAllDrives: true,
        supportsTeamDrives: true,
        requestBody: {
            id: channelId,
            type: 'web_hook',
            address: `${process.env.NGROK_URI}/api/drive-activity/notification`,
            kind: 'api#channel',
        },
    })

    if(listener.status == 200) {
        const user = await db.user.findUnique({
            where: {
                clerkId: authUser.id,
            },
            select: {
                id: true,
                clerkId: true,
            },
        })

        if (!user) {
            return new NextResponse('User not found', { status: 404 })
        }

        await db.user.update({
            where: {
                clerkId: authUser.id,
            },
            data: {
                googleResourceId: listener.data.resourceId,
                localGoogleId: channelId,
            },
        })

        await db.localGoogleCredential.upsert({
            where: {
                userId: user.id,
            },
            update: {
                accessToken,
                channelId,
                pageToken: startPageToken,
                subscribed: true,
            },
            create: {
                userId: user.id,
                accessToken,
                channelId,
                pageToken: startPageToken,
                subscribed: true,
            },
        })

        if(listener.data.resourceId) {
            return new NextResponse('Listening to changes...')
        }
    }

    return new NextResponse('Oops! Something went wrong, try again');
}
