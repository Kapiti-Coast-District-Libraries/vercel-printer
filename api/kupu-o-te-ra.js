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

    const examples = [];
    $('p, li').each((i, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      const lower = text.toLowerCase();

      // Exclude titles, header translations, cross-references, and meta content
      const isUnwanted =
        !text ||
        text === word ||
        text === translation ||
        lower.startsWith('see also') ||
        lower.includes('download the pdf') ||
        lower.includes('kupu o te rā') ||
        lower.includes('copyright') ||
        text.length < 3;

      if (!isUnwanted && !examples.includes(text)) {
        examples.push(text);
      }
    });

    return res.status(200).json({
      word,
      translation,
      examples
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to scrape Māori Word of the Day: ' + error.message });
  }
}
