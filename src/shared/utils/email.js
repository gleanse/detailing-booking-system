const { BrevoClient } = require('@getbrevo/brevo');

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

const sendBookingConfirmationEmail = async (booking) => {
  const {
    guest_name,
    guest_email,
    reference_code,
    queue_number,
    service_name,
    variant_name,
    booking_date,
    amount_paid,
    remaining_balance,
    qr_code,
  } = booking;

  const formattedDate = new Date(booking_date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedAmountPaid = `₱${parseFloat(amount_paid).toLocaleString(
    'en-PH',
    { minimumFractionDigits: 2 },
  )}`;
  const formattedRemaining =
    remaining_balance > 0
      ? `₱${parseFloat(remaining_balance).toLocaleString('en-PH', {
          minimumFractionDigits: 2,
        })}`
      : null;

  const serviceLabel = variant_name
    ? `${service_name} - ${variant_name}`
    : service_name;
  const paymentLabel = 'Down Payment';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;color:#ffffff;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:3px;background-color:#e53535;border-radius:2px;">&nbsp;</td>
                  <td style="padding-left:12px;font-size:20px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#ffffff;">
                    Herco Detailing Garage
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Success Badge -->
          <tr>
            <td align="center" style="padding:40px 0 24px;">
              <div style="display:inline-block;background-color:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:50%;width:72px;height:72px;line-height:72px;text-align:center;font-size:32px;color:#4ade80;font-weight:700;">
                &#10003;
              </div>
              <p style="margin:16px 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#4ade80;">Payment Confirmed</p>
              <h1 style="margin:0;font-size:36px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">
                You're All Set!
              </h1>
              <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;max-width:360px;">
                Your booking has been confirmed. Here are your booking details for your reference.
              </p>
            </td>
          </tr>

          <!-- QR Code -->
          ${
            qr_code
              ? `
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0" style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;width:100%;">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 16px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Your QR Code</p>
                    <div style="display:inline-block;background-color:#ffffff;padding:12px;border-radius:12px;">
                      <img src='${qr_code}' width="160" height="160" alt="QR Code" style="display:block;border-radius:4px;" />
                    </div>
                    <p style="margin:12px 0 0;font-size:11px;color:rgba(255,255,255,0.2);">Present this QR code to our staff upon arrival. Save or screenshot this email as a backup.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Booking Details Card -->
          <tr>
            <td style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
              <p style="margin:0 0 20px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Booking Details</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:14px;margin-bottom:14px;">
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.4);">Reference Code</td>
                  <td align="right" style="font-size:13px;font-weight:700;color:#ffffff;letter-spacing:2px;">${reference_code}</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:14px;margin-bottom:14px;">
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.4);">Queue Number</td>
                  <td align="right" style="font-size:13px;font-weight:700;color:#ffffff;">#${queue_number}</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:14px;margin-bottom:14px;">
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.4);">Service</td>
                  <td align="right" style="font-size:13px;color:#ffffff;">${serviceLabel}</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:14px;margin-bottom:14px;">
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.4);">Date</td>
                  <td align="right" style="font-size:13px;color:#ffffff;">${formattedDate}</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:14px;margin-bottom:14px;">
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.4);">Name</td>
                  <td align="right" style="font-size:13px;color:#ffffff;">${guest_name}</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:14px;margin-bottom:14px;">
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.4);">Payment Type</td>
                  <td align="right" style="font-size:13px;color:#ffffff;">${paymentLabel}</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" ${
                formattedRemaining
                  ? 'style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:14px;margin-bottom:14px;"'
                  : ''
              }>
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.4);">Amount Paid</td>
                  <td align="right" style="font-size:13px;font-weight:700;color:#4ade80;">${formattedAmountPaid}</td>
                </tr>
              </table>

              ${
                formattedRemaining
                  ? `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.4);">Estimated Remaining Balance</td>
                  <td align="right" style="font-size:13px;font-weight:700;color:#facc15;">${formattedRemaining}</td>
                </tr>
              </table>
              `
                  : ''
              }

            </td>
          </tr>

          <!-- What's Next -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0 0 16px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);">What's Next</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="width:40px;vertical-align:top;">
                    <div style="width:32px;height:32px;background-color:#e53535;border-radius:8px;">&nbsp;</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#ffffff;">Arrive on time</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Please arrive at the garage on your scheduled date with your queue number ready.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="width:40px;vertical-align:top;">
                    <div style="width:32px;height:32px;background-color:#e53535;border-radius:8px;">&nbsp;</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#ffffff;">Bring your motorcycle</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Make sure your motorcycle matches the details you provided during booking.</p>
                  </td>
                </tr>
              </table>

              ${
                formattedRemaining
                  ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="width:40px;vertical-align:top;">
                    <div style="width:32px;height:32px;background-color:#e53535;border-radius:8px;">&nbsp;</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#ffffff;">Settle remaining balance</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Please prepare <strong style="color:#facc15;">${formattedRemaining}</strong> to be paid in cash upon pickup.</p>
                  </td>
                </tr>
              </table>
              `
                  : ''
              }

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.2);">This is an automated email from Herco Detailing Garage.</p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">Please do not reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;

  const data = await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: 'Herco Detailing Garage', email: 'devglensprt@gmail.com' },
    to: [{ email: guest_email, name: guest_name }],
    subject: `Booking Confirmed - ${reference_code}`,
    htmlContent: html,
  });

  console.log('[EMAIL] Confirmation email sent:', data.messageId);
  return data;
};

