import puppeteer from '@cloudflare/puppeteer';
import { Env } from '../../util';

export class BrowserService {
  constructor(private env: Env) {}

  async generatePDF(url: string): Promise<ArrayBuffer> {
    if (!this.env.BROWSER) {
      throw new Error('Browser Rendering is not configured');
    }

    const browser = await puppeteer.launch(this.env.BROWSER);
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0' });
      // Use arrayBuffer() representation if page.pdf returns Uint8Array or Buffer in Workers
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      return pdfBuffer as unknown as ArrayBuffer;
    } finally {
      await browser.close();
    }
  }

  // Future features: screenshot, portfolio, certificate
}
