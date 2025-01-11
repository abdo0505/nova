const express = require('express');
const cheerio = require('cheerio');

const app = express();
const port = 3000;

async function getType(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok. Status: ${response.status}`);
        }

        const body = await response.text();
        const $ = cheerio.load(body);

        const downloadText = $('.text .download-text.one-line').text().trim();

        if (downloadText === 'Download XAPK') {
            return 'xapk';
        } else if (downloadText === 'Download APK') {
            return 'apk';
        } else {
            return 'Not found';
        }

    } catch (error) {
        console.error(`Error fetching or processing the page: ${error.message}`);
        return 'Error';
    }
}

async function shortenUrl(url) {
    if (!url) {
        throw new Error("Please provide a URL or link to shorten.");
    }

    try {
        const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 5000 });
        if (!response.ok) {
            throw new Error("Error: Could not generate a short URL.");
        }

        return response.text();
    } catch (error) {
        console.error('Error shortening URL:', error);
        throw error;
    }
}

async function fetchData(app) {
  try {
    const api = `https://apkpure.com/api/v1/search_suggestion_new?key=${encodeURIComponent(app)}&limit=20`;
    const response = await fetch(api, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const appDetails = [];

    for (const app of data) {
      if (app.title && app.packageName && app.fullDownloadUrl) {
        const apkFormat = await getType(app.fullDownloadUrl);
        
        let proxiedUrl;
        if (apkFormat === 'xapk') {
          proxiedUrl = await shortenUrl(`https://translate.google.com/translate?sl=en&tl=fr&hl=en&client=webapp&u=https://d.apkpure.com/b/XAPK/${app.packageName}?version=latest`);
        } else if (apkFormat === 'apk') {
          proxiedUrl = await shortenUrl(`https://translate.google.com/translate?sl=en&tl=fr&hl=en&client=webapp&u=https://d.apkpure.com/b/APK/${app.packageName}?version%3Dlatest`);
        } else {
          proxiedUrl = await shortenUrl(`https://translate.google.com/translate?sl=en&tl=fr&hl=en&client=webapp&u=https://d.apkpure.com/b/APK/${app.packageName}?version%3Dlatest`);
        }

        appDetails.push({
          title: app.title || 'No Title',
          packageName: app.packageName || 'No Package Name',
          downloadLink: app.fullDownloadUrl || 'No Download Link',
          apkformat: apkFormat,
          finalDownloadUrl: proxiedUrl,
          rating: app.score || 'No Rating',
          ratingTotal: app.scoreTotal || 'No Rating Total',
          installTotal: app.installTotal || 'No Install Total',
          fileSizeMB: app.fileSize ? (app.fileSize / (1024 * 1024)).toFixed(2) : 'No File Size',
          version: app.version || 'No Version',
          versionCode: app.versionCode || 'No Version Code',
          tags: app.tags ? app.tags.map(tag => tag.name).join(', ') : 'No tags',
          iconUrl: app.icon || 'No Icon'
        });
      }
    }

    return appDetails;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

app.get('/api/apkpure', async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: 'Please provide a search query parameter `q`.' });
  }

  try {
    const appDetails = await fetchData(query);
    res.json(appDetails);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching data.' });
  }
});

app.get('/', (req, res) => {
    res.send('Use /api/apkpure?q=<query> to search for app data.');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