const sendEmailVerificationEmail = async ({ email, name, otp }) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your New Email</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:3px;background-color:#e53535;border-radius:2px;">&nbsp;</td>
                  <td style="padding-left:12px;font-size:20px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#ffffff;">
                    Herco Detailing Garage
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:40px 0 24px;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Email Verification</p>
              <h1 style="margin:0;font-size:32px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">Verify Your Email</h1>
              <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;max-width:360px;">
                Hi ${name}, enter the code below to verify your new email address. This code expires in 10 minutes.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0" style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 48px;">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 12px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Your Verification Code</p>
                    <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:12px;color:#ffffff;">${otp}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding-top:32px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.2);">If you did not request this, you can safely ignore this email.</p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">This is an automated email from Herco Detailing Garage.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const data = await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: 'Herco Detailing Garage', email: 'devglensprt@gmail.com' },
    to: [{ email, name }],
    subject: 'Verify Your New Email Address',
    htmlContent: html,
  });

  console.log('[EMAIL] Verification email sent:', data.messageId);
  return data;
};

const sendPasswordResetEmail = async ({ email, name, otp }) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:3px;background-color:#e53535;border-radius:2px;">&nbsp;</td>
                  <td style="padding-left:12px;font-size:20px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#ffffff;">
                    Herco Detailing Garage
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:40px 0 24px;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Password Reset</p>
              <h1 style="margin:0;font-size:32px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">Reset Your Password</h1>
              <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;max-width:360px;">
                Hi ${name}, enter the code below to reset your password. This code expires in 10 minutes.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0" style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 48px;">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 12px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Your Reset Code</p>
                    <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:12px;color:#ffffff;">${otp}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding-top:32px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.2);">If you did not request this, you can safely ignore this email.</p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">This is an automated email from Herco Detailing Garage.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const data = await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: 'Herco Detailing Garage', email: 'devglensprt@gmail.com' },
    to: [{ email, name }],
    subject: 'Reset Your Password - Herco Detailing Garage',
    htmlContent: html,
  });

  console.log('[EMAIL] Password reset email sent:', data.messageId);
  return data;
};

// ─── STATUS UPDATE EMAILS ─────────────────────────────────────────────────────

