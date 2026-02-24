import dotenv from "dotenv";
import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

dotenv.config();

type Account = {
  email: string;
  password: string;
  accountId: string;
  pdfPassword: string;
};

const targetDate = process.env.TARGET_DATE
  ? new Date(process.env.TARGET_DATE)
  : new Date(Date.now() - 24 * 60 * 60 * 1000);
const formattedDate = targetDate.toISOString().slice(0, 10);

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const emails = (process.env.EMAILS || "").split(",").filter(Boolean);
const passwords = (process.env.PASSWORDS || "").split(",").filter(Boolean);
const accountIds = (process.env.ACCOUNT_IDS || "").split(",").filter(Boolean);
const pdfPasswords = (process.env.PDF_PASSWORDS || "").split(",").filter(Boolean);

if (
  emails.length !== passwords.length ||
  emails.length !== accountIds.length ||
  emails.length !== pdfPasswords.length
) {
  throw new Error(
    "EMAILS, PASSWORDS, ACCOUNT_IDS, and PDF_PASSWORDS must be of the same length in .env"
  );
}

const accounts: Account[] = emails.map((email, i) => ({
  email,
  password: passwords[i],
  accountId: accountIds[i],
  pdfPassword: pdfPasswords[i],
}));

async function decryptWithQpdf(filePath: string, password: string): Promise<string | null> {
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
    console.error("❌ qpdf failed to decrypt:", filePath, (err as Error).message);
    return null;
  }
}

async function processAccount(account: Account): Promise<void> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: account.email,
      password: account.password,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    function openInbox(cb: (err: Error | null, box: Imap.Box) => void): void {
      imap.openBox("INBOX", false, cb);
    }

    imap.once("ready", () => {
      openInbox((err) => {
        if (err) return reject(err);

        const formattedDateForSubject = targetDate
          .toLocaleDateString("en-GB")
          .split("/")
          .join("-");

        const subjectSearch = `Combined Contract Note for ${account.accountId} ${formattedDateForSubject}`;

        imap.search(
          [
            ["SINCE", formattedDate],
            ["SUBJECT", subjectSearch],
          ],
          (searchErr, results) => {
            if (searchErr) return reject(searchErr);
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
                simpleParser(stream, async (parseErr: Error | null, parsed: ParsedMail) => {
                  if (parseErr) {
                    console.error(`❌ Failed to parse message for ${account.email}: ${parseErr.message}`);
                    return;
                  }
                  const attachments = parsed.attachments || [];
                  for (const attachment of attachments) {
                    if (attachment.filename?.toLowerCase().endsWith(".pdf")) {
                      const filename = `${account.email.replace(/[@.]/g, "_")}_${attachment.filename}`;
                      const filePath = path.join(dataDir, filename);
                      fs.writeFileSync(filePath, attachment.content);
                      console.log(`📎 Saved attachment: ${filename}`);

                      const decryptedPath = await decryptWithQpdf(filePath, account.pdfPassword);
                      if (!decryptedPath) {
                        console.warn(`⚠️ Could not decrypt PDF for ${account.email}`);
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

    imap.once("error", (imapErr: Error) => {
      console.error(`❌ IMAP error for ${account.email}: ${imapErr.message}`);
      reject(imapErr);
    });

    imap.connect();
  });
}

(async () => {
  for (const acc of accounts) {
    try {
      await processAccount(acc);
    } catch (err) {
      console.error(`⚠️ Failed for ${acc.email}: ${(err as Error).message}`);
    }
  }
})();
