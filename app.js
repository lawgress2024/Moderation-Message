const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

// Moderation endpoint
app.post('/api/moderate', async (req, res) => {
  const { message, apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'No API key provided.' });
  }

  const configuration = new Configuration({
    apiKey, // Use the provided API key
  });
  const openai = new OpenAIApi(configuration);

  // Regex patterns for custom content moderation
  const moderationPatterns = [
    { label: 'Email', regex:
/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ },
    { label: 'Phone Number', regex: /\b\d{10,}\b/ },
    { label: 'Credit Card', regex: /\b(?:\d[ -]*?){13,16}\b/ },
    { label: 'PayPal', regex: /\bpaypal\b/i },
    { label: 'Social Media URL', regex:
/(facebook|instagram|twitter|tiktok|linkedin)\.com/i },
    { label: 'Website URL', regex: /\bhttps?:\/\/[^\s]+\b/ }
  ];

  // Check against regex patterns
  const restrictedContent = [];
  moderationPatterns.forEach(({ label, regex }) => {
    if (regex.test(message)) {
      restrictedContent.push(label);
    }
  });

  // If regex-based moderation finds issues, return immediately
  if (restrictedContent.length > 0) {
    return res.json({
      isValid: false,
      flagged: true,
      restrictedContent,
    });
  }

  // Step 2: Check with OpenAI Moderation API
  try {
    const moderationResponse = await openai.createModeration({
      model: 'omni-moderation-latest',
      input: message,
    });

    const results = moderationResponse.data.results[0];
    const flaggedCategories = Object.entries(results.categories)
      .filter(([key, value]) => value)
      .map(([key]) => key);

    res.json({
      isValid: flaggedCategories.length === 0,
      flagged: flaggedCategories.length > 0,
      restrictedContent: flaggedCategories,
      category_scores: results.category_scores,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error processing the moderation request.' });
  }
});

app.listen(port, () => {
  console.log(`Moderation API is running at http://localhost:${port}`);
});