const _statusEmailBase = ({
  referenceCode,
  queueNumber,
  serviceName,
  variantName,
}) => {
  const serviceLabel = variantName
    ? `${serviceName} - ${variantName}`
    : serviceName;
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:14px;margin-bottom:14px;"><tr>
      <td style="font-size:12px;color:rgba(255,255,255,0.4);">Reference Code</td>
      <td align="right" style="font-size:13px;font-weight:700;color:#ffffff;letter-spacing:2px;">${referenceCode}</td>
    </tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:14px;margin-bottom:14px;"><tr>
      <td style="font-size:12px;color:rgba(255,255,255,0.4);">Queue Number</td>
      <td align="right" style="font-size:13px;font-weight:700;color:#ffffff;">#${queueNumber}</td>
    </tr></table>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:12px;color:rgba(255,255,255,0.4);">Service</td>
      <td align="right" style="font-size:13px;color:#ffffff;">${serviceLabel}</td>
    </tr></table>`;
};

const _wrapStatusEmail = (body) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding-bottom:32px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:3px;background-color:#e53535;border-radius:2px;">&nbsp;</td>
            <td style="padding-left:12px;font-size:20px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#ffffff;">Herco Detailing Garage</td>
          </tr></table>
        </td></tr>
        ${body}
        <tr><td style="padding-top:32px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.2);">This is an automated email from Herco Detailing Garage.</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const sendBookingInProgressEmail = async ({
  email,
  name,
  referenceCode,
  queueNumber,
  serviceName,
  variantName,
}) => {
  const html = _wrapStatusEmail(`
    <tr><td align="center" style="padding:40px 0 24px;">
      <div style="display:inline-block;background-color:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:50%;width:72px;height:72px;line-height:72px;text-align:center;font-size:28px;">&#9881;</div>
      <p style="margin:16px 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#60a5fa;">In Progress</p>
      <h1 style="margin:0;font-size:32px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">Work Has Started</h1>
      <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;max-width:360px;">Hi ${name}, our team has started working on your motorcycle. We'll notify you once it's done.</p>
    </td></tr>
    <tr><td style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <p style="margin:0 0 16px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Booking Details</p>
      ${_statusEmailBase({
        referenceCode,
        queueNumber,
        serviceName,
        variantName,
      })}
    </td></tr>`);

  const data = await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: 'Herco Detailing Garage', email: 'devglensprt@gmail.com' },
    to: [{ email, name }],
    subject: `Work Has Started - ${referenceCode}`,
    htmlContent: html,
  });
  console.log('[EMAIL] In-progress email sent:', data.messageId);
  return data;
};

const sendBookingDoneEmail = async ({
  email,
  name,
  referenceCode,
  queueNumber,
  serviceName,
  variantName,
}) => {
  const html = _wrapStatusEmail(`
    <tr><td align="center" style="padding:40px 0 24px;">
      <div style="display:inline-block;background-color:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:50%;width:72px;height:72px;line-height:72px;text-align:center;font-size:32px;color:#4ade80;">&#10003;</div>
      <p style="margin:16px 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#4ade80;">Done</p>
      <h1 style="margin:0;font-size:32px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">Your Motorcycle Is Ready!</h1>
      <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;max-width:360px;">Hi ${name}, your motorcycle is ready for pickup. Please come to the garage at your earliest convenience and present your QR code.</p>
    </td></tr>
    <tr><td style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <p style="margin:0 0 16px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Booking Details</p>
      ${_statusEmailBase({
        referenceCode,
        queueNumber,
        serviceName,
        variantName,
      })}
    </td></tr>`);

  const data = await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: 'Herco Detailing Garage', email: 'devglensprt@gmail.com' },
    to: [{ email, name }],
    subject: `Your Motorcycle Is Ready - ${referenceCode}`,
    htmlContent: html,
  });
  console.log('[EMAIL] Done email sent:', data.messageId);
  return data;
};

const sendBookingPickedUpEmail = async ({
  email,
  name,
  referenceCode,
  queueNumber,
  serviceName,
  variantName,
}) => {
  const html = _wrapStatusEmail(`
    <tr><td align="center" style="padding:40px 0 24px;">
      <div style="display:inline-block;background-color:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:50%;width:72px;height:72px;line-height:72px;text-align:center;font-size:24px;color:rgba(255,255,255,0.6);">&#10003;&#10003;</div>
      <p style="margin:16px 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Complete</p>
      <h1 style="margin:0;font-size:32px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">Booking Complete</h1>
      <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;max-width:360px;">Hi ${name}, your motorcycle has been picked up. Thank you for choosing Herco Detailing Garage!</p>
    </td></tr>
    <tr><td style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <p style="margin:0 0 16px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Booking Summary</p>
      ${_statusEmailBase({
        referenceCode,
        queueNumber,
        serviceName,
        variantName,
      })}
    </td></tr>`);

  const data = await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: 'Herco Detailing Garage', email: 'devglensprt@gmail.com' },
    to: [{ email, name }],
    subject: `Booking Complete - ${referenceCode}`,
    htmlContent: html,
  });
  console.log('[EMAIL] Picked-up email sent:', data.messageId);
  return data;
};

module.exports = {
  sendBookingConfirmationEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendBookingInProgressEmail,
  sendBookingDoneEmail,
  sendBookingPickedUpEmail,
};
