import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { organization } from 'better-auth/plugins';

export function missingAuthSettings(env) {
    const missing = ['BETTER_AUTH_URL', 'BETTER_AUTH_SECRET', 'RESEND_API_KEY', 'MAIL_FROM', 'PILOT_EMAILS']
        .filter(key => !env[key]?.trim());
    if (!env.HYPERDRIVE?.connectionString && !env.DATABASE_URL) missing.push('HYPERDRIVE');
    if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length < 32) missing.push('BETTER_AUTH_SECRET_LENGTH');
    return missing;
}

export function authOptions(env, database, sendMail = message => sendEmail(env, message)) {
    const allowed = new Set((env.PILOT_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
    return {
        appName: 'Domus',
        baseURL: env.BETTER_AUTH_URL,
        secret: env.BETTER_AUTH_SECRET,
        database,
        trustedOrigins: [env.BETTER_AUTH_URL],
        emailAndPassword: {
            enabled: true,
            minPasswordLength: 12,
            requireEmailVerification: true,
            sendResetPassword: ({ user, url }) => sendMail({
                to: user.email, subject: 'Domus: Passwort zurücksetzen',
                text: `Über diesen Link kannst du dein Passwort zurücksetzen:\n${url}`,
            }),
        },
        emailVerification: {
            sendOnSignUp: true,
            sendVerificationEmail: ({ user, url }) => sendMail({
                to: user.email, subject: 'Domus: E-Mail-Adresse bestätigen',
                text: `Bestätige deine E-Mail-Adresse über diesen Link:\n${url}`,
            }),
        },
        rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
        advanced: {
            useSecureCookies: new URL(env.BETTER_AUTH_URL).protocol === 'https:',
            ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
        },
        hooks: {
            before: createAuthMiddleware(async ctx => {
                if (ctx.path === '/sign-up/email' && !allowed.has(ctx.body?.email?.trim().toLowerCase())) {
                    throw new APIError('FORBIDDEN', { message: 'Die Registrierung ist derzeit nur auf Einladung möglich.' });
                }
            }),
        },
        // Konto-Onboarding and team access follow the domain migration.
        plugins: [organization({ allowUserToCreateOrganization: false })],
    };
}

export function createAuth(env, database, sendMail) {
    return betterAuth(authOptions(env, database, sendMail));
}

async function sendEmail(env, message) {
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, ...message }),
    });
    if (!response.ok) throw new Error('Email delivery failed');
}
