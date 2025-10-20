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
        <p><strong>Duration:</strong> ${details.duration ? `${details.duration}ms` : 'N/A'}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      `
      : `
        <h2>Elasticsearch Sync Failed</h2>
        <p><strong>Error:</strong> ${details.error || 'Unknown error'}</p>
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
      <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: adminEmail,
      subject,
      html: htmlContent,
    });

    console.log(`📧 Product sync failure notification sent to ${adminEmail}`);
  } catch (error) {
    console.error("❌ Failed to send product sync failure notification:", error);
  }
}
