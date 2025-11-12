import nodemailer from 'nodemailer';
import { marked } from 'marked';

export function createMailer({ host, port, user, pass, from }) {
  if (!host || !port || !user || !pass || !from) {
    throw new Error('SMTP configuration is incomplete.');
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: Number(port) === 465,
    auth: {
      user,
      pass,
    },
  });

  return {
    async send({ to, subject, markdown }) {
      if (!to) {
        throw new Error('Destination email is missing.');
      }
      const html = marked.parse(markdown || '', { mangle: false, headerIds: false });
      await transport.sendMail({
        from,
        to,
        subject,
        html,
        text: markdown,
      });
    },
  };
}
