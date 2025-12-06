import nodemailer from "nodemailer";

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Send notification email
export async function sendElasticsearchSyncNotification(
  success: boolean,
  details: {
    totalProducts?: number;
    syncedProducts?: number;
    failedProducts?: number;
    error?: string;
    duration?: number;
  }
) {
  try {
    const transporter = createTransporter();
    const adminEmail = "nkipniak@gmail.com";

    const subject = success
      ? "✅ Elasticsearch Sync Successful"
      : "❌ Elasticsearch Sync Failed";

    const htmlContent = success
      ? `
        <h2>Elasticsearch Sync Completed Successfully</h2>
        <p><strong>Total Products:</strong> ${details.totalProducts || 0}</p>
        <p><strong>Synced Products:</strong> ${details.syncedProducts || 0}</p>
        <p><strong>Duration:</strong> ${details.duration ? `${details.duration}ms` : "N/A"}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      `
      : `
        <h2>Elasticsearch Sync Failed</h2>
        <p><strong>Error:</strong> ${details.error || "Unknown error"}</p>
        <p><strong>Total Products:</strong> ${details.totalProducts || 0}</p>
        <p><strong>Synced Products:</strong> ${details.syncedProducts || 0}</p>
        <p><strong>Failed Products:</strong> ${details.failedProducts || 0}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: adminEmail,
      subject,
      html: htmlContent,
    });

    console.log(`📧 Email notification sent to ${adminEmail}`);
  } catch (error) {
    console.error("❌ Failed to send email notification:", error);
  }
}

// Send product sync failure notification
export async function sendProductSyncFailureNotification(
  productId: number,
  productTitle: string,
  error: string
) {
  try {
    const transporter = createTransporter();
    const adminEmail = "nkipniak@gmail.com";

    const subject = `❌ Product Sync Failed: ${productTitle}`;

    const htmlContent = `
      <h2>Product Elasticsearch Sync Failed</h2>
      <p><strong>Product ID:</strong> ${productId}</p>
      <p><strong>Product Title:</strong> ${productTitle}</p>
      <p><strong>Error:</strong> ${error}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <p><strong>Environment:</strong> ${process.env.NODE_ENV || "development"}</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: adminEmail,
      subject,
      html: htmlContent,
    });

    console.log(`📧 Product sync failure notification sent to ${adminEmail}`);
  } catch (error) {
    console.error(
      "❌ Failed to send product sync failure notification:",
      error
    );
  }
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Send chat message notification email
export async function sendChatMessageNotification(
  strapi: any,
  recipientEmail: string,
  senderName: string,
  chatTopic: string,
  messageText: string,
  chatId: number
) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const chatUrl = `${frontendUrl}/chat?chatId=${chatId}`;

    // Escape HTML to prevent XSS
    const safeSenderName = escapeHtml(senderName);
    const safeChatTopic = escapeHtml(chatTopic);
    const safeMessageText = escapeHtml(messageText);

    const subject = `Нове повідомлення в чаті: ${safeChatTopic}`;

    // Truncate message text if too long
    const truncatedMessage =
      safeMessageText.length > 150
        ? safeMessageText.substring(0, 150) + "..."
        : safeMessageText;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4f46e5;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9fafb;
            padding: 20px;
            border-radius: 0 0 5px 5px;
          }
          .message-box {
            background-color: white;
            padding: 15px;
            border-left: 4px solid #4f46e5;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4f46e5;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
          }
          .footer {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Нове повідомлення в чаті</h1>
          </div>
          <div class="content">
            <p>Привіт!</p>
            <p>Ви отримали нове повідомлення від <strong>${safeSenderName}</strong> в чаті <strong>"${safeChatTopic}"</strong>.</p>
            
            <div class="message-box">
              <p><strong>Повідомлення:</strong></p>
              <p>${truncatedMessage.replace(/\n/g, "<br>")}</p>
            </div>
            
            <a href="${chatUrl}" class="button">Переглянути повідомлення</a>
            
            <div class="footer">
              <p>Це автоматичне повідомлення. Будь ласка, не відповідайте на цей email.</p>
              <p>Якщо у вас виникли питання, відповідайте напряму в чаті.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Нове повідомлення в чаті

Привіт!

Ви отримали нове повідомлення від ${safeSenderName} в чаті "${safeChatTopic}".

Повідомлення:
${safeMessageText}

Переглянути повідомлення: ${chatUrl}

Це автоматичне повідомлення. Будь ласка, не відповідайте на цей email.
    `;

    strapi.log.info(`📧 Attempting to send chat message email to ${recipientEmail}`);
    console.log(`[EMAIL-SEND] 📧 Attempting to send chat message email to ${recipientEmail}`);
    
    await strapi.plugins.email.services.email.send({
      to: recipientEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });

    strapi.log.info(`✅ Chat message notification sent successfully to ${recipientEmail}`);
    console.log(`[EMAIL-SEND] ✅ Chat message notification sent successfully to ${recipientEmail}`);
  } catch (error) {
    strapi.log.error("❌ Failed to send chat message notification:", error);
    console.error("[EMAIL-SEND] ❌ Failed to send chat message notification:", error);
    // Не выбрасываем ошибку, чтобы не прерывать отправку сообщения
  }
}
