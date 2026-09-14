import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const homeRes = await fetch('https://kupu.maori.nz/');
    if (!homeRes.ok) throw new Error(`Failed to fetch homepage: ${homeRes.statusText}`);
    const homeHtml = await homeRes.text();
    const $home = cheerio.load(homeHtml);

    let wordHref = null;
    $home('a').each((i, el) => {
      const href = $home(el).attr('href');
      if (href && href.includes('ShowKupu.aspx?kupu=')) {
        if (!wordHref) wordHref = href;
      }
    });

    if (!wordHref) {
      return res.status(404).json({ error: 'Could not locate today link on homepage.' });
    }

    const wordRes = await fetch(`https://kupu.maori.nz/${wordHref}`);
    if (!wordRes.ok) throw new Error(`Failed to fetch word page: ${wordRes.statusText}`);
    const wordHtml = await wordRes.text();
    const $ = cheerio.load(wordHtml);

    const word = $('h1').first().text().trim() || 'Unknown';
    const translation = $('h2').first().text().trim() || '';

    // Collect all paragraphs, bullet items, and text blocks in document order
    const details = [];
    $('p, li, .kupu-content, .kupu').each((i, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (
        text &&
        text !== word &&
        text !== translation &&
        !text.includes('Download the PDF') &&
        !text.includes('Kupu o te Rā') &&
        !text.includes('Copyright') &&
        text.length > 2
      ) {
        if (!details.includes(text)) {
          details.push(text);
        }
      }
    });

    return res.status(200).json({
      word,
      translation,
      details
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to scrape Māori Word of the Day: ' + error.message });
  }
}
