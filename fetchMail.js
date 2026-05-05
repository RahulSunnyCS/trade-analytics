require("dotenv").config();
const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const {
  loadBrokerAccounts,
  getBroker,
  makeFileName,
} = require("./brokers");

const targetDate = process.env.TARGET_DATE
  ? new Date(process.env.TARGET_DATE)
  : new Date(Date.now() - 24 * 60 * 60 * 1000);
const formattedDate = targetDate.toISOString().slice(0, 10);

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const mailboxes = loadBrokerAccounts();

async function decryptWithQpdf(filePath, password) {
  const decryptedPath = filePath.replace(/\.pdf$/i, "_decrypted.pdf");
  try {
    execSync(
      `qpdf --password='${password}' --decrypt "${filePath}" "${decryptedPath}"`,
      { stdio: "ignore" }
    );
    console.log("🔓 PDF decrypted using qpdf:", decryptedPath);
    return decryptedPath;
  } catch (err) {
    console.error("❌ qpdf failed to decrypt:", filePath, err.message);
    return null;
  }
}

function fetchAttachmentsForSubject(imap, subjectSearch, bodyFilterStr) {
  return new Promise((resolve, reject) => {
    imap.search(
      [["SINCE", formattedDate], ["SUBJECT", subjectSearch]],
      (err, results) => {
        if (err) return reject(err);
        if (!results || !results.length) return resolve([]);

        const attachments = [];
        const parsePromises = [];
        const f = imap.fetch(results, { bodies: "", struct: true });

        f.on("message", (msg) => {
          msg.on("body", (stream) => {
            parsePromises.push(
              simpleParser(stream).then((parsed) => {
                if (bodyFilterStr) {
                  const bodyText = parsed.text || parsed.html || "";
                  if (!bodyText.includes(bodyFilterStr)) return;
                }
                for (const att of parsed.attachments || []) {
                  if (
                    att.filename &&
                    att.filename.toLowerCase().endsWith(".pdf")
                  ) {
                    attachments.push(att);
                  }
                }
              })
            );
          });
        });

        f.once("error", reject);
        f.once("end", async () => {
          try {
            await Promise.all(parsePromises);
            resolve(attachments);
          } catch (err) {
            reject(err);
          }
        });
      }
    );
  });
}

async function processMailbox(mailbox) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: mailbox.email,
      password: mailbox.emailPassword,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", false, async (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        try {
          for (const acc of mailbox.accounts) {
            const broker = getBroker(acc.broker);
            const subjectSearch = broker.subject(acc.accountId, targetDate);
            const bodyFilterStr = broker.bodyFilter
              ? broker.bodyFilter(targetDate)
              : null;
            console.log(
              `🔎 ${mailbox.email} → ${acc.broker}/${acc.accountId}: "${subjectSearch}"${bodyFilterStr ? ` (body filter: "${bodyFilterStr}")` : ""}`
            );

            const attachments = await fetchAttachmentsForSubject(
              imap,
              subjectSearch,
              bodyFilterStr
            );
            if (!attachments.length) {
              console.log(
                `📭 No mail for ${acc.broker}/${acc.accountId} in ${mailbox.email}`
              );
              continue;
            }

            for (const att of attachments) {
              const filename = makeFileName(
                mailbox.email,
                acc.broker,
                acc.accountId,
                att.filename
              );
              const filePath = path.join(dataDir, filename);
              fs.writeFileSync(filePath, att.content);
              console.log(`📎 Saved attachment: ${filename}`);
              await decryptWithQpdf(filePath, acc.pdfPassword);
            }
          }

          console.log(`✅ Finished processing ${mailbox.email}`);
          imap.end();
          resolve();
        } catch (err) {
          imap.end();
          reject(err);
        }
      });
    });

    imap.once("error", (err) => {
      console.error(`❌ IMAP error for ${mailbox.email}: ${err.message}`);
      reject(err);
    });

    imap.connect();
  });
}

(async () => {
  for (const mb of mailboxes) {
    try {
      await processMailbox(mb);
    } catch (err) {
      console.error(`⚠️ Failed for ${mb.email}: ${err.message}`);
    }
  }
})();
