require("dotenv").config();
const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// 🎯 Determine which date to process
// If TARGET_DATE env var is provided (YYYY-MM-DD), use that.
// Otherwise default to yesterday.
const targetDateStr = process.env.TARGET_DATE;
const dateSince = targetDateStr
  ? new Date(targetDateStr)
  : new Date(Date.now() - 24 * 60 * 60 * 1000);
const formattedDate = dateSince.toISOString().slice(0, 10);

// 📁 Ensure 'data' folder exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// 📦 Parse from .env
const emails = process.env.EMAILS.split(",");
const passwords = process.env.PASSWORDS.split(",");
const accountIds = process.env.ACCOUNT_IDS.split(",");
const pdfPasswords = process.env.PDF_PASSWORDS.split(",");

// 🧪 Sanity check
if (
  emails.length !== passwords.length ||
  emails.length !== accountIds.length ||
  emails.length !== pdfPasswords.length
) {
  throw new Error(
    "EMAILS, PASSWORDS, ACCOUNT_IDS, and PDF_PASSWORDS must be of the same length in .env"
  );
}

const accounts = emails.map((email, i) => ({
  email,
  password: passwords[i],
  accountId: accountIds[i],
  pdfPassword: pdfPasswords[i],
}));

async function decryptWithQpdf(filePath, password) {
  const decryptedPath = filePath.replace(/\.pdf$/i, "_decrypted.pdf");

  try {
    execSync(
      `qpdf --password='${password}' --decrypt "${filePath}" "${decryptedPath}"`,
      {
        stdio: "ignore",
      }
    );
    console.log("🔓 PDF decrypted using qpdf:", decryptedPath);
    return decryptedPath;
  } catch (err) {
    console.error("❌ qpdf failed to decrypt:", filePath, err.message);
    return null;
  }
}

async function processAccount(account) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: account.email,
      password: account.password,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    function openInbox(cb) {
      imap.openBox("INBOX", false, cb);
    }

    imap.once("ready", () => {
      openInbox((err, box) => {
        if (err) return reject(err);

        const formattedDateForSubject = dateSince
          .toLocaleDateString("en-GB")
          .split("/")
          .join("-");

        const subjectSearch = `Combined Contract Note for ${account.accountId} ${formattedDateForSubject}`;

        imap.search(
          [
            ["SINCE", formattedDate],
            ["SUBJECT", subjectSearch],
          ],
          (err, results) => {
            if (err) return reject(err);
            if (!results.length) {
              console.log(
                `📭 No emails found for ${account.email} with account ID ${account.accountId}`
              );
              imap.end();
              return resolve();
            }

            const f = imap.fetch(results, { bodies: "", struct: true });

            f.on("message", (msg) => {
              msg.on("body", (stream) => {
                simpleParser(stream, async (err, parsed) => {
                  const attachments = parsed.attachments || [];
                  for (const attachment of attachments) {
                    if (attachment.filename.toLowerCase().endsWith(".pdf")) {
                      const filename = `${account.email.replace(
                        /[@.]/g,
                        "_"
                      )}_${attachment.filename}`;
                      const filePath = path.join(dataDir, filename);
                      fs.writeFileSync(filePath, attachment.content);
                      console.log(`📎 Saved attachment: ${filename}`);

                      const decryptedPath = await decryptWithQpdf(
                        filePath,
                        account.pdfPassword
                      );
                      if (!decryptedPath) {
                        console.warn(
                          `⚠️ Could not decrypt PDF for ${account.email}`
                        );
                      }
                    }
                  }
                });
              });
            });

            f.once("end", () => {
              console.log(`✅ Finished processing ${account.email}`);
              imap.end();
              resolve();
            });
          }
        );
      });
    });

    imap.once("error", (err) => {
      console.error(`❌ IMAP error for ${account.email}: ${err.message}`);
      reject(err);
    });

    imap.connect();
  });
}

(async () => {
  for (const acc of accounts) {
    try {
      await processAccount(acc);
    } catch (err) {
      console.error(`⚠️ Failed for ${acc.email}: ${err.message}`);
    }
  }
})();
