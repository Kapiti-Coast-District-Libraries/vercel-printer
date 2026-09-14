import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // Set CORS headers so your frontend can access it
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 1. Fetch homepage to get today's specific word link
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

    // 2. Fetch the word page
    const wordRes = await fetch(`https://kupu.maori.nz/${wordHref}`);
    if (!wordRes.ok) throw new Error(`Failed to fetch word page: ${wordRes.statusText}`);
    const wordHtml = await wordRes.text();
    const $ = cheerio.load(wordHtml);

    // 3. Extract content
    const word = $('h1').first().text().trim() || 'Unknown';
    const translation = $('h2').first().text().trim() || '';

    const examples = [];
    $('.kupu-content, p, .translation, .kupu').each((i, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (
        text &&
        text !== word &&
        text !== translation &&
        !text.includes('Download the PDF') &&
        !text.includes('Another name for') &&
        !text.includes('Learn more about') &&
        text.length > 5 &&
        text.length < 300
      ) {
        if (!examples.includes(text)) {
          examples.push(text);
        }
      }
    });

    return res.status(200).json({
      word,
      translation,
      examples: examples.slice(0, 3)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to scrape Māori Word of the Day: ' + error.message });
  }
}
